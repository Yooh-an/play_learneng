# Play LearnEng 아키텍처 설계서

## 1. 개요

Play LearnEng는 쿠팡 플레이에서 한국어/영어 이중 자막 학습을 지원하는 Chrome Extension입니다. MPD 파일에서 VTT 자막을 자동 추출하여 사용자 친화적인 학습 환경을 제공합니다.

## 2. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Background     │  Content Script │      Popup UI           │
│  Script         │                 │                         │
│                 │                 │                         │
│ • MPD 감지      │ • DOM 조작      │ • 단어장 관리           │
│ • VTT 파싱      │ • UI 인젝션     │ • 스크립트 분석         │
│ • 네트워크 모니터링│ • 이벤트 처리   │ • 설정 관리             │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Coupang Play Website                       │
│                                                             │
│  • MPD 파일 (자막 URL 정보)                                 │
│  • VTT 파일 (실제 자막 데이터)                              │
│  • 비디오 플레이어                                          │
└─────────────────────────────────────────────────────────────┘
```

## 3. 컴포넌트별 상세 설계

### 3.1 Background Script (`src/background/index.ts`)

**역할**: 네트워크 모니터링, VTT 파싱, 데이터 중개

#### 핵심 기능

1. **MPD 파일 감지**
```typescript
// WebRequest API로 MPD 파일 자동 감지
chrome.webRequest.onCompleted.addListener(async (details) => {
  if (isCoupangPlayMpdUrl(details.url)) {
    const mpdContent = await fetch(details.url).then(r => r.text());
    await processMpdFile(details.url, mpdContent, details.tabId);
  }
}, { urls: ["*://*.coupangstreaming.com/*"] });
```

2. **VTT URL 추출 및 자막 파싱**
```typescript
// MPD XML 파싱으로 한국어/영어 VTT URL 추출
async function parseMpdForSubtitles(mpdContent: string): Promise<SubtitleUrls> {
  // AdaptationSet 요소에서 text/vtt 타입 추출
  // 언어별 BaseURL 수집
}

// VTT 내용을 구조화된 데이터로 변환
function parseVTT(vttContent: string): VttCue[] {
  // 시간 정보와 텍스트 파싱
  // 시간순 정렬 및 검증
}
```

3. **탭별 데이터 관리**
```typescript
// 탭별 자막 데이터 캐싱
const tabSubtitleData = new Map<number, TabSubtitleData>();
const contentScriptReadyTabs = new Set<number>();
const pendingVttMessages = new Map<number, VttMessagePayload[]>();
```

### 3.2 Content Script (`src/content/index.tsx`)

**역할**: DOM 조작, UI 인젝션, 사용자 인터랙션 처리

#### 핵심 기능

1. **플레이어 감지 및 초기화**
```typescript
// 플레이어 요소 감지 (재시도 로직 포함)
const detection = await detectPlayerWithRetry(15, 1000);
const { videoElement } = detection;

// React 컴포넌트 마운트
ReactDOM.createRoot(mountPoint).render(
  <PlayerController 
    videoElement={videoElement}
    getKoreanSubtitles={() => currentKoreanSubtitles}
    getEnglishSubtitles={() => currentEnglishSubtitles}
  />
);
```

2. **원본 자막 비활성화**
```typescript
// CSS를 통한 원본 자막 숨김 처리
export function hideOriginalSubtitles(): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .vjs-text-track-display .vjs-text-track-cue {
      opacity: 0 !important;
      display: none !important;
    }
  `;
}
```

3. **자막 저장 시스템**
```typescript
// 자막 클릭 이벤트 처리
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('play-learneng-subtitle-text')) {
    saveSubtitleToStorage({
      primaryText: koreanText,
      secondaryText: englishText,
      timestamp: videoElement.currentTime
    });
  }
});

// 키보드 단축키 (Shift+C)
document.addEventListener('keydown', (event) => {
  if (event.key === 'C' && event.shiftKey) {
    saveCurrentSubtitles();
  }
});
```

### 3.3 PlayerController (`src/components/player/PlayerController.tsx`)

**역할**: 자막 렌더링, 실시간 동기화, 스타일 적용

#### 핵심 기능

1. **실시간 자막 동기화**
```typescript
const updateCurrentSubtitles = useCallback(() => {
  const currentVideoTime = videoElement.currentTime + subtitleSync;
  
  // 현재 시간에 해당하는 자막 찾기
  const currentKoreanCue = koreanData?.cues.find(cue => 
    currentVideoTime >= cue.startTime && currentVideoTime <= cue.endTime
  );
  
  // 언어 설정에 따른 주/부 자막 결정
  if (subtitleSettings.primaryLanguage === 'ko') {
    primaryText = currentKoreanCue?.text || '';
    secondaryText = currentEnglishCue?.text || '';
  }
}, [videoElement, subtitleSync, getKoreanSubtitles, getEnglishSubtitles]);
```

