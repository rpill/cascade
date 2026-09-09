import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
async function open(width=1366,height=768) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__platformEvents={};
    window.YaGames={init:async()=>({
      environment:{i18n:{lang:'en'}},
      getPlayer:async()=>({getUniqueID:()=> 'settings-test',isAuthorized:()=>false,getData:async()=>({}),setData:async()=>{}}),
      serverTime:()=>Date.UTC(2026,8,9,12),isAvailableMethod:async()=>false,
      on:(name,callback)=>{(window.__platformEvents[name]??=new Set()).add(callback);},
      off:(name,callback)=>{window.__platformEvents[name]?.delete(callback);},
      auth:{openAuthDialog:async()=>{}},
    })};
  });
  await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('new Phaser.Game(','globalThis.__settingsGame = new Phaser.Game(')});
  });
  await page.goto(process.env.CASCADE_URL ?? 'http://127.0.0.1:5181/');
  await page.waitForFunction(()=>globalThis.__settingsGame?.scene.getScene('GameScene')?.metaSession?.status==='ready');
  return page;
}
async function expectMute(page, expected) {
  await page.waitForFunction(value=>globalThis.__settingsGame.scene.getScene('GameScene').sound.mute===value, expected);
}
async function snapshot(page) {
  return page.evaluate(()=>{
    const s=globalThis.__settingsGame.scene.getScene('GameScene');
    return {board:s.gameState?.snapshot(),undo:s.history.canUndo,attempt:s.attemptId};
  });
}
async function noRussian(page,selector) {
  const text=await page.locator(selector).innerText();
  assert.doesNotMatch(text,/[А-Яа-яЁё]/,`Untranslated interface: ${text}`);
}
try {
  const page=await open();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await noRussian(page,'.app-shell-dom');
  assert.equal(await page.locator('.main-shell-daily-dot').count(),7);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('switch',{name:'Sound',exact:true}).click();
  await expectMute(page,true);
  await page.locator('.settings-language').selectOption('ru');
  assert.match(await page.locator('.settings-title').innerText(),/Настройки/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.settings-dialog').isVisible(),false);
  assert.equal(await page.locator('.app-shell-dom').getAttribute('data-destination'),'play');
  await page.reload();
  await page.waitForFunction(()=>globalThis.__settingsGame?.scene.getScene('GameScene')?.metaSession?.status==='ready');
  assert.equal(await page.locator('html').getAttribute('lang'),'ru','Manual language overrides platform English after F5');
  await page.locator('[data-mode="winnable"] .main-shell-mode-play').click();
  // Chrome keeps AudioParam updates pending until a user gesture unlocks audio after reload.
  await expectMute(page,true);
  await page.waitForFunction(()=>{const s=globalThis.__settingsGame.scene.getScene('GameScene');return s.attemptStarted&&!s.board.inputLocked;});
  await page.evaluate(()=>globalThis.__settingsGame.scene.getScene('GameScene').board.handleStockClick());
  await page.waitForFunction(()=>!globalThis.__settingsGame.scene.getScene('GameScene').board.inputLocked);
  await page.evaluate(()=>globalThis.__settingsGame.scene.getScene('GameScene').openMainMenu());
  await page.locator('.app-shell-nav-button[data-destination="collection"]').click();
  const before=await snapshot(page);
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.locator('.settings-language').selectOption('en');
  await page.getByRole('switch',{name:'Sound',exact:true}).click();
  await expectMute(page,false);
  await page.evaluate(()=>window.__platformEvents.game_api_pause.forEach(callback=>callback()));
  await expectMute(page,true);
  await page.getByRole('switch',{name:'Sound',exact:true}).click();
  await page.getByRole('switch',{name:'Sound',exact:true}).click();
  await expectMute(page,true);
  await page.evaluate(()=>window.__platformEvents.game_api_resume.forEach(callback=>callback()));
  await expectMute(page,false);
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectMute(page,true);
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectMute(page,false);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.app-shell-dom').getAttribute('data-destination'),'collection');
  assert.deepEqual(await snapshot(page),before,'Settings must preserve board, Undo and attempt');
  await noRussian(page,'.theme-catalog-view');
  await page.getByRole('button',{name:'Rules',exact:true}).click();
  await noRussian(page,'.main-shell-rules');
  await page.keyboard.press('Escape');
  await page.locator('.app-shell-nav-button[data-destination="statistics"]').click();
  await noRussian(page,'.main-shell-statistics');
  await page.close();
  for(const [width,height] of [[844,390],[390,844],[360,640]]) {
    const phone=await open(width,height);
    await phone.waitForLoadState('networkidle');
    await phone.screenshot({path:`artifacts/settings-home-en-${width}.png`,animations:'disabled'});
    await noRussian(phone,'.app-shell-dom');
    await phone.getByRole('button',{name:'Settings',exact:true}).click();
    const dialog=await phone.locator('.settings-dialog').boundingBox();
    assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=width&&dialog.y+dialog.height<=height);
    await phone.screenshot({path:`artifacts/settings-dialog-${width}.png`,animations:'disabled'});
    await phone.keyboard.press('Escape');
    await phone.locator('.app-shell-nav-button[data-destination="statistics"]').click();
    await phone.screenshot({path:`artifacts/settings-statistics-en-${width}.png`,animations:'disabled'});
    assert.ok(await phone.locator('.main-shell-statistics').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Statistics must fit the narrow shell');
    await noRussian(phone,'.main-shell-statistics');
    await phone.getByRole('button',{name:'Rules',exact:true}).click();
    await phone.screenshot({path:`artifacts/settings-rules-en-${width}.png`,animations:'disabled'});
    assert.ok(await phone.locator('.main-shell-rules').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Rules must fit the narrow shell');
    await noRussian(phone,'.main-shell-rules');
    await phone.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Settings browser checks passed: SDK English, manual RU override/F5, real mute and lifecycle gates, live translation, modal return and board/Undo preservation, responsive English screens.');
} finally {await browser.close();}
