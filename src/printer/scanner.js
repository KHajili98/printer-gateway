'use strict';

const net = require('net');

function scanHost(ip, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve({ ip, port, name: 'POS Printer' });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function scanSubnet(subnet, port = 9100, concurrency = 50) {
  const start = Date.now();
  const hosts = [];

  for (let i = 1; i <= 254; i += 1) {
    hosts.push(`${subnet}${i}`);
  }

  const found = [];

  for (let i = 0; i < hosts.length; i += concurrency) {
    const batch = hosts.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((ip) => scanHost(ip, port)));
    found.push(...results.filter(Boolean));
  }

  return {
    found,
    subnet,
    scanDurationMs: Date.now() - start,
  };
}

module.exports = { scanSubnet, scanHost };
