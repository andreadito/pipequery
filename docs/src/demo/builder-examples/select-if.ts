import { fn, from, lit } from '@andreadito/pipequery-lang/builder';

type Product = {
  name: string;
  price: number;
};

export default from<Product>('items').select((item) => ({
  name: item.name,
  price: item.price,
  tier: fn.if(item.price.gt(100), lit('premium'), lit('standard')),
}));