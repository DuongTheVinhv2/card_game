import { defineConfig } from 'vite';

// Test-only config for scripted playtests: no HMR so concurrent edits never reload a running test page.
export default defineConfig({
  server: { port: 5180, strictPort: true, host: '127.0.0.1', hmr: false },
});
