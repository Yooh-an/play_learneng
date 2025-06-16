import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        background: 'src/background/index.ts',
        content: 'src/content/index.tsx',
        popup: 'src/pages/popup/popup.tsx'
      },
      external: [
        // '/src/index.tsx' // 엔트리 포인트는 일반적으로 external로 처리하지 않습니다.
      ]
    }
  },
  publicDir: 'public',
});
