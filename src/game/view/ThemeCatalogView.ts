import { t } from '../../localization/Localization.ts';
import { createCoinInline } from './ui/CoinInline.ts';
export interface ThemeCatalogItemView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly previewUrl: string;
  readonly cardBackUrl: string;
  readonly price: number;
  readonly owned: boolean;
  readonly equipped: boolean;
}

export interface ThemeCatalogState {
  readonly items: readonly ThemeCatalogItemView[];
  readonly coins: number;
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error?: string;
  readonly busyId?: string;
  readonly message?: string;
}

export interface ThemeCatalogActions {
  readonly buy: (id: string) => void;
  readonly equip: (id: string) => void;
  readonly retry: () => void;
}

export type ThemeCatalogFilter = 'all' | 'mine';

const EMPTY_STATE: ThemeCatalogState = {
  items: [],
  coins: 0,
  ready: false,
  loading: true,
};

export function filterThemeCatalogItems(
  items: readonly ThemeCatalogItemView[],
  filter: ThemeCatalogFilter,
): readonly ThemeCatalogItemView[] {
  return items.filter(item => filter !== 'mine' || item.owned);
}

export class ThemeCatalogView {
  private readonly actions: ThemeCatalogActions;
  private readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  private readonly count: HTMLSpanElement;
  private readonly wallet: HTMLSpanElement;
  private readonly filters: HTMLDivElement;
  private readonly allFilter: HTMLButtonElement;
  private readonly mineFilter: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private readonly retryButton: HTMLButtonElement;
  private readonly grid: HTMLDivElement;
  private state: ThemeCatalogState = EMPTY_STATE;
  private filter: ThemeCatalogFilter = 'all';

  constructor(host: HTMLElement, actions: ThemeCatalogActions) {
    this.host = host;
    this.actions = actions;
    this.root = document.createElement('section');
    this.root.className = 'theme-catalog-view';
    this.root.setAttribute('aria-label', t('Каталог тем'));

    const header = document.createElement('header');
    header.className = 'theme-catalog-header';
    const heading = document.createElement('div');
    heading.className = 'theme-catalog-heading';
    this.title = document.createElement('h2');
    this.title.className = 'theme-catalog-title';
    this.subtitle = document.createElement('p');
    this.subtitle.className = 'theme-catalog-subtitle';
    heading.append(this.title, this.subtitle);

    const summary = document.createElement('div');
    summary.className = 'theme-catalog-summary';
    this.count = document.createElement('span');
    this.count.className = 'theme-catalog-count';
    this.wallet = document.createElement('span');
    this.wallet.className = 'theme-catalog-wallet';
    summary.append(this.count, this.wallet);

    this.filters = document.createElement('div');
    this.filters.className = 'theme-catalog-filters';
    this.filters.setAttribute('aria-label', t('Фильтр коллекции'));
    this.allFilter = this.createFilterButton('all', 'Все');
    this.mineFilter = this.createFilterButton('mine', 'Мои');
    this.filters.append(this.allFilter, this.mineFilter);
    header.append(heading, this.filters, summary);

    this.status = document.createElement('div');
    this.status.className = 'theme-catalog-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.retryButton = document.createElement('button');
    this.retryButton.type = 'button';
    this.retryButton.className = 'theme-catalog-retry';
    this.retryButton.textContent = t('ПОВТОРИТЬ');
    this.retryButton.addEventListener('click', () => this.actions.retry());

    this.grid = document.createElement('div');
    this.grid.className = 'theme-catalog-grid';
    this.grid.tabIndex = 0;
    this.grid.setAttribute('role', 'region');
    this.grid.setAttribute('aria-label', t('Темы игрового стола'));

    this.root.append(header, this.status, this.grid);
    this.host.append(this.root);
    this.hide();

  }

  show(state: ThemeCatalogState): void {
    this.state = state;
    this.root.hidden = false;
    this.render();
  }

  update(state: ThemeCatalogState): void {
    this.state = state;
    if (!this.root.hidden) this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }

  private createFilterButton(filter: ThemeCatalogFilter, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-catalog-filter';
    button.textContent = t(label);
    button.addEventListener('click', () => {
      this.filter = filter;
      this.grid.scrollTop = 0;
      this.render();
    });
    return button;
  }

  refreshLocalization(): void {
    this.render();
  }

  private render(): void {
    const focusedCard = document.activeElement?.closest<HTMLElement>('.theme-catalog-card');
    const focusedTheme = focusedCard && this.root.contains(focusedCard) ? focusedCard.dataset.themeId : undefined;
    const ownedCount = this.state.items.filter((item) => item.owned).length;
    const items = filterThemeCatalogItems(this.state.items, this.filter);
    const scrollTop = this.grid.scrollTop;

    this.root.setAttribute('aria-label', t('Каталог тем'));
    this.grid.setAttribute('aria-label', t('Темы игрового стола'));
    this.filters.setAttribute('aria-label', t('Фильтр коллекции'));
    this.allFilter.textContent = t('Все');
    this.mineFilter.textContent = t('Мои');
    this.retryButton.textContent = t('ПОВТОРИТЬ');
    this.root.dataset.destination = 'collection';
    this.title.textContent = t('КОЛЛЕКЦИЯ');
    this.subtitle.textContent = t('Выберите оформление игрового стола');
    this.count.textContent = t('Собрано {owned} из {total}', {owned:ownedCount, total:this.state.items.length});
    this.wallet.textContent = t('{count} монет', {count:Math.max(0, this.state.coins)});
    this.filters.hidden = false;
    this.allFilter.classList.toggle('is-active', this.filter === 'all');
    this.mineFilter.classList.toggle('is-active', this.filter === 'mine');
    this.allFilter.setAttribute('aria-pressed', String(this.filter === 'all'));
    this.mineFilter.setAttribute('aria-pressed', String(this.filter === 'mine'));

    this.renderStatus(items.length);
    this.grid.replaceChildren(...items.map((item) => this.createThemeCard(item)));
    this.grid.scrollTop = scrollTop;
    this.grid.hidden = !this.state.ready || items.length === 0;

    if (focusedTheme) {
      const card=Array.from(this.grid.children).find(item=>(item as HTMLElement).dataset.themeId===focusedTheme);
      const action=card?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      if (action) action.focus({preventScroll:true});
    }
  }

