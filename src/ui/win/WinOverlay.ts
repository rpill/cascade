import * as Phaser from 'phaser';
import type { ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { UiSurface } from '../components/UiSurface.ts';
import { ButtonSurface } from '../components/ButtonSurface.ts';
import { playUiButtonSound } from '../sound/UiSound.ts';
import { ProgressMeter } from '../components/ProgressMeter.ts';
import { CASCADE_UI_ART_KEYS } from '../assets/CascadeUiArt.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export interface WinOverlayMasteryContent {
  readonly beforeRank: keyof typeof CASCADE_UI_ART_KEYS.rank;
  readonly afterRank: keyof typeof CASCADE_UI_ART_KEYS.rank;
  readonly beforeRankLabel: string;
  readonly afterRankLabel: string;
  readonly beforeProgressCurrent: number;
  readonly beforeProgressTotal: number;
  readonly afterProgressCurrent: number;
  readonly afterProgressTotal: number;
  readonly beforeCaption: string;
  readonly afterCaption: string;
  readonly progressLabel: string;
  readonly promoted: boolean;
  readonly rewardLine: string | null;
}

export interface WinOverlayContent {
  readonly title: string;
  readonly kicker: string | null;
  readonly resultLine: string;
  readonly detailLine: string | null;
  readonly noticeLine: string | null;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel: string;
  readonly mastery?: WinOverlayMasteryContent | null;
}

export interface WinOverlayActions {
  readonly newDeal: () => void;
  readonly home: () => void;
}

interface OverlayButton {
  readonly surface: ButtonSurface;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly action: () => void;
}

export class WinOverlay {
  private readonly scene: Phaser.Scene;
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly panel: PaperPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly kicker: Phaser.GameObjects.Text;
  private readonly result: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly masteryPanel: UiSurface;
  private readonly masteryBadge: Phaser.GameObjects.Image;
  private readonly masteryRank: Phaser.GameObjects.Text;
  private readonly masteryCaption: Phaser.GameObjects.Text;
  private readonly masteryProgressLabel: Phaser.GameObjects.Text;
  private readonly masteryProgressValue: Phaser.GameObjects.Text;
  private readonly masteryReward: Phaser.GameObjects.Text;
  private readonly masteryMeter: ProgressMeter;
  private readonly primary: OverlayButton;
  private readonly secondary: OverlayButton;
  private content: WinOverlayContent;
  private visible = true;
  private lastLayout: ViewportLayout | null = null;
  private masteryMeterBounds: { x:number; y:number; width:number; height:number } | null = null;

  constructor(scene: Phaser.Scene, content: WinOverlayContent, actions: WinOverlayActions, depth = 5000) {
    this.scene = scene;
    this.content = content;
    this.dimmer = scene.add.rectangle(0,0,1,1,UI_TOKENS.color.overlay,0.74).setOrigin(0).setDepth(depth).setInteractive();
    this.panel = new PaperPanel(scene, {
      depth: depth + 1,
      textureKey: CASCADE_UI_ART_KEYS.masteryPanelBg,
      artworkAlpha: 0.80,
      artworkWashAlpha: 0.82,
      artworkMode: 'cover',
    });
    this.kicker = this.makeText(scene, depth + 2, '#7a642f', 'system-ui, sans-serif', true);
    this.title = this.makeText(scene, depth + 2, '#24302e', 'Georgia, serif', true);
    this.result = this.makeText(scene, depth + 2, '#24302e', 'system-ui, sans-serif', true);
    this.detail = this.makeText(scene, depth + 2, '#64706a', 'system-ui, sans-serif', false);
    this.notice = this.makeText(scene, depth + 2, '#8b7430', 'system-ui, sans-serif', true);
    this.masteryPanel = new UiSurface(scene, depth + 1.2);
    this.masteryBadge = scene.add.image(0,0,CASCADE_UI_ART_KEYS.rank.novice).setDepth(depth + 2);
    this.masteryRank = this.makeText(scene, depth + 2, '#24302e', 'Georgia, serif', true);
    this.masteryCaption = this.makeText(scene, depth + 2, '#64706a', 'system-ui, sans-serif', false);
    this.masteryProgressLabel = this.makeText(scene, depth + 2, '#64706a', 'system-ui, sans-serif', true);
    this.masteryProgressValue = this.makeText(scene, depth + 2, '#6f5728', 'system-ui, sans-serif', true);
    this.masteryReward = this.makeText(scene, depth + 2, '#7a642f', 'system-ui, sans-serif', true);
    this.masteryMeter = new ProgressMeter(scene, depth + 2);
    this.primary = this.createButton(scene, actions.newDeal, depth + 2);
    this.secondary = this.createButton(scene, actions.home, depth + 2);
    this.applyContent();
  }

