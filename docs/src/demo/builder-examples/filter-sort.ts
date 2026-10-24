import { from } from '@andreadito/pipequery-lang/builder';

type Product = {
  id: number;
  name: string;
  price: number;
  active: boolean;
};

export default from<Product>('items')
  .where((item) => item.price.gt(100).and(item.active.eq(true)))
  .sort((item) => item.price.desc())
  .select((item) => ({ name: item.name, price: item.price }));