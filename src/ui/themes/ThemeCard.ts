import * as Phaser from 'phaser';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ThemeCardViewModel } from './ThemesViewModel.ts';
import { isPressGesture, type PointerPoint } from './ThemeCardPress.ts';
import type { Language } from '../../settings/Preferences.ts';
import { t } from '../../localization/Localization.ts';
import { UiSurface } from '../components/UiSurface.ts';
import { UI_ART_KEYS } from '../assets/UiAssets.ts';
import { coverCrop } from '../assets/ArtworkLayout.ts';

export class ThemeCard {
  readonly id: ThemeId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly surface: UiSurface;
  private readonly painting: Phaser.GameObjects.Image;
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private state: ThemeCardViewModel;
  private readonly onPress: (id: ThemeId) => void;
  private readonly scene: Phaser.Scene;
  private pressStart: PointerPoint | null = null;

  constructor(scene: Phaser.Scene, state: ThemeCardViewModel, onPress: (id: ThemeId) => void, _language: Language) {
    this.id=state.id; this.state=state; this.onPress=onPress; this.scene=scene;
    this.container=scene.add.container(0,0);
    this.surface=new UiSurface(scene);
    const key=`ui.theme.preview.${state.id}`;
    this.painting=scene.add.image(0,0,scene.textures.exists(key)?key:UI_ART_KEYS.jade).setOrigin(0);
    this.preview=scene.add.graphics();
    this.title=scene.add.text(0,0,'',{color:'#24302e',fontFamily:'Georgia, serif',fontStyle:'bold'}).setOrigin(0,0.5);
    this.status=scene.add.text(0,0,'',{color:'#64706a',fontFamily:'system-ui, sans-serif'}).setOrigin(0,0.5);
    this.action=scene.add.text(0,0,'',{color:'#7a642f',fontFamily:'system-ui, sans-serif',fontStyle:'bold'}).setOrigin(1,0.5);
    this.zone=scene.add.zone(0,0,1,1).setOrigin(0).setInteractive();
    this.syncInteraction();
    this.zone.on('pointerover',()=>{if(this.state.action!=='none')this.surface.feedback('hover');});
    this.zone.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{this.pressStart={x:pointer.x,y:pointer.y};if(this.state.action!=='none')this.surface.feedback('pressed');});
    this.zone.on('pointerup',(pointer:Phaser.Input.Pointer)=>{const start=this.pressStart;this.pressStart=null;if(this.state.action!=='none')this.surface.feedback('hover');if(!start||this.state.action==='none')return;if(isPressGesture(start,{x:pointer.x,y:pointer.y})){this.onPress(this.id);}});
    this.zone.on('pointerout',()=>{this.pressStart=null;this.surface.feedback('normal');});
    this.container.add([this.surface.object,this.painting,this.preview,this.title,this.status,this.action,this.zone]);
    this.syncText();
  }
  gameObject(): Phaser.GameObjects.Container { return this.container; }
  setLanguage(_language: Language): void { this.syncText(); }
  setState(state: ThemeCardViewModel): void { this.state=state; this.syncText(); this.syncInteraction(); }
  layout(bounds: UiRect): void {
    this.surface.layout(bounds,'paper',true);
    const css=1/this.scene.scale.zoom;
    const inset=Math.max(8*css,bounds.width*0.035);
    const previewX=bounds.x+inset,previewY=bounds.y+inset,previewW=bounds.width-inset*2,previewH=bounds.height*0.61;
    const frame=this.painting.frame;
    const crop=coverCrop(frame.realWidth,frame.realHeight,previewW,previewH,0.5,0.5),scale=previewW/crop.width;
    this.painting.setCrop(crop.x,crop.y,crop.width,crop.height).setPosition(previewX-crop.x*scale,previewY-crop.y*scale).setScale(scale);
    this.preview.clear().lineStyle(1*css,this.state.active?0x315c46:0xb69557,this.state.active?1:0.45)
      .strokeRect(previewX,previewY,previewW,previewH);
    if(this.state.active)this.preview.lineStyle(2*css,0x315c46,1).strokeRoundedRect(bounds.x+2*css,bounds.y+2*css,bounds.width-4*css,bounds.height-4*css,8*css);
    const titleSize=Math.max(13*css,Math.min(23*css,bounds.height*0.095));
    this.title.setFontSize(titleSize).setPosition(previewX,bounds.y+bounds.height*0.75);
    if(this.title.width>previewW)this.title.setFontSize(titleSize*previewW/this.title.width);
    this.status.setFontSize(Math.max(10*css,titleSize*0.55)).setPosition(previewX,bounds.y+bounds.height*0.90);
    this.action.setFontSize(Math.max(11*css,titleSize*0.62)).setPosition(bounds.x+bounds.width-inset,bounds.y+bounds.height*0.90);
    const statusWidth=previewW-this.action.width-10*css;
    if(this.status.width>statusWidth)this.status.setFontSize(Math.max(9*css,this.status.style.fontSize as number)*statusWidth/this.status.width);
    this.zone.setPosition(bounds.x,bounds.y).setSize(bounds.width,bounds.height);
  }
  destroy(): void { this.container.destroy(true); }
  private syncText(): void {
    this.title.setText(this.state.displayName);
    this.status.setText(this.state.active?`✓ ${t('ВЫБРАНА')}`:this.state.owned?t('В коллекции'):'').setColor(this.state.active?'#20523e':'#64706a');
    this.action.setText(this.state.action==='apply'?t('ПРИМЕНИТЬ'):!this.state.owned?`● ${this.state.priceCoins}`:'').setVisible(this.state.action==='apply'||!this.state.owned);
  }
  private syncInteraction(): void {
    if (!this.zone.input) return;
    this.zone.input.cursor = this.state.action !== 'none' ? 'pointer' : 'default';
    this.surface.feedback('normal');
  }
}
