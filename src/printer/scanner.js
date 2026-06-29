'use strict';

const net = require('net');
const { logger } = require('../middleware/logger');
const {
  validateSubnet,
  compareSubnetWithLocal,
  buildScanHints,
} = require('../utils/network-info');

function scanHost(ip, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port });
    const timer = setTimeout(() => {
      socket.destroy();
      logger.debug({ ip, port }, 'scan: cavab yoxdur (timeout)');
      resolve(null);
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      logger.info({ ip, port }, `scan: printer tapildi -> ${ip}:${port}`);
      resolve({ ip, port, name: 'POS Printer' });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      logger.debug({ ip, port, error: err.code || err.message }, 'scan: qoşulma yoxdur');
      resolve(null);
    });
  });
}

async function scanSubnet(subnet, port = 9100, concurrency = 50) {
  const start = Date.now();
  const validation = validateSubnet(subnet);
  const comparison = compareSubnetWithLocal(subnet);
  const effectiveSubnet = validation.normalized || subnet;

  logger.info('=== LAN scan baslayir ===');
  logger.info(
    {
      inputSubnet: subnet,
      effectiveSubnet,
      port,
      concurrency,
      hostCount: 254,
      sampleHosts: [`${effectiveSubnet}1`, `${effectiveSubnet}80`, `${effectiveSubnet}254`],
    },
    `scan: ${effectiveSubnet}1 - ${effectiveSubnet}254 port ${port}`
  );

  for (const warning of validation.warnings) {
    logger.warn({ subnet }, warning);
  }

  logger.info({ message: comparison.message, localNetworks: comparison.localNetworks }, 'scan: sebeke yoxlamasi');

  if (comparison.mismatch) {
    logger.warn(
      {
        scanSubnet: effectiveSubnet,
        pcSubnets: comparison.localNetworks.map((n) => n.subnet),
        pcIps: comparison.localNetworks.map((n) => n.ip),
      },
      'scan: PC scan edilen subnet-de deyil — printer tapilmaya biler'
    );
  }

  const hosts = [];
  for (let i = 1; i <= 254; i += 1) {
    hosts.push(`${effectiveSubnet}${i}`);
  }

  const found = [];
  const totalBatches = Math.ceil(hosts.length / concurrency);

  for (let i = 0; i < hosts.length; i += concurrency) {
    const batchNum = Math.floor(i / concurrency) + 1;
    const batch = hosts.slice(i, i + concurrency);
    const batchStart = batch[0];
    const batchEnd = batch[batch.length - 1];

    logger.info(
      { batch: batchNum, totalBatches, range: `${batchStart} - ${batchEnd}`, foundSoFar: found.length },
      `scan: batch ${batchNum}/${totalBatches} yoxlanilir...`
    );

    const results = await Promise.all(batch.map((ip) => scanHost(ip, port)));
    const batchFound = results.filter(Boolean);
    found.push(...batchFound);

    if (batchFound.length > 0) {
      logger.info(
        { batch: batchNum, printers: batchFound.map((p) => p.ip) },
        `scan: batch ${batchNum}-de ${batchFound.length} printer tapildi`
      );
    }
  }

  const scanDurationMs = Date.now() - start;
  const hints = buildScanHints(subnet, port, found.length);

  if (found.length === 0) {
    logger.warn(
      {
        subnet: effectiveSubnet,
        port,
        scanDurationMs,
        localNetworks: comparison.localNetworks,
        hints,
      },
      'scan: hec bir printer tapilmadi'
    );
    for (const hint of hints) {
      logger.warn({ hint }, 'scan mesleheti');
    }
  } else {
    logger.info(
      {
        found: found.map((p) => p.ip),
        count: found.length,
        scanDurationMs,
      },
      `scan tamamlandi: ${found.length} printer tapildi`
    );
  }

  return {
    found,
    subnet: effectiveSubnet,
    inputSubnet: subnet,
    scanDurationMs,
    warnings: validation.warnings,
    hints,
    localNetworks: comparison.localNetworks,
    networkMatch: !comparison.mismatch,
  };
}

module.exports = { scanSubnet, scanHost };
