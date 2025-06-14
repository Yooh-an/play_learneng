/**
 * 쿠팡 플레이 영상 플레이어 감지 및 관련 요소 선택을 위한 유틸리티
 */
import { logger } from './logger';

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
  // 쿠팡 플레이 (video.js 기반) 실제 자막 컨테이너 (최우선)
  '.vjs-text-track-display',
  // 기존 쿠팡 플레이 특화 자막 컨테이너 선택자 (우선순위 낮춤)
  '.player-container [aria-live="polite"]',
  '.player-wrapper [aria-live="polite"]',
  '[data-testid="player"] [aria-live="polite"]',
  // 일반적인 자막 컨테이너 선택자
  '.video-subtitle-container',
  '.subtitle-container',
  '.player-subtitle-container',
  '[data-subtitle-container]',
  '[data-testid="subtitle-container"]',
  // 다양한 대체 선택자 (aria-live="polite"는 잘못된 요소를 선택할 수 있으므로 주석 처리)
  // '[aria-live="polite"]', // 이 선택자가 문제를 일으켰으므로 주석 처리
  '[class*="subtitle"]',
  '[class*="caption"]',
  '.subtitles',
  '.captions'
];

/**
 * DOM에서 요소를 찾는 함수
 * 여러 선택자 중 가장 먼저 일치하는 요소를 반환
 */
export function findElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
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
 * 쿠팡플레이 기본 자막 비활성화
 * 확장 프로그램의 자막과 중복 표시 방지
 */
export function hideOriginalSubtitles(): void {
  try {
    const subtitleDisplayContainer = findSubtitleContainer();
    if (!subtitleDisplayContainer) {
      console.warn('자막 표시 컨테이너(.vjs-text-track-display 등)를 찾을 수 없습니다.');
    } else {
      // logger.log('자막 표시 컨테이너 찾음:', subtitleDisplayContainer);
    }
    
    let styleElement = document.getElementById('play-learneng-subtitle-hider');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'play-learneng-subtitle-hider';
      document.head.appendChild(styleElement);
    }
    
    const extensionSubtitleContainerId = 'play-learneng-subtitle-container';

    styleElement.textContent = `
      .vjs-text-track-display .vjs-text-track-cue,
      .vjs-text-track-display > div > .vjs-text-track-cue,
      .subtitle-container .original-subtitle-element,
      [data-testid="subtitle-container"] > p,
      [class*="subtitle"]:not(#${extensionSubtitleContainerId}):not(.play-learneng-subtitle-text),
      [class*="caption"]:not(#${extensionSubtitleContainerId}):not(.play-learneng-subtitle-text)
      {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        display: none !important;
      }
      
      #${extensionSubtitleContainerId},
      #${extensionSubtitleContainerId} .play-learneng-subtitle-text,
      #${extensionSubtitleContainerId} .play-learneng-subtitle-ko,
      #${extensionSubtitleContainerId} .play-learneng-subtitle-en {
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
        pointer-events: auto !important;
      }
    `;
    
    if (subtitleDisplayContainer) {
        const hideNewOriginalCues = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as HTMLElement;
                            if (element.matches && 
                                element.matches('.vjs-text-track-cue') && 
                                element.id !== extensionSubtitleContainerId &&
                                !element.classList.contains('play-learneng-subtitle-text')) {
                                try {
                                    element.style.opacity = '0';
                                    element.style.display = 'none';
                                    element.style.visibility = 'hidden';
                                    element.style.pointerEvents = 'none';
                                } catch (err) {
                                    console.warn('새로 추가된 원본 자막 숨김 처리 실패:', err, element);
                                }
                            }
                        }
                    });
                }
            }
        });

        hideNewOriginalCues.observe(subtitleDisplayContainer, {
            childList: true,
            subtree: true
        });
    }
    
    // logger.log('Play LearnEng: 원본 자막 비활성화 스타일 적용됨');
  } catch (error) {
    console.error('Play LearnEng: 원본 자막 비활성화 중 오류 발생', error);
  }
}

/**
 * 쿠팡플레이 기본 자막을 다시 활성화
 */
