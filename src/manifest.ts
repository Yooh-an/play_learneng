import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from '../package.json';

const { version } = packageJson;

export default defineManifest({
  name: 'Play LearnEng - Dual Language Subtitles',
  description: 'Coupang Play에서 한영 이중 자막으로 외국어 학습을 도와주는 확장 프로그램입니다. 자막 크기, 위치, 배경 투명도를 자유롭게 조정할 수 있습니다.',
  version,
  manifest_version: 3,
  author: 'Play LearnEng Team',
  homepage_url: 'https://github.com/yourusername/play-learneng',
  icons: {
    // src 경로 대신 상대 경로 사용
    16: 'icon-16.png',
    32: 'icon-32.png',
    48: 'icon-48.png',
    128: 'icon-128.png',
  },
  action: {
    default_popup: 'src/pages/popup/index.html',
    // default_icon도 수정
    default_icon: 'icon-32.png',
  },
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
  permissions: ['storage', 'tabs', 'debugger', 'webRequest'],
  host_permissions: ['*://*.coupangstreaming.com/*', '*://*.coupangplay.com/*'],
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: ['*://*.coupangplay.com/*']
    }
  ],
});
