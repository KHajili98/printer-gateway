#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const SERVICE_NAME = 'print-gateway';

function log(msg) {
  console.log(`\n>>> ${msg}`);
}

function fail(msg) {
  console.error(`\n[X] ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: IS_WIN,
    ...opts,
  });
  if (result.status !== 0) {
    fail(`Komanda ugursuz: ${cmd} ${args.join(' ')}`);
  }
}

function checkNode() {
  const major = Number(process.version.slice(1).split('.')[0]);
  if (major < 18) {
    fail(
      `Node.js 18+ lazımdır (indiki: ${process.version}).\n` +
        'Yukle: https://nodejs.org/'
    );
  }
  log(`Node.js ${process.version} — OK`);
}

function npmInstall() {
  log('Asılılıqlar quraşdırılır...');
  run('npm', ['install', '--omit=dev'], { env: { ...process.env, NODE_ENV: 'production' } });
}

function ensureEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    log('.env faylı yaradılır...');
    require(path.join(ROOT, 'src', 'config-manager')).ensureEnvFile();
  }
}

function readPort() {
  try {
    const env = require(path.join(ROOT, 'src', 'config-manager')).readEnvFile();
    return Number(env.PORT) || 3000;
  } catch {
    return 3000;
  }
}

function hasPm2() {
  const r = spawnSync(IS_WIN ? 'pm2.cmd' : 'pm2', ['--version'], { shell: IS_WIN });
  return r.status === 0;
}

function installPm2() {
  log('PM2 quraşdırılır (servis idarəetməsi)...');
  run('npm', ['install', '-g', 'pm2']);
}

function startWithPm2() {
  log('PM2 ilə servis başladılır...');

  spawnSync(IS_WIN ? 'pm2.cmd' : 'pm2', ['delete', SERVICE_NAME], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: IS_WIN,
  });

  run(IS_WIN ? 'pm2.cmd' : 'pm2', [
    'start',
    path.join(ROOT, 'src', 'index.js'),
    '--name',
    SERVICE_NAME,
    '--cwd',
    ROOT,
  ]);

  run(IS_WIN ? 'pm2.cmd' : 'pm2', ['save']);

  if (IS_WIN) {
    try {
      run(IS_WIN ? 'pm2.cmd' : 'pm2', ['startup']);
    } catch {
      log('Windows avto-start: PM2 startup manual quraşdırıla bilər.');
    }
  } else {
    try {
      const startup = spawnSync(IS_WIN ? 'pm2.cmd' : 'pm2', ['startup', '-u', process.env.USER || 'root', '--hp', process.env.HOME || '/root'], {
        shell: false,
        encoding: 'utf8',
      });
      if (startup.stdout) {
        const line = startup.stdout.split('\n').find((l) => l.includes('sudo'));
        if (line) {
          log('Avto-start üçün bu əmri admin olaraq işlədin:');
          console.log(line.trim());
        }
      }
    } catch {
      log('Linux avto-start: pm2 startup manual quraşdırıla bilər.');
    }
  }
}

function startDetached() {
  log('Servis arxa planda başladılır...');
  const out = fs.openSync(path.join(ROOT, 'gateway.log'), 'a');
  const err = fs.openSync(path.join(ROOT, 'gateway.err.log'), 'a');

  const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, err],
  });
  child.unref();

  fs.writeFileSync(
    path.join(ROOT, IS_WIN ? 'stop.bat' : 'stop.sh'),
    IS_WIN
      ? `@echo off\r\nfor /f "tokens=5" %%a in ('netstat -aon ^| findstr :${readPort()} ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul\r\necho Servis dayandirildi.\r\npause\r\n`
      : `#!/bin/bash\npkill -f "src/index.js" 2>/dev/null\necho "Servis dayandirildi."\n`,
    'utf8'
  );

  if (!IS_WIN) {
    fs.chmodSync(path.join(ROOT, 'stop.sh'), 0o755);
  }
}

function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;

    const tick = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${port}/api/v1/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else if (attempts < maxAttempts) setTimeout(tick, 500);
        else resolve(false);
      });
      req.on('error', () => {
        if (attempts < maxAttempts) setTimeout(tick, 500);
        else resolve(false);
      });
      req.setTimeout(1000, () => req.destroy());
    };

    tick();
  });
}

function openBrowser(url) {
  log(`Brauzer açılır: ${url}`);
  const cmd = IS_WIN ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, IS_WIN ? ['', url] : [url], { detached: true, shell: IS_WIN }).unref();
}

function createDesktopShortcut(port) {
  if (!IS_WIN) return;

  const vbs = path.join(ROOT, 'Open-Setup.vbs');
  fs.writeFileSync(
    vbs,
    `Set shell = CreateObject("WScript.Shell")\r\nshell.Run "http://localhost:${port}/setup", 1, False\r\n`,
    'utf8'
  );
  log('Open-Setup.vbs yaradıldı — konfiqurasiya panelini açmaq üçün iki dəfə klikləyin.');
}

async function main() {
  console.log('========================================');
  console.log('  Print Gateway — Quraşdırma');
  console.log(`  Platform: ${IS_WIN ? 'Windows' : process.platform}`);
  console.log('========================================');

  checkNode();
  npmInstall();
  ensureEnv();

  const port = readPort();

  if (!hasPm2()) {
    try {
      installPm2();
    } catch {
      log('PM2 quraşdırıla bilmədi — sadə rejimdə başladılır.');
      startDetached();
    }
  }

  if (hasPm2()) {
    startWithPm2();
  } else if (!fs.existsSync(path.join(ROOT, 'gateway.log'))) {
    startDetached();
  }

  log('Servisin hazır olması gözlənilir...');
  const ready = await waitForServer(port);

  if (ready) {
    log('Servis işləyir!');
    openBrowser(`http://localhost:${port}/setup`);
    createDesktopShortcut(port);
  } else {
    log(`Servis hələ cavab vermir. Brauzerdə açın: http://localhost:${port}/setup`);
  }

  console.log('\n========================================');
  console.log('  Quraşdırma tamamlandı!');
  console.log(`  Setup UI: http://localhost:${port}/setup`);
  console.log(`  API:      http://localhost:${port}/api/v1/health`);
  if (hasPm2()) {
    console.log(`  Dayandır: pm2 stop ${SERVICE_NAME}`);
    console.log(`  Loglar:   pm2 logs ${SERVICE_NAME}`);
  } else {
    console.log(`  Dayandır: ${IS_WIN ? 'stop.bat' : './stop.sh'}`);
  }
  console.log('========================================\n');
}

main().catch((err) => fail(err.message));