  private renderStatus(itemCount: number): void {
    this.status.replaceChildren();
    this.status.classList.remove('is-error');

    if (this.state.error !== undefined) {
      const message = document.createElement('span');
      message.textContent = t(this.state.error || 'Не удалось загрузить профиль.');
      this.status.classList.add('is-error');
      this.status.append(message, this.retryButton);
      this.status.hidden = false;
      return;
    }
    if (!this.state.ready) {
      this.status.textContent = t('Загрузка коллекции…');
      this.status.hidden = false;
      return;
    }
    if (this.state.message !== undefined || this.state.loading) {
      this.status.textContent = t(this.state.message
        ?? (this.state.loading ? 'Сохраняем изменения…' : ''));
      this.status.hidden = false;
      return;
    }
    if (itemCount === 0) {
      this.status.textContent = this.filter === 'mine'
        ? t('Здесь появятся приобретённые темы.')
        : t('Темы скоро появятся.');
      this.status.hidden = false;
      return;
    }
    this.status.hidden = true;
  }

  private createThemeCard(item: ThemeCatalogItemView): HTMLElement {
    const card = document.createElement('article');
    card.className = 'theme-catalog-card';
    card.dataset.themeId = item.id;
    card.classList.toggle('is-owned', item.owned);
    card.classList.toggle('is-equipped', item.equipped);

    const preview = document.createElement('div');
    preview.className = 'theme-catalog-preview';
    preview.style.backgroundImage = `url("${item.previewUrl.replaceAll('"', '%22')}")`;
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', t('Стол «{name}»', {name:t(item.name)}));
    const cardBack = document.createElement('img');
    cardBack.className = 'theme-catalog-card-back';
    cardBack.src = item.cardBackUrl;
    cardBack.alt = t('Рубашка карт темы «{name}»', {name:t(item.name)});
    cardBack.draggable = false;
    preview.append(cardBack);

    const copy = document.createElement('div');
    copy.className = 'theme-catalog-card-copy';
    const name = document.createElement('h3');
    name.className = 'theme-catalog-card-name';
    name.textContent = t(item.name);
    const description = document.createElement('p');
    description.className = 'theme-catalog-card-description';
    description.textContent = t(item.description);
    const price = document.createElement('p');
    price.className = 'theme-catalog-card-price';
    if (item.price === 0) {
      price.textContent = t('Базовая тема');
    } else if (item.owned) {
      price.textContent = t('В коллекции');
    } else {
      price.replaceChildren(createCoinInline(String(item.price), {
        className: 'theme-catalog-price-coin',
        label: t('монет'),
      }));
      price.hidden = true;
    }
    copy.append(name, description, price);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'theme-catalog-card-action';
    const busy = this.state.busyId === item.id;
    const controlsDisabled = !this.state.ready || this.state.loading || busy;
    if (busy) {
      action.textContent = t(item.owned ? 'ПРИМЕНЕНИЕ…' : 'ПОКУПКА…');
      action.disabled = true;
      action.setAttribute('aria-busy', 'true');
    } else if (item.equipped) {
      action.textContent = t('ВЫБРАНА');
      action.disabled = true;
    } else if (item.owned) {
      action.classList.add('is-equip-action');
      action.textContent = t('ПРИМЕНИТЬ');
      action.disabled = controlsDisabled;
      action.addEventListener('click', () => {
        action.disabled = true;
        action.setAttribute('aria-busy', 'true');
        this.actions.equip(item.id);
      }, { once: true });
    } else {
      const missing = Math.max(0, item.price - this.state.coins);
      action.classList.add('is-purchase-action');
      action.replaceChildren(
        createCoinInline(String(item.price), { className: 'theme-catalog-action-coin' }),
      );
      if (missing > 0) {
        action.setAttribute('aria-label', `${t('Не хватает ')}${missing} ${t('монет')}`);
        action.title = `${t('Не хватает ')}${missing} ${t('монет')}`;
      } else {
        action.setAttribute('aria-label', `${t('КУПИТЬ')} ${item.price} ${t('монет')}`);
      }
      action.disabled = controlsDisabled || missing > 0;
      action.addEventListener('click', () => {
        action.disabled = true;
        action.setAttribute('aria-busy', 'true');
        this.actions.buy(item.id);
      }, { once: true });
    }

    card.append(preview, copy, action);
    return card;
  }

}
