import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'engine/index': 'src/engine/index.ts',
    'highlighting/index': 'src/highlighting/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@codemirror/language',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/highlight',
  ],
});
