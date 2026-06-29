'use strict';

const net = require('net');
const { buildPayload } = require('./escpos');
const { logger } = require('../middleware/logger');

const DEFAULT_TIMEOUT_MS = 5000;

function sendToPrinter(text, ip, port = 9100, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const payload = buildPayload(text);
  const start = Date.now();
  const textLength = text?.length || 0;
  const payloadBytes = payload.length;

  logger.info(
    { ip, port, textLength, payloadBytes, timeoutMs },
    `cap: ${ip}:${port}-a gonderilir (${textLength} simvol, ${payloadBytes} byte)`
  );

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port });

    const cleanup = () => {
      socket.removeAllListeners();
    };

    const timer = setTimeout(() => {
      socket.destroy();
      const err = new Error('timeout');
      err.code = 'ETIMEDOUT';
      logger.error(
        { ip, port, timeoutMs, elapsedMs: Date.now() - start },
        `cap: ${ip}:${port} — timeout (${timeoutMs}ms), printer cavab vermir`
      );
      reject(err);
    }, timeoutMs);

    socket.on('connect', () => {
      logger.info({ ip, port }, `cap: ${ip}:${port} — qoşuldu, melumat yazilir`);
      socket.write(payload, (writeErr) => {
        clearTimeout(timer);
        socket.end();
        cleanup();

        if (writeErr) {
          logger.error({ ip, port, error: writeErr.message }, `cap: ${ip}:${port} — yazma xetasi`);
          reject(writeErr);
          return;
        }

        const durationMs = Date.now() - start;
        logger.info({ ip, port, durationMs, payloadBytes }, `cap: ${ip}:${port} — ugurlu (${durationMs}ms)`);
        resolve({ status: 200, durationMs });
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      logger.error(
        { ip, port, error: err.code || err.message, elapsedMs: Date.now() - start },
        `cap: ${ip}:${port} — qoşulma xetasi: ${err.code || err.message}`
      );
      reject(err);
    });
  });
}

function isPrinterReachable(ip, port = 9100, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host: ip, port });

    const done = (reachable) => {
      clearTimeout(timer);
      socket.destroy();
      const durationMs = Date.now() - start;
      logger.debug(
        { ip, port, reachable, durationMs },
        reachable ? `reachability: ${ip}:${port} online` : `reachability: ${ip}:${port} offline`
      );
      resolve(reachable);
    };

    const timer = setTimeout(() => done(false), timeoutMs);

    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

module.exports = { sendToPrinter, isPrinterReachable, DEFAULT_TIMEOUT_MS };
