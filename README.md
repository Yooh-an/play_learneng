# Play LearnEng - 쿠팡 플레이 이중 자막 학습 도우미

<div align="center">
  <p>🎬 쿠팡 플레이에서 한국어/영어 이중 자막으로 효과적인 언어 학습을 경험하세요</p>
</div>

## 📖 소개

**Play LearnEng**는 쿠팡 플레이(Coupang Play)에서 한국어와 영어 이중 자막을 지원하는 크롬 익스텐션입니다. 드라마와 영화를 시청하며 자연스럽게 언어를 학습할 수 있도록 다양한 기능을 제공합니다.

### 🌟 주요 특징

- **🎯 이중 자막 표시**: 한국어/영어 자막을 동시에 화면에 표시
- **📚 자막 저장 기능**: 클릭 한 번으로 학습할 자막을 단어장에 저장
- **🔍 스크립트 분석**: 전체 자막을 시간순으로 검색하고 분석
- **⚙️ 자막 커스터마이징**: 크기, 위치, 투명도 등 세부 설정 가능
- **⌨️ 단축키 지원**: Shift+C로 빠른 자막 저장

## ✨ 주요 기능

### 1. 이중 자막 시스템
- 주 언어(한국어/영어)와 보조 언어 동시 표시
- 주 자막만, 보조 자막만, 이중 자막 모드 전환
- 실시간 자막 동기화 및 표시

### 2. 스마트 자막 저장
- 자막 클릭 또는 Shift+C 단축키로 즉시 저장
- 에피소드 정보와 타임스탬프 자동 기록
- 날짜별 필터링으로 체계적인 복습 관리

### 3. 스크립트 분석 도구
- 한국어/영어 전체 자막 스크립트 제공
- 키워드 검색으로 특정 표현 빠르게 찾기
- 타임스탬프 클릭으로 해당 시점 바로 이동

### 4. 자막 설정 커스터마이징
- 글자 크기: 20px~40px 조절
- 자막 위치: 화면 상단부터 하단까지 자유 조정
- 배경 투명도: 0%~100% 세밀 조절
- 실시간 설정 적용으로 즉시 확인 가능

## 🛠 기술 스택

- **Frontend**: React 18 + TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite + CRXJS
- **Package Manager**: pnpm
- **Chrome Extension APIs**: Storage, Runtime, WebRequest

## 📋 설치 및 사용법

### 설치
```bash
# 개발자 모드로 설치 (Chrome 웹 스토어 출시 예정)
1. Chrome 브라우저에서 chrome://extensions 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 프로젝트의 dist 폴더 선택
```

### 사용법
1. **쿠팡 플레이 접속**: 원하는 콘텐츠 재생
2. **자막 활성화**: 자동으로 이중 자막이 화면에 표시됨
3. **자막 저장**: 학습하고 싶은 자막 클릭 또는 Shift+C 키 사용
4. **설정 조정**: 익스텐션 팝업에서 자막 스타일 커스터마이징
5. **복습하기**: 단어장 탭에서 저장된 자막들을 날짜별로 복습

## 🚀 개발 환경 설정

### 요구사항
- Node.js 18.x 이상
- pnpm 8.x 이상
- Chrome 브라우저

### 로컬 개발
```bash
# 저장소 클론
git clone <repository-url>
cd play-learneng

# 의존성 설치
pnpm install

# 개발 빌드
pnpm dev

# 프로덕션 빌드
pnpm build
```

### Chrome 익스텐션 로드
1. `pnpm dev` 실행 후 `dist` 폴더 생성 확인
2. Chrome에서 `chrome://extensions` 접속
3. "개발자 모드" 활성화
4. "압축해제된 확장 프로그램을 로드합니다" → `dist` 폴더 선택

## 📂 프로젝트 구조

```
src/
├── background/         # 백그라운드 스크립트 (VTT 파싱, 네트워크 모니터링)
│   └── index.ts
├── content/           # 콘텐츠 스크립트 (DOM 조작, UI 인젝션)
│   └── index.tsx
├── components/        # React 컴포넌트
│   └── player/        # 플레이어 컨트롤러
├── pages/            # 익스텐션 페이지
│   └── popup/        # 팝업 UI (단어장, 스크립트 분석, 설정)
├── store/           # Zustand 상태 관리
│   └── subtitleStore.ts
├── utils/           # 유틸리티 함수
│   ├── logger.ts
│   ├── playerDetector.ts
│   └── subtitleCapturer.ts
└── services/        # 서비스 레이어
    └── subtitles/
```

## 🎯 핵심 아키텍처

### VTT 자막 처리 플로우
```
MPD 파일 감지 → VTT URL 추출 → 자막 다운로드 → 파싱 → 콘텐츠 스크립트 전송 → UI 렌더링
```

### 컴포넌트 통신
```
Background Script ↔ Content Script ↔ PlayerController ↔ PopupUI
```

### 데이터 저장
- **Chrome Storage Sync**: 사용자 설정, 저장된 자막
- **Chrome Storage Local**: VTT 캐시, 임시 데이터

## 🔧 주요 구현 기술

### 1. VTT 자막 감지 및 파싱
- WebRequest API로 MPD 파일 모니터링
- VTT URL 추출 및 자동 다운로드
- 실시간 자막 데이터 파싱 및 전송

### 2. DOM 조작 및 UI 인젝션
- MutationObserver로 원본 자막 비활성화
- React Portal로 커스텀 자막 UI 렌더링
- 동적 스타일 적용 및 위치 조정

### 3. 상태 관리
- Zustand로 중앙화된 상태 관리
- Chrome Storage와 실시간 동기화
- 설정 변경 시 즉시 UI 반영

## 📱 지원 기능

### 현재 지원
- ✅ 쿠팡 플레이 한국어/영어 이중 자막
- ✅ 자막 저장 및 단어장 관리
- ✅ 전체 스크립트 분석 및 검색
- ✅ 자막 스타일 커스터마이징
- ✅ 키보드 단축키 (Shift+C)

### 향후 계획
- 🔄 다른 OTT 플랫폼 지원 확장
- 🔄 자막 동기화 미세 조정
- 🔄 구간 반복 재생 기능
- 🔄 학습 통계 및 진도 관리

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🙏 Special Thanks

- **쿠팡 플레이** - 훌륭한 콘텐츠와 서비스 제공
- **오픈소스 커뮤니티** - React, Vite, Tailwind CSS 등 amazing tools

---

<div align="center">
  <p>🎬 Play LearnEng와 함께 즐겁게 언어를 학습하세요! 📚</p>
</div>
