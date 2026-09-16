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

function color(value: string): number { return Number.parseInt(value.replace('#',''),16); }

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
    this.surface=new UiSurface(scene,0,true,0.14);
    this.painting=scene.add.image(0,0,UI_ART_KEYS.jade).setOrigin(0);
    this.preview=scene.add.graphics();
    this.title=scene.add.text(0,0,'',{color:'#24302e',fontFamily:'Georgia, serif',fontStyle:'bold'}).setOrigin(0.5);
    this.status=scene.add.text(0,0,'',{color:'#64706a',fontFamily:'system-ui, sans-serif'}).setOrigin(0.5);
    this.action=scene.add.text(0,0,'',{color:'#7a642f',fontFamily:'system-ui, sans-serif',fontStyle:'bold'}).setOrigin(0.5);
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
    const radius=Math.max(8,bounds.height*0.055); this.surface.layout(bounds,'paper',true);
    const previewX=bounds.x+bounds.width*0.08, previewY=bounds.y+bounds.height*0.10, previewW=bounds.width*0.84, previewH=bounds.height*0.48;
    const crop=coverCrop(1536,1024,previewW,previewH,0,0.55), artScale=previewW/crop.width;
    this.painting.setCrop(crop.x,crop.y,crop.width,crop.height).setPosition(previewX-crop.x*artScale,previewY-crop.y*artScale).setScale(artScale).setTint(color(this.state.slotHighlight));
    this.preview.clear().fillStyle(color(this.state.boardSurface),0.45).fillRoundedRect(previewX,previewY,previewW,previewH,Math.max(5,radius*0.65)).lineStyle(Math.max(1,bounds.height*0.008),color(this.state.slotEdge),0.85);
    for(let i=0;i<3;i+=1){const sw=previewW*0.16,sh=previewH*0.42,sx=previewX+previewW*(0.08+i*0.22),sy=previewY+previewH*0.12;this.preview.strokeRoundedRect(sx,sy,sw,sh,Math.max(2,sw*0.08));}
    const bw=previewW*0.20,bh=previewH*0.72,bx=previewX+previewW*0.70,by=previewY+previewH*0.14;
    this.preview.fillStyle(color(this.state.slotHighlight),0.46).fillRoundedRect(bx,by,bw,bh,Math.max(3,bw*0.09)).lineStyle(Math.max(1,bounds.height*0.008),color(this.state.slotHighlight),1).strokeRoundedRect(bx,by,bw,bh,Math.max(3,bw*0.09));
    const css=1/this.scene.scale.zoom,titleSize=Math.max(13*css,Math.min(24*css,bounds.height*0.10));
    this.title.setFontSize(titleSize).setPosition(bounds.x+bounds.width/2,bounds.y+bounds.height*0.68);
    this.status.setFontSize(Math.max(10*css,titleSize*0.55)).setPosition(bounds.x+bounds.width/2,bounds.y+bounds.height*0.80);
    this.action.setFontSize(Math.max(11*css,titleSize*0.62)).setPosition(bounds.x+bounds.width/2,bounds.y+bounds.height*0.91);
    this.zone.setPosition(bounds.x,bounds.y).setSize(bounds.width,bounds.height);
  }
  destroy(): void { this.container.destroy(true); }
  private syncText(): void {
    this.title.setText(this.state.displayName);
    this.status.setText(this.state.active?`✓ ${t('ВЫБРАНА')}`:this.state.owned?t('В коллекции'):t('Недоступно')).setColor(this.state.active?'#20523e':'#64706a');
    this.action.setText(this.state.action==='apply'?t('ПРИМЕНИТЬ'):!this.state.owned?`● ${this.state.priceCoins}`:'').setVisible(this.state.action==='apply'||!this.state.owned);
  }
  private syncInteraction(): void {
    if (!this.zone.input) return;
    this.zone.input.cursor = this.state.action !== 'none' ? 'pointer' : 'default';
    this.surface.feedback('normal');
  }
}
