// Run against the Vite dev server. The runtime handle is injected by this test only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
await mkdir('artifacts', { recursive: true });

async function newGamePage(width = 1915, height = 953, query = '', equipped = null) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(error.message));
  if (equipped !== null) {
    await page.addInitScript(id => localStorage.setItem('cascadePlayerData', JSON.stringify({
      cascadeMeta: { version: 2, equipped: { theme: id } },
    })), equipped);
  }
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('new Phaser.Game('));
    await route.fulfill({response, body: source.replace('new Phaser.Game(', 'globalThis.__themeTestGame = new Phaser.Game(')});
  });
  await page.goto(`${process.env.CASCADE_URL ?? 'http://127.0.0.1:5173/'}${query}`);
  await page.locator('.main-shell-mode-play').first().click();
  await page.waitForFunction(() => {
    const scene = globalThis.__themeTestGame?.scene.getScene('GameScene');
    return scene?.board && !scene.board.inputLocked;
  }, { }, {timeout: 10000}).catch(async error => {
    console.log(errors, await page.evaluate(() => {
      const game = globalThis.__themeTestGame;
      const scene = game?.scene.getScene('GameScene');
      return { game: !!game, scene: !!scene, status: scene?.sys.settings.status,
        board: !!scene?.board, locked: scene?.board?.inputLocked };
    }));
    throw error;
  });
  return page;
}

