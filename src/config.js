'use strict';

const fs = require('fs');
const path = require('path');
const { ensureEnvFile } = require('./config-manager');
const { getAppRoot } = require('./paths');

ensureEnvFile();
require('dotenv').config({ path: path.join(getAppRoot(), '.env') });

const PRINTERS_PATH = path.join(getAppRoot(), 'config', 'printers.json');

function loadPrintersConfig() {
  try {
    const raw = fs.readFileSync(PRINTERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      main: {
        name: 'Main printer',
        ip: process.env.MAIN_PRINTER_IP || '192.168.1.50',
        port: Number(process.env.MAIN_PRINTER_PORT) || 9100,
      },
      workers: [],
    };
  }
}

const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.PRINT_GATEWAY_API_KEY || '',
  mode: process.env.MODE || 'both',
  backendWsUrl: process.env.BACKEND_WS_URL || '',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  locationId: process.env.LOCATION_ID || '1',
  scanSubnet: process.env.SCAN_SUBNET || '192.168.1.',
  scanPort: Number(process.env.SCAN_PORT) || 9100,
  printRetryCount: Number(process.env.PRINT_RETRY_COUNT) || 3,
  printRetryDelayMs: Number(process.env.PRINT_RETRY_DELAY_MS) || 2000,
  wsHeartbeatMs: Number(process.env.WS_HEARTBEAT_MS) || 30000,
  printers: loadPrintersConfig(),
  reloadPrinters() {
    this.printers = loadPrintersConfig();
  },
};

function resolveTarget(target = { type: 'main' }) {
  const { printers } = config;

  switch (target.type) {
    case 'main':
      if (!printers.main?.ip) {
        throw new Error('Main printer is not configured.');
      }
      return {
        ip: printers.main.ip,
        port: printers.main.port || 9100,
        name: printers.main.name || 'main',
      };

    case 'ip':
      if (!target.ip) {
        throw new Error('Target IP is required.');
      }
      return {
        ip: target.ip,
        port: target.port || 9100,
        name: target.name || target.ip,
      };

    case 'name': {
      if (!target.name) {
        throw new Error('Target name is required.');
      }
      const worker = (printers.workers || []).find(
        (w) => w.name.toLowerCase() === target.name.toLowerCase()
      );
      if (!worker) {
        throw new Error(`Printer "${target.name}" not found.`);
      }
      return {
        ip: worker.ip,
        port: worker.port || 9100,
        name: worker.name,
      };
    }

    default:
      throw new Error(`Unknown target type: ${target.type}`);
  }
}

module.exports = { config, resolveTarget, PRINTERS_PATH };
