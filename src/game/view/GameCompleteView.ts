import type * as Phaser from 'phaser';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent } from '../../ui/win/WinOverlay.ts';
import { presentVictoryMastery, type VictoryMasteryState } from './VictoryMastery.ts';

export interface GameCompleteState {
  readonly completionId: string;
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly moves: number;
  readonly improvedBest: boolean;
  readonly mastery?: VictoryMasteryState | null;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
  readonly sound?: (cue: SfxCue) => void;
}

function formatDuration(ms:number):string {
  const totalSeconds=Math.floor(Math.max(0,ms)/1000);
  return `${Math.floor(totalSeconds/60)}:${String(totalSeconds%60).padStart(2,'0')}`;
}

function contentFor(state:GameCompleteState):WinOverlayContent {
  return {
    title:t('ПОБЕДА'),
    kicker:null,
    resultLine:`${t('Время: {value0}', { value0: formatDuration(state.elapsedMs) })} · ${t('Ходы: {value0}', { value0: Math.max(0, state.moves) })}`,
    detailLine:null,
    noticeLine:state.improvedBest ? t('Новый рекорд!') : null,
    primaryActionLabel:t('НОВАЯ РАЗДАЧА'),
    secondaryActionLabel:t('В МЕНЮ'),
    mastery: state.mastery ? presentVictoryMastery(state.mastery, getLanguage()) : null,
  };
}

/** Shared landscape victory overlay for desktop and mobile. */
export class GameCompleteView {
  private readonly overlay:WinOverlay;
  private state:GameCompleteState|null=null;
  private layoutState:ViewportLayout|null=null;
  private lastCelebratedCompletionId:string|null=null;

  constructor(scene:Phaser.Scene, private readonly actions:GameCompleteActions) {
    const initial:GameCompleteState={completionId:'',mode:'winnable',elapsedMs:0,moves:0,improvedBest:false};
    this.overlay=new WinOverlay(scene,contentFor(initial),{newDeal:actions.newGame,home:actions.menu},5000);
    this.overlay.setVisible(false);
  }

  refreshLocalization():void { if (this.state) this.overlay.setContent(contentFor(this.state)); }

  show(state:GameCompleteState):void {
    this.state=state;
    this.overlay.setContent(contentFor(state));
    this.overlay.setVisible(true);
    if (this.layoutState) this.overlay.layout(this.layoutState);
    const freshCompletion = state.completionId!==this.lastCelebratedCompletionId;
    if (freshCompletion) {
      this.lastCelebratedCompletionId=state.completionId;
      this.actions.sound?.('victory');
      this.overlay.playMasteryAnimation();
    }
  }

  layout(layout:ViewportLayout):void { this.layoutState=layout; this.overlay.layout(layout); }
  hide():void { this.overlay.setVisible(false); }
  destroy():void { this.overlay.destroy(); }
}
