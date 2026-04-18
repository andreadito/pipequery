export function generateDockerfile(port: number): string {
  return `FROM node:20-alpine
WORKDIR /app

# Copy config and data files
COPY pipequery.yaml .
COPY data/ data/ 2>/dev/null || true

# Install PipeQuery CLI
RUN npm install -g @vaultgradient/pipequery-cli

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \\
  CMD wget -qO- http://localhost:${port}/health || exit 1

CMD ["pq", "serve", "--host", "0.0.0.0"]
`;
}

export function generateDockerCompose(port: number): string {
  return `services:
  pipequery:
    build: .
    ports:
      - "${port}:${port}"
    volumes:
      - ./pipequery.yaml:/app/pipequery.yaml:ro
      - ./data:/app/data:ro
    restart: unless-stopped
    environment:
      - NODE_ENV=production
`;
}

export function generateDockerignore(): string {
  return `node_modules
.pipequery
.git
*.log
dist
`;
}
