'use strict';

function isLocalhost(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  );
}

function localhostOnly(req, res, next) {
  if (!isLocalhost(req)) {
    return res.status(403).json({
      success: false,
      message: 'Setup panel yalniz lokal kompüterden əlçatandir.',
    });
  }
  return next();
}

module.exports = { localhostOnly, isLocalhost };
