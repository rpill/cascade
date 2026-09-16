import * as Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { CoinPill } from '../components/CoinPill.ts';
import { SceneShell } from '../components/SceneShell.ts';
import { ScrollRegion } from '../components/ScrollRegion.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { ThemeCard } from '../themes/ThemeCard.ts';
import { computeThemesGridLayout } from '../themes/ThemesGridLayout.ts';
import { buildThemesViewModel, type ThemesViewModel } from '../themes/ThemesViewModel.ts';
import { BaseUiScene } from './BaseUiScene.ts';

export class ThemesScene extends BaseUiScene {
  private shell: SceneShell | null=null; private coinPill: CoinPill | null=null; private reward: ActionCard | null=null;
  private scroll: ScrollRegion | null=null; private cards: ThemeCard[]=[];
  private viewModel: ThemesViewModel | null=null; private unsubscribe: (()=>void)|null=null;
  constructor(){super('ThemesScene');}
  create():void{
    this.resetOwnedUi(); this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const viewport=this.currentUiViewport(); this.refreshViewModel();
    this.shell=new SceneShell(this,viewport,t('Темы'),()=>this.scene.start('HomeScene'),30);
    this.coinPill=new CoinPill(this,30);
    this.reward=new ActionCard(this,viewport,{title:'',enabled:true},()=>{void productBridge.rewardedCoins();},30);
    this.scroll=new ScrollRegion(this,20); this.rebuildCards(); this.syncHeader();
    this.unsubscribe=productBridge.subscribe(()=>this.refreshFromBridge());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.resetOwnedUi()); this.bindResponsiveLayout();
  }
  protected layout(viewport:ResolvedUiViewport):void{
    if(!this.viewModel||!this.shell||!this.coinPill||!this.reward||!this.scroll)return;
    const shell=this.shell.layout(viewport);
    const layout=computeThemesGridLayout(viewport,shell.content,this.viewModel.cards.length); this.reward.setViewport(viewport);
    const headerGap=Math.max(6*viewport.uiScale,viewport.safeMargin*0.25);
    const coinWidth=Math.min(shell.rightSlot.width*0.34,150*viewport.uiScale);
    const rewardWidth=Math.max(viewport.minTouchTarget,shell.rightSlot.width-coinWidth-headerGap);
    this.reward.layout({x:shell.rightSlot.x,y:shell.rightSlot.y,width:rewardWidth,height:shell.rightSlot.height});
    this.coinPill.layout({x:shell.rightSlot.x+shell.rightSlot.width-coinWidth,y:shell.rightSlot.y,width:coinWidth,height:shell.rightSlot.height});
    this.scroll.layout(shell.content);this.scroll.setContentHeight(layout.contentHeight);
    this.cards.forEach((card,index)=>{const bounds=layout.cards[index];if(bounds)card.layout(bounds);});
  }
  private refreshViewModel():void{this.viewModel=buildThemesViewModel(productBridge.themesSnapshot(),getLanguage());}
  private async handleThemeAction(themeId:ThemeId):Promise<void>{
    const card=this.viewModel?.cards.find((item)=>item.id===themeId); if(!card||card.action==='none')return;
    if(card.action==='buy')productBridge.buyTheme(themeId);else await productBridge.equipTheme(themeId); this.refreshFromBridge();
  }
  private refreshFromBridge():void{
    if(!this.isUiSceneActive())return;this.refreshViewModel();this.syncHeader();
    for(const card of this.cards){const next=this.viewModel?.cards.find((entry)=>entry.id===card.id);if(next){card.setLanguage(getLanguage());card.setState(next);}}
    this.requestUiLayout();
  }
  private syncHeader():void{
    const snapshot=productBridge.themesSnapshot();this.coinPill?.setCoins(snapshot.coins);
    const remaining=snapshot.rewardedRemaining;
    this.reward?.setState({title:t('Получить монеты'),subtitle:snapshot.rewardedBusy?t('Загрузка…'):remaining>0?`${t('Смотреть рекламу')} · +25 · ${remaining}`:t('Лимит на сегодня исчерпан'),enabled:snapshot.rewardedAvailable&&!snapshot.rewardedBusy&&remaining>0});
    this.shell?.setTitle(t('Темы'));
  }
  private rebuildCards():void{
    if(!this.scroll||!this.viewModel)return;for(const card of this.cards)card.destroy();this.cards=[];
    for(const state of this.viewModel.cards){const card=new ThemeCard(this,state,(id)=>{void this.handleThemeAction(id);},getLanguage());this.scroll.add(card.gameObject());this.cards.push(card);}
  }
  private resetOwnedUi():void{
    this.unsubscribe?.();this.unsubscribe=null;this.shell?.destroy();this.coinPill?.destroy();this.reward?.destroy();this.scroll?.destroy();
    this.shell=null;this.coinPill=null;this.reward=null;this.scroll=null;this.cards=[];this.viewModel=null;
  }
}
