import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
async function createPage({failRead=false,scope='edge-player',previousScope,small=false}={}) {
  const page=await browser.newPage({viewport:small ? {width:844,height:390} : {width:1366,height:768}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({failRead,scope,previousScope})=>{
    window.__readFails=failRead;
    window.__serverTime=Date.UTC(2026,8,8,12);
    window.__remote=JSON.parse(sessionStorage.getItem('test-remote') ?? 'null') ?? {cascadeMeta:{version:3,progression:{coins:600,totalXp:600},collection:{ownedThemes:['walnut_study']}}};
    window.__writeFails=sessionStorage.getItem('test-write-fails')==='true';
    window.__writes=0;
    if(previousScope) {
      localStorage.setItem('cascadeMetaScope',previousScope);
      localStorage.setItem('cascadeMetaJournal:'+encodeURIComponent(previousScope),JSON.stringify({version:1,stream:'old-stream',nextSequence:3,pending:[
        {stream:'old-stream',sequence:1,operation:{kind:'begin',attemptId:'old-stream~1',mode:'winnable'}},
        {stream:'old-stream',sequence:2,operation:{kind:'complete',attemptId:'old-stream~1',mode:'winnable',elapsedMs:1000,trustedDay:null,trustedWeek:null}},
      ]}));
    }
    window.YaGames={init:async()=>({
      getPlayer:async()=>({getUniqueID:()=>scope,isAuthorized:()=>false,
        getData:async()=>{if(window.__readFails)throw new Error('offline');return structuredClone(window.__remote);},
        setData:async (data,flush)=>{
          window.__writes++;
          if(!flush)throw new Error('Expected an acknowledged write');
          if(window.__writeFails)throw new Error('Yandex storage unavailable');
          window.__remote=structuredClone(data);
          sessionStorage.setItem('test-remote',JSON.stringify(data));
        },
      }),serverTime:()=>window.__serverTime,isAvailableMethod:async()=>false,auth:{openAuthDialog:async()=>{}},
    })};
  },{failRead,scope,previousScope});
  await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('new Phaser.Game(','globalThis.__economyGame = new Phaser.Game(')});
  });
  await page.goto(process.env.CASCADE_URL ?? 'http://127.0.0.1:5173/');
  await page.waitForFunction(()=>{const s=globalThis.__economyGame?.scene.getScene('GameScene');return s?.metaSession?.status=== 'ready'||s?.metaSession?.status==='error';});
  return page;
}
async function won(page) {
  await page.evaluate(async()=>{
    const s=globalThis.__economyGame.scene.getScene('GameScene');
    const {createCard}=await import('/src/game/model/cards.ts');
    const {SUITS}=await import('/src/game/model/types.ts');
    s.gameState.restore({tableau:Array.from({length:7},()=>[]),stock:[],waste:[],freeCell:null,
      foundations:Object.fromEntries(SUITS.map(suit=>[suit,Array.from({length:13},(_,i)=>createCard(suit,i+1))]))});
    s.onBoardSettled(s.gameState);
  });
}
async function settled(page) {
  await page.waitForFunction(()=>{const s=globalThis.__economyGame.scene.getScene('GameScene');return s.attemptStarted&&!s.board.inputLocked;});
}
try {
  const failed=await createPage({failRead:true});
  await failed.locator('.app-shell-nav-button[data-destination="collection"]').click();
  assert.match(await failed.locator('.theme-catalog-status').innerText(),/Не удалось загрузить/);
  assert.equal(await failed.evaluate(()=>window.__writes),0);
  await failed.evaluate(()=>window.__readFails=false);
  await failed.locator('.theme-catalog-retry').click();
  await failed.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').metaSession.status==='ready');
  assert.match(await failed.locator('.theme-catalog-wallet').innerText(),/600/);
  // Failed asset load leaves purchased ownership and the selected previous theme intact.
  await failed.route('**/themes/navy-study/board-surface.webp',route=>route.abort());
  const navy=failed.locator('[data-theme-id="navy_study"] button');
  await navy.click();
  await navy.click();
  await failed.waitForFunction(()=>!globalThis.__economyGame.scene.getScene('GameScene').catalogBusyId);
  assert.equal(await failed.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').activeTheme.id),'walnut_study');
  assert.match(await failed.locator('.theme-catalog-status').innerText(),/Не удалось загрузить тему/);
  await failed.unroute('**/themes/navy-study/board-surface.webp');
  await navy.click();
  await failed.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.equipped.theme==='navy_study');
  await failed.close();

  // A rejected Yandex write must retain the purchase/equip journal through F5.
  const offline=await createPage();
  await offline.evaluate(()=>{
    window.__writeFails=true;
    sessionStorage.setItem('test-write-fails','true');
  });
  await offline.locator('.app-shell-nav-button[data-destination="collection"]').click();
  const offlineNavy=offline.locator('[data-theme-id="navy_study"] .theme-catalog-card-action');
  await offlineNavy.click();
  await offline.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').metaSession.saveError);
  await offlineNavy.click();
  await offline.waitForFunction(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.equipped.theme==='navy_study');
  assert.equal(await offline.evaluate(()=>window.__remote.cascadeMeta.progression.coins),600);
  assert.equal(await offline.evaluate(()=>JSON.parse(localStorage.getItem('cascadeMetaJournal:yandex-edge-player')).pending.length),2);
  await offline.reload();
  await offline.waitForFunction(()=>{
    const s=globalThis.__economyGame?.scene.getScene('GameScene');
    return s?.metaSession?.saveError&&s.activeTheme.id==='navy_study';
  });
  assert.equal(await offline.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),300);
  await offline.locator('.app-shell-nav-button[data-destination="collection"]').click();
  await offline.evaluate(()=>{
    window.__writeFails=false;
    sessionStorage.removeItem('test-write-fails');
  });
  await offline.locator('.theme-catalog-retry').click();
  await offline.waitForFunction(()=>{
    const s=globalThis.__economyGame.scene.getScene('GameScene');
    return !s.metaSession.saving&&!s.metaSession.saveError&&s.metaJournal.pending.length===0;
  });
  assert.equal(await offline.evaluate(()=>window.__remote.cascadeMeta.progression.coins),300);
  assert.equal(await offline.evaluate(()=>window.__remote.cascadeMeta.equipped.theme),'navy_study');
  await offline.reload();
  await offline.waitForFunction(()=>globalThis.__economyGame?.scene.getScene('GameScene')?.activeTheme?.id==='navy_study');
  assert.equal(await offline.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),300);
  await offline.close();

  const switched=await createPage({scope:'new-account',previousScope:'yandex-old-account'});
  assert.equal(await switched.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.stats.winnable.wins),0);
  assert.equal(await switched.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),600);
  assert.equal(await switched.evaluate(()=>JSON.parse(localStorage.getItem('cascadeMetaJournal:yandex-old-account')).pending.length),2);
  await switched.close();

  const daily=await createPage({small:true});
  await daily.locator('[data-mode="daily"] .main-shell-mode-play').click();
  await settled(daily);
  await won(daily);
  assert.equal(await daily.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),755);
  await daily.screenshot({path:'artifacts/economy-daily-844.png'});
  const clipped=await daily.locator('.daily-complete-dom:not([hidden]) .daily-complete-panel').evaluate(el=>{
    const r=el.getBoundingClientRect();return r.top<0||r.bottom>innerHeight;
  });
  assert.equal(clipped,false,'Daily reward panel must fit compact landscape');
  await daily.locator('.daily-complete-retry').click();
  await settled(daily);
  await won(daily);
  assert.equal(await daily.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),755);
  await daily.locator('.daily-complete-menu').click();
  await daily.evaluate(()=>window.__serverTime+=86400000);
  await daily.locator('[data-mode="daily"] .main-shell-mode-play').click();
  assert.equal(await daily.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').dailyContext.dailyId),'2026-09-09');
  await settled(daily);
  await daily.evaluate(()=>{
    window.__originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.startsWith('cascadeMetaJournal:'))throw new Error('quota');return window.__originalSetItem.call(this,key,value);};
  });
  await won(daily);
  assert.equal(await daily.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),755);
  assert.match(await daily.locator('.daily-complete-dom:not([hidden]) .reward-summary-total').innerText(),/начисляются/);
  await daily.evaluate(()=>Storage.prototype.setItem=window.__originalSetItem);
  await daily.locator('.daily-complete-menu').click();
  await daily.locator('.app-shell-nav-button[data-destination="collection"]').click();
  await daily.locator('.theme-catalog-retry').click();
  assert.equal(await daily.evaluate(()=>globalThis.__economyGame.scene.getScene('GameScene').metaState.progression.coins),910);
  await daily.close();
  assert.deepEqual(errors,[]);
  console.log('Edge browser checks passed: failed profile read/retry, rejected Yandex writes across F5 and retry, theme load failure/retry, scoped journals, Daily payout/repeat/date rollover, local journal failure recovery and compact result.');
} finally {await browser.close();}
