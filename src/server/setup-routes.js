'use strict';

const { config } = require('../config');
const { localhostOnly } = require('../middleware/localhost-only');
const { logger, logNetworkContext } = require('../middleware/logger');
const {
  generateApiKey,
  getSetupView,
  saveSetupConfig,
  reloadRuntimeConfig,
} = require('../config-manager');
const { isPrinterReachable } = require('../printer/tcp-sender');
const { scanSubnet } = require('../printer/scanner');
const { executeTestPrint, formatPrintError } = require('../jobs/processor');

function registerSetupRoutes(app, { onConfigSaved } = {}) {
  app.get('/api/setup/config', localhostOnly, (_req, res) => {
    logger.debug('setup: config oxunur');
    res.json(getSetupView());
  });

  app.post('/api/setup/config', localhostOnly, (req, res) => {
    const body = req.body || {};
    logger.info(
      {
        mainIp: body.printers?.main?.ip,
        workerCount: body.printers?.workers?.length || 0,
        mode: body.mode,
        scanSubnet: body.scanSubnet,
      },
      'setup: konfiqurasiya saxlanilir'
    );

    try {
      const saved = saveSetupConfig(body);
      reloadRuntimeConfig(require('../config'));

      logger.info(
        {
          mainIp: saved.printers?.main?.ip,
          scanSubnet: saved.scanSubnet,
          mode: saved.mode,
        },
        'setup: konfiqurasiya ugurla saxlanildi'
      );

      if (onConfigSaved) {
        onConfigSaved(saved);
      }

      res.json({
        success: true,
        message: 'Konfiqurasiya saxlanildi.',
        config: saved,
        restartRequired: true,
      });
    } catch (err) {
      logger.error({ err: err.message }, 'setup: konfiqurasiya saxlanila bilmedi');
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/setup/generate-key', localhostOnly, (_req, res) => {
    logger.info('setup: yeni API key yaradildi');
    res.json({ apiKey: generateApiKey() });
  });

  app.get('/api/setup/status', localhostOnly, async (_req, res) => {
    logger.debug('setup: status yoxlanilir');
    const { main, workers = [] } = config.printers;

    const mainReachable = main?.ip
      ? await isPrinterReachable(main.ip, main.port || 9100)
      : false;

    const workerStatuses = await Promise.all(
      workers.map(async (w) => ({
        name: w.name,
        ip: w.ip,
        port: w.port || 9100,
        reachable: w.ip ? await isPrinterReachable(w.ip, w.port || 9100) : false,
      }))
    );

    logger.info(
      {
        main: main?.ip ? { ip: main.ip, reachable: mainReachable } : null,
        workers: workerStatuses,
      },
      `setup status: main=${mainReachable ? 'online' : 'offline'}`
    );

    res.json({
      status: 'ok',
      mode: config.mode,
      port: config.port,
      configured: Boolean(config.apiKey),
      printers: {
        main: main?.ip
          ? { ...main, reachable: mainReachable }
          : null,
        workers: workerStatuses,
      },
    });
  });

  app.post('/api/setup/scan', localhostOnly, async (req, res) => {
    const subnet = req.body?.subnet || config.scanSubnet;
    const port = Number(req.body?.port) || config.scanPort;

    logNetworkContext('setup-scan', subnet, port);
    logger.info({ subnet, port }, 'setup: LAN scan basladildi');

    try {
      const result = await scanSubnet(subnet, port);

      logger.info(
        {
          found: result.found.map((p) => p.ip),
          count: result.found.length,
          scanDurationMs: result.scanDurationMs,
          hints: result.hints,
        },
        `setup scan tamamlandi: ${result.found.length} printer`
      );

      res.json(result);
    } catch (err) {
      logger.error({ err: err.message, subnet, port }, 'setup: scan xetasi');
      res.status(500).json({ success: false, message: 'Scan ugursuz oldu.' });
    }
  });

  app.post('/api/setup/test', localhostOnly, async (req, res) => {
    const target = req.body?.target || { type: 'main' };
    logger.info({ target, mainIp: config.printers?.main?.ip }, 'setup: test cap basladildi');

    try {
      const result = await executeTestPrint(target);
      logger.info({ printer: result.printer }, 'setup: test cap ugurlu');
      res.json(result);
    } catch (err) {
      logger.error(
        { error: err.code || err.message, target, mainIp: config.printers?.main?.ip },
        'setup: test cap ugursuz'
      );
      res.status(502).json(formatPrintError(err));
    }
  });

  app.post('/api/setup/restart', localhostOnly, (_req, res) => {
    logger.info('setup: servis yeniden basladilir');
    res.json({ success: true, message: 'Servis yeniden basladilir...' });
    setTimeout(() => process.exit(0), 500);
  });
}

module.exports = { registerSetupRoutes };
