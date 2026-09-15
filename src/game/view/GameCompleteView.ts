import type Phaser from 'phaser';
import { t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { MasteryRank } from '../../meta/MetaSave.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent } from '../../ui/win/WinOverlay.ts';
import type { RewardSummaryState } from './RewardSummaryView.ts';

export interface GameCompleteState {
  readonly completionId: string;
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly improvedBest: boolean;
  readonly reward?: RewardSummaryState;
  readonly rewardActionLabel?: string | null;
  readonly rewardActionEnabled?: boolean;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
  readonly doubleCoins?: () => void;
  readonly sound?: (cue: SfxCue) => void;
}

const RANK_LABELS: Readonly<Record<MasteryRank,string>> = {
  novice:'Новичок', player:'Игрок', tactician:'Тактик', expert:'Эксперт', master:'Мастер', grandmaster:'Грандмастер',
};

function formatDuration(ms:number):string {
  const totalSeconds=Math.floor(Math.max(0,ms)/1000);
  return `${Math.floor(totalSeconds/60)}:${String(totalSeconds%60).padStart(2,'0')}`;
}

function rewardLine(reward:RewardSummaryState|undefined):string|null {
  if (!reward) return null;
  if (reward.pending) return t('Награды начисляются…');
  return reward.coins > 0 ? `+${reward.coins} ${t('монет')}` : t('Без повторной награды');
}

function detailLine(reward:RewardSummaryState|undefined):string|null {
  if (!reward || reward.pending || !reward.rankAdvancedTo) return null;
  return t('Новый ранг: {rank}', {rank:t(RANK_LABELS[reward.rankAdvancedTo])});
}

function contentFor(state:GameCompleteState):WinOverlayContent {
  return {
    title:t('ПОБЕДА'),
    kicker:state.mode==='winnable'?t('ИГРА'):t('КЛАССИКА'),
    resultLine:state.improvedBest?`${formatDuration(state.elapsedMs)} · ${t('Новый рекорд')}`:formatDuration(state.elapsedMs),
    rewardLine:rewardLine(state.reward),
    detailLine:detailLine(state.reward),
    noticeLine:state.reward?.themePurchaseUnlocked?t('Доступны новые темы в коллекции'):null,
    primaryActionLabel:t('НОВАЯ РАЗДАЧА'),
    secondaryActionLabel:t('В МЕНЮ'),
    rewardActionLabel:state.rewardActionLabel ?? null,
    rewardActionEnabled:state.rewardActionEnabled === true,
  };
}

/** Trifold-style Phaser victory overlay adapted to Cascade's existing completion contract. */
export class GameCompleteView {
  private readonly overlay:WinOverlay;
  private state:GameCompleteState|null=null;
  private layoutState:ViewportLayout|null=null;
  private lastCelebratedCompletionId:string|null=null;

  constructor(scene:Phaser.Scene, private readonly actions:GameCompleteActions) {
    const initial:GameCompleteState={completionId:'',mode:'winnable',elapsedMs:0,improvedBest:false};
    this.overlay=new WinOverlay(scene,contentFor(initial),{newDeal:actions.newGame,home:actions.menu,doubleCoins:actions.doubleCoins},5000);
    this.overlay.setVisible(false);
  }

  refreshLocalization():void {
    if (this.state) this.overlay.setContent(contentFor(this.state));
  }

  show(state:GameCompleteState):void {
    this.state=state;
    this.overlay.setContent(contentFor(state));
    this.overlay.setVisible(true);
    if (this.layoutState) this.overlay.layout(this.layoutState);
    if (state.completionId!==this.lastCelebratedCompletionId) {
      this.lastCelebratedCompletionId=state.completionId;
      this.actions.sound?.('victory');
      if (state.reward && !state.reward.pending && state.reward.coins>0) this.actions.sound?.('coin-reward');
    }
  }

  layout(layout:ViewportLayout):void { this.layoutState=layout; this.overlay.layout(layout); }
  hide():void { this.overlay.setVisible(false); }
  destroy():void { this.overlay.destroy(); }
}
