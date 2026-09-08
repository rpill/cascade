import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurfaceSlices } from '../src/game/view/SurfaceSlices.ts';

test('wide scenes preserve full top/bottom and uniform corner object proportions', () => {
  const pieces = getSurfaceSlices(2000, 900, 1600, 900, {left:320,right:360,top:420,bottom:420});
  assert.equal(pieces.length, 9);
  assert.deepEqual(pieces[0], {sx:0,sy:0,sw:320,sh:420,x:0,y:0,width:320,height:420});
  assert.deepEqual(pieces[2], {sx:1240,sy:0,sw:360,sh:420,x:1640,y:0,width:360,height:420});
  assert.equal(pieces[7].y + pieces[7].height, 900);
  assert.equal(pieces[1].y, 0);
});

test('compact and tall viewports stay fully covered with no overlapping or negative patches', () => {
  for (const [width,height] of [[844,390],[1366,768],[1280,1024]]) {
    const pieces = getSurfaceSlices(width,height,1600,900,{left:320,right:360,top:420,bottom:420});
    assert.ok(pieces.every(p => p.width > 0 && p.height > 0));
    assert.ok(Math.abs(pieces.reduce((sum,p) => sum+p.width*p.height,0)-width*height)<0.001);
    for (const index of [0,2,6,8]) {
      const p=pieces[index];
      assert.ok(Math.abs(p.width/p.sw-p.height/p.sh)<1e-9);
    }
    assert.equal(pieces[1].x, pieces[0].width);
    assert.equal(pieces[1].x+pieces[1].width, pieces[2].x);
  }
});