try {
  const page = await newGamePage();
  await page.screenshot({path: 'artifacts/theme-desktop.png'});
  const inspect = () => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    return {
      deal: JSON.stringify(scene.gameState.snapshot()),
      undo: scene.history.canUndo,
      objects: scene.children.length,
      theme: scene.activeTheme.id,
      slots: scene.board.appearance.slots.map(({image, role}) => ({
        role, key: image.texture.key, width: image.displayWidth, height: image.displayHeight,
      })),
      cardWidth: scene.board.layout.cardWidth,
      cardHeight: scene.board.layout.cardHeight,
    };
  };
  const before = await page.evaluate(inspect);
  for (const slot of before.slots) {
    assert.ok(Math.abs(slot.width - before.cardWidth) < 0.001);
    assert.ok(Math.abs(slot.height - before.cardHeight) < 0.001);
  }
  assert.equal(before.slots.length, 12);

  // A platform pause must not discard a successfully loaded equipped theme.
  assert.equal(await page.evaluate(async () => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    scene.scene.pause();
    const result = await scene.setTheme('green_felt_club');
    scene.scene.resume();
    return result;
  }), true, 'theme should apply while the platform pauses the scene');
  const green = await page.evaluate(inspect);
  assert.equal(green.theme, 'green_felt_club');
  assert.equal(green.deal, before.deal);
  assert.equal(green.objects, before.objects);
  assert.equal(await page.locator('.game-hud').getAttribute('data-theme'), 'green_felt_club');
  assert.ok(green.slots.every(slot => slot.key === 'green_felt_club-slot-frame'));
  await page.screenshot({path: 'artifacts/theme-green.png'});

  for (let index = 0; index < 4; index++) {
    await page.evaluate(async () => {
      const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
      await scene.setTheme('walnut_study');
      await scene.setTheme('green_felt_club');
    });
  }
  await page.evaluate(() => globalThis.__themeTestGame.scene.getScene('GameScene').setTheme('walnut_study'));
  const after = await page.evaluate(inspect);
  assert.equal(after.deal, before.deal);
  assert.equal(after.objects, before.objects);
  assert.equal(after.undo, before.undo);
  assert.equal(await page.locator('.game-hud').count(), 1);

  const stock = await page.evaluate(() => globalThis.__themeTestGame.scene.getScene('GameScene').board.layout.stock);
  await page.mouse.click(stock.x + 20, stock.y + 20);
  await page.waitForFunction(() => !globalThis.__themeTestGame.scene.getScene('GameScene').board.inputLocked);
  const drawn = await page.evaluate(inspect);
  assert.notEqual(drawn.deal, before.deal);
  await page.getByRole('button', {name: 'Отменить ход', exact: true}).click();
  await page.waitForFunction(() => !globalThis.__themeTestGame.scene.getScene('GameScene').board.inputLocked);
  assert.equal((await page.evaluate(inspect)).deal, before.deal);

  await page.setViewportSize({width: 844, height: 390});
  await page.waitForTimeout(250);
  await page.screenshot({path: 'artifacts/theme-compact.png'});
  assert.equal((await page.evaluate(inspect)).deal, before.deal);

  // Empty-state visual fixture: preserve all cards but expose a column and stock.
  await page.setViewportSize({width: 1915, height: 953});
  await page.evaluate(() => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    const snapshot = scene.gameState.snapshot();
    snapshot.waste.push(...snapshot.stock.splice(0), ...snapshot.tableau[0].splice(0));
    scene.gameState.restore(snapshot);
    scene.board.showRestoredState();
  });
  await page.waitForTimeout(200);
  await page.screenshot({path: 'artifacts/theme-empty-slots.png'});
  await page.close();

  const saved = await newGamePage(1366, 768, '', 'green_felt_club');
  await saved.waitForFunction(() => document.querySelector('.game-hud')?.dataset.theme === 'green_felt_club');
  await saved.close();
  const preview = await newGamePage(1366, 768, '?theme=walnut_study', 'green_felt_club');
  assert.equal(await preview.locator('.game-hud').getAttribute('data-theme'), 'walnut_study');
  assert.equal(await preview.evaluate(() => JSON.parse(localStorage.getItem('cascadePlayerData')).cascadeMeta.equipped.theme), 'green_felt_club');
  await preview.close();

  const failure = await newGamePage();
  await failure.route('**/green-felt-club/card-back.png', route => route.abort());
  assert.equal(await failure.evaluate(() => globalThis.__themeTestGame.scene.getScene('GameScene').setTheme('green_felt_club')), false);
  assert.equal(await failure.locator('.game-hud').getAttribute('data-theme'), 'walnut_study');
  await failure.unroute('**/green-felt-club/card-back.png');
  assert.equal(await failure.evaluate(() => globalThis.__themeTestGame.scene.getScene('GameScene').setTheme('green_felt_club')), true);
  const rapid = await failure.evaluate(() => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    return Promise.all([scene.setTheme('green_felt_club'), scene.setTheme('walnut_study')]);
  });
  assert.deepEqual(rapid, [false, true]);
  assert.equal(await failure.locator('.game-hud').getAttribute('data-theme'), 'walnut_study');
  await failure.close();

  const burgundy = await newGamePage(1915, 953, '?theme=burgundy_club');
  const burgundyMetrics = await burgundy.evaluate(() => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    const board = scene.board;
    const backs = board.stockBacks.filter(image => image.visible);
    const top = backs.at(-1);
    const stock = board.appearance.slots.find(slot => slot.role === 'stock');
    return {
      backWidth: top.displayWidth, backHeight: top.displayHeight,
      cardWidth: board.layout.cardWidth, cardHeight: board.layout.cardHeight,
      crop: [top.frame.cutX, top.frame.cutY, top.frame.realWidth, top.frame.realHeight],
      edgeKeys: backs.slice(0,-1).map(image => image.texture.key),
      slotVisible: stock.image.visible, glyphVisible: stock.glyph.visible,
      separateLayers: stock.image !== stock.glyph,
      frameDimensions: [stock.image.displayWidth,stock.image.displayHeight],
      surfacePieceCount: board.appearance.surface.pieces.length,
      surfaceUsesSingleCover: board.appearance.surface.tile !== null,
    };
  });
  assert.equal(burgundyMetrics.backWidth,burgundyMetrics.cardWidth);
  assert.equal(burgundyMetrics.backHeight,burgundyMetrics.cardHeight);
  assert.deepEqual(burgundyMetrics.crop,[2,2,356,466]);
  assert.deepEqual(burgundyMetrics.frameDimensions,[burgundyMetrics.cardWidth,burgundyMetrics.cardHeight]);
  assert.ok(burgundyMetrics.edgeKeys.every(key => key === 'cascade-stock-paper-edge'));
  assert.ok(burgundyMetrics.slotVisible && burgundyMetrics.glyphVisible && burgundyMetrics.separateLayers);
  assert.equal(burgundyMetrics.surfacePieceCount,0);
  assert.equal(burgundyMetrics.surfaceUsesSingleCover,true);
  await burgundy.mouse.move(900,900);
  await burgundy.screenshot({path:'artifacts/burgundy-desktop.png'});

  // Exact overlay proof: show half a face over a single back at the same coordinates.
  await burgundy.evaluate(() => {
    const scene = globalThis.__themeTestGame.scene.getScene('GameScene');
    const {cardWidth:w,cardHeight:h} = scene.board.layout;
    globalThis.__sizeProof = [
      scene.add.image(800,700,scene.activeTheme.cardBack.key,'card-back-art').setOrigin(0).setDisplaySize(w,h).setDepth(2000),
      scene.add.image(800+w/2,700,'spades-4').setOrigin(0).setDisplaySize(w,h).setDepth(2001),
    ];
  });
  await burgundy.screenshot({path:'artifacts/burgundy-size-proof.png',clip:{x:785,y:685,width:235,height:215}});
  await burgundy.evaluate(() => globalThis.__sizeProof.forEach(image => image.destroy()));

  await burgundy.setViewportSize({width:844,height:390});
  await burgundy.waitForTimeout(250);
  await burgundy.screenshot({path:'artifacts/burgundy-compact.png'});
  await burgundy.setViewportSize({width:1366,height:768});
  await burgundy.waitForTimeout(250);
  await burgundy.screenshot({path:'artifacts/burgundy-laptop.png'});
  await burgundy.evaluate(() => {
    const scene=globalThis.__themeTestGame.scene.getScene('GameScene');
    const snapshot=scene.gameState.snapshot();
    snapshot.waste.push(...snapshot.stock.splice(0),...snapshot.tableau[0].splice(0));
    scene.gameState.restore(snapshot);
    scene.board.showRestoredState();
  });
  await burgundy.screenshot({path:'artifacts/burgundy-empty-slots.png'});
  assert.equal(await burgundy.evaluate(() => {
    const board=globalThis.__themeTestGame.scene.getScene('GameScene').board;
    return board.appearance.slots.find(slot=>slot.role==='stock').glyph.visible;
  }),true);
  await burgundy.close();
  assert.deepEqual(errors, []);
  console.log('Theme browser checks passed: full bundles, pause, repeated switches, deal preservation, exact slot bounds, draw/undo, resize, empty slots, saved selection, preview override, failed download/retry and rapid selections.');
} finally {
  await browser.close();
}
