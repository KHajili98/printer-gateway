'use strict';

const pino = require('pino');
const { isPackaged } = require('../paths');

const usePretty = !isPackaged() && process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: usePretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  redact: ['req.headers.authorization', 'body.text', 'payload.text'],
});

function logPrintRequest(req, meta = {}) {
  logger.info(
    {
      requestId: req.headers['x-request-id'],
      receiptType: meta.receipt_type,
      tableId: meta.table_id,
      source: meta.source,
      targetType: meta.targetType,
      printerIp: meta.printerIp,
    },
    'print request'
  );
}

module.exports = { logger, logPrintRequest };
