'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const NODE_VERSION = '20.18.1';
const IS_WIN = process.platform === 'win32';

function log(msg) {
  console.log(`\n>>> ${msg}`);
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const fetch = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetch(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode} ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    fetch(url);
  });
}

async function fetchNode(platform) {
  const cache = path.join(DIST, 'cache');
  fs.mkdirSync(cache, { recursive: true });

  if (platform === 'win') {
    const name = `node-v${NODE_VERSION}-win-x64.zip`;
    const archive = path.join(cache, name);
    if (!fs.existsSync(archive)) {
      log(`Node.js Windows yuklenir (${NODE_VERSION})...`);
      await download(`https://nodejs.org/dist/v${NODE_VERSION}/${name}`, archive);
    }
    return { archive, type: 'zip' };
  }

  const name = `node-v${NODE_VERSION}-linux-x64.tar.xz`;
  const archive = path.join(cache, name);
  if (!fs.existsSync(archive)) {
    log(`Node.js Linux yuklenir (${NODE_VERSION})...`);
    await download(`https://nodejs.org/dist/v${NODE_VERSION}/${name}`, archive);
  }
  return { archive, type: 'tar.xz' };
}

function extractZip(zipPath, dest) {
  if (IS_WIN) {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${dest}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -qo "${zipPath}" -d "${dest}"`, { stdio: 'inherit' });
  }
}

function extractTarXz(tarPath, dest) {
  fs.mkdirSync(dest, { recursive: true });
  execSync(`tar -xJf "${tarPath}" -C "${dest}"`, { stdio: 'inherit' });
}

function prepareAppBundle(appDir) {
  log('App bundle hazirlanir...');
  rmrf(appDir);
  fs.mkdirSync(appDir, { recursive: true });

  for (const item of ['src', 'public', 'config', 'package.json', 'package-lock.json', '.env.example']) {
    const src = path.join(ROOT, item);
    if (fs.existsSync(src)) {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) copyDir(src, path.join(appDir, item));
      else fs.copyFileSync(src, path.join(appDir, item));
    }
  }

  log('Production asilililari qurasdirilir...');
  spawnSync('npm', ['ci', '--omit=dev'], { cwd: appDir, stdio: 'inherit', shell: IS_WIN });
}

function buildWindows(appDir) {
  const out = path.join(DIST, 'release', 'win-x64');
  rmrf(out);
  fs.mkdirSync(out, { recursive: true });

  const { archive } = fetchNodeSync('win');
  const tmp = path.join(DIST, 'tmp-win');
  rmrf(tmp);
  extractZip(archive, tmp);

  const nodeDir = fs.readdirSync(tmp).find((n) => n.startsWith('node-'));
  copyDir(path.join(tmp, nodeDir), path.join(out, 'node'));
  copyDir(appDir, path.join(out, 'app'));

  fs.copyFileSync(path.join(ROOT, 'installers', 'install-win-portable.bat'), path.join(out, 'Install.bat'));
  fs.copyFileSync(path.join(ROOT, 'installers', 'start-win-portable.bat'), path.join(out, 'Start.bat'));
  fs.copyFileSync(path.join(ROOT, 'installers', 'stop-win-portable.bat'), path.join(out, 'Stop.bat'));
  fs.copyFileSync(path.join(ROOT, 'installers', 'Open-Setup.bat'), path.join(out, 'Open Setup.bat'));

  fs.writeFileSync(
    path.join(out, 'README.txt'),
    [
      'Print Gateway - Windows',
      '=======================',
      '',
      'Node.js daxildir — ayrica qurasdirmaya ehtiyac yoxdur.',
      '',
      '1. Install.bat — qurasdirma (avto-start + setup paneli)',
      '2. Open Setup.bat — konfiqurasiya',
      '3. Start.bat / Stop.bat',
      '',
      `Versiya: ${VERSION}`,
    ].join('\r\n'),
    'utf8'
  );

  rmrf(tmp);
  return out;
}

function buildLinux(appDir) {
  const out = path.join(DIST, 'release', 'linux-x64');
  rmrf(out);
  fs.mkdirSync(out, { recursive: true });

  const { archive } = fetchNodeSync('linux');
  const tmp = path.join(DIST, 'tmp-linux');
  rmrf(tmp);
  extractTarXz(archive, tmp);

  const nodeDir = fs.readdirSync(tmp).find((n) => n.startsWith('node-'));
  copyDir(path.join(tmp, nodeDir), path.join(out, 'node'));
  copyDir(appDir, path.join(out, 'app'));

  for (const f of ['install-linux-portable.sh', 'start-linux-portable.sh', 'stop-linux-portable.sh']) {
    const dest = f.replace('-portable', '').replace('install-linux', 'install').replace('start-linux', 'start').replace('stop-linux', 'stop');
    fs.copyFileSync(path.join(ROOT, 'installers', f), path.join(out, dest));
    fs.chmodSync(path.join(out, dest), 0o755);
  }

  fs.writeFileSync(
    path.join(out, 'README.txt'),
    [
      'Print Gateway - Linux',
      '=====================',
      '',
      'Node.js daxildir — ayrica qurasdirmaya ehtiyac yoxdur.',
      '',
      '  chmod +x install.sh && ./install.sh',
      '',
      'Setup: http://localhost:3000/setup',
      '',
      `Versiya: ${VERSION}`,
    ].join('\n'),
    'utf8'
  );

  rmrf(tmp);
  return out;
}

function fetchNodeSync(platform) {
  const cache = path.join(DIST, 'cache');
  fs.mkdirSync(cache, { recursive: true });
  if (platform === 'win') {
    const name = `node-v${NODE_VERSION}-win-x64.zip`;
    const archive = path.join(cache, name);
    if (!fs.existsSync(archive)) {
      throw new Error(`Node arxivi yoxdur: ${archive}. npm run build isledek.`);
    }
    return { archive, type: 'zip' };
  }
  const name = `node-v${NODE_VERSION}-linux-x64.tar.xz`;
  const archive = path.join(cache, name);
  if (!fs.existsSync(archive)) {
    throw new Error(`Node arxivi yoxdur: ${archive}`);
  }
  return { archive, type: 'tar.xz' };
}

async function downloadNodes() {
  await fetchNode('win');
  await fetchNode('linux');
}

function zipDir(dir, zipPath) {
  rmrf(zipPath);
  if (IS_WIN) {
    execSync(`powershell -Command "Compress-Archive -Path '${dir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`cd "${dir}" && zip -rq "${zipPath}" .`, { stdio: 'inherit' });
  }
}

