import { from } from '@andreadito/pipequery-lang/builder';

type Order = {
  orderId: string;
  customerId: string;
  total: number;
};

type Customer = {
  id: string;
  name: string;
  city: string;
};

export default from<Order>('orders')
  .join<Customer>('customers', (order, customer) => order.customerId.eq(customer.id))
  .select((row) => ({ orderId: row.orderId, name: row.name, total: row.total, city: row.city }));