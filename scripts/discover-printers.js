#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { scanSubnet } = require('../src/printer/scanner');

const subnet = process.env.SCAN_SUBNET || '192.168.1.';
const port = Number(process.env.SCAN_PORT) || 9100;

async function main() {
  console.log(`Scanning ${subnet}1-254 on port ${port}...`);
  const result = await scanSubnet(subnet, port);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
