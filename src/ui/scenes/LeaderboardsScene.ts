import Phaser from 'phaser';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { t } from '../../localization/Localization.ts';
import { decodeMasteryLeaderboardScore, type GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { IconButton } from '../components/IconButton.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { BaseUiScene } from './BaseUiScene.ts';

function formatTime(ms:number):string{const total=Math.max(0,Math.round(ms/1000)),m=Math.floor(total/60),s=total%60;return `${m}:${s.toString().padStart(2,'0')}`;}
export class LeaderboardsScene extends BaseUiScene {
  private back:IconButton|null=null;private tabs:SegmentedControl<GlobalLeaderboardMode>|null=null;private panel:PaperPanel|null=null;
  private title:Phaser.GameObjects.Text|null=null;private status:Phaser.GameObjects.Text|null=null;private rows:Phaser.GameObjects.Text[]=[];private signIn:ActionCard|null=null;
  private selected:GlobalLeaderboardMode='daily';private loading=false;private authorizing=false;private unsubscribe:(()=>void)|null=null;
  constructor(){super('LeaderboardsScene');}
  create():void{
    this.resetOwnedUi();this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);const viewport=this.currentUiViewport();
    this.back=new IconButton(this,viewport,{iconKey:UI_ICON_KEYS.back,enabled:true},()=>this.scene.start('HomeScene'),30);
    this.tabs=new SegmentedControl(this,viewport,[{value:'daily',label:'Daily'},{value:'winnable',label:t('ЛУЧШИЕ СЕРИИ')},{value:'mastery',label:t('Мастерство')}],this.selected,(tab)=>{this.selected=tab;this.tabs?.setSelected(tab);void this.refreshRows();},30);
    this.panel=new PaperPanel(this,{depth:10,textureKey:UI_TOKENS.asset.paperPanel});
    this.title=this.add.text(0,0,t('ТАБЛИЦА ЛИДЕРОВ'),{color:'#eadfc7',fontFamily:'Georgia, serif',fontStyle:'bold',align:'center'}).setOrigin(0.5).setDepth(30);
    this.status=this.add.text(0,0,'',{color:'#64706a',fontFamily:'system-ui, sans-serif',align:'center'}).setOrigin(0.5).setDepth(30);
    this.signIn=new ActionCard(this,viewport,{title:t('ВОЙТИ'),subtitle:t('Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.'),enabled:false},()=>{void this.authorizeAndReload();},30);
    this.updateSignInState();this.unsubscribe=productBridge.subscribe(()=>this.updateSignInState());this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.resetOwnedUi());this.bindResponsiveLayout();void this.refreshRows();
  }
  protected layout(viewport:ResolvedUiViewport):void{
    if(!this.back||!this.tabs||!this.panel||!this.title||!this.status||!this.signIn)return;const margin=viewport.safeMargin,headerH=Math.max(viewport.minTouchTarget,viewport.profile==='desktop'?54:44);
    this.back.setViewport(viewport);this.tabs.setViewport(viewport);this.signIn.setViewport(viewport);this.back.layout({x:margin,y:margin,width:headerH,height:headerH});
    this.title.setFontSize(Math.max(22,Math.min(40,headerH*0.62))).setPosition(viewport.width/2,margin+headerH/2);
    const contentX=margin,contentW=viewport.width-margin*2,tabsY=margin+headerH+12,tabsH=Math.max(viewport.minTouchTarget,50);this.tabs.layout({x:contentX,y:tabsY,width:contentW,height:tabsH});
    const panelY=tabsY+tabsH+12,authorized=productBridge.leaderboardSnapshot().authorized;this.signIn.setVisible(!authorized);const authH=authorized?0:Math.max(viewport.minTouchTarget,64),panelH=Math.max(120,viewport.height-panelY-margin-(authH>0?authH+12:0)),panelBounds:UiRect={x:contentX,y:panelY,width:contentW,height:panelH};
    this.panel.layout(panelBounds);this.status.setPosition(panelBounds.x+panelBounds.width/2,panelBounds.y+panelBounds.height*0.12).setFontSize(Math.max(13,Math.min(22,panelBounds.width*0.025)));
    const startY=panelBounds.y+panelBounds.height*0.24,rowGap=Math.max(24,Math.min(44,panelBounds.height*0.085));this.rows.forEach((row,index)=>row.setPosition(panelBounds.x+panelBounds.width*0.08,startY+index*rowGap).setFontSize(Math.max(12,Math.min(21,panelBounds.width*0.022))));
    if(authH>0)this.signIn.layout({x:contentX,y:panelY+panelH+12,width:contentW,height:authH});
  }
  private async refreshRows():Promise<void>{
    if(this.loading)return;this.loading=true;this.status?.setText(t('Загрузка…'));
    try{const result=await productBridge.loadLeaderboard(this.selected);if(!this.isUiSceneActive())return;this.rebuildRows(result.entries);this.status?.setText(result.status==='ready'?(result.playerEntry?`${t('Ваш результат')}: ${result.playerEntry.rank}`:t('ТОП-10')):result.status==='unavailable'?t('Таблица лидеров недоступна'):t('Не удалось загрузить таблицу лидеров'));this.updateSignInState();this.requestUiLayout();}finally{this.loading=false;}
  }
  private rebuildRows(entries:readonly LeaderboardRow[]):void{for(const row of this.rows)row.destroy();this.rows=entries.slice(0,10).map(entry=>{const name=entry.publicName.trim()||t('Игрок'),value=this.formatLeaderboardValue(entry.value);return this.add.text(0,0,`${entry.rank}. ${name}   ${value}`,{color:'#24302e',fontFamily:'system-ui, sans-serif'}).setOrigin(0,0.5).setDepth(20);});}
  private formatLeaderboardValue(value:number):string{
    if(this.selected==='daily')return formatTime(value);
    if(this.selected==='mastery'){
      const decoded=decodeMasteryLeaderboardScore(value);
      if(decoded===null)return '—';
      const labels={novice:'Новичок',player:'Игрок',tactician:'Тактик',expert:'Эксперт',master:'Мастер',grandmaster:'Грандмастер'} as const;
      return `${t(labels[decoded.rank])} · ${decoded.points}`;
    }
    return String(value);
  }
  private updateSignInState():void{const state=productBridge.leaderboardSnapshot();this.signIn?.setVisible(!state.authorized);this.signIn?.setState({title:t('ВОЙТИ'),subtitle:t('Войдите с Яндекс ID, чтобы сохранить рекорд и увидеть своё место в таблице.'),enabled:state.available&&state.authorizationAllowed&&!state.authorized&&!state.authPending&&!this.authorizing});this.requestUiLayout();}
  private async authorizeAndReload():Promise<void>{if(this.authorizing)return;this.authorizing=true;this.updateSignInState();try{if(await productBridge.authorizeLeaderboard())await this.refreshRows();}finally{this.authorizing=false;this.updateSignInState();}}
  private resetOwnedUi():void{this.unsubscribe?.();this.unsubscribe=null;this.back?.destroy();this.tabs?.destroy();this.panel?.destroy();this.title?.destroy();this.status?.destroy();this.signIn?.destroy();for(const row of this.rows)row.destroy();this.rows=[];this.back=null;this.tabs=null;this.panel=null;this.title=null;this.status=null;this.signIn=null;this.loading=false;this.authorizing=false;}
}
