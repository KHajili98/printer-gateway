'use strict';

const os = require('os');

function getLocalNetworks() {
  const nets = os.networkInterfaces();
  const result = [];

  for (const [name, addresses] of Object.entries(nets)) {
    for (const addr of addresses || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const parts = addr.address.split('.');
      if (parts.length !== 4) continue;
      result.push({
        interface: name,
        ip: addr.address,
        netmask: addr.netmask,
        subnet: `${parts[0]}.${parts[1]}.${parts[2]}.`,
      });
    }
  }

  return result;
}

function validateSubnet(subnet) {
  const warnings = [];
  const trimmed = String(subnet || '').trim();

  if (!trimmed) {
    warnings.push('Subnet bosdur. Numune: 192.168.1.');
    return { valid: false, normalized: '', warnings, hint: 'Subnet prefiksi yazin, mes: 192.168.1.' };
  }

  const fullIpMatch = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (fullIpMatch) {
    const normalized = `${fullIpMatch[1]}.${fullIpMatch[2]}.${fullIpMatch[3]}.`;
    warnings.push(
      `Subnet yerine tam IP yazilib: "${trimmed}". Scan bele isleyecek: ${normalized}1 ... ${normalized}254`
    );
    return {
      valid: false,
      normalized,
      warnings,
      hint: `Duzgun format: ${normalized} (sonda noqte olmalidir)`,
      looksLikeFullIp: true,
    };
  }

  const prefixMatch = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.?$/);
  if (!prefixMatch) {
    warnings.push(`Subnet formati duzgun deyil: "${trimmed}". Numune: 192.168.1.`);
    return { valid: false, normalized: trimmed, warnings, hint: 'Format: XXX.XXX.XXX.' };
  }

  const normalized = `${prefixMatch[1]}.${prefixMatch[2]}.${prefixMatch[3]}.`;
  if (!trimmed.endsWith('.')) {
    warnings.push(`Subnet sonunda noqte yoxdur: "${trimmed}" -> "${normalized}" istifade olunur`);
  }

  return { valid: true, normalized, warnings, hint: null, looksLikeFullIp: false };
}

function compareSubnetWithLocal(subnet) {
  const validation = validateSubnet(subnet);
  const scanSubnet = validation.normalized || subnet;
  const localNetworks = getLocalNetworks();

  const matching = localNetworks.filter((n) => n.subnet === scanSubnet);
  const mismatch = localNetworks.length > 0 && matching.length === 0;

  return {
    scanSubnet,
    localNetworks,
    matching,
    mismatch,
    message: mismatch
      ? `Diqqet: PC scan edilen subnet-de deyil. PC: ${localNetworks.map((n) => `${n.ip} (${n.subnet})`).join(', ')} | Scan: ${scanSubnet}`
      : matching.length > 0
        ? `PC ve scan subnet uygun: ${matching.map((n) => n.ip).join(', ')}`
        : 'Lokal IPv4 sebeke tapilmadi (WiFi/Ethernet yoxlanin)',
  };
}

function buildScanHints(subnet, port, foundCount) {
  const hints = [];
  const validation = validateSubnet(subnet);
  const comparison = compareSubnetWithLocal(subnet);

  if (validation.looksLikeFullIp) {
    hints.push(`Subnet yerine tam IP yazmayin. Duzgun: ${validation.normalized}`);
  }

  if (comparison.mismatch) {
    hints.push(comparison.message);
    hints.push('PC restoran WiFi-sine qoshulub? Hotspot/ev sebekeinde printer tapilmayacaq.');
  }

  if (foundCount === 0) {
    hints.push(`Port ${port} aciq olan cihaz tapilmadi.`);
    hints.push('Printer aciqdir? WiFi/kabel eyni routera qoshulub?');
    hints.push('Firewall port 9100-i bloklaya bilir.');
    if (comparison.localNetworks.length > 0) {
      const suggested = comparison.localNetworks[0].subnet;
      hints.push(`Tovsiye olunan subnet: ${suggested}`);
    }
  }

  return hints;
}

module.exports = {
  getLocalNetworks,
  validateSubnet,
  compareSubnetWithLocal,
  buildScanHints,
};
