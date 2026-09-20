import type { PlatformServices } from './services.ts';

export function authorizationUsesProfileScopeTransfer(platform: PlatformServices): boolean {
  return platform.auth.playerStorageScopeChangesOnAuthorization === true;
}
