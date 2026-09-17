export type RuleSlideId =
  | 'foundations'
  | 'alternating-colors'
  | 'free-spaces'
  | 'stock';

export interface RuleSlide {
  readonly id: RuleSlideId;
  readonly title: string;
  readonly body: string;
}

export const RULE_SLIDES: readonly RuleSlide[] = [
  {
    id: 'foundations',
    title: 'Соберите все масти',
    body: 'Соберите все карты в четыре основания: каждую масть отдельно, от туза до короля.',
  },
  {
    id: 'alternating-colors',
    title: 'Чередуйте цвета',
    body: 'На столе кладите карты по убыванию, чередуя цвет: красную на чёрную, чёрную на красную. Готовую последовательность можно переносить целиком.',
  },
  {
    id: 'free-spaces',
    title: 'Используйте свободные места',
    body: 'В пустой столбец можно перенести карту или готовую последовательность. Когда колода закончится, место колоды становится дополнительной временной ячейкой для одной карты.',
  },
  {
    id: 'stock',
    title: 'Открывайте по три карты',
    body: 'Нажимайте на колоду, чтобы открыть следующие три карты. Играйте доступной верхней картой, освобождайте нужные карты и переносите их в основания.',
  },
] as const;
