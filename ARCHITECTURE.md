# Play LearnEng 크롬 익스텐션 아키텍처

## 1. 개요

이 문서는 Play LearnEng 크롬 익스텐션의 아키텍처를 설명합니다. Play LearnEng는 쿠팡 플레이에서 외국어 학습을 지원하는 확장 프로그램으로, 이중 자막, 자막 커스터마이징, 구간 반복 등의 기능을 제공합니다.

## 2. 시스템 구성

Play LearnEng는 크게 다음과 같은 구성 요소로 이루어집니다:

```
+------------------------+       +------------------------+
|                        |       |                        |
|  Chrome Extension      |       |  Supabase Backend      |
|  (Frontend)            | <---> |  (Optional)            |
|                        |       |                        |
+------------------------+       +------------------------+
        |
        v
+------------------------+
|                        |
|  Coupang Play          |
|  (Target Website)      |
|                        |
+------------------------+
```

1. **크롬 익스텐션 (프론트엔드)**: 사용자와 직접 상호작용하는 인터페이스
2. **Supabase 백엔드 (선택사항)**: 자막 저장, 사용자 인증 등을 위한 백엔드 서비스
3. **쿠팡 플레이 웹사이트**: 익스텐션이 기능을 추가할 대상 웹사이트

## 3. 프론트엔드 아키텍처

### 3.1 폴더 구조

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
│   ├── subtitleStore.ts
│   ├── settingsStore.ts
│   └── playerStore.ts
├── services/          # 외부 서비스 연동 로직
│   ├── chrome/        # Chrome API 관련 서비스
│   ├── storage/       # 저장소(로컬/원격) 관련 서비스
│   └── subtitles/     # 자막 처리 관련 서비스
├── utils/             # 유틸리티 함수
├── pages/             # 익스텐션 페이지
│   ├── popup/         # 팝업 페이지
│   ├── options/       # 옵션 페이지
│   └── review/        # 자막 복습 페이지
├── content/           # 콘텐츠 스크립트
│   ├── index.tsx      # 메인 콘텐츠 스크립트 진입점
│   ├── injector.ts    # DOM 조작 및 자막 인젝션 로직
│   └── observers/     # Mutation Observer 등 DOM 감시 로직
├── background/        # 백그라운드 스크립트
├── manifest.ts        # 익스텐션 매니페스트 파일
└── index.tsx          # 메인 진입점
```

### 3.2 컴포넌트 아키텍처

React 컴포넌트는 다음과 같은 계층 구조로 설계됩니다:

- **컨테이너 컴포넌트**: 비즈니스 로직과 상태 관리 담당
- **프레젠테이션 컴포넌트**: UI 렌더링만 담당하는 순수 컴포넌트

### 3.3 상태 관리

Zustand를 사용한 상태 관리 구조:

```typescript
// subtitleStore.ts 예시
import create from 'zustand';

interface SubtitleState {
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  subtitles: Array<SubtitleItem>;
  // ...actions
  setPrimaryLanguage: (lang: string) => void;
  setDisplayMode: (mode: 'primary' | 'secondary' | 'dual') => void;
  saveSubtitle: (subtitle: SubtitleItem) => void;
}

const useSubtitleStore = create<SubtitleState>((set) => ({
  primaryLanguage: 'ko',
  secondaryLanguage: 'en',
  displayMode: 'dual',
  subtitles: [],
  
  setPrimaryLanguage: (lang) => set({ primaryLanguage: lang }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  saveSubtitle: (subtitle) => 
    set((state) => ({ 
      subtitles: [...state.subtitles, subtitle] 
    })),
}));
```

## 4. 주요 기능 구현

### 4.1 이중 자막 (Dual Subtitles)

이중 자막 기능은 다음과 같은 방식으로 구현됩니다:

1. **자막 감지 및 추출**:
   - MutationObserver를 사용하여 쿠팡 플레이의 자막 DOM 요소 변화 감지
   - 자막 텍스트 및 메타데이터 추출

2. **자막 인젝션**:
   - 추출된 자막을 기반으로 커스텀 자막 DOM 요소 생성
   - 스타일링 및 위치 조정 적용

3. **언어 전환**:
   - 사용자 설정에 따라 자막 언어 및 표시 방식 전환 기능 제공

### 4.2 자막 커스터마이징

```typescript
// settingsStore.ts 예시
interface SubtitleStyle {
  position: 'top' | 'middle' | 'bottom';
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  opacity: number;
  autoWrap: boolean;
  // ...기타 스타일 속성
}

// 사용자 설정에 따라 스타일 객체 생성 및 적용
```

### 4.3 구간 반복

구간 반복 기능은 다음 컴포넌트로 구현됩니다:

- **A/B 마커 컴포넌트**: 시작/종료 지점 설정 UI
- **플레이어 컨트롤러**: 비디오 API를 사용하여 특정 구간 반복 재생 제어
- **단축키 핸들러**: 키보드 단축키를 통한 구간 반복 제어

### 4.4 자막 저장 및 복습

자막 저장 로직은 이원화하여 구현합니다:

1. **로컬 저장 (Chrome Storage API)**:
```typescript
// Local Storage Service
const saveSubtitleLocally = async (subtitle: SubtitleItem) => {
  const { subtitles = [] } = await chrome.storage.local.get('subtitles');
  await chrome.storage.local.set({
    subtitles: [...subtitles, {
      ...subtitle,
      savedAt: new Date().toISOString()
    }]
  });
};
```

2. **원격 저장 (Supabase) - 선택사항**:
```typescript
// Supabase Storage Service
const saveSubtitleRemotely = async (subtitle: SubtitleItem, userId: string) => {
  await supabase
    .from('subtitles')
    .insert({
      user_id: userId,
      primary_text: subtitle.primaryText,
      secondary_text: subtitle.secondaryText,
      video_id: subtitle.videoId,
      timestamp: subtitle.timestamp,
      saved_at: new Date()
    });
};
```

## 5. 백엔드 아키텍처 (Supabase)

### 5.1 데이터베이스 스키마

```sql
-- 사용자 테이블은 Supabase Auth에서 자동 관리
-- 저장된 자막 정보
CREATE TABLE subtitles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  primary_text TEXT NOT NULL,
  secondary_text TEXT,
  video_id TEXT NOT NULL,
  video_title TEXT,
  timestamp FLOAT NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 메타데이터
  memo TEXT,
  is_favorite BOOLEAN DEFAULT FALSE
);

