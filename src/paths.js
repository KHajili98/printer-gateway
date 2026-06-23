'use strict';

const fs = require('fs');
const path = require('path');

function isPackaged() {
  return Boolean(process.pkg);
}

function getAppRoot() {
  if (isPackaged()) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '..');
}

function getResourcePath(...parts) {
  if (isPackaged()) {
    return path.join(__dirname, ...parts);
  }
  return path.join(__dirname, '..', ...parts);
}

function seedRuntimeFiles(root) {
  const pairs = [
    ['config/printers.json', path.join(root, 'config', 'printers.json')],
    ['.env.example', path.join(root, '.env.example')],
  ];

  for (const [srcRel, dest] of pairs) {
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const src = getResourcePath(srcRel);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  const publicSrc = getResourcePath('public');
  const publicDest = path.join(root, 'public');
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    copyDir(publicSrc, publicDest);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

module.exports = { isPackaged, getAppRoot, getResourcePath, seedRuntimeFiles };
