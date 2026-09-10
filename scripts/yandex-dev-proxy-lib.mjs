import net from 'node:net';

export async function isPortAvailable(port, host = '::') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    const cleanup = () => {
      server.removeAllListeners('error');
      server.removeAllListeners('listening');
    };

    server.once('error', (error) => {
      cleanup();
      if (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(error);
    });

    server.once('listening', () => {
      server.close((error) => {
        cleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      });
    });

    server.listen({ port, host, exclusive: true });
  });
}

export async function findAvailablePort(startPort = 8080, maxPort = 65535) {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65535) {
    throw new RangeError(`Invalid start port: ${startPort}`);
  }
  if (!Number.isInteger(maxPort) || maxPort < startPort || maxPort > 65535) {
    throw new RangeError(`Invalid max port: ${maxPort}`);
  }

  for (let port = startPort; port <= maxPort; port += 1) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`No free port found in range ${startPort}-${maxPort}`);
}

export function createProxyLaunch(port, platform = process.platform, env = process.env) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`Invalid proxy port: ${port}`);
  }

  const proxyArgs = [
    'dlx',
    '@yandex-games/sdk-dev-proxy',
    '-p',
    'dist',
    '--dev-mode=true',
    `--port=${port}`,
  ];

  if (platform === 'win32') {
    return {
      command: env.ComSpec || env.COMSPEC || 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        `pnpm ${proxyArgs.join(' ')}`,
      ],
    };
  }

  return {
    command: 'pnpm',
    args: proxyArgs,
  };
}
