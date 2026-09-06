export interface ClickThroughEvent {
  readonly preventDefault: () => void;
  readonly stopPropagation: () => void;
}

export type UiFrameScheduler = (callback: () => void) => void;

function scheduleNextFrame(callback: () => void): void {
  window.requestAnimationFrame(() => callback());
}

export function deferClickThroughAction(
  event: ClickThroughEvent,
  action: () => void,
  schedule: UiFrameScheduler = scheduleNextFrame,
): void {
  event.preventDefault();
  event.stopPropagation();
  schedule(action);
}
