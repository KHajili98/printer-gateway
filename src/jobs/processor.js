'use strict';

const { resolveTarget } = require('../config');
const { sendToPrinter } = require('../printer/tcp-sender');
const { buildTestPageText } = require('../printer/escpos');
const { logger } = require('../middleware/logger');

async function executePrint({ text, target }) {
  const printer = resolveTarget(target);
  logger.info(
    { target, printerIp: printer.ip, printerPort: printer.port, printerName: printer.name },
    `cap job: ${printer.name} (${printer.ip}:${printer.port})`
  );

  const result = await sendToPrinter(text, printer.ip, printer.port);

  logger.info(
    { printerIp: printer.ip, durationMs: result.durationMs },
    `cap job tamamlandi: ${printer.ip}`
  );

  return {
    success: true,
    message: 'Çek uğurla çap edildi.',
    printer: { ip: printer.ip, port: printer.port, name: printer.name },
    durationMs: result.durationMs,
  };
}

async function executePrintBatch(jobs) {
  logger.info({ jobCount: jobs.length }, `batch cap: ${jobs.length} job baslayir`);

  const results = await Promise.allSettled(
    jobs.map(async (job, index) => {
      const printer = resolveTarget(job.target);
      logger.info(
        { index, printerIp: printer.ip, meta: job.meta },
        `batch cap [${index + 1}/${jobs.length}]: ${printer.ip}`
      );
      const result = await sendToPrinter(job.text, printer.ip, printer.port);
      return {
        success: true,
        printer: { ip: printer.ip, port: printer.port, name: printer.name },
        meta: job.meta || {},
        durationMs: result.durationMs,
      };
    })
  );

  const mapped = results.map((r, index) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }

    const err = r.reason;
    logger.error(
      { index, error: err?.code || err?.message, meta: jobs[index]?.meta },
      `batch cap [${index + 1}] ugursuz`
    );
    return {
      success: false,
      message: 'Printerə qoşulmaq mümkün olmadı.',
      error: err?.code || err?.message || 'UNKNOWN',
      meta: jobs[index]?.meta || {},
    };
  });

  const okCount = mapped.filter((r) => r.success).length;
  logger.info({ total: jobs.length, ok: okCount, failed: jobs.length - okCount }, 'batch cap tamamlandi');

  return mapped;
}

async function executeTestPrint(target) {
  logger.info({ target }, 'test cap baslayir');
  const text = buildTestPageText();
  return executePrint({ text, target });
}

function formatPrintError(err) {
  return {
    success: false,
    message: 'Printerə qoşulmaq mümkün olmadı.',
    error: err?.code || err?.message || 'UNKNOWN',
  };
}

module.exports = {
  executePrint,
  executePrintBatch,
  executeTestPrint,
  formatPrintError,
};