  setContent(content: WinOverlayContent): void { this.content = content; this.applyContent(); if (this.lastLayout) this.layout(this.lastLayout); }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.dimmer.setVisible(visible).setActive(visible);
    this.panel.setVisible(visible);
    for (const text of [this.kicker,this.title,this.result,this.detail,this.notice,this.masteryRank,this.masteryCaption,this.masteryProgressLabel,this.masteryProgressValue,this.masteryReward]) text.setVisible(visible && text.text.length > 0);
    this.masteryPanel.setVisible(visible && Boolean(this.content.mastery));
    this.masteryBadge.setVisible(visible && Boolean(this.content.mastery));
    this.masteryMeter.setVisible(visible && Boolean(this.content.mastery));
    this.setButtonVisible(this.primary, visible);
    this.setButtonVisible(this.secondary, visible);
  }

  playMasteryAnimation(): void {
    const mastery = this.content.mastery;
    if (!this.visible || !mastery) return;

    this.masteryBadge.setTexture(CASCADE_UI_ART_KEYS.rank[mastery.beforeRank]).setScale(1).setAlpha(1);
    this.masteryRank.setText(mastery.beforeRankLabel);
    this.masteryCaption.setText(mastery.beforeCaption);
    this.masteryReward.setText('');
    this.updateMasteryMeter(mastery.beforeProgressCurrent, mastery.beforeProgressTotal);

    if(mastery.promoted){
      this.animateMasteryMeter(
        mastery.beforeProgressCurrent,
        mastery.beforeProgressTotal,
        mastery.beforeProgressTotal,
        420,
        ()=>{
          this.masteryBadge.setTexture(CASCADE_UI_ART_KEYS.rank[mastery.afterRank]).setScale(0.90).setAlpha(0.55);
          this.masteryRank.setText(mastery.afterRankLabel);
          this.masteryCaption.setText(mastery.afterCaption);
          this.masteryReward.setText(mastery.rewardLine ?? '');
          this.updateMasteryMeter(0, mastery.afterProgressTotal);
          this.scene.tweens.add({ targets:this.masteryBadge, alpha:1, scale:1, duration:300, ease:'Back.Out' });
          this.animateMasteryMeter(0, mastery.afterProgressCurrent, mastery.afterProgressTotal, 420);
        },
      );
      return;
    }

    this.animateMasteryMeter(
      mastery.beforeProgressCurrent,
      mastery.afterProgressCurrent,
      mastery.afterProgressTotal,
      520,
      ()=>{
        this.masteryRank.setText(mastery.afterRankLabel);
        this.masteryCaption.setText(mastery.afterCaption);
      },
    );
  }

  layout(layout: ViewportLayout): void {
    this.lastLayout = layout;
    const compact = layout.profile === 'compact-landscape';
    const vw = layout.viewportWidth, vh = layout.viewportHeight;
    this.dimmer.setSize(vw,vh);
    const width = Math.min(vw * (compact ? 0.78 : 0.62), compact ? 820 : 930);
    const height = Math.min(vh * (compact ? 0.88 : 0.78), compact ? 520 : 650);
    const bounds = {x:(vw-width)/2,y:(vh-height)/2,width,height};
    this.panel.layout(bounds);
    const cx = bounds.x + bounds.width/2;
    const pad = bounds.width * 0.07;
    this.kicker.setPosition(cx,bounds.y+height*0.09).setFontSize(Math.max(12,height*0.032));
    this.title.setPosition(cx,bounds.y+height*(this.content.kicker?0.16:0.11)).setFontSize(Math.max(24,height*0.075));
    this.result.setPosition(cx,bounds.y+height*0.25).setFontSize(Math.max(14,height*0.038));
    this.detail.setPosition(cx,bounds.y+height*0.31).setFontSize(Math.max(12,height*0.030));
    this.notice.setPosition(cx,bounds.y+height*0.37).setFontSize(Math.max(12,height*0.030));

    const mastery = this.content.mastery;
    const panelY = bounds.y + height*0.42;
    const panelH = height*0.34;
    const panelBounds = {x:bounds.x+pad,y:panelY,width:bounds.width-pad*2,height:panelH};
    this.masteryPanel.setVisible(this.visible && Boolean(mastery));
    if (mastery) {
      this.masteryPanel.layout(panelBounds,'paper',true);
      const badgeSize = Math.min(panelH * 0.50, panelBounds.width * 0.17);
      this.masteryBadge.setPosition(panelBounds.x + panelBounds.width * 0.18, panelY + panelH * 0.50).setDisplaySize(badgeSize, badgeSize);

      const contentLeft = panelBounds.x + panelBounds.width * 0.34;
      const contentRight = panelBounds.x + panelBounds.width * 0.92;
      const contentWidth = contentRight - contentLeft;
      const progressLabelWidth = contentWidth * 0.34;
      const progressGap = panelBounds.width * 0.018;
      const progressValueWidth = contentWidth * 0.12;
      const meterHeight = Math.max(10, panelH * 0.075);
      const row1Y = panelY + panelH * 0.26;
      const row2Y = panelY + panelH * 0.46;
      const row3Y = panelY + panelH * 0.70;

      this.masteryRank
        .setOrigin(0, 0.5)
        .setPosition(contentLeft, row1Y)
        .setFontSize(Math.max(17, panelH * 0.14));

      this.masteryCaption
        .setOrigin(0, 0.5)
        .setPosition(contentLeft, row2Y)
        .setFontSize(Math.max(11, panelH * 0.075))
        .setWordWrapWidth(contentWidth * 0.92)
        .setAlign('left');

      this.masteryProgressLabel
        .setOrigin(0, 0.5)
        .setPosition(contentLeft, row3Y)
        .setFontSize(Math.max(10, panelH * 0.065));

      const meterX = contentLeft + progressLabelWidth + progressGap;
      const meterBounds = {
        x: meterX,
        y: row3Y - meterHeight / 2,
        width: Math.max(32, contentRight - meterX - progressGap - progressValueWidth),
        height: meterHeight,
      };
      this.masteryMeterBounds = meterBounds;
      this.masteryMeter.layout(meterBounds);

      this.masteryProgressValue
        .setOrigin(1, 0.5)
        .setPosition(contentRight, row3Y)
        .setFontSize(Math.max(10, panelH * 0.065));

      this.masteryReward
        .setOrigin(0.5, 0.5)
        .setPosition(panelBounds.x + panelBounds.width * 0.65, panelY + panelH * 0.87)
        .setFontSize(Math.max(10, panelH * 0.065));
    }

    const buttonY=bounds.y+height*0.82, gap=bounds.width*0.025;
    const buttonW=(bounds.width-pad*2-gap)/2, buttonH=Math.max(44,height*0.105);
    this.layoutButton(this.secondary,{x:bounds.x+pad,y:buttonY,width:buttonW,height:buttonH},'paper');
    this.layoutButton(this.primary,{x:bounds.x+pad+buttonW+gap,y:buttonY,width:buttonW,height:buttonH},'gold');
  }

  destroy(): void {
    this.dimmer.destroy(); this.panel.destroy(); this.masteryPanel.destroy(); this.masteryMeter.destroy(); this.masteryBadge.destroy();
    for(const text of [this.kicker,this.title,this.result,this.detail,this.notice,this.masteryRank,this.masteryCaption,this.masteryProgressLabel,this.masteryProgressValue,this.masteryReward]) text.destroy();
    this.destroyButton(this.primary); this.destroyButton(this.secondary);
  }

  private applyContent(): void {
    this.kicker.setText(this.content.kicker ?? '');
    this.title.setText(this.content.title);
    this.result.setText(this.content.resultLine);
    this.detail.setText(this.content.detailLine ?? '');
    this.notice.setText(this.content.noticeLine ?? '');
    this.primary.label.setText(this.content.primaryActionLabel);
    this.secondary.label.setText(this.content.secondaryActionLabel);
    const mastery=this.content.mastery;
    if(mastery){
      this.masteryBadge.setTexture(CASCADE_UI_ART_KEYS.rank[mastery.afterRank]);
      this.masteryRank.setText(mastery.afterRankLabel);
      this.masteryCaption.setText(mastery.afterCaption);
      this.masteryProgressLabel.setText(mastery.progressLabel);
      this.masteryReward.setText(mastery.rewardLine ?? '');
      this.updateMasteryMeter(mastery.afterProgressCurrent,mastery.afterProgressTotal);
    }
    if(this.lastLayout) this.setVisible(this.visible);
  }

  private animateMasteryMeter(from:number,to:number,total:number,duration:number,onComplete?:()=>void):void{
    this.scene.tweens.addCounter({
      from,
      to,
      duration,
      ease:'Sine.Out',
      onUpdate:(tween:Phaser.Tweens.Tween)=>this.updateMasteryMeter(Number(tween.getValue() ?? to),total),
      onComplete:()=>{ this.updateMasteryMeter(to,total); onComplete?.(); },
    });
  }

  private updateMasteryMeter(current:number,total:number):void{
    const safeTotal=Math.max(1,total);
    this.masteryMeter.setProgress({current,total:safeTotal});
    this.masteryProgressValue.setText(`${Math.round(current)} / ${safeTotal}`);
    if(this.masteryMeterBounds)this.masteryMeter.layout(this.masteryMeterBounds);
  }

  private makeText(scene:Phaser.Scene,depth:number,color:string,fontFamily:string,bold:boolean):Phaser.GameObjects.Text{
    return scene.add.text(0,0,'',{color,fontFamily,fontStyle:bold?'bold':'normal',align:'center'}).setOrigin(0.5).setDepth(depth);
  }

  private createButton(scene:Phaser.Scene,action:()=>void,depth:number):OverlayButton{
    const surface=new ButtonSurface(scene,depth);
    const label=scene.add.text(0,0,'',{color:'#24302e',fontFamily:'Georgia, serif',fontStyle:'bold'}).setOrigin(0.5).setDepth(depth+0.1);
    const zone=scene.add.zone(0,0,1,1).setOrigin(0).setDepth(depth+0.2).setInteractive();
    zone.input!.cursor='pointer';
    zone.on('pointerover',()=>surface.feedback('hover'));
    zone.on('pointerout',()=>surface.feedback('normal'));
    zone.on('pointerdown',()=>surface.feedback('pressed'));
    zone.on('pointerup',()=>{surface.feedback('hover');playUiButtonSound(scene);action();});
    return{surface,label,zone,action};
  }

  private layoutButton(button:OverlayButton,bounds:{x:number;y:number;width:number;height:number},tone:'paper'|'gold'):void{
    button.surface.layout(bounds,tone,'wide');
    button.label.setPosition(bounds.x+bounds.width/2,bounds.y+bounds.height/2).setFontSize(Math.max(13,bounds.height*0.32));
    button.zone.setPosition(bounds.x,bounds.y).setSize(bounds.width,bounds.height);
  }

  private setButtonVisible(button:OverlayButton,visible:boolean):void{button.surface.setVisible(visible);button.label.setVisible(visible);button.zone.setVisible(visible).setActive(visible);if(button.zone.input)button.zone.input.enabled=visible;}
  private destroyButton(button:OverlayButton):void{button.surface.destroy();button.label.destroy();button.zone.destroy();}
}
