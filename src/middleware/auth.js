'use strict';

const { config } = require('../config');

function authMiddleware(req, res, next) {
  const { logger } = require('./logger');

  if (!config.apiKey) {
    logger.error({ path: req.path }, 'auth: PRINT_GATEWAY_API_KEY konfiqurasiya olunmayib');
    return res.status(500).json({
      success: false,
      message: 'PRINT_GATEWAY_API_KEY is not configured.',
    });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || token !== config.apiKey) {
    logger.warn(
      { path: req.path, ip: req.ip, hasAuth: Boolean(header), scheme: scheme || 'yoxdur' },
      'auth: icaze verilmeyib (API key sehv ve ya yoxdur)'
    );
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  logger.debug({ path: req.path }, 'auth: ugurlu');
  return next();
}

module.exports = { authMiddleware };
