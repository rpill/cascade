import * as Phaser from 'phaser';
import type { StandardDifficulty } from '../../meta/MetaSave.ts';
import { getLanguage, t } from '../../localization/Localization.ts';
import { THEME_CATALOG } from '../../theme/ThemeCatalog.ts';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { CoinPill } from '../components/CoinPill.ts';
import { IconButton } from '../components/IconButton.ts';
import { ModalShell } from '../components/ModalShell.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { buildHomeViewModel, difficultyLabel, type HomeViewModel } from '../home/HomeViewModel.ts';
import { computeHomeLayout, type UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';

export class HomeScene extends BaseUiScene {
  private viewModel: HomeViewModel | null = null;
  private primary: ActionCard | null = null;
  private newDeal: ActionCard | null = null;
  private daily: ActionCard | null = null;
  private mastery: ActionCard | null = null;
  private themes: ActionCard | null = null;
  private difficulty: SegmentedControl<StandardDifficulty> | null = null;
  private coinPill: CoinPill | null = null;
  private serviceButtons: IconButton[] = [];
  private brandGraphics: Phaser.GameObjects.Graphics | null = null;
  private brandTitle: Phaser.GameObjects.Text | null = null;
  private brandSubtitle: Phaser.GameObjects.Text | null = null;
  private unsubscribeBridge: (() => void) | null = null;
  private newDealConfirmShell: ModalShell | null = null;
  private newDealConfirmText: Phaser.GameObjects.Text | null = null;
  private newDealConfirmCancel: ActionCard | null = null;
  private newDealConfirmStart: ActionCard | null = null;

  constructor() { super('HomeScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    this.refreshViewModel();
    const viewport = this.currentUiViewport();
    const vm = this.requireViewModel();

    this.primary = new ActionCard(this, viewport, {
      title: vm.primary.title,
      subtitle: vm.primary.subtitle,
      artwork: 'landscape',
      enabled: true,
    }, () => this.openPrimary(), 20);

    this.newDeal = new ActionCard(this, viewport, {
      title: vm.newDeal.title,
      emphasis: 'highlight',
      enabled: true,
    }, () => this.requestNewStandard(), 20);

    this.daily = new ActionCard(this, viewport, {
      title: 'Daily', subtitle: vm.daily.subtitle, artwork: 'daily', enabled: vm.daily.enabled,
    }, () => this.scene.start('DailyScene'), 20);
    this.mastery = new ActionCard(this, viewport, {
      title: t('Мастерство'), subtitle: vm.mastery.subtitle, artwork: 'mastery',
      artworkKey: CASCADE_UI_ART_KEYS.rank[vm.mastery.rank], enabled: vm.mastery.enabled,
    }, () => this.scene.start('MasteryScene'), 20);
    this.themes = new ActionCard(this, viewport, {
      title: t('Темы'), subtitle: vm.themes.subtitle, artwork: 'themes', enabled: vm.themes.enabled,
    }, () => this.scene.start('ThemesScene'), 20);

    this.difficulty = new SegmentedControl(
      this,
      viewport,
      (['easy','medium','hard'] as const).map(value => ({ value, label: difficultyLabel(getLanguage(), value) })),
      vm.selectedDifficulty,
      value => this.selectDifficulty(value),
      30,
    );
    this.coinPill = new CoinPill(this, 30);
    this.coinPill.setCoins(vm.coins);
    this.serviceButtons = [
      new IconButton(this, viewport, { iconKey:UI_ICON_KEYS.leaderboard, enabled:vm.leaderboardsEnabled }, () => this.scene.start('LeaderboardsScene'), 30),
      new IconButton(this, viewport, { iconKey:UI_ICON_KEYS.howToPlay, enabled:true }, () => this.scene.start('HowToPlayScene'), 30),
      new IconButton(this, viewport, { iconKey:UI_ICON_KEYS.settings, enabled:true }, () => this.scene.start('SettingsScene'), 30),
    ];
    this.createBrand();
    this.unsubscribeBridge = productBridge.subscribe(() => this.refreshFromBridge());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeBridge?.(); this.unsubscribeBridge = null; this.closeNewDealConfirmation();
    });
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.primary) return;
    const home = computeHomeLayout(viewport);
    for (const component of [this.primary,this.newDeal,this.daily,this.mastery,this.themes]) component?.setViewport(viewport);
    this.difficulty?.setViewport(viewport);
    for (const button of this.serviceButtons) button.setViewport(viewport);
    this.primary.layout(home.continuePrimary);
    this.difficulty?.layout(home.difficultySelector);
    this.newDeal?.layout(home.newDealAction);
    this.daily?.layout(home.daily);
    this.mastery?.layout(home.mastery);
    this.themes?.layout(home.themes);
    this.coinPill?.layout(home.coinPill);
    const gap=Math.max(6,home.serviceActions.height*0.14);
    const width=(home.serviceActions.width-gap*2)/3;
    this.serviceButtons.forEach((button,index)=>button.layout({x:home.serviceActions.x+index*(width+gap),y:home.serviceActions.y,width,height:home.serviceActions.height}));
    this.layoutBrand(home.brand,viewport);
    this.layoutNewDealConfirmation(viewport);
  }

  private requireViewModel(): HomeViewModel { if (!this.viewModel) throw new Error('Home view model is not ready.'); return this.viewModel; }

  private refreshViewModel(): void {
    const snapshot = productBridge.snapshot();
    this.viewModel = buildHomeViewModel({
      state:snapshot.state,
      activeMode:snapshot.activeMode,
      activeDifficulty:snapshot.activeDifficulty,
      currentDailyId:snapshot.currentDailyId,
      leaderboardsEnabled:snapshot.leaderboardsEnabled,
      themesTotal:snapshot.themesTotal || THEME_CATALOG.length,
      language:getLanguage(),
    });
  }

  private refreshFromBridge(): void {
    if (!this.isUiSceneActive()) return;
    this.refreshViewModel();
    const vm=this.requireViewModel();
    this.primary?.setState({title:vm.primary.title,subtitle:vm.primary.subtitle,artwork:'landscape',enabled:true});
    this.newDeal?.setState({title:vm.newDeal.title,emphasis:'highlight',enabled:true});
    this.daily?.setState({title:'Daily',subtitle:vm.daily.subtitle,artwork:'daily',enabled:vm.daily.enabled});
    this.mastery?.setState({title:t('Мастерство'),subtitle:vm.mastery.subtitle,artwork:'mastery',artworkKey:CASCADE_UI_ART_KEYS.rank[vm.mastery.rank],enabled:true});
    this.themes?.setState({title:t('Темы'),subtitle:vm.themes.subtitle,artwork:'themes',enabled:true});
    this.difficulty?.setSelected(vm.selectedDifficulty);
    this.coinPill?.setCoins(vm.coins);
    this.serviceButtons[0]?.setState({iconKey:UI_ICON_KEYS.leaderboard,enabled:vm.leaderboardsEnabled});
    this.requestUiLayout();
  }

  private openPrimary(): void {
    const vm=this.requireViewModel();
    if (vm.primary.hasActiveGame) productBridge.resumeGame();
    else productBridge.startStandard(vm.selectedDifficulty);
  }

  private requestNewStandard(): void {
    if (this.requireViewModel().primary.hasActiveGame) { this.confirmNewDeal(); return; }
    productBridge.startStandard(this.requireViewModel().selectedDifficulty);
  }

  private selectDifficulty(difficulty: StandardDifficulty): void {
    productBridge.setStandardDifficulty(difficulty);
    this.refreshFromBridge();
  }

  private confirmNewDeal(): void {
    if (this.newDealConfirmShell) return;
    const viewport=this.currentUiViewport();
    this.newDealConfirmShell=new ModalShell(this,t('Начать новую раздачу?'),()=>this.closeNewDealConfirmation(),5000);
    this.newDealConfirmText=this.add.text(0,0,t('Текущая партия будет завершена.'),{color:'#64706a',fontFamily:'system-ui, sans-serif',align:'center'}).setOrigin(0.5).setDepth(5002);
    this.newDealConfirmCancel=new ActionCard(this,viewport,{title:t('ОТМЕНА'),enabled:true},()=>this.closeNewDealConfirmation(),5002);
    this.newDealConfirmStart=new ActionCard(this,viewport,{title:t('НОВАЯ РАЗДАЧА'),emphasis:'highlight',enabled:true},()=>{
      const difficulty=this.requireViewModel().selectedDifficulty;
      this.closeNewDealConfirmation();
      productBridge.startStandard(difficulty);
    },5002);
    this.layoutNewDealConfirmation(viewport);
  }

  private closeNewDealConfirmation(): void {
    this.newDealConfirmShell?.destroy(); this.newDealConfirmText?.destroy(); this.newDealConfirmCancel?.destroy(); this.newDealConfirmStart?.destroy();
    this.newDealConfirmShell=null; this.newDealConfirmText=null; this.newDealConfirmCancel=null; this.newDealConfirmStart=null;
  }

  private layoutNewDealConfirmation(viewport: ResolvedUiViewport): void {
    if(!this.newDealConfirmShell||!this.newDealConfirmText||!this.newDealConfirmCancel||!this.newDealConfirmStart)return;
    this.newDealConfirmCancel.setViewport(viewport); this.newDealConfirmStart.setViewport(viewport);
    const scale=viewport.minTouchTarget/44;
    const width=Math.min(viewport.width*(viewport.profile==='desktop'?0.42:0.68),680*scale);
    const height=Math.min(viewport.height*0.62,Math.max(240*scale,viewport.minTouchTarget*4.8));
    const bounds:UiRect={x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height};
    this.newDealConfirmShell.layout(viewport.width,viewport.height,bounds);
    this.newDealConfirmText.setFontSize(Math.max(12*scale,Math.min(20*scale,bounds.height*0.07))).setPosition(bounds.x+bounds.width/2,bounds.y+bounds.height*0.44);
    const gap=Math.max(8*scale,viewport.minTouchTarget*0.18),buttonHeight=Math.max(viewport.minTouchTarget,bounds.height*0.19),innerWidth=bounds.width*0.78,buttonWidth=(innerWidth-gap)/2,buttonY=bounds.y+bounds.height-buttonHeight-bounds.height*0.10,buttonX=bounds.x+(bounds.width-innerWidth)/2;
    this.newDealConfirmCancel.layout({x:buttonX,y:buttonY,width:buttonWidth,height:buttonHeight});
    this.newDealConfirmStart.layout({x:buttonX+buttonWidth+gap,y:buttonY,width:buttonWidth,height:buttonHeight});
  }

  private createBrand(): void {
    this.brandGraphics=this.add.graphics().setDepth(1);
    this.brandTitle=this.add.text(0,0,'CASCADE',{color:'#e8c88a',fontFamily:'Georgia, serif'}).setOrigin(0.5).setDepth(3);
    this.brandSubtitle=this.add.text(0,0,t('Пасьянс для спокойной игры'),{color:'#e3d5b5',fontFamily:'Georgia, serif',align:'center'}).setOrigin(0.5).setDepth(3);
  }

  private layoutBrand(bounds: UiRect, viewport: ResolvedUiViewport): void {
    const cx=bounds.x+bounds.width*0.48,cy=bounds.y+bounds.height*0.34,r=Math.max(4,bounds.width*0.012);
    this.brandGraphics?.clear().lineStyle(Math.max(1,viewport.minTouchTarget/44),UI_TOKENS.color.gold,0.85)
      .lineBetween(bounds.x+bounds.width*0.12,cy,cx-r*3,cy).lineBetween(cx+r*3,cy,bounds.x+bounds.width*0.84,cy);
    for(const dx of [-r*1.5,0,r*1.5]) this.brandGraphics?.beginPath().moveTo(cx+dx,cy-r).lineTo(cx+dx+r,cy).lineTo(cx+dx,cy+r).lineTo(cx+dx-r,cy).closePath().strokePath();
    const titleSize=bounds.width*0.135;
    this.brandTitle?.setLetterSpacing(titleSize*0.08).setFontSize(titleSize).setPosition(cx,bounds.y+bounds.height*0.29);
    this.brandSubtitle?.setFontSize(Math.max(11*viewport.minTouchTarget/44,titleSize*0.23)).setPosition(cx,bounds.y+bounds.height*0.385);
  }
}
