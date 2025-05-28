#!/bin/bash

# Play LearnEng 초기 개발 환경 셋업
echo "🚀 Play LearnEng 크롬 익스텐션 개발 환경 셋업을 시작합니다..."

# # 1. 프로젝트 디렉토리 생성 및 이동
# echo "📁 프로젝트 디렉토리 생성"
# mkdir -p play-learneng
# cd play-learneng

# 2. Git 저장소 초기화
echo "🔄 Git 저장소 초기화"
git init
echo "node_modules\n.DS_Store\ndist\n.env\n*.log" > .gitignore

# 3. pnpm 초기화
echo "📦 pnpm 초기화"
pnpm init

# 4. TypeScript 및 React 18 설치
echo "⚛️ TypeScript 및 React 설치"
pnpm add react@18 react-dom@18
pnpm add -D typescript @types/react @types/react-dom

# 5. Vite + CRXJS 설치
echo "🛠️ Vite 및 CRXJS 설치"
pnpm add -D vite @crxjs/vite-plugin@latest

# 6. Zustand 상태 관리 설치
echo "🗄️ Zustand 설치"
pnpm add zustand

# 7. Tailwind CSS + HeadlessUI 설치
echo "🎨 Tailwind CSS 및 HeadlessUI 설치"
pnpm add -D tailwindcss postcss autoprefixer
pnpm add @headlessui/react

# 8. Tailwind CSS 초기화
echo "🧩 Tailwind CSS 초기화"
pnpm exec tailwindcss init -p

# 9. tsconfig.json 생성
echo "📝 TypeScript 설정 파일 생성"
cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOL

cat > tsconfig.node.json << EOL
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOL

# 10. Vite 설정 파일 생성
echo "⚙️ Vite 설정 파일 생성"
cat > vite.config.ts << EOL
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
});
EOL

# 11. tailwind.config.js 설정
echo "🎭 Tailwind 설정 파일 업데이트"
cat > tailwind.config.js << EOL
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOL

# 12. 기본 폴더 구조 생성
echo "📂 기본 폴더 구조 생성"
mkdir -p src/assets src/components/common src/components/player src/components/subtitles src/components/settings
mkdir -p src/hooks src/store src/services/chrome src/services/storage src/services/subtitles
mkdir -p src/utils src/pages/popup src/pages/options src/pages/review
mkdir -p src/content/observers src/background

# 13. manifest.ts 생성
echo "📄 Chrome Extension Manifest V3 파일 생성"
cat > src/manifest.ts << EOL
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
EOL

# 14. 기본 아이콘 다운로드 (임시 아이콘)
echo "🖼️ 임시 아이콘 생성"
mkdir -p src/assets
touch src/assets/icon-16.png src/assets/icon-32.png src/assets/icon-48.png src/assets/icon-128.png

# 15. 기본 index.html 생성
echo "📝 HTML 파일 생성"
cat > index.html << EOL
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/src/assets/icon-32.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Play LearnEng</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
EOL

# 16. 기본 CSS 생성
echo "🎨 기본 CSS 생성"
cat > src/index.css << EOL
@tailwind base;
@tailwind components;
@tailwind utilities;
EOL

# 17. 기본 진입점 파일 생성
echo "🏁 진입점 파일 생성"
cat > src/index.tsx << EOL
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 기본 컴포넌트는 후에 구현할 예정
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="p-4 bg-blue-100 rounded">
      <h1 className="text-xl font-bold">Play LearnEng</h1>
      <p>쿠팡 플레이 영상을 통한 외국어 학습 도우미</p>
    </div>
  </React.StrictMode>,
);
EOL

# 18. 기본 Background 스크립트 생성
echo "🔄 Background 스크립트 생성"
cat > src/background/index.ts << EOL
console.log('Play LearnEng Background Script Loaded');

// 확장 프로그램 설치 또는 업데이트 시 실행
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Play LearnEng installed');
    // 기본 설정 초기화 등의 작업 수행
  } else if (details.reason === 'update') {
    console.log('Play LearnEng updated');
  }
});
EOL

# 19. 기본 Content 스크립트 생성
echo "🎭 Content 스크립트 생성"
cat > src/content/index.tsx << EOL
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';

console.log('Play LearnEng Content Script Loaded');

// DOM에 UI 요소 추가를 위한 준비
const mountPoint = document.createElement('div');
mountPoint.id = 'play-learneng-container';
document.body.appendChild(mountPoint);

// React UI 렌더링
ReactDOM.createRoot(mountPoint).render(
  <React.StrictMode>
    <div className="fixed bottom-4 right-4 z-50 p-2 bg-white rounded shadow">
      <p className="text-sm font-bold">Play LearnEng</p>
    </div>
  </React.StrictMode>
);
EOL

# 20. 기본 Zustand 스토어 생성
echo "🗄️ 기본 Zustand 스토어 생성"
cat > src/store/subtitleStore.ts << EOL
import { create } from 'zustand';

interface SubtitleItem {
  id: string;
  primaryText: string;
  secondaryText: string;
  startTime: number;
  endTime: number;
  videoId: string;
}

interface SubtitleState {
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  subtitles: Array<SubtitleItem>;
  savedSubtitles: Array<SubtitleItem>;
  
  // 액션
  setPrimaryLanguage: (lang: string) => void;
  setSecondaryLanguage: (lang: string) => void;
  setDisplayMode: (mode: 'primary' | 'secondary' | 'dual') => void;
  saveSubtitle: (subtitle: SubtitleItem) => void;
}

const useSubtitleStore = create<SubtitleState>((set) => ({
  primaryLanguage: 'ko',
  secondaryLanguage: 'en',
  displayMode: 'dual',
  subtitles: [],
  savedSubtitles: [],
  
  setPrimaryLanguage: (lang) => set({ primaryLanguage: lang }),
  setSecondaryLanguage: (lang) => set({ secondaryLanguage: lang }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  saveSubtitle: (subtitle) => set((state) => ({ 
    savedSubtitles: [...state.savedSubtitles, subtitle] 
  })),
}));

export default useSubtitleStore;
EOL

echo "✅ Play LearnEng 개발 환경 셋업이 완료되었습니다!"
echo "다음 명령어를 실행하여 개발을 시작하세요:"
echo "  cd play-learneng"
echo "  pnpm install (필요한 의존성 설치)"
echo "  pnpm dev (개발 서버 시작)"
