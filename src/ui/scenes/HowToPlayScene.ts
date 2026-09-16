import * as Phaser from 'phaser';
import { t } from '../../localization/Localization.ts';
import { productBridge } from '../bridge/CascadeProductBridge.ts';
import { RULE_SLIDES } from '../../game/view/RulesSlides.ts';
import { ActionCard } from '../components/ActionCard.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { computeNarrowScenePanel } from '../layout/SceneShellLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { SceneShell } from '../components/SceneShell.ts';

export class HowToPlayScene extends BaseUiScene {
  private pageIndex=0;private onboarding=false;private returnToGame=false;private titleText:Phaser.GameObjects.Text|null=null;private counterText:Phaser.GameObjects.Text|null=null;private bodyText:Phaser.GameObjects.Text|null=null;
  private shell:SceneShell|null=null;private prev:ActionCard|null=null;private next:ActionCard|null=null;private play:ActionCard|null=null;private paper:PaperPanel|null=null;private illustration:Phaser.GameObjects.Image|null=null;private cards:Phaser.GameObjects.Image[]=[];
  constructor(){super('HowToPlayScene');}
  init(data?:{onboarding?:boolean;returnToGame?:boolean}):void{this.onboarding=data?.onboarding===true;this.returnToGame=data?.returnToGame===true;this.pageIndex=0;}
  create():void{
    this.destroyOwnedUi();this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);const viewport=this.currentUiViewport();this.shell=new SceneShell(this,viewport,t('Как играть'),()=>this.exitHowToPlay(),20);this.paper=new PaperPanel(this,{depth:-10});this.illustration=this.add.image(0,0,UI_ICON_KEYS.howToPlay).setTint(UI_TOKENS.color.gold);this.cards=['spades-9','hearts-8','clubs-7'].map((key,index)=>this.add.image(0,0,key).setDepth(2+index));
    this.titleText=this.add.text(0,0,'',{color:'#f2e6c9',fontFamily:'Georgia, serif',fontStyle:'bold'}).setOrigin(0.5);this.counterText=this.add.text(0,0,'',{color:'#c7b98f',fontFamily:'system-ui, sans-serif'}).setOrigin(0.5);
    this.bodyText=this.add.text(0,0,'',{color:'#e7ddc5',fontFamily:'system-ui, sans-serif',align:'center',lineSpacing:8}).setOrigin(0.5);
    this.prev=new ActionCard(this,viewport,{title:'←',enabled:true},()=>this.changePage(-1),20);this.next=new ActionCard(this,viewport,{title:'→',enabled:true},()=>this.changePage(1),20);this.play=new ActionCard(this,viewport,{title:this.onboarding?t('ИГРАТЬ'):t('ЗАКРЫТЬ'),enabled:true,emphasis:'highlight'},()=>this.exitHowToPlay(),20);
    this.refreshPage();this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.destroyOwnedUi());this.bindResponsiveLayout();
  }
  protected layout(viewport:ResolvedUiViewport):void{
    if(!this.shell||!this.titleText||!this.bodyText)return;
    const shell=this.shell.layout(viewport);
    const panel=computeNarrowScenePanel(shell.content, viewport);
    const css=viewport.minTouchTarget/44;
    this.paper?.layout(panel);
    this.titleText.setColor('#24302e');this.counterText?.setColor('#846b3b');this.bodyText.setColor('#43534a');
    const emblem=Math.min(panel.height*0.16,92*viewport.uiScale);
    const cx=panel.x+panel.width/2;
    this.illustration?.setPosition(cx,panel.y+panel.height*0.34).setDisplaySize(emblem,emblem).setVisible(this.pageIndex!==0);
    const cardHeight=panel.height*0.22;
    this.cards.forEach((card,index)=>card.setVisible(this.pageIndex===0).setDisplaySize(cardHeight*0.65,cardHeight).setPosition(cx,panel.y+panel.height*(0.32+index*0.060)));
    const buttonHeight=Math.max(48*viewport.uiScale,viewport.minTouchTarget);
    this.titleText.setFontSize(Math.max(18*css,28*viewport.uiScale)).setPosition(cx,panel.y+panel.height*0.10);
    this.counterText?.setFontSize(Math.max(12*css,15*viewport.uiScale)).setPosition(cx,panel.y+panel.height*0.18);
    this.bodyText.setFontSize(Math.max(13*css,20*viewport.uiScale)).setWordWrapWidth(panel.width*0.82).setPosition(cx,panel.y+panel.height*0.64);
    const bottomY=panel.y+panel.height-buttonHeight-panel.height*0.045;
    const gap=Math.max(8*css,panel.width*0.018);
    const navWidth=Math.max(viewport.minTouchTarget,panel.width*0.14);
    const primaryWidth=Math.max(panel.width*0.42,panel.width-navWidth*2-gap*3);
    const rowWidth=navWidth*2+primaryWidth+gap*2;
    const rowX=panel.x+(panel.width-rowWidth)/2;
    this.prev?.setViewport(viewport);this.prev?.layout({x:rowX,y:bottomY,width:navWidth,height:buttonHeight});
    this.next?.setViewport(viewport);this.next?.layout({x:rowX+navWidth+gap,y:bottomY,width:navWidth,height:buttonHeight});
    this.play?.setViewport(viewport);this.play?.layout({x:rowX+navWidth*2+gap*2,y:bottomY,width:primaryWidth,height:buttonHeight});
  }

  private exitHowToPlay():void{if(this.returnToGame){productBridge.closeHowToPlay(this.onboarding);return;}this.scene.start('HomeScene');}
  private changePage(delta:number):void{this.pageIndex=(this.pageIndex+delta+RULE_SLIDES.length)%RULE_SLIDES.length;this.refreshPage();this.requestUiLayout();}
  private refreshPage():void{const page=RULE_SLIDES[this.pageIndex];if(!page)return;this.titleText?.setText(t(page.title));this.counterText?.setText(`${this.pageIndex+1} / ${RULE_SLIDES.length}`);this.bodyText?.setText(t(page.body));const icons=[UI_ICON_KEYS.howToPlay,UI_ICON_KEYS.archive,UI_ICON_KEYS.history,UI_ICON_KEYS.newDeal,UI_ICON_KEYS.themes,UI_ICON_KEYS.check];this.illustration?.setTexture(icons[this.pageIndex%icons.length]!);}
  private destroyOwnedUi():void{this.paper?.destroy();this.illustration?.destroy();this.cards.forEach(card=>card.destroy());this.cards=[];this.titleText?.destroy();this.counterText?.destroy();this.bodyText?.destroy();this.shell?.destroy();this.prev?.destroy();this.next?.destroy();this.play?.destroy();this.paper=null;this.illustration=null;this.titleText=null;this.counterText=null;this.bodyText=null;this.shell=null;this.prev=null;this.next=null;this.play=null;}
}
