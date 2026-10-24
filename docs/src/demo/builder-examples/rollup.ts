import { agg, col, from } from '@andreadito/pipequery-lang/builder';

type Sale = {
  region: string;
  category: string;
  revenue: number;
};

export default from<Sale>('sales').rollup(
  'region',
  'category',
  agg.sum(col<number>('revenue')).as('total'),
  agg.count().as('rows'),
);