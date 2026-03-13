import chalk from 'chalk';

const LOGO = [
  '  ██████╗  ██╗ ██████╗  ███████╗  ██████╗  ██╗   ██╗ ███████╗ ██████╗  ██╗   ██╗',
  '  ██╔══██╗ ██║ ██╔══██╗ ██╔════╝ ██╔═══██╗ ██║   ██║ ██╔════╝ ██╔══██╗ ╚██╗ ██╔╝',
  '  ██████╔╝ ██║ ██████╔╝ █████╗   ██║   ██║ ██║   ██║ █████╗   ██████╔╝  ╚████╔╝ ',
  '  ██╔═══╝  ██║ ██╔═══╝  ██╔══╝   ██║▄▄ ██║ ██║   ██║ ██╔══╝   ██╔══██╗   ╚██╔╝  ',
  '  ██║      ██║ ██║      ███████╗  ╚██████╔╝ ╚██████╔╝ ███████╗ ██║  ██║    ██║   ',
  '  ╚═╝      ╚═╝ ╚═╝      ╚══════╝   ╚══▀▀═╝   ╚═════╝  ╚══════╝ ╚═╝  ╚═╝    ╚═╝   ',
];

// Gradient from cyan → blue → magenta
const GRADIENT_COLORS = [
  '#06b6d4', // cyan
  '#0891b2',
  '#0e7490',
  '#2563eb', // blue
  '#4f46e5',
  '#7c3aed', // violet
];

function applyGradient(line: string, colorIndex: number): string {
  const color = GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length];
  return chalk.hex(color)(line);
}

export function printBanner() {
  console.log();
  LOGO.forEach((line, i) => {
    console.log(applyGradient(line, i));
  });
  console.log();
  console.log(chalk.dim(`  v0.1.0 — data sources, aggregations, APIs, and terminal dashboards`));
  console.log();
}

export function printCompactBanner() {
  console.log();
  console.log(
    chalk.hex('#06b6d4').bold('  ╔═╗ ╦ ╔═╗ ╔═╗ ╔═╗ ╦ ╦ ╔═╗ ╦═╗ ╦ ╦'),
  );
  console.log(
    chalk.hex('#4f46e5').bold('  ╠═╝ ║ ╠═╝ ║╣  ║═╬╗║ ║ ║╣  ╠╦╝ ╚╦╝'),
  );
  console.log(
    chalk.hex('#7c3aed').bold('  ╩   ╩ ╩   ╚═╝ ╚═╝╚╚═╝ ╚═╝ ╩╚═  ╩ '),
  );
  console.log();
}

export function printServerStartup(opts: {
  url: string;
  sourceCount: number;
  endpointCount: number;
}) {
  const { url, sourceCount, endpointCount } = opts;

  console.log(chalk.hex('#06b6d4').bold('  ● Server running'));
  console.log();
  console.log(`  ${chalk.dim('URL')}        ${chalk.white.bold(url)}`);
  console.log(`  ${chalk.dim('Sources')}    ${chalk.white(String(sourceCount))} loaded`);
  console.log(`  ${chalk.dim('Endpoints')}  ${chalk.white(String(endpointCount))} registered`);
  console.log();
  console.log(chalk.dim('  Press Ctrl+C to stop'));
  console.log();
}

export function printSection(title: string) {
  console.log(chalk.hex('#4f46e5').bold(`  ${title}`));
}
