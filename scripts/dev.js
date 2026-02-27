/**
 * AiCaffe Dev Runner
 * Starts all backend services + frontend concurrently in one terminal.
 * Usage: npm run dev  (from project root)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UVICORN = path.join(ROOT, 'services', 'venv', 'Scripts', 'uvicorn.exe');
const ENV_FILE = path.join(ROOT, '.env');

// Each backend service sits 2 levels deep (services/<name>), so ../../.env
// We pass the absolute path to avoid any relative-path confusion.
const backendArgs = (port) => [
  'main:app',
  '--host', '0.0.0.0',
  '--port', String(port),
  '--reload',
  '--env-file', ENV_FILE,
];

// Colour codes for each service label
const RESET = '\x1b[0m';
const SERVICES = [
  {
    name: '  frontend',
    color: '\x1b[96m',   // bright cyan
    cmd: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(ROOT, 'frontend'),
    shell: true,
  },
  {
    name: '   gateway',
    color: '\x1b[92m',   // bright green
    cmd: UVICORN,
    args: backendArgs(8000),
    cwd: path.join(ROOT, 'services', 'api-gateway'),
    shell: false,
  },
  {
    name: '      auth',
    color: '\x1b[93m',   // bright yellow
    cmd: UVICORN,
    args: backendArgs(8001),
    cwd: path.join(ROOT, 'services', 'auth-service'),
    shell: false,
  },
  {
    name: '    models',
    color: '\x1b[94m',   // bright blue
    cmd: UVICORN,
    args: backendArgs(8002),
    cwd: path.join(ROOT, 'services', 'model-registry'),
    shell: false,
  },
  {
    name: '    tokens',
    color: '\x1b[95m',   // bright magenta
    cmd: UVICORN,
    args: backendArgs(8003),
    cwd: path.join(ROOT, 'services', 'token-service'),
    shell: false,
  },
  {
    name: '  ai-proxy',
    color: '\x1b[91m',   // bright red
    cmd: UVICORN,
    args: backendArgs(8006),
    cwd: path.join(ROOT, 'services', 'ai-proxy-service'),
    shell: false,
  },
];

const processes = [];

function prefix(svc) {
  return `${svc.color}[${svc.name}]${RESET} `;
}

function startService(svc) {
  const proc = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    shell: svc.shell,
    env: { ...process.env },
    windowsHide: true,
  });

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach((line) => {
      process.stdout.write(prefix(svc) + line + '\n');
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach((line) => {
      process.stdout.write(prefix(svc) + line + '\n');
    });
  });

  proc.on('error', (err) => {
    console.error(`${prefix(svc)}Failed to start: ${err.message}`);
  });

  proc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`${prefix(svc)}Exited with code ${code}`);
    }
  });

  processes.push(proc);
}

// ── Start all ────────────────────────────────────────────────────────────────

console.log('\x1b[1m\x1b[97m');
console.log('  ╔══════════════════════════════════════╗');
console.log('  ║        AiCaffe Dev Server            ║');
console.log('  ╚══════════════════════════════════════╝');
console.log(RESET);
console.log('  Starting 6 services...\n');

SERVICES.forEach(startService);

// ── Graceful shutdown on Ctrl+C ──────────────────────────────────────────────

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n\x1b[97mShutting down all services...\x1b[0m');

  // On Windows, SIGTERM doesn't kill child trees.
  // Use taskkill /T /F to kill the entire process tree for each child.
  processes.forEach((p) => {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' });
      } else {
        p.kill('SIGTERM');
      }
    } catch (_) {}
  });

  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
