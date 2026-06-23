'use strict';

const { config } = require('../config');

function authMiddleware(req, res, next) {
  if (!config.apiKey) {
    return res.status(500).json({
      success: false,
      message: 'PRINT_GATEWAY_API_KEY is not configured.',
    });
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || token !== config.apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  return next();
}

module.exports = { authMiddleware };
