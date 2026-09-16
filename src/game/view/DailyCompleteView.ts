import type * as Phaser from 'phaser';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent, type WinOverlayRewardContent } from '../../ui/win/WinOverlay.ts';
import type { RewardSummaryState } from './RewardSummaryView.ts';
import { presentVictoryMastery, type VictoryMasteryState } from './VictoryMastery.ts';
import { buildVictoryRewardPresentation } from './VictoryRewardPresentation.ts';

export interface DailyCompleteState {
  readonly completionId:string;
  readonly elapsedMs:number;
  readonly moves:number;
  readonly bestTimeMs:number;
  readonly improvedBest:boolean;
  readonly weekCompleted:number;
  readonly reward?:RewardSummaryState;
  readonly mastery?: VictoryMasteryState | null;
}
export interface DailyCompleteActions { readonly retry:()=>void; readonly menu:()=>void; readonly sound?:(cue:SfxCue)=>void; }

function formatDuration(ms:number):string{const total=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}

function rewardContent(reward: RewardSummaryState | undefined): WinOverlayRewardContent {
  const presentation = buildVictoryRewardPresentation(reward);
  return {
    title: t('НАГРАДЫ'),
    baseLabel: presentation.baseLabel ? t(presentation.baseLabel) : null,
    baseCoins: presentation.baseCoins,
    rankLabel: presentation.rankCoins > 0 ? t('Новый ранг') : null,
    rankCoins: presentation.rankCoins,
    totalLabel: t('Всего получено'),
    totalCoins: presentation.totalCoins,
    pendingLabel: presentation.pending ? t('Награды начисляются…') : null,
    emptyLabel: presentation.empty ? t('Без повторной награды') : null,
    helperLine: null,
  };
}

function contentFor(state:DailyCompleteState):WinOverlayContent{
  const timeLabel=t('Время: {value0}', { value0: formatDuration(state.elapsedMs) });
  const movesLabel=t('Ходы: {value0}', { value0: Math.max(0,state.moves) });
  const noticeParts = [
    state.improvedBest ? t('Новый рекорд!') : null,
    state.reward?.themePurchaseUnlocked ? t('Доступны новые темы в коллекции') : null,
  ].filter((value): value is string => Boolean(value));
  return{
    title:t('ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО'),
    kicker:'Daily',
    resultLine:`${timeLabel} · ${movesLabel}`,
    rewards:rewardContent(state.reward),
    detailLine:t('Эта неделя: {value0} / 7',{value0:state.weekCompleted}),
    noticeLine:noticeParts.length > 0 ? noticeParts.join(' · ') : null,
    primaryActionLabel:t('ПОВТОРИТЬ'),
    secondaryActionLabel:t('В МЕНЮ'),
    rewardActionLabel:null,
    rewardActionEnabled:false,
    mastery: state.mastery ? presentVictoryMastery(state.mastery, getLanguage()) : null,
  };
}

/** Daily variant of the shared landscape victory overlay. */
export class DailyCompleteView {
  private readonly overlay:WinOverlay;private state:DailyCompleteState|null=null;private layoutState:ViewportLayout|null=null;private lastCelebratedCompletionId:string|null=null;
  constructor(scene:Phaser.Scene,private readonly actions:DailyCompleteActions){
    const initial:DailyCompleteState={completionId:'',elapsedMs:0,moves:0,bestTimeMs:0,improvedBest:false,weekCompleted:0};
    this.overlay=new WinOverlay(scene,contentFor(initial),{newDeal:actions.retry,home:actions.menu},5000);this.overlay.setVisible(false);
  }
  refreshLocalization():void{if(this.state)this.overlay.setContent(contentFor(this.state));}
  show(state:DailyCompleteState):void{this.state=state;this.overlay.setContent(contentFor(state));this.overlay.setVisible(true);if(this.layoutState)this.overlay.layout(this.layoutState);const freshCompletion=state.completionId!==this.lastCelebratedCompletionId;if(freshCompletion){this.lastCelebratedCompletionId=state.completionId;this.actions.sound?.('victory');if(state.reward&&!state.reward.pending&&state.reward.coins>0)this.actions.sound?.('coin-reward');}if(freshCompletion)this.overlay.playMasteryAnimation();}
  layout(layout:ViewportLayout):void{this.layoutState=layout;this.overlay.layout(layout);} hide():void{this.overlay.setVisible(false);} destroy():void{this.overlay.destroy();}
}
