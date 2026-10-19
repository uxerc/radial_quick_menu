import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  test: { environment: 'node' },
  build:
    mode === 'standalone'
      ? {
          outDir: 'dist-standalone',
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          chunkSizeWarningLimit: 4096,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : { chunkSizeWarningLimit: 4096 },
}));
