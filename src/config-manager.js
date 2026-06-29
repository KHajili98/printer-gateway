'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getAppRoot, getResourcePath, seedRuntimeFiles } = require('./paths');

const ROOT = getAppRoot();
seedRuntimeFiles(ROOT);

const ENV_PATH = path.join(ROOT, '.env');
const ENV_EXAMPLE_PATH = fs.existsSync(path.join(ROOT, '.env.example'))
  ? path.join(ROOT, '.env.example')
  : getResourcePath('.env.example');
const PRINTERS_PATH = path.join(ROOT, 'config', 'printers.json');

const ENV_KEYS = [
  'PORT',
  'NODE_ENV',
  'PRINT_GATEWAY_API_KEY',
  'BACKEND_WS_URL',
  'GATEWAY_TOKEN',
  'LOCATION_ID',
  'MODE',
  'MAIN_PRINTER_IP',
  'MAIN_PRINTER_PORT',
  'SCAN_SUBNET',
  'SCAN_PORT',
  'PRINT_RETRY_COUNT',
  'PRINT_RETRY_DELAY_MS',
  'WS_HEARTBEAT_MS',
];

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function serializeEnvFile(values, templateContent) {
  const lines = templateContent.split('\n');
  const written = new Set();

  const output = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (values[key] !== undefined) {
      written.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });

  for (const key of ENV_KEYS) {
    if (!written.has(key) && values[key] !== undefined) {
      output.push(`${key}=${values[key]}`);
    }
  }

  return `${output.join('\n').replace(/\n+$/, '')}\n`;
}

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return parseEnvFile(fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8'));
  }
  return parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8'));
}

function writeEnvFile(values) {
  const template = fs.existsSync(ENV_EXAMPLE_PATH)
    ? fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8')
    : ENV_KEYS.map((k) => `${k}=`).join('\n');
  fs.writeFileSync(ENV_PATH, serializeEnvFile(values, template), 'utf8');
}

function readPrintersFile() {
  try {
    return JSON.parse(fs.readFileSync(PRINTERS_PATH, 'utf8'));
  } catch {
    return { main: { name: 'Kassa printer', ip: '', port: 9100 }, workers: [] };
  }
}

