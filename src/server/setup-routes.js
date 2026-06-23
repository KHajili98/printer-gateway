'use strict';

const { config } = require('../config');
const { localhostOnly } = require('../middleware/localhost-only');
const { logger } = require('../middleware/logger');
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
    res.json(getSetupView());
  });

  app.post('/api/setup/config', localhostOnly, (req, res) => {
    try {
      const saved = saveSetupConfig(req.body || {});
      reloadRuntimeConfig(require('../config'));

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
      logger.error({ err }, 'setup save failed');
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/setup/generate-key', localhostOnly, (_req, res) => {
    res.json({ apiKey: generateApiKey() });
  });

  app.get('/api/setup/status', localhostOnly, async (_req, res) => {
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

    try {
      const result = await scanSubnet(subnet, port);
      res.json(result);
    } catch (err) {
      logger.error({ err }, 'setup scan failed');
      res.status(500).json({ success: false, message: 'Scan ugursuz oldu.' });
    }
  });

  app.post('/api/setup/test', localhostOnly, async (req, res) => {
    const target = req.body?.target || { type: 'main' };

    try {
      const result = await executeTestPrint(target);
      res.json(result);
    } catch (err) {
      res.status(502).json(formatPrintError(err));
    }
  });

  app.post('/api/setup/restart', localhostOnly, (_req, res) => {
    res.json({ success: true, message: 'Servis yeniden basladilir...' });
    setTimeout(() => process.exit(0), 500);
  });
}

module.exports = { registerSetupRoutes };
