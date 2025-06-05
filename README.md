# Play LearnEng - 쿠팡 플레이 외국어 학습 도우미

<div align="center">
  <img src="https://via.placeholder.com/200x200?text=Play+LearnEng" alt="Play LearnEng Logo" width="200" />
  <p>쿠팡 플레이 콘텐츠를 외국어 학습에 효과적으로 활용하세요</p>
</div>

## 📖 소개

**Play LearnEng**는 쿠팡 플레이(Coupang Play)를 시청하며 효과적인 외국어 학습이 가능하도록 도와주는 크롬 익스텐션입니다. 영화와 드라마를 즐기는 동시에 언어 실력을 향상시키고 싶은 사용자를 위한 다양한 기능을 제공합니다.

### 주요 특징

- **이중 자막**: 두 개 언어의 자막을 동시에 표시
- **자막 커스터마이징**: 위치, 색상, 크기 등 조절 가능 (구현 예정)
- **자막 분석**: 전체 자막 목록을 보고 이해도 향상

## ✨ 주요 기능

### 1. 이중 자막 (Dual Subtitles)
- 주 자막과 보조 자막을 동시에 화면에 표시
- 주 자막/보조 자막/이중 자막 모드 간 전환 가능
- 선호하는 자막 언어 설정 저장 (구현 예정)

### 2. 자막 커스터마이징 (구현 예정)
- 자막 위치 조절
- 텍스트 색상 및 배경색 설정
- 텍스트 크기 및 굵기 조절
- 배경 불투명도 조절
- 자동 줄바꿈 설정
- 자막 싱크 미세 조절

### 3. 영상 컨트롤 (구현 예정)
- 시간 단위 영상 이동
- 이전/다음 자막으로 이동
- 재생 속도 조절

### 4. 자막 분석
- 현재 영상 전체 자막 시간 순 표시
- 현재 재생 중인 자막 자동 강조 및 스크롤 (구현 예정)

## 🛠 기술 스택

### 프론트엔드
- **언어**: TypeScript, JavaScript (ES6+)
- **프레임워크**: React 18
- **상태 관리**: Zustand
- **스타일링**: Tailwind CSS, HeadlessUI
- **빌드 도구**: Vite, CRXJS
- **패키지 관리**: pnpm

### 백엔드 (선택적 - 현재 미사용)
- **플랫폼**: Supabase
- **데이터베이스**: PostgreSQL (Supabase 내장)
- **인증**: Supabase Auth
- **서버리스 함수**: Supabase Edge Functions

## 📋 설치 및 사용 방법

### 설치
1. [Chrome 웹 스토어](https://chrome.google.com/webstore/)에서 "Play LearnEng" 검색 (출시 후 링크 업데이트 예정)
2. "Chrome에 추가" 버튼을 클릭하여 설치

### 사용 방법
1. 쿠팡 플레이 웹사이트 접속
2. 원하는 콘텐츠 재생
3. 화면 우측 하단에 표시되는 Play LearnEng 아이콘 클릭 (팝업 UI 구현 예정)
4. 원하는 기능(이중 자막, 자막 분석 등) 선택하여 사용

## 🚀 개발 환경 설정

로컬에서 개발하고 싶으신 분들을 위한 가이드입니다.

### 요구 사항
- Node.js 18.x 이상 (Vite 최신 버전 권장 사항 반영)
- pnpm 7.x 이상
- Git

### 설정 방법
```bash
# 저장소 클론
git clone https://github.com/yourusername/play-learneng.git # 실제 사용자 이름으로 변경 필요
cd play-learneng

# 의존성 설치
pnpm install

# 개발 서버 실행 (Chrome 익스텐션 로드 필요)
pnpm dev
```
Chrome 브라우저에서 `chrome://extensions` 페이지를 열고, "압축해제된 확장 프로그램을 로드합니다." 버튼을 클릭하여 `dist` 폴더를 선택합니다.

### 빠른 설정
저장소 루트 디렉토리에 제공된 `setup.sh` 스크립트를 사용하여 개발 환경을 빠르게 설정할 수 있습니다 (스크립트 내용 확인 및 권한 부여 필요):

```bash
chmod +x setup.sh
./setup.sh
```

## 📂 프로젝트 구조

```
play-learneng/
├── public/            # 정적 에셋 (아이콘 등)
├── src/               # 소스 코드
│   ├── assets/        # 이미지, 아이콘 등의 정적 자원
│   ├── components/    # 재사용 가능한 UI 컴포넌트
│   │   ├── player/    # 영상 플레이어 관련 컴포넌트 (예시)
│   │   └── subtitles/ # 자막 관련 컴포넌트 (DualSubtitles.tsx 등)
│   ├── content/       # 콘텐츠 스크립트 (DOM 조작, Coupang Play 페이지와 상호작용)
│   │   └── index.tsx
│   │   └── observers/ # DOM 변경 감지 로직 (SubtitleObserver.ts 등)
│   ├── background/    # 백그라운드 스크립트
│   │   └── index.ts
│   ├── pages/         # 익스텐션 UI 페이지 (팝업 등)
│   │   └── popup/
│   ├── services/      # 외부 서비스 연동 또는 핵심 로직
│   │   ├── chrome/    # Chrome API 관련 서비스 (storageService.ts 등)
│   │   └── subtitles/ # 자막 처리 관련 서비스 (vttSubtitleService.ts 등)
│   ├── store/         # Zustand 상태 관리 (subtitleStore.ts 등)
│   ├── utils/         # 유틸리티 함수 (logger.ts, subtitleAnalyzer.ts 등)
│   ├── index.css      # 전역 스타일
│   ├── index.tsx      # React 애플리케이션 진입점 (팝업 등 UI용)
│   └── manifest.ts    # 익스텐션 매니페스트 파일
├── .eslintrc.cjs      # ESLint 설정 파일
├── .gitignore         # Git 무시 파일 목록
├── package.json       # 프로젝트 메타데이터 및 의존성 관리
├── pnpm-lock.yaml     # pnpm 의존성 잠금 파일
├── postcss.config.js  # PostCSS 설정
├── README.md          # 프로젝트 설명 문서
├── tailwind.config.js # Tailwind CSS 설정
├── tsconfig.json      # TypeScript 설정
├── tsconfig.node.json # TypeScript Node.js 환경 설정
└── vite.config.ts     # Vite 설정 파일
```

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요. (LICENSE 파일 생성 필요)

## 🙏 감사의 말

- 쿠팡 플레이 서비스 - 훌륭한 콘텐츠 제공
- 오픈소스 커뮤니티 - 다양한 라이브러리와 도구 제공

## 📞 문의하기

프로젝트에 관한 질문이나 제안이 있으시면, 이슈를 생성하거나 다음 연락처로 문의해 주세요:

- Email: [your-email@example.com](mailto:your-email@example.com) <!-- 실제 이메일로 변경 필요 -->
- GitHub Issues: [프로젝트 저장소 Issues 링크] <!-- 실제 링크로 변경 필요 -->

---

<div align="center">
  <p>🌟 Play LearnEng를 사용해 즐겁게 외국어를 학습하세요! 🌟</p>
</div>
