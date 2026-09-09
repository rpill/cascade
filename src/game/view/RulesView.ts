import { t, LocalizationBindings } from '../../localization/Localization.ts';
import { RULE_SLIDES, type RuleSlide } from './RulesSlides.ts';
import { createUiIcon } from './ui/UiIcons.ts';

export interface RulesViewActions {
  readonly back: () => void;
}

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

export class RulesView {
  private readonly localization = new LocalizationBindings();

  refreshLocalization(): void {
    this.localization.refresh();
  }

  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly heading: HTMLHeadingElement;
  private readonly copy: HTMLParagraphElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly dots: readonly HTMLButtonElement[];
  private activeSlideIndex = 0;

  constructor(host: HTMLElement, actions: RulesViewActions) {
    this.root = document.createElement('section');
    this.root.className = 'main-shell-rules';
    this.localization.attribute(this.root, 'aria-label', () => t('Правила'));

    const header = document.createElement('div');
    header.className = 'main-shell-rules-header';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'main-shell-rules-back';
    this.localization.attribute(back, 'aria-label', () => t('Назад'));
    back.append(createUiIcon('back'));
    const backLabel = document.createElement('span');
    this.localization.text(backLabel, () => t('Назад'));
    back.append(backLabel);
    back.addEventListener('click', () => actions.back());

    const title = document.createElement('h1');
    title.className = 'main-shell-rules-title';
    this.localization.text(title, () => t('ПРАВИЛА'));

    const headerBalance = document.createElement('span');
    headerBalance.className = 'main-shell-rules-header-balance';
    headerBalance.setAttribute('aria-hidden', 'true');
    header.append(back, title, headerBalance);

    const carousel = document.createElement('div');
    carousel.className = 'main-shell-rules-carousel';

    this.previousButton = this.createCarouselButton(
      'main-shell-rules-prev',
      'Предыдущее правило',
      '‹',
      () => this.goToSlide(this.activeSlideIndex - 1),
    );

    this.nextButton = this.createCarouselButton(
      'main-shell-rules-next',
      'Следующее правило',
      '›',
      () => this.goToSlide(this.activeSlideIndex + 1),
    );

    const slide = document.createElement('article');
    slide.className = 'main-shell-rules-slide';
    slide.setAttribute('aria-live', 'polite');

    this.stage = document.createElement('div');
    this.stage.className = 'main-shell-rules-stage';
    this.stage.setAttribute('aria-hidden', 'true');

    this.heading = document.createElement('h2');
    this.heading.className = 'main-shell-rule-title';

    this.copy = document.createElement('p');
    this.copy.className = 'main-shell-rule-copy';

    const dotNavigation = document.createElement('nav');
    dotNavigation.className = 'main-shell-rules-dots';
    this.localization.attribute(dotNavigation, 'aria-label', () => t('Слайды правил'));
    this.dots = RULE_SLIDES.map((ruleSlide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'main-shell-rules-dot';
      dot.dataset.ruleSlideIndex = String(index);
      this.localization.attribute(dot, 'aria-label', () => `${index + 1}. ${t(ruleSlide.title)}`);
      dot.addEventListener('click', () => this.goToSlide(index));
      dotNavigation.append(dot);
      return dot;
    });

    slide.append(this.stage, this.heading, this.copy, dotNavigation);
    carousel.append(this.previousButton, slide, this.nextButton);
    this.root.append(header, carousel);
    host.append(this.root);

    this.goToSlide(0);
    this.hide();
  }

  show(): void {
    this.root.hidden = false;
    document.addEventListener('keydown', this.handleKeyDown);
    this.goToSlide(this.activeSlideIndex);
  }

  hide(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.root.hidden = true;
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.root.hidden) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goToSlide(this.activeSlideIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goToSlide(this.activeSlideIndex + 1);
    }
  };

  private goToSlide(index: number): void {
    const boundedIndex = Math.max(0, Math.min(RULE_SLIDES.length - 1, index));
    const slide = RULE_SLIDES[boundedIndex];
    if (slide === undefined) {
      return;
    }

    this.activeSlideIndex = boundedIndex;
    this.localization.text(this.heading, () => t(slide.title));
    this.localization.text(this.copy, () => t(slide.body));
    this.stage.replaceChildren(this.createSlideScene(slide));

    this.previousButton.disabled = boundedIndex === 0;
    this.nextButton.disabled = boundedIndex === RULE_SLIDES.length - 1;

    for (let dotIndex = 0; dotIndex < this.dots.length; dotIndex += 1) {
      const dot = this.dots[dotIndex];
      const active = dotIndex === boundedIndex;
      dot.classList.toggle('is-active', active);
      if (active) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
    }
  }

  private createSlideScene(slide: RuleSlide): HTMLElement {
    const scene = document.createElement('div');
    scene.className = `rules-screenshot-scene rules-screenshot-scene-${slide.id}`;

    const frame = document.createElement('div');
    frame.className = 'rules-screenshot-frame';
    frame.style.aspectRatio = `${slide.imageWidth} / ${slide.imageHeight}`;

    const image = document.createElement('img');
    image.className = 'rules-screenshot-image';
    image.src = resolveAssetUrl(slide.image);
    this.localization.attribute(image, 'alt', () => t(slide.imageAlt));
    image.draggable = false;

    const cursor = this.createScreenshotCursor();
    cursor.style.left = `${slide.cursor.x}%`;
    cursor.style.top = `${slide.cursor.y}%`;
    cursor.style.setProperty('--rules-cursor-rotation', `${slide.cursor.rotation ?? 0}deg`);

    frame.append(image, cursor);
    scene.append(frame);
    return scene;
  }

  private createScreenshotCursor(): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const cursor = document.createElementNS(namespace, 'svg');
    cursor.classList.add('rules-screenshot-cursor');
    cursor.setAttribute('viewBox', '0 0 34 42');
    cursor.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', 'M4.5 3.5 29 23.5l-10.7 1.2 5.8 10.8-6.2 3.3-5.6-10.7-7.8 7.5Z');
    cursor.append(path);
    return cursor;
  }

  private createCarouselButton(
    className: string,
    label: string,
    glyph: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `main-shell-rules-arrow ${className}`;
    this.localization.attribute(button, 'aria-label', () => t(label));
    this.localization.text(button, () => glyph);
    button.addEventListener('click', onClick);
    return button;
  }
}
