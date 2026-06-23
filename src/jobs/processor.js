'use strict';

const { resolveTarget } = require('../config');
const { sendToPrinter } = require('../printer/tcp-sender');
const { buildTestPageText } = require('../printer/escpos');

async function executePrint({ text, target }) {
  const printer = resolveTarget(target);
  const result = await sendToPrinter(text, printer.ip, printer.port);

  return {
    success: true,
    message: 'Çek uğurla çap edildi.',
    printer: { ip: printer.ip, port: printer.port, name: printer.name },
    durationMs: result.durationMs,
  };
}

async function executePrintBatch(jobs) {
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const printer = resolveTarget(job.target);
      const result = await sendToPrinter(job.text, printer.ip, printer.port);
      return {
        success: true,
        printer: { ip: printer.ip, port: printer.port, name: printer.name },
        meta: job.meta || {},
        durationMs: result.durationMs,
      };
    })
  );

  return results.map((r, index) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }

    const err = r.reason;
    return {
      success: false,
      message: 'Printerə qoşulmaq mümkün olmadı.',
      error: err?.code || err?.message || 'UNKNOWN',
      meta: jobs[index]?.meta || {},
    };
  });
}

async function executeTestPrint(target) {
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
