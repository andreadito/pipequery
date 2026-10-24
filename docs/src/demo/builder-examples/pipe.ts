import { from } from '@andreadito/pipequery-lang/builder';

type Product = {
  price: number;
};

export default from<Product>('items').pipe('where(price > 100) | sort(price desc) | first(5)');