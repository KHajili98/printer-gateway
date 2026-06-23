'use strict';

const net = require('net');
const { buildPayload } = require('./escpos');

const DEFAULT_TIMEOUT_MS = 5000;

function sendToPrinter(text, ip, port = 9100, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const payload = buildPayload(text);
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port });

    const cleanup = () => {
      socket.removeAllListeners();
    };

    const timer = setTimeout(() => {
      socket.destroy();
      const err = new Error('timeout');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);

    socket.on('connect', () => {
      socket.write(payload, (writeErr) => {
        clearTimeout(timer);
        socket.end();
        cleanup();

        if (writeErr) {
          reject(writeErr);
          return;
        }

        resolve({
          status: 200,
          durationMs: Date.now() - start,
        });
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
  });
}

function isPrinterReachable(ip, port = 9100, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port });

    const done = (reachable) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(reachable);
    };

    const timer = setTimeout(() => done(false), timeoutMs);

    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

module.exports = { sendToPrinter, isPrinterReachable, DEFAULT_TIMEOUT_MS };
