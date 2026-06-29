'use strict';

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { isPackaged } = require('../paths');
const { getAppRoot } = require('../paths');
const { getLocalNetworks } = require('../utils/network-info');

const LOG_PATH = path.join(getAppRoot(), 'gateway.log');
const usePretty = !isPackaged() && process.env.NODE_ENV !== 'production';

const streams = [{ stream: process.stdout }];

try {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  streams.push({ stream: fs.createWriteStream(LOG_PATH, { flags: 'a' }) });
} catch {
  // fayla yazmaq mümkün olmasa yalnız stdout
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization', 'body.text', 'payload.text', 'token', 'gatewayToken', 'apiKey'],
    ...(usePretty
      ? {
          transport: {
            targets: [
              { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
              { target: 'pino/file', options: { destination: LOG_PATH, mkdir: true } },
            ],
          },
        }
      : {}),
  },
  usePretty ? undefined : pino.multistream(streams)
);

function logPrintRequest(req, meta = {}) {
  logger.info(
    {
      requestId: req.headers['x-request-id'],
      receiptType: meta.receipt_type,
      tableId: meta.table_id,
      source: meta.source,
      targetType: meta.targetType,
      printerIp: meta.printerIp,
    },
    'cap sorğusu alindi'
  );
}

function logHttpRequest(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        ip: req.ip,
      },
      `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${durationMs}ms)`
    );
  });

  next();
}

function logStartup(config) {
  const networks = getLocalNetworks();

  logger.info('=== Print Gateway baslayir ===');
  logger.info(
    {
      port: config.port,
      mode: config.mode,
      locationId: config.locationId,
      scanSubnet: config.scanSubnet,
      scanPort: config.scanPort,
      mainPrinter: config.printers?.main
        ? { name: config.printers.main.name, ip: config.printers.main.ip, port: config.printers.main.port }
        : null,
      workerCount: config.printers?.workers?.length || 0,
      wsConfigured: Boolean(config.backendWsUrl && config.gatewayToken),
      apiKeyConfigured: Boolean(config.apiKey),
      logFile: LOG_PATH,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    'konfiqurasiya'
  );

  if (networks.length === 0) {
    logger.warn('lokal IPv4 sebeke tapilmadi — WiFi/Ethernet yoxlayin');
  } else {
    for (const net of networks) {
      logger.info(
        { interface: net.interface, ip: net.ip, subnet: net.subnet, netmask: net.netmask },
        `lokal sebeke: ${net.interface} -> ${net.ip} (subnet: ${net.subnet})`
      );
    }
  }

  logger.info({ setupUrl: `http://localhost:${config.port}/setup` }, 'setup paneli hazirdir');
}

function logNetworkContext(context, subnet, port) {
  const networks = getLocalNetworks();
  logger.info(
    {
      context,
      scanSubnet: subnet,
      scanPort: port,
      localNetworks: networks,
    },
    `[${context}] sebeke veziyyeti: PC ${networks.map((n) => n.ip).join(', ') || 'tapilmadi'} | scan: ${subnet}:${port}`
  );
}

module.exports = {
  logger,
  LOG_PATH,
  logPrintRequest,
  logHttpRequest,
  logStartup,
  logNetworkContext,
};
