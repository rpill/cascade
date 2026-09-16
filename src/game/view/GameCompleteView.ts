import type * as Phaser from 'phaser';
import { getLanguage, t } from '../../localization/Localization.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import type { ViewportLayout } from './ViewportLayout.ts';
import { WinOverlay, type WinOverlayContent, type WinOverlayRewardContent } from '../../ui/win/WinOverlay.ts';
import type { RewardSummaryState } from './RewardSummaryView.ts';
import { presentVictoryMastery, type VictoryMasteryState } from './VictoryMastery.ts';
import { buildVictoryRewardPresentation } from './VictoryRewardPresentation.ts';

export interface GameCompleteState {
  readonly completionId: string;
  readonly mode: 'original' | 'winnable';
  readonly elapsedMs: number;
  readonly moves: number;
  readonly improvedBest: boolean;
  readonly reward?: RewardSummaryState;
  readonly rewardActionLabel?: string | null;
  readonly rewardActionEnabled?: boolean;
  readonly rewardDoubled?: boolean;
  readonly rewardDoubleBonusCoins?: number | null;
  readonly mastery?: VictoryMasteryState | null;
}

export interface GameCompleteActions {
  readonly newGame: () => void;
  readonly menu: () => void;
  readonly doubleCoins?: () => void;
  readonly sound?: (cue: SfxCue) => void;
}

function formatDuration(ms:number):string {
  const totalSeconds=Math.floor(Math.max(0,ms)/1000);
  return `${Math.floor(totalSeconds/60)}:${String(totalSeconds%60).padStart(2,'0')}`;
}

function baseRewardLabel(label: string | null): string | null {
  if (label === null) return null;
  if (label === 'Победа') return t('За победу');
  return t(label);
}

function rewardContent(state: GameCompleteState): WinOverlayRewardContent {
  const presentation = buildVictoryRewardPresentation(state.reward, {
    doubleBonusCoins: state.rewardDoubleBonusCoins,
    doubled: state.rewardDoubled,
  });
  const helperLine = presentation.pending
    ? null
    : presentation.empty
      ? null
      : state.rewardDoubled && presentation.doubleFromCoins > 0
        ? t('Награда за победу удвоена\n({from} → {to})', {
            from: `+${presentation.doubleFromCoins}`,
            to: `+${presentation.doubleToCoins}`,
          })
        : presentation.doubleFromCoins > 0 && presentation.doubleToCoins > presentation.doubleFromCoins
          ? `${t('Реклама удваивает только награду за победу ({from} → {to})', {
              from: `+${presentation.doubleFromCoins}`,
              to: `+${presentation.doubleToCoins}`,
            }).replace(' (', '\n(')}`
          : null;
  return {
    title: t('НАГРАДЫ'),
    baseLabel: baseRewardLabel(presentation.baseLabel),
    baseCoins: presentation.baseCoins,
    rankLabel: presentation.rankCoins > 0 ? t('Новый ранг') : null,
    rankCoins: presentation.rankCoins,
    totalLabel: t('Всего получено'),
    totalCoins: presentation.totalCoins,
    pendingLabel: presentation.pending ? t('Награды начисляются…') : null,
    emptyLabel: presentation.empty ? t('Без повторной награды') : null,
    helperLine,
  };
}

function contentFor(state:GameCompleteState):WinOverlayContent {
  const noticeParts = [
    state.improvedBest ? t('Новый рекорд!') : null,
    state.reward?.themePurchaseUnlocked ? t('Доступны новые темы в коллекции') : null,
  ].filter((value): value is string => Boolean(value));
  return {
    title:t('ПОБЕДА'),
    kicker:null,
    resultLine:`${t('Время: {value0}', { value0: formatDuration(state.elapsedMs) })} · ${t('Ходы: {value0}', { value0: Math.max(0, state.moves) })}`,
    detailLine:null,
    noticeLine:noticeParts.length > 0 ? noticeParts.join(' · ') : null,
    rewards: rewardContent(state),
    primaryActionLabel:t('НОВАЯ РАЗДАЧА'),
    secondaryActionLabel:t('В МЕНЮ'),
    rewardActionLabel:state.rewardActionLabel ?? null,
    rewardActionEnabled:state.rewardActionEnabled === true,
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
    const freshCompletion = state.completionId!==this.lastCelebratedCompletionId;
    if (freshCompletion) {
      this.lastCelebratedCompletionId=state.completionId;
      this.actions.sound?.('victory');
      if (state.reward && !state.reward.pending && state.reward.coins>0) this.actions.sound?.('coin-reward');
    }
    if (freshCompletion) this.overlay.playMasteryAnimation();
  }

  layout(layout:ViewportLayout):void { this.layoutState=layout; this.overlay.layout(layout); }
  hide():void { this.overlay.setVisible(false); }
  destroy():void { this.overlay.destroy(); }
}
