const rawBaseUrl = process.env.CLOUDFLARE_BACKEND_URL ?? process.argv[2];
if (!rawBaseUrl?.trim()) {
  console.error('Usage: set CLOUDFLARE_BACKEND_URL or pass the Worker base URL as the first argument.');
  process.exit(1);
}

const baseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
const smokeOrigin = process.env.CLOUDFLARE_SMOKE_ORIGIN?.trim() || '';
const deniedOrigin = 'https://cascade-smoke-denied.invalid';

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON response with HTTP ${response.status}.`);
    }
  }
  return { response, body };
}

function assertStatus(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, got ${actual}.`);
}

function assertErrorBody(body, expected, label) {
  if (body?.error !== expected) {
    throw new Error(`${label}: expected error ${JSON.stringify(expected)}, got ${JSON.stringify(body)}.`);
  }
}

async function main() {
  const allowedOrigin = smokeOrigin || 'http://localhost:5173';

  const missing = await request('/__cascade_missing_route__');
  assertStatus(missing.response.status, 404, 'unknown route');
  assertErrorBody(missing.body, 'Not found.', 'unknown route');
  console.log('PASS unknown route');

  const profile = await request('/v1/profile');
  assertStatus(profile.response.status, 401, 'unauthorized profile');
  console.log('PASS unauthorized profile');

  const malformed = await request('/v1/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedData: 'cascade-smoke-malformed-signed-data' }),
  });
  if (malformed.response.status !== 400 && malformed.response.status !== 401) {
    throw new Error(`malformed session rejection: expected HTTP 400/401, got ${malformed.response.status}.`);
  }
  console.log('PASS malformed session rejection');

  const preflight = await request('/v1/profile', {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assertStatus(preflight.response.status, 204, 'preflight');
  console.log('PASS preflight');

  const allowed = await request('/__cascade_missing_route__', {
    headers: { Origin: allowedOrigin },
  });
  if (allowed.response.headers.get('access-control-allow-origin') !== allowedOrigin) {
    throw new Error(`CORS allowed origin: expected ${JSON.stringify(allowedOrigin)}, got ${JSON.stringify(allowed.response.headers.get('access-control-allow-origin'))}.`);
  }
  console.log('PASS CORS allowed origin');

  const denied = await request('/__cascade_missing_route__', {
    headers: { Origin: deniedOrigin },
  });
  if (denied.response.headers.get('access-control-allow-origin') !== null) {
    throw new Error('disallowed origin received CORS access');
  }
  console.log('PASS CORS denied origin');

  console.log('Cloudflare backend smoke PASSED.');
}

main().catch((error) => {
  console.error(`Cloudflare backend smoke FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
