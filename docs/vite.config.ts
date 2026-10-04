import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

export default defineConfig({
  plugins: [
    react(),
    // Inject the engine version into index.html (JSON-LD) at build time
    { name: 'inject-pkg-version', transformIndexHtml: (html: string) => html.replaceAll('%PKG_VERSION%', version) },
  ],
  base: '/pipequery/',
  resolve: {
    dedupe: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled', '@codemirror/language', '@codemirror/state', '@codemirror/view', '@lezer/highlight'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
});
