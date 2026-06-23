'use strict';

const WebSocket = require('ws');
const { config } = require('../config');
const { logger } = require('../middleware/logger');
const { isPrinterReachable } = require('../printer/tcp-sender');
const { executePrint, formatPrintError } = require('../jobs/processor');

class WsClient {
  constructor() {
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectDelayMs = 3000;
    this.shouldRun = false;
  }

  start() {
    if (!config.backendWsUrl || !config.gatewayToken) {
      logger.warn('WebSocket mode disabled: BACKEND_WS_URL or GATEWAY_TOKEN missing');
      return;
    }

    this.shouldRun = true;
    this.connect();
  }

  stop() {
    this.shouldRun = false;
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.reconnectTimer);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  buildUrl() {
    const url = new URL(config.backendWsUrl);
    url.searchParams.set('token', config.gatewayToken);
    url.searchParams.set('location_id', config.locationId);
    return url.toString();
  }

  connect() {
    if (!this.shouldRun) return;

    const url = this.buildUrl();
    logger.info({ url: config.backendWsUrl }, 'connecting to backend WebSocket');

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('WebSocket connected');
      this.reconnectDelayMs = 3000;
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      logger.warn('WebSocket disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ err: err.message }, 'WebSocket error');
    });
  }

  scheduleReconnect() {
    if (!this.shouldRun) return;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 60000);
    }, this.reconnectDelayMs);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, config.wsHeartbeatMs);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async getPrintersStatus() {
    const { main, workers = [] } = config.printers;

    const mainStatus = main?.ip
      ? await isPrinterReachable(main.ip, main.port || 9100)
      : false;

    const workerStatuses = await Promise.all(
      workers.map(async (w) => ({
        name: w.name,
        ip: w.ip,
        reachable: await isPrinterReachable(w.ip, w.port || 9100),
      }))
    );

    return { main: mainStatus, workers: workerStatuses };
  }

  async sendHeartbeat() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const printersStatus = await this.getPrintersStatus();
    this.send({
      type: 'heartbeat',
      printers_status: printersStatus,
    });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  async handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      logger.warn('invalid WebSocket message');
      return;
    }

    if (message.type !== 'print_job') return;

    const { job_id: jobId, payload } = message;
    logger.info({ jobId, meta: payload?.meta }, 'received print job');

    try {
      const result = await executePrint({
        text: payload.text,
        target: payload.target || { type: 'main' },
      });

      this.send({
        type: 'print_result',
        job_id: jobId,
        success: true,
        status_code: 200,
        message: result.message,
        printer: result.printer,
        duration_ms: result.durationMs,
      });
    } catch (err) {
      const error = formatPrintError(err);
      this.send({
        type: 'print_result',
        job_id: jobId,
        success: false,
        status_code: 502,
        message: error.message,
        error: error.error,
      });
    }
  }
}

module.exports = { WsClient };