-- 사용자 구독 정보 (향후 확장 시)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan_type TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);
```

### 5.2 권한 정책

```sql
-- 자막은 본인이 저장한 것만 접근 가능하도록 설정
CREATE POLICY "개인 자막 접근 정책" ON subtitles
  FOR ALL USING (auth.uid() = user_id);
```

### 5.3 API 엔드포인트 (Edge Functions)

향후 결제 시스템 연동을 위한 서버리스 함수:

```typescript
// 결제 완료 웹훅 처리 함수 예시
export async function handlePaymentWebhook(req) {
  const { payment_id, status, user_id, plan_type } = req.body;
  
  if (status === 'success') {
    await supabase
      .from('subscriptions')
      .upsert({
        user_id,
        plan_type,
        starts_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
        is_active: true
      });
      
    return { success: true };
  }
  
  return { success: false, error: 'Payment failed' };
}
```

## 6. 통합 플로우

### 6.1 초기화 플로우

1. 익스텐션 설치 및 활성화
2. 쿠팡 플레이 페이지 접속 시 콘텐츠 스크립트 자동 실행
3. DOM 준비 상태 감지 후 Play LearnEng UI 요소 주입
4. 로컬 저장소에서 사용자 설정 불러오기 및 적용

### 6.2 자막 처리 플로우

```
사용자 자막 언어 선택 → 자막 탐지 → 자막 추출/변환 → 커스텀 UI로 렌더링 → 유저 인터랙션
```

### 6.3 데이터 동기화 플로우 (Supabase 사용 시)

```
로컬 저장 → 로그인 상태 확인 → 온라인 상태 확인 → Supabase 동기화 → 성공/실패 처리
```

## 7. 호환성 및 성능 고려사항

### 7.1 DOM 구조 변경 대응

쿠팡 플레이의 DOM 구조 변경에 대응하기 위한 전략:

1. **선택자 추상화**: 직접적인 CSS 선택자 하드코딩 대신 우선순위가 있는 선택자 목록 사용
2. **동적 감지 로직**: 페이지 로드 후 DOM 구조를 분석하여 적절한 요소 탐지
3. **재시도 메커니즘**: DOM 요소를 찾을 수 없을 경우 일정 간격으로 재시도

### 7.2 성능 최적화

1. **메모리 사용량 최적화**:
   - 불필요한 DOM 요소 최소화
   - 이벤트 리스너 적절히 관리 (메모리 누수 방지)

2. **CPU 사용량 최적화**:
   - 렌더링 최적화 (React.memo, useMemo, useCallback 활용)
   - 애니메이션 및 DOM 조작 제한

3. **네트워크 최적화**:
   - 필요한 데이터만 선택적으로 동기화
   - 배치 처리를 통한 API 호출 최소화

## 8. 보안 고려사항

1. **데이터 보안**:
   - 민감한 사용자 정보는 로컬에 저장하지 않음
   - Supabase의 보안 정책 활용하여 데이터 접근 제한

2. **Content Security Policy**:
   - 적절한 CSP 설정으로 XSS 공격 방지
   - 외부 리소스 로딩 제한

3. **권한 최소화**:
   - 매니페스트에서 필요한 최소한의 권한만 요청

## 9. 확장성 고려사항

1. **모듈화된 설계**:
   - 기능별로 모듈화하여 새로운 기능 추가 용이하게 설계
   - 플러그인 아키텍처를 통해 코어 기능과 확장 기능 분리

2. **추가 OTT 서비스 확장**:
   - 서비스별 어댑터 패턴 도입으로 다른 OTT 플랫폼 지원 확장 용이
   - 공통 인터페이스 정의를 통해 일관된 기능 제공

3. **프리미엄 기능 확장**:
   - 기능 플래그를 통한 프리미엄 기능 관리
   - 구독 상태에 따른 기능 접근 제어 시스템
