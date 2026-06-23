'use strict';

const path = require('path');
const { getAppRoot } = require('../paths');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { config, resolveTarget } = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { logger, logPrintRequest } = require('../middleware/logger');
const { isPrinterReachable } = require('../printer/tcp-sender');
const { scanSubnet } = require('../printer/scanner');
const {
  executePrint,
  executePrintBatch,
  executeTestPrint,
  formatPrintError,
} = require('../jobs/processor');

const startTime = Date.now();
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

function checkIdempotency(requestId) {
  if (!requestId) return null;

  const cached = idempotencyCache.get(requestId);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    return cached.response;
  }

  return null;
}

function storeIdempotency(requestId, response) {
  if (!requestId) return;

  idempotencyCache.set(requestId, {
    timestamp: Date.now(),
    response,
  });

  if (idempotencyCache.size > 1000) {
    const oldest = idempotencyCache.keys().next().value;
    idempotencyCache.delete(oldest);
  }
}

function createHttpServer(options = {}) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  const publicDir = path.join(getAppRoot(), 'public');
  if (!require('fs').existsSync(publicDir)) {
    const fallback = path.join(__dirname, '..', '..', 'public');
    app.use('/setup', express.static(path.join(fallback, 'setup')));
    app.get('/setup', (_req, res) => res.sendFile(path.join(fallback, 'setup', 'index.html')));
  } else {
    app.use('/setup', express.static(path.join(publicDir, 'setup')));
    app.get('/setup', (_req, res) => res.sendFile(path.join(publicDir, 'setup', 'index.html')));
  }
  app.get('/', (_req, res) => res.redirect('/setup'));

  const { registerSetupRoutes } = require('./setup-routes');
  registerSetupRoutes(app, options);

  const printLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Rate limit exceeded.' },
  });

  app.get('/api/v1/health', async (_req, res) => {
    const { main, workers = [] } = config.printers;

    const mainReachable = main?.ip
      ? await isPrinterReachable(main.ip, main.port || 9100)
      : false;

    const workerStatuses = await Promise.all(
      workers.map(async (w) => ({
        name: w.name,
        ip: w.ip,
        port: w.port || 9100,
        reachable: await isPrinterReachable(w.ip, w.port || 9100),
      }))
    );

    res.json({
      status: 'ok',
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      printers: {
        main: main?.ip
          ? { ip: main.ip, port: main.port || 9100, reachable: mainReachable }
          : null,
        workers: workerStatuses,
      },
    });
  });

  app.get('/api/v1/printers/scan', authMiddleware, async (_req, res) => {
    try {
      const result = await scanSubnet(config.scanSubnet, config.scanPort);
      res.json(result);
    } catch (err) {
      logger.error({ err }, 'scan failed');
      res.status(500).json({ success: false, message: 'Scan failed.' });
    }
  });

  app.post('/api/v1/print', authMiddleware, printLimiter, async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const cached = checkIdempotency(requestId);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }

    const { text, target, meta = {} } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'text is required.',
      });
    }

    try {
      const resolved = resolveTarget(target || { type: 'main' });
      logPrintRequest(req, {
        ...meta,
        targetType: target?.type || 'main',
        printerIp: resolved.ip,
      });

      const result = await executePrint({ text, target: target || { type: 'main' } });
      const response = { status: 200, body: result };
      storeIdempotency(requestId, response);
      return res.status(200).json(result);
    } catch (err) {
      logger.error({ err, meta }, 'print failed');

      const body = formatPrintError(err);
      if (err.message?.includes('not configured') || err.message?.includes('not found')) {
        return res.status(400).json(body);
      }

      const response = { status: 502, body };
      storeIdempotency(requestId, response);
      return res.status(502).json(body);
    }
  });

  app.post('/api/v1/print/batch', authMiddleware, printLimiter, async (req, res) => {
    const { jobs } = req.body || {};

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'jobs array is required.',
      });
    }

    for (const job of jobs) {
      if (!job.text || !job.target) {
        return res.status(400).json({
          success: false,
          message: 'Each job requires text and target.',
        });
      }
    }

    try {
      const results = await executePrintBatch(jobs);
      const allOk = results.every((r) => r.success);

      return res.status(allOk ? 200 : 207).json({
        success: allOk,
        results,
      });
    } catch (err) {
      logger.error({ err }, 'batch print failed');
      return res.status(500).json(formatPrintError(err));
    }
  });

  app.post('/api/v1/test', authMiddleware, printLimiter, async (req, res) => {
    const { target } = req.body || {};

    try {
      const result = await executeTestPrint(target || { type: 'main' });
      return res.status(200).json(result);
    } catch (err) {
      logger.error({ err }, 'test print failed');
      return res.status(502).json(formatPrintError(err));
    }
  });

  return app;
}

function startHttpServer(options = {}) {
  const app = createHttpServer(options);
  return app.listen(config.port, () => {
    logger.info({ port: config.port, setup: `http://localhost:${config.port}/setup` }, 'HTTP server started');
  });
}

module.exports = { createHttpServer, startHttpServer };
