import { log } from '../utils/logger.js';

const BASH_COMPLETION = `###-begin-pq-completions-###
_pq_completions() {
  local cur prev commands source_cmds endpoint_cmds remote_cmds
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="init serve query source endpoint dashboard remote help"
  source_cmds="list add remove test"
  endpoint_cmds="list add remove"
  remote_cmds="deploy connect status"

  case "\${COMP_WORDS[1]}" in
    source)
      COMPREPLY=( $(compgen -W "$source_cmds" -- "$cur") )
      return 0
      ;;
    endpoint)
      COMPREPLY=( $(compgen -W "$endpoint_cmds" -- "$cur") )
      return 0
      ;;
    remote)
      COMPREPLY=( $(compgen -W "$remote_cmds" -- "$cur") )
      return 0
      ;;
    serve)
      COMPREPLY=( $(compgen -W "--port --host --daemon --stop" -- "$cur") )
      return 0
      ;;
    query)
      COMPREPLY=( $(compgen -W "--format" -- "$cur") )
      return 0
      ;;
    dashboard)
      COMPREPLY=( $(compgen -W "--name" -- "$cur") )
      return 0
      ;;
  esac

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
  fi

  return 0
}
complete -F _pq_completions pq
###-end-pq-completions-###`;

const ZSH_COMPLETION = `###-begin-pq-completions-###
_pq() {
  local -a commands source_cmds endpoint_cmds remote_cmds

  commands=(
    'init:Create a pipequery.yaml config file'
    'serve:Start the PipeQuery server'
    'query:Run an ad-hoc PipeQuery expression'
    'source:Manage data sources'
    'endpoint:Manage API endpoints'
    'dashboard:Launch the interactive terminal dashboard'
    'remote:Manage remote deployment'
  )

  source_cmds=(
    'list:List configured data sources'
    'add:Add a data source'
    'remove:Remove a data source'
    'test:Test a data source'
  )

  endpoint_cmds=(
    'list:List API endpoints'
    'add:Register an API endpoint'
    'remove:Remove an API endpoint'
  )

  remote_cmds=(
    'deploy:Generate Dockerfile and docker-compose.yaml'
    'connect:Connect CLI to a remote PipeQuery server'
    'status:Check remote server health'
  )

  _arguments -C \\
    '1: :->command' \\
    '2: :->subcommand' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    subcommand)
      case $words[2] in
        source) _describe 'subcommand' source_cmds ;;
        endpoint) _describe 'subcommand' endpoint_cmds ;;
        remote) _describe 'subcommand' remote_cmds ;;
      esac
      ;;
  esac
}
compdef _pq pq
###-end-pq-completions-###`;

const FISH_COMPLETION = `###-begin-pq-completions-###
# Top-level commands
complete -c pq -f -n '__fish_use_subcommand' -a 'init' -d 'Create a pipequery.yaml config file'
complete -c pq -f -n '__fish_use_subcommand' -a 'serve' -d 'Start the PipeQuery server'
complete -c pq -f -n '__fish_use_subcommand' -a 'query' -d 'Run an ad-hoc PipeQuery expression'
complete -c pq -f -n '__fish_use_subcommand' -a 'source' -d 'Manage data sources'
complete -c pq -f -n '__fish_use_subcommand' -a 'endpoint' -d 'Manage API endpoints'
complete -c pq -f -n '__fish_use_subcommand' -a 'dashboard' -d 'Launch the terminal dashboard'
complete -c pq -f -n '__fish_use_subcommand' -a 'remote' -d 'Manage remote deployment'

# source subcommands
complete -c pq -f -n '__fish_seen_subcommand_from source' -a 'list' -d 'List data sources'
complete -c pq -f -n '__fish_seen_subcommand_from source' -a 'add' -d 'Add a data source'
complete -c pq -f -n '__fish_seen_subcommand_from source' -a 'remove' -d 'Remove a data source'
complete -c pq -f -n '__fish_seen_subcommand_from source' -a 'test' -d 'Test a data source'

# endpoint subcommands
complete -c pq -f -n '__fish_seen_subcommand_from endpoint' -a 'list' -d 'List endpoints'
complete -c pq -f -n '__fish_seen_subcommand_from endpoint' -a 'add' -d 'Add an endpoint'
complete -c pq -f -n '__fish_seen_subcommand_from endpoint' -a 'remove' -d 'Remove an endpoint'

# remote subcommands
complete -c pq -f -n '__fish_seen_subcommand_from remote' -a 'deploy' -d 'Generate Docker files'
complete -c pq -f -n '__fish_seen_subcommand_from remote' -a 'connect' -d 'Connect to remote server'
complete -c pq -f -n '__fish_seen_subcommand_from remote' -a 'status' -d 'Check remote health'

# serve flags
complete -c pq -l port -s p -n '__fish_seen_subcommand_from serve' -d 'Server port'
complete -c pq -l host -s H -n '__fish_seen_subcommand_from serve' -d 'Server host'
complete -c pq -l daemon -s d -n '__fish_seen_subcommand_from serve' -d 'Run as daemon'
complete -c pq -l stop -n '__fish_seen_subcommand_from serve' -d 'Stop running daemon'
###-end-pq-completions-###`;

export async function completionCommand(opts: { shell?: string }) {
  const shell = opts.shell ?? detectShell();

  switch (shell) {
    case 'bash':
      console.log(BASH_COMPLETION);
      log.dim('\n# Add to ~/.bashrc:');
      log.dim('# eval "$(pq completion --shell bash)"');
      break;
    case 'zsh':
      console.log(ZSH_COMPLETION);
      log.dim('\n# Add to ~/.zshrc:');
      log.dim('# eval "$(pq completion --shell zsh)"');
      break;
    case 'fish':
      console.log(FISH_COMPLETION);
      log.dim('\n# Save to ~/.config/fish/completions/pq.fish:');
      log.dim('# pq completion --shell fish > ~/.config/fish/completions/pq.fish');
      break;
    default:
      log.error(`Unknown shell: ${shell}. Use --shell bash|zsh|fish`);
  }
}

function detectShell(): string {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  return 'bash';
}
