import * as Phaser from 'phaser';
import type { StandardDifficulty } from '../../meta/MetaSave.ts';
import { getLanguage, t } from '../../localization/Localization.ts';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { ActionCard } from '../components/ActionCard.ts';
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
  private leaders: ActionCard | null = null;
  private difficulty: SegmentedControl<StandardDifficulty> | null = null;
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
    document.title = t('Пасьянс Каскад');
    this.game.canvas.parentElement?.setAttribute('aria-label', t('Пасьянс Каскад'));
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
    this.leaders = new ActionCard(this, viewport, {
      title: vm.leaders.title, subtitle: vm.leaders.subtitle, artwork: 'leaders', enabled: vm.leaders.enabled,
    }, () => this.scene.start('LeaderboardsScene'), 20);

    this.difficulty = new SegmentedControl(
      this,
      viewport,
      (['easy','medium','hard'] as const).map(value => ({ value, label: difficultyLabel(getLanguage(), value) })),
      vm.selectedDifficulty,
      value => this.selectDifficulty(value),
      30,
    );
    this.serviceButtons = [
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
    for (const component of [this.primary,this.newDeal,this.daily,this.mastery,this.leaders]) component?.setViewport(viewport);
    this.difficulty?.setViewport(viewport);
    for (const button of this.serviceButtons) button.setViewport(viewport);
    this.primary.layout(home.continuePrimary);
    this.difficulty?.layout(home.difficultySelector);
    this.newDeal?.layout(home.newDealAction);
    this.daily?.layout(home.daily);
    this.mastery?.layout(home.mastery);
    this.leaders?.layout(home.leaders);
    const gap=Math.max(6,home.serviceActions.height*0.14);
    const width=(home.serviceActions.width-gap)/2;
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
    this.leaders?.setState({title:vm.leaders.title,subtitle:vm.leaders.subtitle,artwork:'leaders',enabled:vm.leaders.enabled});
    this.difficulty?.setSelected(vm.selectedDifficulty);
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
    this.brandTitle=this.add.text(0,0,t('Пасьянс Каскад'),{color:'#e8c88a',fontFamily:'Georgia, serif'}).setOrigin(0.5).setDepth(3);
    this.brandSubtitle=this.add.text(0,0,t('Пасьянс для спокойной игры'),{color:'#e3d5b5',fontFamily:'Georgia, serif',align:'center'}).setOrigin(0.5).setDepth(3);
  }

  private layoutBrand(bounds: UiRect, viewport: ResolvedUiViewport): void {
    if (viewport.profile === 'mobile-landscape') {
      const css = viewport.minTouchTarget / 44;
      this.brandGraphics?.clear();
      const maxMobileTitleWidth = bounds.width - 8 * css;
      let mobileTitleSize = Math.min(27 * css, bounds.width * 0.105);
      this.brandTitle?.setText(t('Пасьянс Каскад')).setOrigin(0, 0.5).setLetterSpacing(0.6 * css).setFontSize(mobileTitleSize);
      if (this.brandTitle && this.brandTitle.width > maxMobileTitleWidth) {
        mobileTitleSize *= maxMobileTitleWidth / this.brandTitle.width;
        this.brandTitle.setFontSize(mobileTitleSize);
      }
      this.brandTitle?.setPosition(bounds.x + 4 * css, bounds.y + bounds.height / 2);
      this.brandSubtitle?.setVisible(false);
      return;
    }
    this.brandTitle?.setOrigin(0.5);
    this.brandSubtitle?.setVisible(true);
    const cx = bounds.x + bounds.width * 0.48;
    const panelY = bounds.y + bounds.height * 0.39;
    const panelHeight = bounds.height * 0.22;
    const dividerY = panelY + panelHeight * 0.55;
    this.brandGraphics?.clear().fillStyle(0x08291f,0.88).fillRoundedRect(bounds.x, panelY, bounds.width * 0.96, panelHeight, 12)
      .lineStyle(Math.max(1,viewport.minTouchTarget/44),UI_TOKENS.color.gold,0.85)
      .lineBetween(bounds.x+bounds.width*0.12, dividerY, bounds.x+bounds.width*0.84, dividerY);
    const maxTitleWidth = bounds.width * 0.80;
    let titleSize = Math.min(bounds.width * 0.092, panelHeight * 0.30);
    this.brandTitle?.setText(t('Пасьянс Каскад')).setLetterSpacing(titleSize * 0.012).setFontSize(titleSize);
    if (this.brandTitle && this.brandTitle.width > maxTitleWidth) {
      titleSize *= maxTitleWidth / this.brandTitle.width;
      this.brandTitle.setFontSize(titleSize);
    }
    this.brandTitle?.setPosition(cx, panelY + panelHeight * 0.32);
    this.brandSubtitle?.setFontSize(Math.max(11*viewport.minTouchTarget/44,titleSize*0.31)).setPosition(cx, panelY + panelHeight * 0.76);
  }
}
