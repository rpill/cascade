import { createUiIcon, type UiIconName } from './UiIcons.ts';

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
  button.setAttribute('aria-label', options.label);
  button.title = options.tooltip;
  button.dataset.tooltip = options.tooltip;
  button.append(createUiIcon(options.icon));

  if (options.onClick !== undefined) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      options.onClick?.();
    });
  }

  return button;
}
