import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX_ASSETS, SfxController } from '../src/settings/SfxController.ts';

test('SFX catalog contains the complete first-pass solitaire feedback set', () => {
  assert.deepEqual(Object.keys(SFX_ASSETS).sort(), [
    'button','card-place','card-touch','coin-reward','deal','level-up','undo','victory',
  ]);
  for (const asset of Object.values(SFX_ASSETS)) {
    assert.ok(Array.isArray(asset.urls) && asset.urls.length > 0);
    for (const url of asset.urls) assert.match(url, /^\.\/assets\/audio\/sfx\/.+\.(?:ogg|wav)$/);
    assert.ok(asset.volume > 0 && asset.volume <= 1);
  }
});

test('SfxController maps semantic cues to loaded Phaser audio keys and tuned volume', () => {
  const calls: Array<{key:string;config?:{volume?:number}}> = [];
  const sfx = new SfxController({ play:(key,config)=>{ calls.push({key,config}); return true; } });
  sfx.play('card-place');
  assert.equal(calls.length, 1);
  assert.ok(SFX_ASSETS['card-place'].keys.includes(calls[0].key));
  assert.deepEqual(calls[0].config, {volume:SFX_ASSETS['card-place'].volume});
});


test('card handling cues share one quiet calibrated playback gain', () => {
  assert.equal(SFX_ASSETS['card-touch'].volume, 0.04);
  assert.equal(SFX_ASSETS['card-place'].volume, 0.04);
  assert.equal(SFX_ASSETS.deal.volume, 0.04);
  assert.ok(SFX_ASSETS.button.volume <= 0.05);
});

test('card touch uses one stable physical sample instead of alternating pickup sounds', () => {
  assert.equal(SFX_ASSETS['card-touch'].keys.length, 1);
  const calls: Array<{key:string;config?:{volume?:number}}> = [];
  const sfx = new SfxController({ play:(key,config)=>{ calls.push({key,config}); return true; } });
  sfx.play('card-touch');
  sfx.play('card-touch');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
});

test('SfxController skips playback while Phaser audio is locked and does not advance variants', () => {
  const calls: Array<{key:string;config?:{volume?:number}}> = [];
  const manager = {
    locked: true,
    play:(key:string,config?:{volume?:number})=>{ calls.push({key,config}); return true; },
  };
  const sfx = new SfxController(manager);

  sfx.play('deal');
  sfx.play('deal');
  assert.equal(calls.length, 0);

  manager.locked = false;
  sfx.play('deal');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, SFX_ASSETS.deal.keys[0]);
});
