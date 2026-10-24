import { from, win } from '@andreadito/pipequery-lang/builder';

type Trade = {
  symbol: string;
  date: string;
  price: number;
};

export default from<Trade>('trades')
  .sort((trade) => trade.date.asc())
  .select((trade) => ({
    symbol: trade.symbol,
    date: trade.date,
    price: trade.price,
    row: win.row_number(),
    runningAverage: win.running_avg('price'),
  }));