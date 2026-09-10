import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { findAvailablePort } from '../scripts/yandex-dev-proxy-lib.mjs';

function listen(server, port, host = '::') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port, host, exclusive: true }, () => {
      server.off('error', reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('findAvailablePort skips an occupied port and returns the next free port', async () => {
  const blocker = net.createServer();
  const address = await listen(blocker, 0);
  assert.equal(typeof address, 'object');
  const occupiedPort = address.port;

  try {
    const port = await findAvailablePort(occupiedPort, occupiedPort + 20);
    assert.ok(port > occupiedPort);
  } finally {
    await close(blocker);
  }
});

test('Windows proxy launch uses cmd.exe instead of spawning pnpm.cmd directly', async () => {
  const { createProxyLaunch } = await import('../scripts/yandex-dev-proxy-lib.mjs');
  const launch = createProxyLaunch(8082, 'win32', {
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
  });

  assert.equal(launch.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(launch.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.match(launch.args[3], /^pnpm dlx @yandex-games\/sdk-dev-proxy /);
  assert.match(launch.args[3], /--port=8082$/);
  assert.doesNotMatch(launch.command, /pnpm\.cmd$/i);
});
