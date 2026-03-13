import type { PipeQueryConfig } from './schema.js';

export const DEFAULT_CONFIG: PipeQueryConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  sources: {},
  endpoints: {},
  dashboards: {},
};

export const STARTER_YAML = `# PipeQuery Configuration
# Docs: https://github.com/andreadito/pipequery

server:
  port: 3000
  host: 0.0.0.0

# Data sources — REST APIs, WebSockets, files, or inline JSON
sources:
  # Example: crypto prices from CoinCap
  # crypto:
  #   type: rest
  #   url: https://api.coincap.io/v2/assets
  #   dataPath: data
  #   interval: 30s
  #
  # orders:
  #   type: file
  #   path: ./data/orders.csv
  #   watch: true

# API endpoints — expose PipeQuery results as REST APIs
endpoints: {}
  # /api/top-coins:
  #   query: "crypto | sort(market_cap desc) | first(10)"
  #   cache: 30s

# Terminal dashboards
dashboards: {}
  # main:
  #   refresh: 10s
  #   panels:
  #     - title: Top Assets
  #       query: "crypto | sort(market_cap desc) | first(10)"
  #       viz: table
`;
