export interface CoinInlineOptions {
  readonly className?: string;
  readonly iconClassName?: string;
  readonly valueClassName?: string;
  readonly label?: string;
  readonly labelClassName?: string;
}

function joinClasses(...values: readonly (string | undefined)[]): string {
  return values.filter((value): value is string => value !== undefined && value.length > 0).join(' ');
}

export function createCoinInline(valueText: string, options: CoinInlineOptions = {}): HTMLSpanElement {
  const root = document.createElement('span');
  root.className = joinClasses('coin-inline', options.className);

  const icon = document.createElement('span');
  icon.className = joinClasses('coin-inline-icon', options.iconClassName);
  icon.setAttribute('aria-hidden', 'true');

  const value = document.createElement('span');
  value.className = joinClasses('coin-inline-value', options.valueClassName);
  value.textContent = valueText;

  root.append(icon, value);

  if (options.label !== undefined) {
    const label = document.createElement('span');
    label.className = joinClasses('coin-inline-label', options.labelClassName);
    label.textContent = options.label;
    root.append(label);
  }

  return root;
}
