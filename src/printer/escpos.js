'use strict';

const iconv = require('iconv-lite');

const ESC_CUT = Buffer.from([0x1d, 0x56, 0x00]);
const BEEP = Buffer.from([0x1b, 0x42, 0x03, 0x02]);

const AZ_MAP = {
  ə: 'e', Ə: 'E', ı: 'i', İ: 'I', ö: 'o', Ö: 'O',
  ü: 'u', Ü: 'U', ğ: 'g', Ğ: 'G', ş: 's', Ş: 'S', ç: 'c', Ç: 'C',
};

function mapAzChars(text) {
  return String(text).replace(/[əƏıİöÖüÜğĞşŞçÇ]/g, (ch) => AZ_MAP[ch] ?? ch);
}

function buildPayload(text) {
  const mapped = mapAzChars(text);
  const encoded = iconv.encode(mapped, 'cp857');
  return Buffer.concat([encoded, ESC_CUT, BEEP]);
}

function buildTestPageText() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return [
    '================================',
    '     PRINT GATEWAY TEST PAGE',
    '================================',
    '',
    `Tarix: ${now}`,
    '',
    'Printer ugurla qosuldu.',
    'Bu test sehifesidir.',
    '',
    '',
    '',
  ].join('\n');
}

module.exports = {
  ESC_CUT,
  BEEP,
  AZ_MAP,
  mapAzChars,
  buildPayload,
  buildTestPageText,
};
