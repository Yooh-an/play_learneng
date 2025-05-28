# Play LearnEng - 쿠팡 플레이 외국어 학습 도우미

<div align="center">
  <img src="https://via.placeholder.com/200x200?text=Play+LearnEng" alt="Play LearnEng Logo" width="200" />
  <p>쿠팡 플레이 콘텐츠를 외국어 학습에 효과적으로 활용하세요</p>
</div>

## 📖 소개

**Play LearnEng**는 쿠팡 플레이(Coupang Play)를 시청하며 효과적인 외국어 학습이 가능하도록 도와주는 크롬 익스텐션입니다. 영화와 드라마를 즐기는 동시에 언어 실력을 향상시키고 싶은 사용자를 위한 다양한 기능을 제공합니다.

### 주요 특징

- **이중 자막**: 두 개 언어의 자막을 동시에 표시
- **자막 커스터마이징**: 위치, 색상, 크기 등 자유롭게 조절
- **구간 반복**: 특정 대사를 반복해서 학습
- **자막 저장 및 복습**: 기억하고 싶은 문장을 저장하고 복습
- **자막 분석**: 전체 자막 목록을 보고 이해도 향상

## ✨ 주요 기능

### 1. 이중 자막 (Dual Subtitles)
- 주 자막과 보조 자막을 동시에 화면에 표시
- 주 자막/보조 자막/이중 자막 모드 간 전환 가능
- 선호하는 자막 언어 설정 저장

### 2. 자막 커스터마이징
- 자막 위치 조절
- 텍스트 색상 및 배경색 설정
- 텍스트 크기 및 굵기 조절
- 배경 불투명도 조절
- 자동 줄바꿈 설정
- 자막 싱크 미세 조절

### 3. 영상 컨트롤
- 시간 단위 영상 이동
- 이전/다음 자막으로 이동
- 재생 속도 조절

### 4. 구간 반복
- A/B 마커로 원하는 구간 반복 재생
- 현재 자막만 반복 재생

### 5. 자막 저장 및 복습
- 마음에 드는 자막 저장
- 복습 메뉴에서 저장한 자막 목록 확인
- 저장 자막 필터링 및 검색
- 저장된 자막 클릭 시 해당 영상 시점으로 이동

### 6. 자막 분석
- 현재 영상 전체 자막 시간 순 표시
- 현재 재생 중인 자막 자동 강조 및 스크롤

## 🛠 기술 스택

### 프론트엔드
- **언어**: TypeScript, JavaScript (ES6+)
- **프레임워크**: React 18
- **상태 관리**: Zustand
- **스타일링**: Tailwind CSS + HeadlessUI
- **빌드 도구**: Vite + CRXJS
- **패키지 관리**: pnpm

### 백엔드 (선택적)
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
3. 화면 우측 하단에 표시되는 Play LearnEng 아이콘 클릭
4. 원하는 기능(이중 자막, 커스터마이징, 구간 반복 등) 선택하여 사용

## 🚀 개발 환경 설정

로컬에서 개발하고 싶으신 분들을 위한 가이드입니다.

### 요구 사항
- Node.js 16.x 이상
- pnpm 7.x 이상
- Git

### 설정 방법
```bash
# 저장소 클론
git clone https://github.com/yourusername/play-learneng.git
cd play-learneng

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

### 빠른 설정
저장소 루트 디렉토리에 제공된 `setup.sh` 스크립트를 사용하여 개발 환경을 빠르게 설정할 수 있습니다:

```bash
chmod +x setup.sh
./setup.sh
```

## 📂 프로젝트 구조

```
src/
├── assets/            # 이미지, 아이콘 등의 정적 자원
├── components/        # 재사용 가능한 UI 컴포넌트
│   ├── common/        # 공통 UI 요소
│   ├── player/        # 영상 플레이어 관련 컴포넌트
│   ├── subtitles/     # 자막 관련 컴포넌트
│   └── settings/      # 설정 관련 컴포넌트
├── hooks/             # 커스텀 React 훅
├── store/             # Zustand 상태 관리
├── services/          # 외부 서비스 연동 로직
├── utils/             # 유틸리티 함수
├── pages/             # 익스텐션 페이지
├── content/           # 콘텐츠 스크립트
├── background/        # 백그라운드 스크립트
└── manifest.ts        # 익스텐션 매니페스트 파일
```

## 🤝 기여하기

Play LearnEng는 오픈소스 프로젝트로, 여러분의 기여를 환영합니다!

1. 이 저장소를 Fork합니다
2. 새 Branch를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 Commit합니다 (`git commit -m 'Add some amazing feature'`)
4. Branch에 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

기여하기 전에 [TODO.md](TODO.md) 문서를 확인하여 현재 개발 상황을 파악하세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- 쿠팡 플레이 서비스 - 훌륭한 콘텐츠 제공
- 오픈소스 커뮤니티 - 다양한 라이브러리와 도구 제공

## 📞 문의하기

프로젝트에 관한 질문이나 제안이 있으시면, 이슈를 생성하거나 다음 연락처로 문의해 주세요:

- Email: [your-email@example.com](mailto:your-email@example.com)
- Twitter: [@YourTwitterHandle](https://twitter.com/YourTwitterHandle)

---

<div align="center">
  <p>🌟 Play LearnEng를 사용해 즐겁게 외국어를 학습하세요! 🌟</p>
</div>
