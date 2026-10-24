import { agg, from } from '@andreadito/pipequery-lang/builder';

type Product = {
  category: string;
  price: number;
};

export default from<Product>('items')
  .groupBy((item) => item.category)
  .select((item) => ({
    category: item.category,
    total: agg.sum(item.price),
    count: agg.count(),
  }));