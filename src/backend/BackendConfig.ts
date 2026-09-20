export function normalizeBackendUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}

export function resolveBackendUrl(): string | null {
  const meta = import.meta as ImportMeta & { readonly env?: { readonly VITE_BACKEND_URL?: string } };
  return normalizeBackendUrl(meta.env?.VITE_BACKEND_URL);
}
