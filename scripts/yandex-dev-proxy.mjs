import { spawn } from 'node:child_process';
import { createProxyLaunch, findAvailablePort } from './yandex-dev-proxy-lib.mjs';

const port = await findAvailablePort(8080);
console.log(`[Cascade] Starting Yandex Games SDK dev proxy on http://localhost:${port}`);

const launch = createProxyLaunch(port);
const child = spawn(launch.command, launch.args, { stdio: 'inherit' });

child.once('error', (error) => {
  console.error('[Cascade] Failed to start Yandex Games SDK dev proxy:', error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
