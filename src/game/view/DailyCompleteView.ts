import type Phaser from 'phaser';
import { t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { MasteryRank } from '../../meta/MetaSave.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent } from '../../ui/win/WinOverlay.ts';
import type { RewardSummaryState } from './RewardSummaryView.ts';

export interface DailyCompleteState {
  readonly completionId:string;
  readonly elapsedMs:number;
  readonly bestTimeMs:number;
  readonly improvedBest:boolean;
  readonly weekCompleted:number;
  readonly reward?:RewardSummaryState;
}
export interface DailyCompleteActions { readonly retry:()=>void; readonly menu:()=>void; readonly sound?:(cue:SfxCue)=>void; }

const RANK_LABELS:Readonly<Record<MasteryRank,string>>={novice:'Новичок',player:'Игрок',tactician:'Тактик',expert:'Эксперт',master:'Мастер',grandmaster:'Грандмастер'};
function formatDuration(ms:number):string{const total=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}
function rewardLine(reward:RewardSummaryState|undefined):string|null{if(!reward)return null;if(reward.pending)return t('Награды начисляются…');return reward.coins>0?`+${reward.coins} ${t('монет')}`:t('Без повторной награды');}
function detailLine(state:DailyCompleteState):string{
  const rank=state.reward?.rankAdvancedTo;
  const rankPart=rank&&!state.reward?.pending?` · ${t('Новый ранг: {rank}',{rank:t(RANK_LABELS[rank])})}`:'';
  return `${t('Эта неделя: {value0} / 7',{value0:state.weekCompleted})}${rankPart}`;
}
function contentFor(state:DailyCompleteState):WinOverlayContent{return{
  title:t('ИСПЫТАНИЕ ДНЯ ЗАВЕРШЕНО'),kicker:'Daily',
  resultLine:state.improvedBest?`${formatDuration(state.elapsedMs)} · ${t('Новый рекорд')}`:`${t('Лучшее')}: ${formatDuration(state.bestTimeMs)}`,
  rewardLine:rewardLine(state.reward),detailLine:detailLine(state),noticeLine:state.reward?.themePurchaseUnlocked?t('Доступны новые темы в коллекции'):null,
  primaryActionLabel:t('ПОВТОРИТЬ'),secondaryActionLabel:t('В МЕНЮ'),rewardActionLabel:null,rewardActionEnabled:false,
};}

/** Daily variant of the shared Trifold-style Phaser victory overlay. */
export class DailyCompleteView {
  private readonly overlay:WinOverlay;private state:DailyCompleteState|null=null;private layoutState:ViewportLayout|null=null;private lastCelebratedCompletionId:string|null=null;
  constructor(scene:Phaser.Scene,private readonly actions:DailyCompleteActions){
    const initial:DailyCompleteState={completionId:'',elapsedMs:0,bestTimeMs:0,improvedBest:false,weekCompleted:0};
    this.overlay=new WinOverlay(scene,contentFor(initial),{newDeal:actions.retry,home:actions.menu},5000);this.overlay.setVisible(false);
  }
  refreshLocalization():void{if(this.state)this.overlay.setContent(contentFor(this.state));}
  show(state:DailyCompleteState):void{this.state=state;this.overlay.setContent(contentFor(state));this.overlay.setVisible(true);if(this.layoutState)this.overlay.layout(this.layoutState);if(state.completionId!==this.lastCelebratedCompletionId){this.lastCelebratedCompletionId=state.completionId;this.actions.sound?.('victory');if(state.reward&&!state.reward.pending&&state.reward.coins>0)this.actions.sound?.('coin-reward');}}
  layout(layout:ViewportLayout):void{this.layoutState=layout;this.overlay.layout(layout);} hide():void{this.overlay.setVisible(false);} destroy():void{this.overlay.destroy();}
}
