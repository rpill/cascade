// Real browser layout checks. Test-only access does not ship in the game bundle.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('artifacts',{recursive:true});
const errors=[];
async function open(width,height) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('new Phaser.Game(','globalThis.__menuGame = new Phaser.Game(')});
  });
  await page.goto(process.env.CASCADE_URL ?? 'http://127.0.0.1:5181/');
  await page.waitForFunction(()=>globalThis.__menuGame?.scene.getScene('GameScene')?.metaSession?.status==='ready');
  return page;
}
async function screenshot(page,name) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:`artifacts/menu-${name}.png`,animations:'disabled'});
}
try {
  for(const [width,height] of [[1915,953],[1366,768],[844,390],[667,375],[740,320],[390,844],[360,640]]) {
    const page=await open(width,height);
    await screenshot(page,`home-${width}`);
    assert.equal(await page.locator('.main-shell-daily-dot').count(),7,'Seven day indicators remain visible without trusted time');
    assert.match(await page.locator('.main-shell-level-reward').innerText(),/50/);
    const layout=await page.evaluate(()=>{
      const surface=document.querySelector('.app-shell-surface').getBoundingClientRect();
      const buttons=[...document.querySelectorAll('.main-shell-mode-play')].map(button=>{
        const b=button.getBoundingClientRect(), c=button.closest('article').getBoundingClientRect();
        return {bottomGap:c.bottom-b.bottom,inside:b.top>=c.top&&b.bottom<=c.bottom&&b.left>=c.left&&b.right<=c.right};
      });
      const footer=document.querySelector('.main-shell-play-footer').getBoundingClientRect();
      const cards=document.querySelector('.main-shell-mode-grid').getBoundingClientRect();
      const reward=document.querySelector('.main-shell-level-reward').getBoundingClientRect();
      return {left:surface.left,right:innerWidth-surface.right,bottom:surface.bottom,buttons,overlap:cards.bottom>footer.top+1,rewardBottom:reward.bottom};
    });
    assert.ok(layout.left>=23&&layout.right>=23,JSON.stringify({width,layout}));
    assert.ok(layout.bottom<=height&&layout.rewardBottom<=height,JSON.stringify({width,layout}));
    assert.ok(!layout.overlap,JSON.stringify({width,layout}));
    assert.ok(layout.buttons.every(b=>b.inside&&b.bottomGap>=11),JSON.stringify({width,layout}));
    await page.locator('[data-destination="collection"].app-shell-nav-button').click();
    await page.getByRole('button',{name:'Мои',exact:true}).click();
    await screenshot(page,`mine-${width}`);
    const maximumCardWidth=height<=560&&width>600?652:322;
    assert.ok((await page.locator('.theme-catalog-card').boundingBox()).width<=maximumCardWidth,'A single owned theme must not stretch');
    await page.getByRole('button',{name:'Все',exact:true}).click();
    await page.evaluate(()=>{
      const s=globalThis.__menuGame.scene.getScene('GameScene');
      const state=s.buildCatalogState();
      s.catalogView.update({...state,items:Array.from({length:12},(_,i)=>({...state.items[i%3],id:`fixture-${i}`,name:`Тема ${i+1}`}))});
    });
    assert.equal(await page.locator('.theme-catalog-card').count(),12);
    const grid=page.locator('.theme-catalog-grid');
    assert.ok(await grid.evaluate(el=>el.scrollHeight>el.clientHeight),'Growing catalog must scroll');
    await grid.hover();
    await page.mouse.wheel(0,2000);
    await page.waitForFunction(()=>document.querySelector('.theme-catalog-grid').scrollTop>0);
    await page.locator('[data-theme-id="fixture-11"] button').scrollIntoViewIfNeeded();
    const end=await page.locator('[data-theme-id="fixture-11"] button').boundingBox();
    assert.ok(end.y>=0&&end.y+end.height<=height,'Final theme action is reachable');
    await screenshot(page,`scroll-${width}`);
    await page.locator('[data-destination="collection"].app-shell-nav-button').click();
    assert.equal(await grid.evaluate(el=>el.scrollTop),0,'Changing catalog destination starts at the top');
    await screenshot(page,`collection-${width}`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Menu browser checks passed: desktop/landscape/portrait gutters, card buttons, Daily indicators, level reward, single-theme sizing and scrolling 12-theme catalogs.');
} finally {await browser.close();}
