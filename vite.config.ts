import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        // 필요한 진입점 정의
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  publicDir: 'public', // public 디렉토리의 파일을 빌드 디렉토리로 복사
});
