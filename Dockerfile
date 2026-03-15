FROM node:20-slim

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

# Smoke test: pq --help should work
RUN pq --help

ENTRYPOINT ["pq"]
CMD ["--help"]
