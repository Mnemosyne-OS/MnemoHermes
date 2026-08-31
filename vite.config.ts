import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard configuration for Mnemosyne OS Cartridges
export default defineConfig({
  plugins: [react()],
  base: './', // Vital for custom protocols (mnemo-plugin://)
  server: {
    host: '127.0.0.1', // Forces IPv4 loopback binding for Electron compatibility
    port: 5207,        // Registered in apps/dev-ports.json
    strictPort: true,  // Fails fast if port is already in use
    cors: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  // Vitest reads this straight from the Vite config, so the cartridge needs no
  // `vitest/config` import it cannot resolve on its own.
  //
  // include is {ts,tsx} deliberately: a glob of `.test.ts` alone collects no
  // rendering test, and it fails SILENTLY — the suite stays green and the test
  // count never moves. useConfirm.test.tsx is the canary.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}']
  }
} as UserConfig & { test: Record<string, unknown> });
