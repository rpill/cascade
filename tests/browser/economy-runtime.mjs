// Runtime integration test. Game access and fixtures are injected only into this test browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('artifacts',{recursive:true});
const errors=[];
async function pageFor({width=1366,height=768,funded=false}={}) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  if(funded) await page.addInitScript(()=>{
    if(!localStorage.getItem('cascadePlayerData')) localStorage.setItem('cascadePlayerData',JSON.stringify({cascadeMeta:{
      version:3,progression:{totalXp:600,coins:600},collection:{ownedThemes:['walnut_study']},equipped:{theme:'walnut_study'},
    }}));
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    const source=await response.text();
    assert.ok(source.includes('new Phaser.Game('));
    await route.fulfill({response,body:source.replace('new Phaser.Game(','globalThis.__economyGame = new Phaser.Game(')});
  });
  await page.goto(process.env.CASCADE_URL ?? 'http://127.0.0.1:5173/');
  await page.waitForFunction(()=>globalThis.__economyGame?.scene.getScene('GameScene')?.metaSession?.status==='ready');
  return page;
}
async function inspect(page) {
  return page.evaluate(()=>{
    const scene=globalThis.__economyGame.scene.getScene('GameScene');
    return {state:scene.metaState,theme:scene.activeTheme.id,attempt:scene.attemptId,
      board:scene.gameState ? JSON.stringify(scene.gameState.snapshot()) : null,undo:scene.history.canUndo};
  });
}
async function waitForSave(page) { await page.waitForFunction(()=>!globalThis.__economyGame.scene.getScene('GameScene').metaSession.saving); }
async function assertVisibleBounds(page,selector) {
  const failures=await page.locator(selector).evaluateAll(elements=>elements.filter(el=>el.getClientRects().length>0).flatMap(el=>{
    const r=el.getBoundingClientRect();
    return r.left < -1 || r.top < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1 ? [{class:el.className,x:r.x,y:r.y,w:r.width,h:r.height}] : [];
  }));
  assert.deepEqual(failures,[],`clipped controls: ${JSON.stringify(failures)}`);
}
async function assertCatalogActionsReachable(page) {
  for (const action of await page.locator('.theme-catalog-card-action').all()) {
    await action.scrollIntoViewIfNeeded();
    const bounds=await action.boundingBox();
    assert.ok(bounds.y>=0&&bounds.y+bounds.height<=page.viewportSize().height);
  }
  await page.locator('.theme-catalog-grid').evaluate(el=>el.scrollTop=0);
}
try {
  const page=await pageFor({funded:true});
  assert.match(await page.locator('.main-shell-player-progress').innerText(),/Уровень 4/);
  await page.screenshot({path:'artifacts/economy-home.png',animations:'disabled'});
  await page.locator('.app-shell-nav-button[data-destination="shop"]').click();
  await page.screenshot({path:'artifacts/economy-shop.png',animations:'disabled'});
  const navy=page.locator('[data-theme-id="navy_study"] .theme-catalog-card-action');
  await navy.click();
  assert.equal((await inspect(page)).state.progression.coins,300);
  await navy.click();
  await page.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').activeTheme.id==='navy_study');
  await waitForSave(page);
  await page.reload();
  await page.waitForFunction(()=>globalThis.__economyGame?.scene.getScene('GameScene')?.activeTheme?.id==='navy_study');
  assert.equal((await inspect(page)).state.progression.coins,300);
  await page.locator('.app-shell-nav-button[data-destination="shop"]').click();
  const burgundy=page.locator('[data-theme-id="burgundy_club"] .theme-catalog-card-action');
  await burgundy.click();
  await burgundy.click();
  await page.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').activeTheme.id==='burgundy_club');
  assert.equal((await inspect(page)).state.progression.coins,0);
  await page.locator('.app-shell-nav-button[data-destination="collection"]').click();
  assert.match(await page.locator('.theme-catalog-count').innerText(),/3 из 3/);
  await page.getByRole('button',{name:'Правила',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.app-shell-dom').getAttribute('data-destination'),'collection');
  await page.locator('.app-shell-nav-button[data-destination="play"]').click();
  await page.locator('[data-mode="winnable"] .main-shell-mode-play').click();
  await page.waitForFunction(()=>{const s=globalThis.__economyGame.scene.getScene('GameScene');return s.attemptStarted && !s.board.inputLocked;});
  // Exercise a real stock action and its undo history before changing appearance.
  await page.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').board.handleStockClick());
  await page.waitForFunction(()=>!globalThis.__economyGame.scene.getScene('GameScene').board.inputLocked);
  const before=await inspect(page);
  await page.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').openMainMenu());
  await page.locator('.app-shell-nav-button[data-destination="collection"]').click();
  await page.locator('[data-theme-id="navy_study"] .theme-catalog-card-action').click();
  await page.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.equipped.theme==='navy_study');
  const after=await inspect(page);
  assert.equal(after.board,before.board);
  assert.equal(after.undo,before.undo);
  assert.equal(after.attempt,before.attempt);
  await page.getByRole('button',{name:'К игре',exact:true}).click();
  // Complete the board via the real settled callback. Solitaire rules are covered by model tests.
  await page.evaluate(async()=>{
    const s=globalThis.__economyGame.scene.getScene('GameScene');
    const {createCard}=await import('/src/game/model/cards.ts');
    const {SUITS}=await import('/src/game/model/types.ts');
    s.gameState.restore({tableau:Array.from({length:7},()=>[]),stock:[],waste:[],freeCell:null,
      foundations:Object.fromEntries(SUITS.map(suit=>[suit,Array.from({length:13},(_,i)=>createCard(suit,i+1))]))});
    s.onBoardSettled(s.gameState);
  });
  assert.equal((await inspect(page)).state.progression.totalXp,700);
  assert.equal((await inspect(page)).state.progression.coins,75);
  await page.screenshot({path:'artifacts/economy-result.png',animations:'disabled'});
  await assertVisibleBounds(page,'.game-complete-panel button');
  await waitForSave(page);
  await page.reload();
  await page.waitForFunction(()=>globalThis.__economyGame?.scene.getScene('GameScene')?.metaSession?.status==='ready');
  assert.equal((await inspect(page)).state.progression.coins,75);
  await page.close();
  for(const [width,height] of [[1915,953],[1366,768],[844,390]]) {
    const screen=await pageFor({width,height});
    await screen.screenshot({path:`artifacts/economy-home-${width}.png`,animations:'disabled'});
    await assertVisibleBounds(screen,'.main-shell-player-progress,.app-shell-wallet');
    await screen.locator('.app-shell-nav-button[data-destination="collection"]').click();
    await screen.screenshot({path:`artifacts/economy-collection-${width}.png`,animations:'disabled'});
    await assertCatalogActionsReachable(screen);
    await screen.locator('.app-shell-nav-button[data-destination="shop"]').click();
    await screen.screenshot({path:`artifacts/economy-shop-${width}.png`,animations:'disabled'});
    await assertCatalogActionsReachable(screen);
    for(const button of await screen.locator('.theme-catalog-card-action').all()) assert.ok(await button.isDisabled());
    await screen.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Economy browser smoke passed: purchase/equip both, reload, real move/Undo preservation, win reward and three viewport sizes.');
} finally { await browser.close(); }
