export type RuleSlideId =
  | 'foundations'
  | 'stock'
  | 'empty-column'
  | 'free-cell'
  | 'alternating-colors';

export interface RuleSlideCursor {
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
}

export interface RuleSlide {
  readonly id: RuleSlideId;
  readonly title: string;
  readonly body: string;
  readonly image: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAlt: string;
  readonly cursor: RuleSlideCursor;
}

export const RULE_SLIDES: readonly RuleSlide[] = [
  {
    id: 'foundations',
    title: 'СОБИРАЙТЕ МАСТИ',
    body: 'Начинайте с туза и выкладывайте карты той же масти по возрастанию до короля.',
    image: './assets/rules/foundation.webp',
    imageWidth: 413,
    imageHeight: 472,
    imageAlt: 'Двойка треф переносится к тузу треф в основание.',
    cursor: { x: 57, y: 38, rotation: -8 },
  },
  {
    id: 'stock',
    title: 'ОТКРЫВАЙТЕ КОЛОДУ',
    body: 'Нажимайте на колоду, чтобы открыть следующие три карты.',
    image: './assets/rules/stock-draw-three.webp',
    imageWidth: 456,
    imageHeight: 251,
    imageAlt: 'Закрытая колода и три открытые карты справа от неё.',
    cursor: { x: 27, y: 55, rotation: -8 },
  },
  {
    id: 'empty-column',
    title: 'ИСПОЛЬЗУЙТЕ ПУСТЫЕ СТОЛБЦЫ',
    body: 'В пустой столбец можно перенести одну карту или собранную последовательность.',
    image: './assets/rules/empty-column.webp',
    imageWidth: 562,
    imageHeight: 389,
    imageAlt: 'Последовательность карт переносится в пустой столбец.',
    cursor: { x: 67, y: 61, rotation: -8 },
  },
  {
    id: 'free-cell',
    title: 'ОСВОБОДИВШАЯСЯ КОЛОДА',
    body: 'Когда колода закончилась, её место можно использовать для временного хранения одной карты.',
    image: './assets/rules/free-stock-cell.webp',
    imageWidth: 591,
    imageHeight: 278,
    imageAlt: 'Пустая ячейка колоды используется как временное место для одной карты.',
    cursor: { x: 17, y: 56, rotation: -8 },
  },
  {
    id: 'alternating-colors',
    title: 'ЧЕРЕДУЙТЕ ЦВЕТА',
    body: 'Собирайте последовательности по убыванию: красная карта на чёрную, чёрная — на красную.',
    image: './assets/rules/alternating-colors.webp',
    imageWidth: 560,
    imageHeight: 409,
    imageAlt: 'Карты в столбцах собраны по убыванию с чередованием красных и чёрных мастей.',
    cursor: { x: 65, y: 69, rotation: -8 },
  },
] as const;
