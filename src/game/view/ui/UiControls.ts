import { createUiIcon, type UiIconName } from './UiIcons.ts';
import { t } from '../../../localization/Localization.ts';

const controlLabels = new WeakMap<HTMLButtonElement, IconControlOptions>();

export function refreshIconControls(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('.ui-icon-control')) {
    const options = controlLabels.get(button);
    if (options) {
      button.setAttribute('aria-label', t(options.label));
      button.title = t(options.tooltip);
      button.dataset.tooltip = t(options.tooltip);
    }
  }
}

export interface IconControlOptions {
  readonly icon: UiIconName;
  readonly label: string;
  readonly tooltip: string;
  readonly className?: string;
  readonly onClick?: () => void;
}

export function createIconControl(options: IconControlOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['ui-icon-control', options.className]
    .filter(Boolean)
    .join(' ');
  controlLabels.set(button, options);
  button.setAttribute('aria-label', t(options.label));
  button.title = t(options.tooltip);
  button.dataset.tooltip = t(options.tooltip);
  button.append(createUiIcon(options.icon));

  if (options.onClick !== undefined) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      options.onClick?.();
    });
  }

  return button;
}
