export type RuleSlideId =
  | 'foundations'
  | 'alternating-colors'
  | 'free-spaces'
  | 'stock';

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
    title: 'Соберите все масти',
    body: 'Соберите все карты в четыре основания: каждую масть отдельно, от туза до короля.',
    image: './assets/rules/foundation.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Карты одной масти собираются в основании от туза до короля.',
  },
  {
    id: 'alternating-colors',
    title: 'Чередуйте цвета',
    body: 'На столе кладите карты по убыванию, чередуя цвет: красную на чёрную, чёрную на красную. Готовую последовательность можно переносить целиком.',
    image: './assets/rules/alternating-colors.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Последовательность на столе собрана по убыванию с чередованием цветов.',
  },
  {
    id: 'free-spaces',
    title: 'Используйте свободные места',
    body: 'В пустой столбец можно перенести карту или готовую последовательность. Когда колода закончится, место колоды становится дополнительной временной ячейкой для одной карты.',
    image: './assets/rules/empty-column.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Пустой столбец и освободившееся место колоды помогают временно размещать карты.',
  },
  {
    id: 'stock',
    title: 'Открывайте по три карты',
    body: 'Нажимайте на колоду, чтобы открыть следующие три карты. Играйте доступной верхней картой, освобождайте нужные карты и переносите их в основания.',
    image: './assets/rules/stock-draw-three.svg',
    imageWidth: 1200,
    imageHeight: 600,
    imageAlt: 'Из колоды открываются три карты, верхняя из них доступна для хода.',
  },
] as const;
