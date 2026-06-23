'use strict';

const { config } = require('./config');
const { logger } = require('./middleware/logger');
const { startHttpServer } = require('./server/http');
const { WsClient } = require('./server/ws-client');

const wsClient = new WsClient();
let httpServer = null;

function applyMode() {
  const mode = config.mode.toLowerCase();

  if (mode === 'websocket' || mode === 'both') {
    wsClient.start();
  } else {
    wsClient.stop();
  }
}

function start() {
  const mode = config.mode.toLowerCase();
  logger.info({ mode, locationId: config.locationId }, 'starting print gateway');

  if (mode === 'http' || mode === 'both') {
    httpServer = startHttpServer({
      onConfigSaved: () => {
        applyMode();
      },
    });
  }

  applyMode();

  if (mode !== 'http' && mode !== 'websocket' && mode !== 'both') {
    logger.error({ mode }, 'invalid MODE; use http, websocket, or both');
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  wsClient.stop();

  if (httpServer) {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