function writePrintersFile(printers) {
  fs.mkdirSync(path.dirname(PRINTERS_PATH), { recursive: true });
  fs.writeFileSync(PRINTERS_PATH, `${JSON.stringify(printers, null, 2)}\n`, 'utf8');
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function detectLocalSubnet() {
  const nets = os.networkInterfaces();
  const { logger } = require('./middleware/logger');
  const found = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        const parts = net.address.split('.');
        if (parts.length === 4) {
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.`;
          found.push({ interface: name, ip: net.address, subnet });
        }
      }
    }
  }

  if (found.length > 0) {
    logger.debug({ networks: found }, 'lokal subnet avtomatik tapildi');
    return found[0].subnet;
  }

  logger.warn('lokal subnet tapilmadi, default 192.168.1. istifade olunur');
  return '192.168.1.';
}

function getFullConfig() {
  const env = readEnvFile();
  const printers = readPrintersFile();

  return {
    port: Number(env.PORT) || 3000,
    nodeEnv: env.NODE_ENV || 'production',
    apiKey: env.PRINT_GATEWAY_API_KEY || '',
    mode: env.MODE || 'both',
    backendWsUrl: env.BACKEND_WS_URL || '',
    gatewayToken: env.GATEWAY_TOKEN || '',
    locationId: env.LOCATION_ID || '1',
    scanSubnet: env.SCAN_SUBNET || detectLocalSubnet(),
    scanPort: Number(env.SCAN_PORT) || 9100,
    printRetryCount: Number(env.PRINT_RETRY_COUNT) || 3,
    printRetryDelayMs: Number(env.PRINT_RETRY_DELAY_MS) || 2000,
    wsHeartbeatMs: Number(env.WS_HEARTBEAT_MS) || 30000,
    printers,
  };
}

function getSetupView() {
  const full = getFullConfig();
  const apiKey = full.apiKey;
  return {
    ...full,
    apiKey,
    apiKeyMasked: apiKey ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : '',
    detectedSubnet: detectLocalSubnet(),
    configured: Boolean(apiKey && apiKey !== 'change-me-long-random-string'),
  };
}

function saveSetupConfig(payload) {
  const current = readEnvFile();
  const printers = payload.printers || readPrintersFile();

  if (printers.main) {
    printers.main.port = Number(printers.main.port) || 9100;
  }
  printers.workers = (printers.workers || []).map((w) => ({
    name: w.name || 'Worker',
    ip: w.ip || '',
    port: Number(w.port) || 9100,
  }));

  writePrintersFile(printers);

  const envValues = {
    ...current,
    PORT: String(payload.port || current.PORT || 3000),
    NODE_ENV: 'production',
    PRINT_GATEWAY_API_KEY: payload.apiKey || current.PRINT_GATEWAY_API_KEY || generateApiKey(),
    BACKEND_WS_URL: payload.backendWsUrl ?? current.BACKEND_WS_URL ?? '',
    GATEWAY_TOKEN: payload.gatewayToken ?? current.GATEWAY_TOKEN ?? '',
    LOCATION_ID: String(payload.locationId ?? current.LOCATION_ID ?? '1'),
    MODE: payload.mode || current.MODE || 'both',
    MAIN_PRINTER_IP: printers.main?.ip || '',
    MAIN_PRINTER_PORT: String(printers.main?.port || 9100),
    SCAN_SUBNET: payload.scanSubnet || current.SCAN_SUBNET || detectLocalSubnet(),
    SCAN_PORT: String(payload.scanPort || current.SCAN_PORT || 9100),
    PRINT_RETRY_COUNT: String(payload.printRetryCount || current.PRINT_RETRY_COUNT || 3),
    PRINT_RETRY_DELAY_MS: String(payload.printRetryDelayMs || current.PRINT_RETRY_DELAY_MS || 2000),
    WS_HEARTBEAT_MS: String(payload.wsHeartbeatMs || current.WS_HEARTBEAT_MS || 30000),
  };

  writeEnvFile(envValues);
  return getSetupView();
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return readEnvFile();

  const values = parseEnvFile(fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8'));
  values.PRINT_GATEWAY_API_KEY = generateApiKey();
  values.SCAN_SUBNET = detectLocalSubnet();
  writeEnvFile(values);
  return values;
}

function applyEnvToProcess(env) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function reloadRuntimeConfig(configModule) {
  const env = readEnvFile();
  applyEnvToProcess(env);
  configModule.config.port = Number(env.PORT) || 3000;
  configModule.config.nodeEnv = env.NODE_ENV || 'production';
  configModule.config.apiKey = env.PRINT_GATEWAY_API_KEY || '';
  configModule.config.mode = env.MODE || 'both';
  configModule.config.backendWsUrl = env.BACKEND_WS_URL || '';
  configModule.config.gatewayToken = env.GATEWAY_TOKEN || '';
  configModule.config.locationId = env.LOCATION_ID || '1';
  configModule.config.scanSubnet = env.SCAN_SUBNET || detectLocalSubnet();
  configModule.config.scanPort = Number(env.SCAN_PORT) || 9100;
  configModule.config.printRetryCount = Number(env.PRINT_RETRY_COUNT) || 3;
  configModule.config.printRetryDelayMs = Number(env.PRINT_RETRY_DELAY_MS) || 2000;
  configModule.config.wsHeartbeatMs = Number(env.WS_HEARTBEAT_MS) || 30000;
  configModule.config.reloadPrinters();
}

module.exports = {
  ROOT,
  ENV_PATH,
  PRINTERS_PATH,
  readEnvFile,
  writeEnvFile,
  readPrintersFile,
  writePrintersFile,
  generateApiKey,
  detectLocalSubnet,
  getFullConfig,
  getSetupView,
  saveSetupConfig,
  ensureEnvFile,
  reloadRuntimeConfig,
};
