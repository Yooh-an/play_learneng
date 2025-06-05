# Play LearnEng 개발 TodoList

## 🚀 Phase 1: 핵심 기능 구현 및 개선 (Core Feature Implementation & Refinement)

### 1.1. 자막 커스터마이징 (Subtitle Customization)
- [v] **UI**: 설정 패널 내 자막 커스터마이징 UI 구현
- [v] **기능**: 주 자막/보조 자막 배경색 및 불투명도 설정
- [v] **기능**: 주 자막/보조 자막 텍스트 크기 및 굵기 조절
- [v] **기능**: 자막 자동 줄바꿈 옵션 제공
- [v] **저장**: 커스텀 설정 `chrome.storage`에 저장 및 로드 (`storageService.ts` 활용)

### 1.3. 자막 분석 (Subtitle Analysis) - 기능 강화
- [ ] **UI**: 현재 재생 중인 자막 자동 강조 표시 (기존 `DualSubtitles.tsx` 또는 관련 컴포넌트 개선)
- [ ] **UI**: 현재 재생 중인 자막으로 자동 스크롤 (자막 목록 표시 영역)
- [v] **기능**: 자막 목록에서 특정 자막 클릭 시 해당 영상 시점으로 이동 (기존 기능 점검 및 개선, `subtitleAnalyzer.ts` 연계)

### 1.6. 단어장 관리 (Vocabulary Management)
- [ ] **일자별 저장**: 단어장 항목을 날짜별로 저장 및 관리
- [ ] **UI**: 단어장 상단에 날짜 선택 드롭다운 추가 (오늘, 날짜별, 전체)
- [ ] **데이터 관리**: 최근 7일간의 데이터만 유지하는 자동 정리 기능
- [ ] **필터링**: 선택한 날짜에 따라 단어장 내용 필터링하는 기능

### 1.4. 팝업 UI (Popup UI)
- [ ] **디자인**: 팝업 UI 디자인 (Figma 등 활용 또는 직접 디자인)
- [v] **구현**: `src/pages/popup/popup.tsx` 기반 팝업 UI 개발
    - [v] 현재 상태 표시 (예: 활성화 여부, 현재 선택된 언어 - `subtitleStore.ts` 연동)

### 1.5. 설정 (Settings)
- [v] **UI**: 별도 설정 페이지 또는 팝업 내 설정 섹션 구현
- [v] **기능**: 주 자막/보조 자막 선호 언어 설정 저장 및 로드 (`storageService.ts`, `subtitleStore.ts` 연동)

## 🎨 Phase 2: UI/UX 개선 및 추가 기능 (UI/UX Polish & Additional Features)

### 2.1. 디자인 시스템 및 UI 일관성
- [v] **디자인**: 쿠팡 플레이 UI와 조화로우면서 사용성 높은 디자인 시스템 정의 (Tailwind CSS 기반)
- [ ] **아이콘**: 직관적이고 통일된 아이콘 세트 제작 또는 선정 (`src/assets` 활용)
- [v] **레이블**: 명확하고 이해하기 쉬운 레이블 사용
- [v] **반응형**: 팝업 및 설정 UI 반응형 디자인 적용

### 2.2. 사용자 경험 (User Experience)
- [ ] **테마**: 다크/라이트 테마 지원 (OS 설정 연동 또는 수동 선택, Tailwind CSS 활용)
- [ ] **가이드**: 최초 사용자를 위한 간단한 온보딩 가이드 또는 튜토리얼 제공 (팝업 또는 별도 페이지)
- [ ] **피드백**: 사용자 액션에 대한 시각적/청각적 피드백 개선

