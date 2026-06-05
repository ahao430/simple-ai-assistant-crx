import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        common: resolve(__dirname, 'src/content/common.ts'),
        yuque: resolve(__dirname, 'src/content/yuque.ts'),
        fmanage: resolve(__dirname, 'src/content/fmanage.ts'),
        haixing: resolve(__dirname, 'src/content/haixing.ts')
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.js';
          if (['common', 'yuque', 'fmanage', 'haixing'].includes(chunk.name)) return 'content/[name].js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