2. **동적 자막 렌더링**
```typescript
const renderDualSubtitles = useCallback((subtitle: ActiveSubtitle) => {
  // 자막 컨테이너 생성 및 위치 설정
  container.style.cssText = `
    position: absolute !important;
    top: ${topPercentage}% !important;
    z-index: 9999 !important;
  `;
  
  // 주/부 자막 요소 생성 및 스타일 적용
  const primaryElement = document.createElement('div');
  primaryElement.style.cssText = `
    font-size: ${settings.fontSize}px !important;
    background-color: rgba(0, 0, 0, ${settings.opacity}) !important;
  `;
}, [displayMode, subtitleSettings]);
```

### 3.4 Popup UI (`src/pages/popup/popup.tsx`)

**역할**: 사용자 인터페이스, 설정 관리, 데이터 시각화

#### 탭 구조

1. **단어장 (Review Tab)**
```typescript
const ReviewTab = () => {
  // 날짜별 필터링
  const filteredSubtitles = getFilteredSubtitles();
  
  // 저장된 자막 목록 표시
  // 삭제 기능 제공
  // 날짜별 그룹화
};
```

2. **스크립트 분석 (Analysis Tab)**
```typescript
const AnalysisTab = () => {
  // VTT 데이터 파싱 및 표시
  const parseVTT = (vttContent: string, languagePrefix: 'ko' | 'en') => {
    // 시간 정보와 텍스트 추출
    // 검색 기능 지원
  };
  
  // 타임스탬프 클릭으로 영상 이동
  const jumpToTimestamp = (timestamp: number) => {
    chrome.tabs.sendMessage(tabId, { type: 'JUMP_TO_TIME', timestamp });
  };
};
```

3. **설정 (Subtitle Tab)**
```typescript
const SubtitleTab = () => {
  // 실시간 설정 변경
  const saveSettings = (newSettings: SubtitleSettings) => {
    chrome.storage.sync.set({ subtitleSettings: newSettings });
    chrome.tabs.sendMessage(tabId, { type: 'SETTINGS_UPDATED', settings: newSettings });
  };
  
  // 드래그 기반 슬라이더 조절
  const handleSliderMouseDown = (e, sliderType) => {
    // 마우스 드래그로 값 조절
    // 실시간 미리보기 제공
  };
};
```

## 4. 데이터 플로우

### 4.1 자막 데이터 플로우

```
1. MPD 파일 감지 (Background)
   ↓
2. VTT URL 추출 (Background)
   ↓
3. VTT 다운로드 및 파싱 (Background)
   ↓
4. 가공된 데이터 전송 (Background → Content)
   ↓
5. 실시간 자막 렌더링 (PlayerController)
   ↓
6. 사용자 인터랙션 처리 (Content Script)
```

### 4.2 설정 데이터 플로우

```
1. 사용자 설정 변경 (Popup UI)
   ↓
2. Chrome Storage Sync 저장
   ↓
3. 설정 변경 이벤트 전송 (Popup → Content)
   ↓
4. 실시간 스타일 적용 (PlayerController)
```

### 4.3 자막 저장 플로우

```
1. 자막 클릭 또는 단축키 (Content Script)
   ↓
2. 현재 자막 정보 수집 (비디오 정보, 타임스탬프)
   ↓
3. Chrome Storage Sync 저장
   ↓
4. 사용자 피드백 표시
   ↓
5. Popup UI 자동 업데이트
```

## 5. 상태 관리

### 5.1 Zustand Store (`src/store/subtitleStore.ts`)

```typescript
interface SubtitleState {
  // 설정
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  subtitleSync: number;
  
  // 현재 상태
  isPlaying: boolean;
  currentVideoId: string | null;
  activeSubtitles: ActiveSubtitle | null;
  
  // 자막 데이터
  koreanSubtitle: string | null;
  englishSubtitle: string | null;
  savedSubtitles: Array<SubtitleItem>;
}
```

### 5.2 Chrome Storage 구조

**Sync Storage** (계정 동기화됨):
```typescript
{
  subtitleSettings: SubtitleSettings,
  savedSubtitles: SavedSubtitle[],
  isDarkMode: boolean
}
```

**Local Storage** (로컬만):
```typescript
{
  koreanVttContent: string,
  englishVttContent: string,
  lastSavedSubtitle: SavedSubtitle
}
```

## 6. 통신 메커니즘

### 6.1 Background ↔ Content Script

```typescript
// Background → Content
chrome.tabs.sendMessage(tabId, {
  type: 'PROCESSED_SUBTITLE_RECEIVED',
  payload: processedSubtitleData
});

// Content → Background
chrome.runtime.sendMessage({
  type: 'VIDEO_ELEMENT_FOUND',
  payload: { videoId }
});
```

