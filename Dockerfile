FROM node:22-slim

WORKDIR /app

# Copy everything needed for the CLI build
COPY package.json package-lock.json* ./
COPY src/ ./src/
COPY cli/ ./cli/

# Install root dependencies (the engine)
RUN npm install --ignore-scripts 2>/dev/null || true

# Build the CLI
WORKDIR /app/cli
RUN npm install && npm run build

# Link globally so `pq` is available
RUN npm link

WORKDIR /workspace

# Scaffold a default config so `pq serve` works out of the box
RUN pq init

# Smoke test
RUN pq --help

# Expose the default port
EXPOSE 3000

# Start the server, binding to all interfaces so Docker port mapping works
CMD ["pq", "serve", "--host", "0.0.0.0"]