### 2.3. 단축키 시스템 (Shortcut System)
- [ v **기능**: 주요 기능에 대한 기본 단축키 매핑 (예: 이중 자막 토글, 다음/이전 자막) (`manifest.ts` commands 활용 및 `background/index.ts` 처리)

### 2.4. 성능 최적화 (Performance Optimization)
- [ ] **자막 처리**: 대용량 자막 파일 로드 및 파싱 성능 개선 (`vttSubtitleService.ts`)
- [ ] **DOM 조작**: 콘텐츠 스크립트의 DOM 조작 최적화 (`SubtitleObserver.ts`, `content/index.tsx`)
- [ ] **메모리 관리**: 메모리 누수 점검 및 최적화 (특히 장시간 사용 시, `cleanupHelper.ts` 활용)
- [ ] **백그라운드**: 백그라운드 스크립트 (`background/index.ts`) 작업 효율성 증대

## 🧪 Phase 3: 테스트 및 배포 준비 (Testing & Deployment Prep)

### 3.1. 테스트 (Testing)
- [ ] **호환성**: 다양한 쿠팡 플레이 콘텐츠 (영화, 드라마, 예능)에서의 호환성 테스트
- [ ] **기능 통합**: 모든 핵심 기능 (이중 자막, 자막 분석, 커스터마이징, 영상 컨트롤, 팝업) 통합 테스트
- [ ] **엣지 케이스**: 다양한 사용자 시나리오 및 엣지 케이스 테스트 (예: 자막 없는 콘텐츠, 네트워크 불안정)
- [ ] **성능**: 실제 사용 환경에서의 성능 프로파일링 및 병목 지점 개선
- [ ] **오류 처리**: 예외 상황 및 오류 발생 시 사용자 친화적인 처리 및 복구 메커니즘 검증 (`logger.ts` 활용)

### 3.2. 배포 준비 (Deployment Preparation)
- [ ] **매니페스트**: `manifest.ts` 최종 검토 및 권한, 설정 등 확인 (버전 정보 포함)
- [ ] **에셋**: 최종 아이콘 (`public/` 및 `src/assets/`) 및 프로모션 이미지 제작
- [ ] **문서화**:
    - [ ] `LICENSE` 파일 생성 (예: MIT License) 및 추가
    - [ ] `PRIVACY.md` (개인정보 처리방침) 작성 (필요시)
    - [ ] `README.md` 최종 업데이트 (설치, 사용법, 기능 소개, 스크린샷 등)
    - [ ] 크롬 웹 스토어 등록 정보 (설명, 스크린샷 가이드라인 등) 준비
- [ ] **빌드**: 최종 프로덕션 빌드 생성 (`pnpm build`) 및 테스트
- [ ] **패키징**: 배포용 `.zip` 파일 생성 (예: `play-learneng-vX.Y.Z-production.zip`)

## 🌟 Phase 4: 장기 계획 및 선택적 기능 (Long-term & Optional Features)

### 4.1. 자막 저장 및 복습 (Save & Review Subtitles)
- [ ] **UI**: 저장된 자막 목록 UI, 복습 UI (팝업 내 별도 탭 또는 페이지)
- [ ] **기능**: 현재 자막 클릭 또는 버튼으로 저장
- [ ] **기능**: 저장된 자막 필터링, 검색, 삭제
- [ ] **기능**: 저장된 자막 클릭 시 해당 영상의 해당 시간으로 이동 (가능한 경우, 쿠팡 플레이 URL 구조 및 재생 제어 가능성 확인 필요)
- [ ] **데이터**: `chrome.storage.local` 또는 `chrome.storage.sync`를 사용한 저장된 자막 데이터 관리 (`storageService.ts` 확장)
- [ ] **일자별 자막 관리**: 
    - [ ] **UI**: 단어장 타이틀 라인 옆에 날짜 드롭다운 추가 (오늘, 6월 4일, 6월 3일... 전체)
    - [ ] **데이터**: 자막 저장 시 날짜 정보 함께 저장
    - [ ] **데이터 관리**: 사용 날짜 기준 최근 7일간의 자막만 유지 (오래된 데이터 자동 정리)
    - [ ] **필터링**: 선택된 날짜에 따라 단어장 내용 필터링

### 4.2. 내보내기 기능 (Export Features)
- [ ] **기능**: 현재 영상의 전체 자막 스크립트 내보내기 (텍스트 파일, `subtitleAnalyzer.ts` 활용)
- [ ] **기능**: (선택적) 저장된 자막 목록 내보내기

### 4.3. Supabase 백엔드 연동 (Optional Backend Integration)
- [ ] **목표**: 사용자 설정 동기화, 저장된 자막 클라우드 백업 등 (현재는 로컬 저장 우선)
- [ ] **작업**:
    - [ ] Supabase 프로젝트 설정
    - [ ] 데이터베이스 스키마 설계 (user_settings, saved_subtitles 등)
    - [ ] Supabase Auth 연동 (Google, Email 등)
    - [ ] Supabase 클라이언트 (`@supabase/supabase-js`) 연동
    - [ ] 데이터 동기화 로직 구현

### 4.4. 고급 학습 도구 (Advanced Learning Tools)
- [ ] **기능**: 반복 학습 알고리즘 (Spaced Repetition) 적용 (저장된 자막 대상)
- [ ] **기능**: 학습 진도 추적 및 통계 (간단한 형태로 시작)

---

## 📝 기타 작업 (Miscellaneous)
- [ ] 프로젝트 내 `// TODO:` 주석 정리 및 이 파일 또는 GitHub Issues로 이전
- [ ] 코드 스타일 일관성 유지 (ESLint, Prettier 규칙 준수 - `pnpm lint` 활용)
- [ ] 의존성 라이브러리 주기적 업데이트 및 보안 점검 (`package.json` 관리)
- [ ] `ARCHITECTURE.md`, `DEPLOYMENT.md`, `PRD.md` 등 관련 문서 최신화

## ✅ 완료된 주요 작업 (Completed Major Tasks - 2025년 6월 5일 기준)
- 이중 자막 기본 기능 구현 (`DualSubtitles.tsx`)
- VTT 자막 파싱 및 서비스 로직 구현 (`vttSubtitleService.ts`)
- 자막 변경 감지 로직 구현 (`SubtitleObserver.ts`)
- 상태 관리 (Zustand) 기본 설정 (`subtitleStore.ts`)
- Vite + CRXJS 기반 개발 환경 구축
- 기본적인 로깅 유틸리티 구현 (`logger.ts`)
- Chrome 저장소 서비스 기본 구현 (`storageService.ts`)
- 자막 추출 및 분석 유틸리티 일부 구현 (`subtitleExtractor.ts`, `subtitleAnalyzer.ts`)
- README.md 1차 개정

> **참고**: 현재 작업 우선순위는 Phase 1의 미완료 항목 및 Phase 2의 UI/UX 개선에 집중합니다.