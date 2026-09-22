import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  signBridgeSession,
  verifyBridgeSession,
  establishBridgeSession,
  type SessionDependencies,
} from '../server/cascade-api/session.ts';
import type { CascadeStore, DailyResultInput, StoredLeaderboardPage, VerifiedPlayerIdentity } from '../server/cascade-api/store.ts';

function b64url(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function signPikabu(payload: Record<string, unknown>, secret='pikabu-secret'): string {
  const h=b64url({alg:'HS256',typ:'JWT'}), p=b64url(payload);
  const sig=createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

class FakeStore implements CascadeStore {
  identities: Array<VerifiedPlayerIdentity & { nowMs: number }> = [];
  async upsertPlayer(identity: VerifiedPlayerIdentity, nowMs: number): Promise<void> { this.identities.push({ ...identity, nowMs }); }
  async readProfile(_pikabuId: string): Promise<string | null> { return null; }
  async writeProfile(_pikabuId: string, _serialized: string, _nowMs: number): Promise<void> {}
  async submitStandard(_pikabuId: string, _bestStreak: number, _nowMs: number): Promise<void> {}
  async readStandard(_limit: number, _pikabuId?: string): Promise<StoredLeaderboardPage> { return { entries: [], playerEntry: null }; }
  async submitDaily(_pikabuId: string, _result: DailyResultInput): Promise<'published' | 'replay'> { return 'published'; }
  async readDaily(_dailyId: string, _limit: number, _pikabuId?: string): Promise<StoredLeaderboardPage> { return { entries: [], playerEntry: null }; }
  async submitDailyStreak(_pikabuId: string, _current: number, _best: number, _nowMs: number): Promise<void> {}
  async readDailyStreak(_limit: number, _pikabuId?: string): Promise<StoredLeaderboardPage> { return { entries: [], playerEntry: null }; }
  async submitMastery(_pikabuId: string, _masteryRank: number, _masteryPoints: number, _nowMs: number): Promise<void> {}
  async readMastery(_limit: number, _pikabuId?: string): Promise<StoredLeaderboardPage> { return { entries: [], playerEntry: null }; }
}

function deps(store: FakeStore, nowSeconds=100): SessionDependencies {
  return { pikabuSecret:'pikabu-secret', bridgeSecret:'bridge-secret', store, nowSeconds:()=>nowSeconds };
}

test('bridge JWT round-trips Pikabu subject claims and expires after 30 minutes', async () => {
  const result=await signBridgeSession({pikabuId:'pikabu-42',name:'Alice',avatar:'https://x/a.png'},'bridge-secret',100);
  assert.equal(result.expiresAtMs,1_900_000);
  assert.deepEqual(await verifyBridgeSession(result.token,'bridge-secret',101),{
    pikabuId:'pikabu-42',name:'Alice',avatar:'https://x/a.png',issuedAt:100,expiresAt:1900,
  });
});

test('bridge JWT subject is verified Pikabu id', async () => {
  const signed = await signBridgeSession({ pikabuId: 'pikabu-42', name: 'Ada', avatar: '' }, 'bridge-secret', 100);
  const payload = JSON.parse(Buffer.from(signed.token.split('.')[1]!, 'base64url').toString('utf8'));
  assert.equal(payload.sub, 'pikabu-42');
  assert.equal(payload.pid, 'pikabu-42');
  assert.equal(typeof payload.sub, 'string');
});

test('bridge JWT rejects mismatched string subject and pid', async () => {
  const raw=(claims:Record<string,unknown>)=>{
    const h=b64url({alg:'HS256',typ:'JWT'}),p=b64url(claims);
    const sig=createHmac('sha256','bridge-secret').update(`${h}.${p}`).digest('base64url');
    return `${h}.${p}.${sig}`;
  };
  await assert.rejects(()=>verifyBridgeSession(raw({iss:'cascade-bridge',aud:'cascade-pikabu',sub:'other',pid:'pikabu-42',iat:100,exp:2000}),'bridge-secret',101),/sub|identity/i);
});

test('first authorized Pikabu session upserts identity and succeeds without provisioning', async () => {
  const store = new FakeStore();
  const session = await establishBridgeSession(
    { signedData: signPikabu({ id: 'pikabu-42', name: 'Ada', avatar: 'https://img.example/ada.png', isAuthorized: true }) },
    deps(store),
  );
  assert.deepEqual(store.identities, [{ pikabuId: 'pikabu-42', publicName: 'Ada', avatarUrl: 'https://img.example/ada.png', nowMs: 100_000 }]);
  assert.equal(session.claims.pikabuId, 'pikabu-42');
  assert.equal('gamePushPlayerId' in session.claims, false);
});

test('guest Pikabu token is rejected before identity upsert', async () => {
  const store = new FakeStore();
  await assert.rejects(()=>establishBridgeSession({signedData:signPikabu({id:'42',isAuthorized:false})},deps(store)),/authorized/i);
  assert.equal(store.identities.length,0);
});

test('session source contains no provisioning or GamePush path', () => {
  const source = readFileSync('server/cascade-api/session.ts', 'utf8');
  assert.doesNotMatch(source, /PROVISIONING_REQUIRED|GamePush|provisioning/);
});
