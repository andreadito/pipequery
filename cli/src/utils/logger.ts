import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.hex('#06b6d4')('  ●'), msg),
  success: (msg: string) => console.log(chalk.hex('#10b981')('  ✓'), msg),
  warn: (msg: string) => console.log(chalk.hex('#f59e0b')('  ⚠'), msg),
  error: (msg: string) => console.error(chalk.hex('#ef4444')('  ✗'), msg),
  dim: (msg: string) => console.log(chalk.dim(`    ${msg}`)),
  step: (msg: string) => console.log(chalk.hex('#4f46e5')('  →'), msg),
};