export function showOriginalSubtitles(): void {
  try {
    const subtitleContainer = findSubtitleContainer();
    if (!subtitleContainer) return;
    
    // 스타일 요소 제거
    const styleElement = document.getElementById('play-learneng-subtitle-hider');
    if (styleElement) {
      styleElement.remove();
    }
    
    // 데이터 속성 제거
    if (subtitleContainer.hasAttribute('data-pleng-controlled')) {
      subtitleContainer.removeAttribute('data-pleng-controlled');
    }
    if (subtitleContainer.hasAttribute('data-pleng-original-display')) {
      subtitleContainer.removeAttribute('data-pleng-original-display');
    }
    
    // logger.log('Play LearnEng: 원본 자막 재활성화됨');
  } catch (error) {
    console.error('Play LearnEng: 원본 자막 재활성화 중 오류 발생', error);
  }
}

/**
 * 비디오 정보 추출
 * 제목, 에피소드 정보 등
 */
export function extractVideoInfo(): { title: string; episodeInfo: string; videoId: string } {
  let title = '';
  let episodeInfo = '';
  let videoId = '';
  
  // 0. 쿠팡 플레이어 UI에서 직접 제목과 부제목 가져오기 (스크린샷에서 보이는 title과 subtitle 클래스)
  const titleElement = document.querySelector('.label .title');
  if (titleElement && titleElement.textContent) {
    title = titleElement.textContent.trim();
    // logger.log(`[Play LearnEng] Player UI 제목 추출: '${title}'`);
    
    // 비디오 ID도 함께 추출 시도
    const playerWrapper = titleElement.closest('[id*="player"], [data-content-id], [data-video-id]');
    if (playerWrapper) {
      const dataContentId = playerWrapper.getAttribute('data-content-id');
      const dataVideoId = playerWrapper.getAttribute('data-video-id');
      if (dataContentId) videoId = dataContentId;
      else if (dataVideoId) videoId = dataVideoId;
      else if (playerWrapper.id) videoId = playerWrapper.id;
    }
    
    // 부제목(subtitle) 정보도 확인
    const subtitleElement = document.querySelector('.label .subtitle');
    if (subtitleElement && subtitleElement.textContent) {
      episodeInfo = subtitleElement.textContent.trim();
      // logger.log(`[Play LearnEng] Player UI 에피소드 정보 추출: '${episodeInfo}'`);
    }
  }

  // 1. Try JSON-LD first (often the most structured and reliable)
  // 웹페이지에 application/ld+json 타입의 스크립트가 있다면, 이 데이터를 우선적으로 사용합니다.
  const jsonLdScripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  jsonLdScripts.forEach(script => {
    try {
      const jsonData = JSON.parse(script.textContent || '{}');
      // TV 에피소드, 영화, 비디오 객체 타입 확인
      if (jsonData['@type'] === 'TVEpisode' || jsonData['@type'] === 'Movie' || jsonData['@type'] === 'VideoObject') {
        if (jsonData.name && !title) {
          // jsonData.name이 에피소드 제목이거나 영화 제목일 수 있음
          title = jsonData.name;
        }

        if (jsonData['@type'] === 'TVEpisode') {
          // TV 에피소드인 경우 시리즈 정보 추출
          if (jsonData.partOfSeries && jsonData.partOfSeries.name) {
            title = jsonData.partOfSeries.name; // 시리즈 제목
            if (jsonData.name && jsonData.name !== title) {
              episodeInfo = jsonData.name; // 에피소드 제목
            }
          }
          // 시즌 및 에피소드 번호 추출
          let seasonEpisodeDetails: string[] = []; // Explicitly type as string[]
          if (jsonData.seasonNumber) seasonEpisodeDetails.push(`시즌 ${jsonData.seasonNumber}`);
          if (jsonData.episodeNumber) seasonEpisodeDetails.push(`에피소드 ${jsonData.episodeNumber}`);
          
          const seasonEpisodeStr = seasonEpisodeDetails.join(', ');
          if (episodeInfo && seasonEpisodeStr && !episodeInfo.includes(seasonEpisodeStr)) {
            episodeInfo = `${episodeInfo} (${seasonEpisodeStr})`;
          } else if (!episodeInfo && seasonEpisodeStr) {
            episodeInfo = seasonEpisodeStr;
          }
        }      // JSON-LD 내의 고유 식별자에서 videoId 추출 시도
      if (jsonData.identifier) {
        videoId = String(jsonData.identifier);
      } else if (jsonData.url) {
        const urlObj = new URL(jsonData.url);
        const idFromPath = urlObj.pathname.split('/').pop();
        if (idFromPath) videoId = idFromPath;
      } else if (jsonData.embedUrl) {
        const urlObj = new URL(jsonData.embedUrl);
        videoId = urlObj.searchParams.get('id') || urlObj.pathname.split('/').pop() || videoId;
      }
      }
    } catch (e) {
      // console.warn('[Play LearnEng] Error parsing JSON-LD data:', e);
    }
  });

  // 2. Try specific DOM elements (examples, need Coupang Play specific selectors)
  // 쿠팡플레이 DOM 구조를 분석하여 실제 사용되는 셀렉터로 교체해야 합니다.
  if (!title) {
    // 시리즈/프로그램 제목 선택자
    const seriesTitleSelectors = [
      '[data-testid="program-title"]', // React 앱에서 흔히 사용
      '.series-title',
      '.label .title',
      '.program-title'
    ];
    for (const selector of seriesTitleSelectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.textContent) {
        title = el.textContent.trim();
        break;
      }
    }
  }

  if (!episodeInfo) {
    // 에피소드 정보 선택자
    const episodeInfoSelectors = [
      '[data-testid="episode-title"]',
      '.episode-info',
      '.label .subtitle',
      '.subtitle', // 쿠팡플레이 부제목 클래스
      '.episode-title',
      '.episode-number'
    ];
    for (const selector of episodeInfoSelectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.textContent) {
        episodeInfo = el.textContent.trim();
        break;
      }
    }
  }

  // 3. Try meta tags and document title as fallbacks
  if (!title) {
    const ogTitleMeta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitleMeta && ogTitleMeta.content) {
      title = ogTitleMeta.content.trim();
    }
  }
  // document.title은 최후의 보루로 사용하거나, 다른 정보가 없을 때 기본값으로 활용
  if (!title && document.title) {
    const docTitle = document.title.trim();
    if (docTitle !== '쿠팡플레이' && docTitle !== 'Coupang Play') {
        title = docTitle;
    }
  }


  // 4. Clean up and refine title and episodeInfo
  // 제목(title)에 에피소드 정보(episodeInfo)가 포함되어 있고, 두 정보가 다를 경우 제목에서 에피소드 정보 제거
  if (episodeInfo && title.includes(episodeInfo) && title !== episodeInfo) {
    const potentialSeriesTitle = title.replace(episodeInfo, '').replace(/[-—:]\\s*$/, '').trim(); // em-dash 추가
    if (potentialSeriesTitle) {
      title = potentialSeriesTitle;
    }
  } else if (title && !episodeInfo) {
    // 에피소드 정보(episodeInfo)가 비어있고 제목(title)에 시리즈와 에피소드가 함께 있을 경우 분리 시도
    const separators = [' - ', ' — ', ': الحلقة ', ': 에피소드 ', ': Episode ', ' 시즌 ', ' Season ']; // em-dash 추가 및 다양한 구분자
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length > 1) {
          const potentialSeries = parts[0].trim();
          const potentialEpisode = parts.slice(1).join(sep).trim();
          // 휴리스틱: 첫 부분이 너무 짧지 않고, 두 번째 부분이 에피소드 정보로 보일 경우
          if (potentialSeries.length > 1 && potentialEpisode.length > 0) { // 시리즈 이름이 한 글자일 수도 있음 (예: 'V')
            title = potentialSeries;
            episodeInfo = potentialEpisode;
            break;
          }
        }
      }
    }
  }

  // 5. Video ID Extraction
  const urlPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  // 쿠팡플레이 URL 구조에 맞게 정규식 수정 (예: /contents/, /episode/)
  const videoIdPathMatch = urlPath.match(/\/videos\/([\w-]+)/) || urlPath.match(/\/contents\/([\w-]+)/) || urlPath.match(/\/episode\/([\w-]+)/) ;
  if (videoIdPathMatch && videoIdPathMatch[1]) {
    videoId = videoIdPathMatch[1];
  } else if (urlParams.get('videoId')) {
    videoId = urlParams.get('videoId')!;
  } else {
    // 비디오 플레이어 또는 관련 요소의 데이터 속성에서 ID 추출 시도
    const videoElement = document.querySelector('video');
    if (videoElement) {
        const playerWrapper = videoElement.closest('[data-content-id], [data-video-id], [id*="player"]');
        if (playerWrapper) {
            videoId = playerWrapper.getAttribute('data-content-id') || 
                     playerWrapper.getAttribute('data-video-id') || 
                     (playerWrapper.id && playerWrapper.id.includes('player') ? playerWrapper.id : '') || 
                     videoId;
        }
    }
  }

  // Final fallbacks and adjustments
  // 제목이 여전히 일반적이거나 비어있을 경우 조정
  if (!title || title === '쿠팡플레이' || title === 'Coupang Play') {
    // 문서 제목이 더 구체적이라면 사용
    if (document.title && document.title.trim() !== '' && document.title !== '쿠팡플레이' && document.title !== 'Coupang Play') {
        const docTitle = document.title.trim();
        // 만약 episodeInfo가 이미 title에서 추출된 형태와 유사하다면, docTitle을 그대로 사용하지 않도록 주의
        if (!(episodeInfo && docTitle.includes(title) && docTitle.includes(episodeInfo))) {
            title = docTitle;
            // title이 document.title로 설정된 후, episodeInfo가 비어있다면 다시 분리 시도
            if (!episodeInfo) {
                const separators = [' - ', ' — ', ': الحلقة ', ': 에피소드 ', ': Episode ', ' 시즌 ', ' Season '];
                for (const sep of separators) {
                    if (title.includes(sep)) {
                        const parts = title.split(sep);
                        if (parts.length > 1) {
                          const potentialSeries = parts[0].trim();
                          const potentialEpisode = parts.slice(1).join(sep).trim();
                          if (potentialSeries.length > 1 && potentialEpisode.length > 0) {
                              title = potentialSeries;
                              episodeInfo = potentialEpisode;
                              break;
                          }
                        }
                    }
                }
            }
        }
    }
  }
  
  // 제목이 여전히 일반적인 "쿠팡플레이"이고 에피소드 정보가 있다면,
  // 영화의 경우 에피소드 정보가 실제 제목일 수 있음.
  if ((title === '쿠팡플레이' || title === 'Coupang Play' || title.trim() === '') && episodeInfo) {
    // 휴리스틱: episodeInfo가 "시즌 X / 에피소드 Y" 형태가 아니라면, 이를 주요 제목으로 간주
    if (!/시즌|Season|에피소드|Episode|[Ss]\\d+[Ee]\\d+/i.test(episodeInfo)) {
        title = episodeInfo; // episodeInfo를 주요 제목으로 설정
        episodeInfo = '';    // episodeInfo는 이제 주요 제목이므로 비움
    }
  }

  // 최종 ID 및 제목 폴백
  if (!videoId) {
    videoId = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; // 더 고유한 ID 생성
  }
  if (!title || title.trim() === '' || title === '쿠팡플레이' || title === 'Coupang Play') {
      title = '쿠팡플레이'; // 최종 제목 폴백
  }

  // 중복 제거: episodeInfo가 title의 일부이고, title이 episodeInfo로만 구성된 경우
  if (episodeInfo && title === episodeInfo) {
      episodeInfo = ''; // 이런 경우 episodeInfo를 비워 중복 저장 방지
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
        // logger.log('Play LearnEng: 플레이어와 자막 컨테이너를 감지했습니다.');
        resolve({ videoElement, subtitleContainer });
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        console.warn(`Play LearnEng: ${maxAttempts}번 시도 후 플레이어를 찾을 수 없습니다.`);
        resolve(null);
        return;
      }
      
      // logger.log(`Play LearnEng: 플레이어 감지 시도 중... (${attempts}/${maxAttempts})`);
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
      // logger.log('Play LearnEng: 페이지 변경 감지');
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
