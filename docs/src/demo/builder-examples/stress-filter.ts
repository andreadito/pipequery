import { from } from '@andreadito/pipequery-lang/builder';

type StressProduct = {
  price: number;
  status: string;
};

export default from<StressProduct>('items')
  .where((item) => item.price.gt(500).and(item.status.eq('active')))
  .sort((item) => item.price.desc())
  .first(20);