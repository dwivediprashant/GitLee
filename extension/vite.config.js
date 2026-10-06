import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin to copy manifest and static assets to dist
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

      // Copy manifest
      copyFileSync(
        resolve(__dirname, 'public/manifest.json'),
        resolve(distDir, 'manifest.json')
      );

      // Copy icons if they exist
      const iconsDir = resolve(__dirname, 'public/icons');
      const distIconsDir = resolve(distDir, 'icons');
      if (existsSync(iconsDir)) {
        if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
          const src = resolve(iconsDir, icon);
          if (existsSync(src)) copyFileSync(src, resolve(distIconsDir, icon));
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.js'),
        content: resolve(__dirname, 'src/content/index.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
