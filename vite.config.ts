import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// three pages: the sales page, the game, and the gift intake form
export default defineConfig({
  appType: 'mpa',
  // relative, so the same build works at the domain root or under /dropbots/
  base: './',
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
        order: resolve(__dirname, 'order/index.html'),
        fight: resolve(__dirname, 'fight/index.html'),
      },
    },
  },
});
