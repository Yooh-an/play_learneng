/**
 * 쿠팡 플레이 영상 플레이어 감지 및 관련 요소 선택을 위한 유틸리티
 */

/**
 * 쿠팡 플레이 영상 플레이어를 감지하는 선택자 목록
 * DOM 구조 변경에 대비하여 여러 가능한 선택자 포함
 */
export const VIDEO_PLAYER_SELECTORS = [
  'video',
  '.player-container video',
  '.video-player-wrapper video',
  '.coupangplay-video-player video',
];

/**
 * 자막 컨테이너를 감지하는 선택자 목록
 */
export const SUBTITLE_CONTAINER_SELECTORS = [
  '.video-subtitle-container',
  '.subtitle-container',
  '.player-subtitle-container',
  '[data-subtitle-container]',
  '[data-testid="subtitle-container"]',
];

/**
 * DOM에서 요소를 찾는 함수
 * 여러 선택자 중 가장 먼저 일치하는 요소를 반환
 */
export function findElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`Play LearnEng: 요소를 찾았습니다. (${selector})`);
      return element;
    }
  }
  return null;
}

/**
 * 비디오 플레이어 요소 찾기
 */
export function findVideoPlayer(): HTMLVideoElement | null {
  return findElement(VIDEO_PLAYER_SELECTORS) as HTMLVideoElement | null;
}

/**
 * 자막 컨테이너 요소 찾기
 */
export function findSubtitleContainer(): Element | null {
  return findElement(SUBTITLE_CONTAINER_SELECTORS);
}

/**
 * 비디오 정보 추출
 * 제목, 에피소드 정보 등
 */
export function extractVideoInfo(): { title: string; episodeInfo: string; videoId: string } {
  // 기본 값
  let title = '';
  let episodeInfo = '';
  let videoId = '';
  
  try {
    // 현재 URL에서 videoId 추출 시도
    const urlMatch = window.location.href.match(/\/watch\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      videoId = urlMatch[1];
    }
    
    // 제목 찾기 시도 (여러 선택자 시도)
    const titleSelectors = [
      '.player-header-title',
      '.video-title',
      '.content-title',
      'h1.title',
    ];
    
    const titleElement = findElement(titleSelectors);
    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }
    
    // 에피소드 정보 찾기 시도
    const episodeSelectors = [
      '.episode-info',
      '.video-episode',
      '.player-header-episode',
    ];
    
    const episodeElement = findElement(episodeSelectors);
    if (episodeElement) {
      episodeInfo = episodeElement.textContent?.trim() || '';
    }
  } catch (error) {
    console.error('Play LearnEng: 비디오 정보 추출 중 오류:', error);
  }
  
  return { title, episodeInfo, videoId };
}

/**
 * 지속적으로 플레이어 감지 시도
 * @param maxAttempts 최대 시도 횟수
 * @param intervalMs 시도 간격 (밀리초)
 * @returns Promise<{videoElement, subtitleContainer}> 
 */
export function detectPlayerWithRetry(
  maxAttempts = 10,
  intervalMs = 1000
): Promise<{ videoElement: HTMLVideoElement; subtitleContainer: Element } | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    
    const attemptDetection = () => {
      const videoElement = findVideoPlayer();
      const subtitleContainer = findSubtitleContainer();
      
      if (videoElement && subtitleContainer) {
        console.log('Play LearnEng: 플레이어와 자막 컨테이너를 감지했습니다.');
        resolve({ videoElement, subtitleContainer });
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        console.warn(`Play LearnEng: ${maxAttempts}번 시도 후 플레이어를 찾을 수 없습니다.`);
        resolve(null);
        return;
      }
      
      console.log(`Play LearnEng: 플레이어 감지 시도 중... (${attempts}/${maxAttempts})`);
      setTimeout(attemptDetection, intervalMs);
    };
    
    // 첫 시도 시작
    attemptDetection();
  });
}

/**
 * 페이지 변경(SPA 네비게이션)을 감지
 * @param callback 페이지 변경 시 실행할 콜백 함수
 */
export function watchPageChanges(callback: () => void): () => void {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('Play LearnEng: 페이지 변경 감지');
      callback();
    }
  });
  
  // body 변경 관찰 설정
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 옵저버 해제 함수 반환
  return () => observer.disconnect();
}

export default {
  findVideoPlayer,
  findSubtitleContainer,
  extractVideoInfo,
  detectPlayerWithRetry,
  watchPageChanges
};
