export type RuleSlideId =
  | 'foundations'
  | 'stock'
  | 'empty-column'
  | 'free-cell'
  | 'alternating-colors';

export interface RuleSlide {
  readonly id: RuleSlideId;
  readonly title: string;
  readonly body: string;
  readonly image: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAlt: string;
}

export const RULE_SLIDES: readonly RuleSlide[] = [
  {
    id: 'foundations',
    title: 'СОБИРАЙТЕ МАСТИ',
    body: 'Начинайте с туза и выкладывайте карты той же масти по возрастанию до короля.',
    image: './assets/rules/foundation.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Двойка треф переносится к тузу треф в основание.',
  },
  {
    id: 'stock',
    title: 'ОТКРЫВАЙТЕ КОЛОДУ',
    body: 'Нажимайте на колоду, чтобы открыть следующие три карты.',
    image: './assets/rules/stock-draw-three.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Закрытая колода и три открытые карты справа от неё.',
  },
  {
    id: 'empty-column',
    title: 'ИСПОЛЬЗУЙТЕ ПУСТЫЕ СТОЛБЦЫ',
    body: 'В пустой столбец можно перенести одну карту или собранную последовательность.',
    image: './assets/rules/empty-column.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Последовательность карт переносится в пустой столбец.',
  },
  {
    id: 'free-cell',
    title: 'ОСВОБОДИВШАЯСЯ КОЛОДА',
    body: 'Когда колода закончилась, её место можно использовать для временного хранения одной карты.',
    image: './assets/rules/free-stock-cell.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Пустая ячейка колоды используется как временное место для одной карты.',
  },
  {
    id: 'alternating-colors',
    title: 'ЧЕРЕДУЙТЕ ЦВЕТА',
    body: 'Собирайте последовательности по убыванию: красная карта на чёрную, чёрная — на красную.',
    image: './assets/rules/alternating-colors.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Карты в столбцах собраны по убыванию с чередованием красных и чёрных мастей.',
  },
] as const;
