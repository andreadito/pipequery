import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { serveCommand } from './commands/serve.js';
import { queryCommand } from './commands/query.js';
import { sourceListCommand, sourceAddCommand, sourceRemoveCommand, sourceTestCommand } from './commands/source.js';
import { endpointListCommand, endpointAddCommand, endpointRemoveCommand } from './commands/endpoint.js';
import { dashboardCommand } from './commands/dashboard.js';
import { monitorCommand } from './commands/monitor.js';
import { remoteDeployCommand, remoteConnectCommand, remoteStatusCommand } from './commands/remote.js';
import { mcpServeCommand, mcpInspectCommand } from './commands/mcp.js';
import { completionCommand } from './commands/completion.js';
import { stopCommand } from './commands/stop.js';
import { startRepl } from './commands/repl.js';
import { printBanner } from './utils/banner.js';

const program = new Command();

program
  .name('pq')
  .description('PipeQuery CLI — data sources, aggregations, APIs, and terminal dashboards')
  .version('0.1.0')
  .addHelpText('beforeAll', () => {
    printBanner();
    return '';
  })
  .configureHelp({
    subcommandTerm: (cmd) => chalk.hex('#06b6d4')(cmd.name()) + (cmd.usage() ? ' ' + chalk.dim(cmd.usage()) : ''),
  });

// ─── pq init ─────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Create a pipequery.yaml config file')
  .action(initCommand);

// ─── pq serve ────────────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the PipeQuery server')
  .option('-p, --port <port>', 'Server port', parseInt)
  .option('-H, --host <host>', 'Server host')
  .option('-d, --daemon', 'Run as a background daemon')
  .option('--stop', 'Stop a running daemon')
  .action(serveCommand);

// ─── pq query ────────────────────────────────────────────────────────────────

program
  .command('query <expression>')
  .description('Run an ad-hoc PipeQuery expression')
  .option('-f, --format <format>', 'Output format: table, json', 'table')
  .action(queryCommand);

// ─── pq source ───────────────────────────────────────────────────────────────

const source = program.command('source').description('Manage data sources');

source
  .command('list')
  .description('List configured data sources')
  .action(sourceListCommand);

source
  .command('add <name>')
  .description('Add a data source')
  .requiredOption('-t, --type <type>', 'Source type: rest, websocket, file')
  .option('-u, --url <url>', 'URL for REST or WebSocket sources')
  .option('-i, --interval <interval>', 'Poll interval for REST (e.g., 30s, 5m)', '30s')
  .option('-d, --data-path <path>', 'Dot-path to extract data from response')
  .option('-p, --path <path>', 'File path for file sources')
  .option('-w, --watch', 'Watch file for changes')
  .action(sourceAddCommand);

source
  .command('remove <name>')
  .description('Remove a data source')
  .action(sourceRemoveCommand);

source
  .command('test <name>')
  .description('Test a data source and show sample data')
  .action(sourceTestCommand);

// ─── pq endpoint ─────────────────────────────────────────────────────────────

const endpoint = program.command('endpoint').description('Manage API endpoints');

endpoint
  .command('list')
  .description('List API endpoints')
  .action(endpointListCommand);

endpoint
  .command('add <path>')
  .description('Register an API endpoint')
  .requiredOption('-q, --query <query>', 'PipeQuery expression')
  .option('-c, --cache <duration>', 'Cache duration (e.g., 30s)')
  .action(endpointAddCommand);

endpoint
  .command('remove <path>')
  .description('Remove an API endpoint')
  .action(endpointRemoveCommand);

// ─── pq dashboard ────────────────────────────────────────────────────────────

program
  .command('dashboard')
  .description('Launch the interactive terminal dashboard')
  .option('-n, --name <name>', 'Dashboard name from config', 'main')
  .action(dashboardCommand);

// ─── pq monitor ─────────────────────────────────────────────────────────────

program
  .command('monitor')
  .description('Live server monitor — sources, endpoints, logs')
  .action(monitorCommand);

// ─── pq remote ───────────────────────────────────────────────────────────────

const remote = program.command('remote').description('Manage remote deployment');

remote
  .command('deploy')
  .description('Generate Dockerfile and docker-compose.yaml')
  .action(remoteDeployCommand);

remote
  .command('connect <url>')
  .description('Connect CLI to a remote PipeQuery server')
  .action(remoteConnectCommand);

remote
  .command('status')
  .description('Check remote server health')
  .action(remoteStatusCommand);

// ─── pq mcp ──────────────────────────────────────────────────────────────────

const mcp = program.command('mcp').description('Model Context Protocol server for AI clients');

mcp
  .command('serve')
  .description('Start an MCP server exposing pipequery as tools (for Claude, Cursor, Copilot, etc.)')
  .option('--http', 'Serve over HTTP/SSE instead of stdio')
  .option('-p, --port <port>', 'HTTP port (when --http is set)', parseInt)
  .option('-H, --host <host>', 'HTTP host (when --http is set)')
  .option('--attach <url>', 'Attach to a running `pq serve` instance at the given URL instead of loading pipequery.yaml locally')
  .action(mcpServeCommand);

mcp
  .command('inspect')
  .description('Print the MCP tool schemas as JSON (useful for directory submission / debugging)')
  .option('--attach <url>', 'Attach to a running `pq serve` instance at the given URL instead of loading pipequery.yaml locally')
  .action(mcpInspectCommand);

// ─── pq stop ────────────────────────────────────────────────────────────────

program
  .command('stop')
  .description('Stop the running PipeQuery server (daemon or foreground)')
  .option('-f, --force', 'Force kill (SIGKILL instead of SIGTERM)')
  .action(stopCommand);

// ─── pq completion ───────────────────────────────────────────────────────────

program
  .command('completion')
  .description('Generate shell completion script')
  .option('-s, --shell <shell>', 'Shell type: bash, zsh, fish')
  .action(completionCommand);

// ─── Run ─────────────────────────────────────────────────────────────────────

// If no args, start interactive REPL
if (process.argv.length <= 2) {
  startRepl();
} else {
  program.parse();
}
