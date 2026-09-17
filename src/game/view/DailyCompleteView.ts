import type * as Phaser from 'phaser';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent } from '../../ui/win/WinOverlay.ts';
import { presentVictoryMastery, type VictoryMasteryState } from './VictoryMastery.ts';

export interface DailyCompleteState {
  readonly completionId:string;
  readonly elapsedMs:number;
  readonly moves:number;
  readonly bestTimeMs:number;
  readonly improvedBest:boolean;
  readonly weekCompleted:number;
  readonly mastery?: VictoryMasteryState | null;
}
export interface DailyCompleteActions { readonly retry:()=>void; readonly menu:()=>void; readonly sound?:(cue:SfxCue)=>void; }

function formatDuration(ms:number):string{const total=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}

function contentFor(state:DailyCompleteState):WinOverlayContent{
  return{
    title:t('ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО'),
    kicker:'Daily',
    resultLine:`${t('Время: {value0}', { value0: formatDuration(state.elapsedMs) })} · ${t('Ходы: {value0}', { value0: Math.max(0,state.moves) })}`,
    detailLine:t('Эта неделя: {value0} / 7',{value0:state.weekCompleted}),
    noticeLine:state.improvedBest ? t('Новый рекорд!') : null,
    primaryActionLabel:t('ПОВТОРИТЬ'),
    secondaryActionLabel:t('В МЕНЮ'),
    mastery: state.mastery ? presentVictoryMastery(state.mastery, getLanguage()) : null,
  };
}

/** Daily variant of the shared landscape victory overlay. */
export class DailyCompleteView {
  private readonly overlay:WinOverlay;
  private state:DailyCompleteState|null=null;
  private layoutState:ViewportLayout|null=null;
  private lastCelebratedCompletionId:string|null=null;
  constructor(scene:Phaser.Scene,private readonly actions:DailyCompleteActions){
    const initial:DailyCompleteState={completionId:'',elapsedMs:0,moves:0,bestTimeMs:0,improvedBest:false,weekCompleted:0};
    this.overlay=new WinOverlay(scene,contentFor(initial),{newDeal:actions.retry,home:actions.menu},5000);
    this.overlay.setVisible(false);
  }
  refreshLocalization():void{if(this.state)this.overlay.setContent(contentFor(this.state));}
  show(state:DailyCompleteState):void{
    this.state=state;
    this.overlay.setContent(contentFor(state));
    this.overlay.setVisible(true);
    if(this.layoutState)this.overlay.layout(this.layoutState);
    const freshCompletion=state.completionId!==this.lastCelebratedCompletionId;
    if(freshCompletion){this.lastCelebratedCompletionId=state.completionId;this.actions.sound?.('victory');this.overlay.playMasteryAnimation();}
  }
  layout(layout:ViewportLayout):void{this.layoutState=layout;this.overlay.layout(layout);}
  hide():void{this.overlay.setVisible(false);}
  destroy():void{this.overlay.destroy();}
}
