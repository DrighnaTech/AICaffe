/**
 * Kill all stale AiCaffe processes on service ports.
 * Usage: node scripts/cleanup.js
 */
const { execSync } = require('child_process');

const PORTS = [3000, 3001, 3002, 3003, 8000, 8001, 8002, 8003, 8006];

console.log('Cleaning up stale processes...');

for (const port of PORTS) {
  try {
    const output = execSync(`netstat -ano | findstr ":${port} "`, {
      encoding: 'utf8',
      timeout: 3000,
    });
    const pids = new Set();
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && /^\d+$/.test(pid)) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 3000 });
        console.log(`  Killed PID ${pid} (port ${port})`);
      } catch (_) {
        // If taskkill times out or fails, try Stop-Process via PowerShell
        try {
          execSync(`powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, {
            stdio: 'ignore',
            timeout: 3000,
          });
          console.log(`  Killed PID ${pid} (port ${port}) via PowerShell`);
        } catch (_) {}
      }
    }
  } catch (_) {
    // No process on this port
  }
}

console.log('Cleanup done.\n');
