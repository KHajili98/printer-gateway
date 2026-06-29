'use strict';

const { config } = require('./config');
const { logger, logStartup } = require('./middleware/logger');
const { startHttpServer } = require('./server/http');
const { WsClient } = require('./server/ws-client');

const wsClient = new WsClient();
let httpServer = null;

function applyMode() {
  const mode = config.mode.toLowerCase();

  if (mode === 'websocket' || mode === 'both') {
    logger.info({ mode }, 'WebSocket rejimi aktivlesdirilir');
    wsClient.start();
  } else {
    logger.info({ mode }, 'WebSocket rejimi deaktiv');
    wsClient.stop();
  }
}

function start() {
  logStartup(config);

  const mode = config.mode.toLowerCase();

  if (mode === 'http' || mode === 'both') {
    httpServer = startHttpServer({
      onConfigSaved: () => {
        logger.info('konfiqurasiya yenilendi, rejimler yeniden tetbiq olunur');
        applyMode();
      },
    });
  }

  applyMode();

  if (mode !== 'http' && mode !== 'websocket' && mode !== 'both') {
    logger.error({ mode }, 'sehv MODE — http, websocket ve ya both olmalidir');
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info({ signal }, 'servis dayandirilir');
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

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'gozlenilmeyen xeta');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'handle edilmeyen promise xetasi');
});

start();