### 6.2 Popup ↔ Background/Content

```typescript
// Popup → Background (데이터 요청)
chrome.runtime.sendMessage({
  type: 'GET_CURRENT_VTT_FOR_POPUP'
});

// Popup → Content (설정 변경)
chrome.tabs.sendMessage(tabId, {
  type: 'SETTINGS_UPDATED',
  settings: newSettings
});
```

### 6.3 Custom Events (Content Script 내부)

```typescript
// VTT 데이터 업데이트 알림
const updateEvent = new CustomEvent('vttSubtitlesUpdated', {
  detail: { korean: koreanData, english: englishData }
});
document.dispatchEvent(updateEvent);

// 설정 변경 알림
const settingsEvent = new CustomEvent('settingsUpdated', {
  detail: newSettings
});
document.dispatchEvent(settingsEvent);
```

## 7. 성능 최적화

### 7.1 메모리 관리

1. **탭별 데이터 정리**
```typescript
function clearPendingVttMessagesAndVideoId(tabId: number) {
  pendingVttMessages.delete(tabId);
  tabVideoIdMap.delete(tabId);
  tabSubtitleData.delete(tabId);
  contentScriptReadyTabs.delete(tabId);
}
```

2. **이벤트 리스너 정리**
```typescript
useEffect(() => {
  const handleTimeUpdate = () => updateCurrentSubtitles();
  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  
  return () => {
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  };
}, [videoElement, updateCurrentSubtitles]);
```

### 7.2 렌더링 최적화

1. **쓰로틀링으로 업데이트 빈도 제한**
```typescript
const THROTTLE_INTERVAL = 250; // 250ms마다 업데이트
let lastUpdateTime = 0;

const handleSubtitleTimeUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime < THROTTLE_INTERVAL) return;
  lastUpdateTime = now;
  updateCurrentSubtitles();
};
```

2. **React 최적화**
```typescript
const renderDualSubtitles = useCallback((subtitle) => {
  // 메모이제이션으로 불필요한 리렌더링 방지
}, [displayMode, subtitleSettings]);
```

## 8. 에러 처리 및 복구

### 8.1 확장 프로그램 컨텍스트 검증

```typescript
function isExtensionContextValid(): boolean {
  try {
    const extensionId = chrome.runtime.id;
    return !!extensionId;
  } catch (error) {
    return false;
  }
}

function showInvalidContextMessage(): void {
  // 사용자에게 새로고침 필요 안내
  // 새로고침 버튼 제공
}
```

### 8.2 네트워크 오류 처리

```typescript
// VTT 다운로드 실패 시 재시도
const fetchWithRetry = async (url: string, maxRetries: number = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.text();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 8.3 DOM 변경 대응

```typescript
// 플레이어 감지 재시도 로직
export function detectPlayerWithRetry(
  maxAttempts = 10,
  intervalMs = 1000
): Promise<{ videoElement: HTMLVideoElement } | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const attemptDetection = () => {
      const videoElement = findVideoPlayer();
      if (videoElement) {
        resolve({ videoElement });
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        resolve(null);
        return;
      }
      
      setTimeout(attemptDetection, intervalMs);
    };
    attemptDetection();
  });
}
```

## 9. 보안 고려사항

### 9.1 Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 9.2 권한 최소화

```json
{
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.coupangplay.com/*",
    "*://*.coupangstreaming.com/*"
  ]
}
```

### 9.3 데이터 검증

```typescript
// VTT 데이터 검증
function processSubtitleData(vttContent: string, language: string): ProcessedSubtitleData {
  try {
    const cues = parseVTT(vttContent);
    return {
      language,
      cues,
      totalCues: cues.length,
      isValid: cues.length > 0
    };
  } catch (error) {
    return {
      language,
      cues: [],
      totalCues: 0,
      isValid: false
    };
  }
}
```

## 10. 확장성 고려사항

### 10.1 모듈화된 설계

- **Detector 추상화**: 다른 OTT 플랫폼 지원 확장 가능
- **Parser 인터페이스**: 다양한 자막 포맷 지원 확장 가능
- **Storage 추상화**: 로컬/원격 저장소 전환 용이

### 10.2 설정 시스템 확장

```typescript
// 플랫폼별 설정 지원
interface PlatformSettings {
  coupangPlay: SubtitleSettings;
  netflix?: SubtitleSettings;
  // 향후 추가 플랫폼
}
```

### 10.3 플러그인 아키텍처

```typescript
// 기능별 플러그인 분리
interface FeaturePlugin {
  name: string;
  init(): void;
  destroy(): void;
  isEnabled(): boolean;
}

class RepeatFeaturePlugin implements FeaturePlugin {
  // A-B 구간 반복 기능
}
```

이 아키텍처는 현재 구현된 기능을 기반으로 하며, 향후 확장성과 유지보수성을 고려하여 설계되었습니다.