function tarDir(dir, tarPath) {
  rmrf(tarPath);
  execSync(`tar -czf "${tarPath}" -C "${dir}" .`, { stdio: 'inherit' });
}

function buildNsis(winDir) {
  const nsis = path.join(ROOT, 'installers', 'setup-portable.nsi');
  try {
    execSync('makensis /VERSION', { stdio: 'ignore' });
  } catch {
    return null;
  }
  const outExe = path.join(DIST, `PrintGateway-Setup-${VERSION}-win-x64.exe`);
  execSync(`makensis /DVERSION=${VERSION} /DSOURCE_DIR="${winDir}" /DOUT_FILE="${outExe}" "${nsis}"`, { stdio: 'inherit' });
  return outExe;
}

async function main() {
  console.log('Print Gateway Portable Release Build');
  console.log(`Version: ${VERSION} | Node: ${NODE_VERSION}\n`);

  rmrf(path.join(DIST, 'release'));
  fs.mkdirSync(path.join(DIST, 'cache'), { recursive: true });

  await downloadNodes();

  const appDir = path.join(DIST, 'app-bundle');
  prepareAppBundle(appDir);

  const winDir = buildWindows(appDir);
  const linuxDir = buildLinux(appDir);

  const winZip = path.join(DIST, `PrintGateway-Setup-${VERSION}-win-x64.zip`);
  const linuxTar = path.join(DIST, `PrintGateway-Setup-${VERSION}-linux-x64.tar.gz`);

  log('Windows ZIP yaradilir...');
  zipDir(winDir, winZip);
  log('Linux tar.gz yaradilir...');
  tarDir(linuxDir, linuxTar);

  const exe = buildNsis(winDir);

  console.log('\n========================================');
  console.log('  Hazir fayllar (dist/):');
  console.log(`  ${path.basename(winZip)}`);
  console.log(`  ${path.basename(linuxTar)}`);
  if (exe) console.log(`  ${path.basename(exe)}`);
  console.log('========================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
