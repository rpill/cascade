import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPikabuSignedData } from '../server/cascade-api/auth.ts';

function b64url(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function sign(payload: Record<string, unknown>, secret='secret', header:Record<string,unknown>={alg:'HS256',typ:'JWT'}): string {
  const h=b64url(header), p=b64url(payload);
  const sig=createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

test('valid Pikabu HS256 token returns normalized authorized player', async () => {
  const token=sign({id:' 42 ',name:' Alice ',avatar:'https://example.com/a.png',isAuthorized:true});
  assert.deepEqual(await verifyPikabuSignedData(token,'secret',true),{id:'42',name:'Alice',avatar:'https://example.com/a.png',isAuthorized:true});
});

test('tampered signature is rejected', async () => {
  const token=sign({id:'42',name:'Alice',isAuthorized:true})+'x';
  await assert.rejects(()=>verifyPikabuSignedData(token,'secret',true),/signature/i);
});

test('header alg none is rejected before payload trust', async () => {
  const token=sign({id:'42',isAuthorized:true},'secret',{alg:'none'});
  await assert.rejects(()=>verifyPikabuSignedData(token,'secret',true),/HS256/);
});

test('header alg HS512 is rejected even with a syntactically valid token', async () => {
  const token=sign({id:'42',isAuthorized:true},'secret',{alg:'HS512'});
  await assert.rejects(()=>verifyPikabuSignedData(token,'secret',true),/HS256/);
});

test('isAuthorized false is rejected for required account identity', async () => {
  const token=sign({id:'42',name:'Guest',isAuthorized:false});
  await assert.rejects(()=>verifyPikabuSignedData(token,'secret',true),/authorized/i);
  assert.equal((await verifyPikabuSignedData(token,'secret',false)).isAuthorized,false);
});

test('missing id or overlong name/avatar is rejected or normalized', async () => {
  await assert.rejects(()=>verifyPikabuSignedData(sign({name:'x',isAuthorized:true}),'secret',true),/id/i);
  const player=await verifyPikabuSignedData(sign({id:'42',name:'x'.repeat(300),avatar:'y'.repeat(3000),isAuthorized:true}),'secret',true);
  assert.equal(player.name?.length,100);
  assert.equal(player.avatar,undefined);
});
