import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from '../package.json';

const { version } = packageJson;

export default defineManifest({
  name: 'Play LearnEng',
  description: '쿠팡 플레이 영상을 통한 외국어 학습 도우미',
  version,
  manifest_version: 3,
  icons: {
    16: 'src/assets/icon-16.png',
    32: 'src/assets/icon-32.png',
    48: 'src/assets/icon-48.png',
    128: 'src/assets/icon-128.png',
  },
  action: {
    default_popup: 'src/pages/popup/index.html',
    default_icon: 'src/assets/icon-32.png',
  },
  options_page: 'src/pages/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['*://*.coupangplay.com/*'],
      js: ['src/content/index.tsx'],
    },
  ],
  permissions: ['storage', 'tabs'],
});
