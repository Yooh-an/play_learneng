import useSubtitleStore from '../store/subtitleStore';

/**
 * 자막 텍스트 추출 및 처리를 위한 유틸리티
 */

// 자막 언어 감지 (한국어/영어/기타)
function detectLanguage(text: string): 'ko' | 'en' | 'other' {
  // 한국어 정규식 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ, 완성형 한글)
  const koreanRegex = /[\u3131-\u318E\uAC00-\uD7A3]/;
  // 영어 정규식 (A-Za-z)
  const englishRegex = /[A-Za-z]/;
  
  const hasKorean = koreanRegex.test(text);
  const hasEnglish = englishRegex.test(text);
  
  if (hasKorean) return 'ko';
  if (hasEnglish) return 'en';
  return 'other';
}

// 자막 텍스트 정제
function cleanSubtitleText(text: string): string {
  if (!text) return '';
  // 불필요한 공백 제거 및 정규화
  return text
    .replace(/\s+/g, ' ') // 다중 공백을 하나로
    .trim();
}

/**
 * 자막 정보 인터페이스
 */
export interface SubtitleInfo {
  text: string;
  language?: string;
  startTime?: number;
  endTime?: number;
  isActive: boolean;
}

/**
 * 쿠팡 플레이 자막 요소에서 자막 텍스트 추출
 */
export function extractSubtitleText(subtitleElement: Element): { text: string; language: 'ko' | 'en' | 'other' } | null {
  if (!subtitleElement) return null;
  
  // "Play Video"인 경우 필터링 (쿠팡플레이 제어 텍스트)
  const rawText = cleanSubtitleText(subtitleElement.textContent || '');
  if (!rawText) return null;
  
  // 컨트롤 텍스트 필터링
  const controlTexts = ['Play Video', '재생', '일시정지', '정지', '일시 중지'];
  if (controlTexts.includes(rawText)) {
    console.log('컨트롤 텍스트 감지되어 무시:', rawText);
    return null;
  }
  
  // 단순 텍스트만 있을 경우
  if (subtitleElement.childElementCount === 0) {
    const language = detectLanguage(rawText);
    return {
      text: rawText,
      language: language as 'ko' | 'en' | 'other'
    };
  }
  
  // 자식 요소를 가진 복잡한 구조의 자막일 경우 (예: 스타일링된 자막)
  const textFragments: string[] = [];
  
  // 텍스트 노드 누적
  const extractText = (element: Element | ChildNode): void => {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = cleanSubtitleText(element.textContent || '');
      if (text && !controlTexts.some(ctrl => text.includes(ctrl))) {
        textFragments.push(text);
      }
      return;
    }
    
    // HTML 요소인 경우 자식들을 재귀적으로 처리
    if (element.nodeType === Node.ELEMENT_NODE) {
      const elem = element as HTMLElement;
      
      // 줄바꿈 처리
      if (elem.tagName === 'BR' || elem.tagName === 'br') {
        textFragments.push('\n');
      }
      
      // 컨트롤 요소 필터링
      const isControlElement = [
        'BUTTON', 'A', 'svg', 'path', 'use', 'g', 'rect', 
        'circle', 'polygon', 'line', 'polyline', 'ellipse', 'image'
      ].some(tag => 
        elem.tagName === tag || 
        (elem.closest && elem.closest(tag)) ||
        (elem.classList && elem.classList.toString().includes('control')) ||
        elem.getAttribute('role') === 'button' ||
        (elem.getAttribute('aria-label')?.match(/(재생|일시정지|play|pause|volume|mute|fullscreen|controls?)/i))
      );
      
      if (!isControlElement) {
        for (const child of Array.from(element.childNodes)) {
          extractText(child);
        }
      }
    }
  };
  
  extractText(subtitleElement);
  const result = textFragments.join(' ').replace(/\s+/g, ' ').trim();
  
  if (!result) return null;
  
  const language = detectLanguage(result);
  console.log('자막 추출 결과:', { text: result, language });
  
  return {
    text: result,
    language: language as 'ko' | 'en' | 'other'
  };
}

/**
 * 자막 요소에서 자막 상태 정보 추출
 */
export function extractSubtitleInfo(subtitleElement: Element, videoPlayer: HTMLVideoElement): SubtitleInfo | null {
  if (!subtitleElement) return null;
  
  const extracted = extractSubtitleText(subtitleElement);
  if (!extracted) return null;
  
  const { text, language } = extracted;
  
  // 자막 스토어에 언어별로 저장
  const store = useSubtitleStore.getState();
  if (language === 'ko') {
    store.setKoreanSubtitle(text);
  } else if (language === 'en') {
    store.setEnglishSubtitle(text);
  }
  
  // 기본 정보로 자막 객체 생성
  return {
    text,
    language,
    isActive: true,
    startTime: videoPlayer.currentTime,
  };
}

/**
 * 자막 컨테이너에서 활성화된 자막 요소 찾기 (이중 자막 강제 지원)
 */
export function findActiveSubtitles(subtitleContainer: Element): Element[] {
  if (!subtitleContainer) return [];
    
  const foundElements: Element[] = [];
  
  // 0단계: video 요소에서 활성화된 텍스트 트랙 확인 (가장 신뢰할 수 있는 방법)
  const videoElement = document.querySelector('video');
  if (videoElement && videoElement.textTracks) {
    
    // 모든 트랙 순회하면서 정보 출력
    for (let i = 0; i < videoElement.textTracks.length; i++) {
      const track = videoElement.textTracks[i];
      console.log(`트랙 ${i}:`, {
        kind: track.kind,
        language: track.language,
        label: track.label,
        mode: track.mode,
        activeCues: track.activeCues ? track.activeCues.length : 0
      });
      
      // 자막 트랙인 경우 showing 모드로 설정 시도
      if ((track.kind === 'subtitles' || track.kind === 'captions') && track.mode !== 'showing') {
        try {
          
          track.mode = 'showing';
        } catch (e) {
          console.error('트랙 활성화 실패:', e);
        }
      }
      
      // 트랙의 현재 활성 Cue 확인 (showing 또는 hidden 모드일 때)
      if ((track.mode === 'showing' || track.mode === 'hidden') && 
          track.activeCues && track.activeCues.length > 0) {
        for (let j = 0; j < track.activeCues.length; j++) {
          const cue = track.activeCues[j] as VTTCue;
          if (cue && cue.text && cue.text.trim() !== '' && 
              cue.text !== 'Play Video' && 
              cue.text !== '재생' && 
              cue.text !== '일시정지') {
            console.log(`활성 자막 큐 ${j}:`, cue.text);
            
            // DOM에 임시 요소 생성하여 활성 자막 반환
            const tempElement = document.createElement('div');
            tempElement.textContent = cue.text;
            tempElement.classList.add('vjs-text-track-cue');
            
            // 자막 언어 정보 추가 (한글 포함 여부로 언어 추정)
            if (track.language) {
              if (track.language.includes('ko') || track.language.includes('kor') || 
                 track.label?.toLowerCase().includes('korean') || 
                 /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cue.text)) {
                tempElement.classList.add('vjs-text-track-cue-ko');
              } else if (track.language.includes('en') || track.language.includes('eng') || 
                       track.label?.toLowerCase().includes('english') || 
                       /^[a-zA-Z\s.,!?'"-]+$/.test(cue.text)) {
                tempElement.classList.add('vjs-text-track-cue-en');
              }
            } else {
              // 언어 정보가 없는 경우, 텍스트 내용으로 추정
              if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cue.text)) {
                tempElement.classList.add('vjs-text-track-cue-ko');
              } else if (/^[a-zA-Z\s.,!?'"-]+$/.test(cue.text)) {
                tempElement.classList.add('vjs-text-track-cue-en');
              }
            }
            
            foundElements.push(tempElement);
          }
        }
      }
    }
    
    // 활성화된 자막을 찾았으면 바로 반환
    if (foundElements.length > 0) {
      return foundElements;
    }
  } // End of "if (videoElement && videoElement.textTracks)" block

  let domSearchNode: Element | Document = subtitleContainer; // Default to the passed subtitleContainer

  const vjsTextTrackDisplay = document.querySelector('.vjs-text-track-display');
  if (vjsTextTrackDisplay) {
    domSearchNode = vjsTextTrackDisplay;
  } else {
    // domSearchNode remains subtitleContainer as set initially
  }
  
  // 1단계: DOM에서 한국어와 영어 자막 요소를 각각 찾기
  const koreanElements = Array.from(domSearchNode.querySelectorAll('.vjs-text-track-cue-ko, [class*="vjs-text-track-cue-ko"]'));
  const englishElements = Array.from(domSearchNode.querySelectorAll('.vjs-text-track-cue-en, [class*="vjs-text-track-cue-en"]'));
  
  // 2단계: 유효한 자막 요소 필터링
  const getValidSubtitleElements = (elements: Element[]): Element[] => {
    return elements.filter(el => {
      const textContent = el.textContent?.trim();
      const className = el.className || '';
      const classString = typeof className === 'string' ? className : String(className);
      
      const isControlElement = classString.includes('vjs-control-text') || 
                              el.closest('.vjs-control-bar') !== null;
      
      const isValidText = textContent &&
                         textContent.length > 0 &&
                         textContent !== 'Play Video' &&
                         textContent !== '재생' &&
                         textContent !== '일시정지' &&
                         textContent !== 'Pause' &&
                         !textContent.includes('Volume Level');
      
      // 자막 요소는 hidden 상태여도 포함 (쿠팡플레이는 비활성 자막을 hidden으로 처리)
      const isSubtitleElement = classString.includes('vjs-text-track-cue');
      
      if (isValidText && isSubtitleElement) {
      }
      
      return isValidText && !isControlElement && isSubtitleElement;
    });
  };
  
  const validKoreanElements = getValidSubtitleElements(koreanElements);
  const validEnglishElements = getValidSubtitleElements(englishElements);
  
  // 3단계: 이중 자막 구성
  if (validKoreanElements.length > 0 || validEnglishElements.length > 0) {
    
    // 원본 자막 요소도 추적을 위해 추가
    if (validKoreanElements.length > 0) {
      foundElements.push(validKoreanElements[0]);
    }
    
    if (validEnglishElements.length > 0) {
      foundElements.push(validEnglishElements[0]);
    }
    
    // 기존 커스텀 자막 요소는 매번 제거하고 다시 생성
    removeExistingCustomSubtitles();
    
    // 이중 자막 컨테이너 준비 (스크린샷과 일치하는 구조)
    let dualSubtitleContainer = document.getElementById('play-learneng-subtitle-container');
    if (!dualSubtitleContainer) {
      dualSubtitleContainer = createDualSubtitleContainer();
    } else {
      // 기존 컨테이너가 있으면 내용 비우기
      dualSubtitleContainer.innerHTML = '';
    }
    
    // 한국어 자막 렌더링
    if (validKoreanElements.length > 0) {
      renderDualSubtitle(
        dualSubtitleContainer, 
        validKoreanElements[0].textContent?.trim() || "", 
        'ko'
      );
    }
    
    // 영어 자막 렌더링
    if (validEnglishElements.length > 0) {
      renderDualSubtitle(
        dualSubtitleContainer, 
        validEnglishElements[0].textContent?.trim() || "", 
        'en'
      );
    }
    
    return foundElements;
  }
  
  // 4단계: 언어별 자막을 찾지 못한 경우 기존 로직 사용
  
  const generalSelectors = [
    '.vjs-text-track-cue', // 기본 video.js 자막 큐
    '.vjs-text-track-cue > div', // 내부 div
    '[class*="vjs-text-track-cue"]', // vjs-text-track-cue로 시작하는 모든 클래스
    'div[style*="position: absolute"][style*="text-align: center"]', // 스타일 기반 검색
    'div' // 가장 포괄적인 검색
  ];
  
  for (const selector of generalSelectors) {
    const elements = Array.from(domSearchNode.querySelectorAll(selector)); // Use domSearchNode here
    const contextName = domSearchNode instanceof Element ? domSearchNode.tagName : 'document';
    
    if (elements.length > 0) {
      const validElements = getValidSubtitleElements(elements);
      
      if (validElements.length > 0) {
        return validElements;
      }
    }
  }
  
  return [];
}

/**
 * 커스텀 자막 컨테이너 생성 (스크린샷 구조)
 */
function createDualSubtitleContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'play-learneng-subtitle-container';
  
  // 스크린샷과 동일한 스타일링 적용
  container.style.cssText = `
    position: absolute;
    bottom: 70px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    z-index: 9999;
    pointer-events: none;
    padding: 0 30px;
    box-sizing: border-box;
  `;
  
  // 비디오 컨테이너 찾아서 추가
  const videoContainer = document.querySelector('.video-js') || 
                       document.querySelector('[id*="player"]') || 
                       document.querySelector('.player-container');
                       
  if (videoContainer) {
    videoContainer.appendChild(container);
  } else {
    // 비디오 컨테이너를 찾을 수 없으면 body에 추가
    document.body.appendChild(container);
  }
  
  console.log('✅ 이중 자막 컨테이너 생성 완료:', container);
  return container;
}

/**
 * 기존에 생성된 커스텀 자막 요소 제거
 */
function removeExistingCustomSubtitles(): void {
  // 기존 자막 컨테이너 제거
  const existingContainer = document.getElementById('play-learneng-subtitle-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 혹시 남아있는 개별 자막 요소들도 제거
  const customSubtitles = document.querySelectorAll('.play-learneng-subtitle-text');
  customSubtitles.forEach(el => el.remove());
  
  console.log('기존 커스텀 자막 요소 제거 완료');
}

/**
 * 이중 자막 렌더링 (스크린샷과 일치하는 구조)
 */
function renderDualSubtitle(container: HTMLElement, text: string | null, language: 'ko' | 'en'): void {
  
  const subtitleElement = document.createElement('div');
  subtitleElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${language}`;
  subtitleElement.textContent = text;
  
  // 스크린샷과 일치하는 언어별 스타일링
  if (language === 'ko') {
    subtitleElement.style.cssText = `
      color: #ffffff;
      padding: 4px 10px;
      margin-bottom: 5px;
      font-size: 20px;
      font-weight: 500;
      max-width: 90%;
      text-align: center;
      line-height: 1.4;
      white-space: pre-wrap;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
    `;
  } else {
    subtitleElement.style.cssText = `
      color: #56c7ff; /* 스크린샷의 밝은 파란색 */
      padding: 4px 10px;
      font-size: 18px;
      font-weight: 400;
      max-width: 90%;
      text-align: center;
      line-height: 1.4;
      white-space: pre-wrap;
      margin-bottom: 0;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
    `;
  }
  
  container.appendChild(subtitleElement);
  
}

/**
 * 특정 언어의 자막을 강제로 표시하도록 시도
 */
function tryForceShowSubtitle(container: Element, language: 'ko' | 'en'): void {
  
  
  // 비디오 재생 상태 확인 - 일시정지 시 비활성화
  const videoElement = document.querySelector('video') as HTMLVideoElement;
  if (videoElement && videoElement.paused) {
    
    return;
  }
  
  // 전체적인 쿠팡플레이 구조 분석
  analyzeSubtitleInfrastructure();
  
  // 1단계: 숨겨진 자막 요소 찾기
  const hiddenElements = Array.from(container.querySelectorAll(`.vjs-text-track-cue-${language}, [class*="vjs-text-track-cue-${language}"]`));
  console.log(`숨겨진 ${language} 자막 요소 수:`, hiddenElements.length);
  
  // 2단계: video.js 플레이어에서 텍스트 트랙 조작 시도
  if (videoElement) {
    
    
    // 더 광범위한 video.js 플레이어 인스턴스 찾기
    const player = findVideoJSPlayer(videoElement);
    
    if (player) {
    
      
      // 모든 텍스트 트랙 가져오기
      const textTracks = player.textTracks ? player.textTracks() : videoElement.textTracks;
    
      
      if (textTracks) {
        for (let i = 0; i < textTracks.length; i++) {
          const track = textTracks[i];
          ;
          
          // 원하는 언어의 트랙을 찾아서 활성화
          const isTargetLanguage = track.language === language || 
                                  track.language === `${language}-KR` ||
                                  track.language === `${language}-US` ||
                                  track.label?.toLowerCase().includes(language === 'ko' ? 'korean' : 'english');
          
          if (isTargetLanguage && track.mode !== 'showing') {
            
            try {
              track.mode = 'showing';
              
              // 트랙 변경 이벤트 발생
              if (player.trigger) {
                player.trigger('texttrackchange');
              }
              
            } catch (error) {
              
            }
          }
        }
      }
    } else {
      
    }
    
    // 3단계: HTML5 비디오 요소의 텍스트 트랙 직접 조작
    if (videoElement && videoElement.textTracks) {
      
      for (let i = 0; i < videoElement.textTracks.length; i++) {
        const track = videoElement.textTracks[i];
        
        
        const isTargetLanguage = track.language === language || 
                                track.language === `${language}-KR` ||
                                track.language === `${language}-US`;
        
        if (isTargetLanguage) {
          
          try {
            track.mode = 'showing';
          
          } catch (error) {
          
          }
        }
      }
    }
  }
  
  // 4단계: DOM 조작으로 자막 요소 강제 표시 (기존 로직)
  for (const element of hiddenElements) {
    const htmlElement = element as HTMLElement;
    const textContent = element.textContent?.trim();
    
    if (textContent && textContent.length > 0) {
      
      
      // CSS 스타일을 강제로 변경하여 표시
      htmlElement.style.display = 'block';
      htmlElement.style.visibility = 'visible';
      htmlElement.style.opacity = '1';
      
      // 부모 요소도 확인
      let parent = htmlElement.parentElement;
      while (parent && parent !== container) {
        const parentHtml = parent as HTMLElement;
        if (parentHtml.style.display === 'none') {
          parentHtml.style.display = 'block';
        }
        if (parentHtml.style.visibility === 'hidden') {
          parentHtml.style.visibility = 'visible';
        }
        parent = parent.parentElement;
      }
      
      
      break; // 첫 번째 요소만 활성화
    }
  }
  
  // 5단계: 쿠팡플레이 UI 버튼 조작 시도 (즉시 실행)
  console.log('즉시 UI 버튼 조작 시도...');
  tryToggleSubtitleButton(language);
}

/**
 * 더 광범위한 video.js 플레이어 인스턴스 찾기
 */
function findVideoJSPlayer(videoElement: HTMLVideoElement): any {
  // 방법 1: 비디오 요소에 직접 연결된 플레이어
  if ((videoElement as any).player) {
    return (videoElement as any).player;
  }
  
  // 방법 2: window.videojs API 사용
  if ((window as any).videojs?.getPlayer) {
    try {
      return (window as any).videojs.getPlayer(videoElement);
    } catch (e) {
      console.log('videojs.getPlayer 실패:', e);
    }
  }
  
  // 방법 3: 부모 요소에서 플레이어 인스턴스 찾기
  let parent = videoElement.parentElement;
  while (parent) {
    if ((parent as any).player) {
      return (parent as any).player;
    }
    parent = parent.parentElement;
  }
  
  // 방법 4: 전역 변수에서 플레이어 찾기
  const globalVars = ['player', 'videoPlayer', 'vjsPlayer'];
  for (const varName of globalVars) {
    if ((window as any)[varName]) {
      return (window as any)[varName];
    }
  }
  
  return null;
}

/**
 * 쿠팡플레이 자막 인프라 구조 분석
 */
function analyzeSubtitleInfrastructure(): void {
  console.log('=== 쿠팡플레이 자막 인프라 분석 ===');
  
  // 1. 비디오 요소 분석
  const videos = Array.from(document.querySelectorAll('video'));
  console.log('비디오 요소 수:', videos.length);
  videos.forEach((video, i) => {
    console.log(`비디오 ${i}:`, {
      src: video.src,
      currentSrc: video.currentSrc,
      textTracks: video.textTracks.length,
      player: (video as any).player ? 'exists' : 'none'
    });
  });
  
  // 2. 자막 관련 버튼 찾기
  const buttonSelectors = [
    'button', '[role="button"]', '.vjs-button', 
    '[class*="subtitle"]', '[class*="caption"]', '[class*="cc"]'
  ];
  
  for (const selector of buttonSelectors) {
    const buttons = Array.from(document.querySelectorAll(selector));
    const subtitleButtons = buttons.filter(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      const className = btn.className?.toLowerCase() || '';
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      
      return text.includes('자막') || text.includes('subtitle') || text.includes('caption') ||
             className.includes('subtitle') || className.includes('caption') ||
             ariaLabel.includes('자막') || ariaLabel.includes('subtitle');
    });
    
    if (subtitleButtons.length > 0) {
      console.log(`${selector} 자막 버튼:`, subtitleButtons.length);
      subtitleButtons.forEach((btn, i) => {
        console.log(`  버튼 ${i}:`, {
          text: btn.textContent?.trim(),
          className: btn.className,
          ariaLabel: btn.getAttribute('aria-label')
        });
      });
    }
  }
  
  // 3. 설정 메뉴 관련 요소 찾기
  const menuSelectors = ['.vjs-menu', '[class*="menu"]', '[class*="setting"]', '[class*="option"]'];
  for (const selector of menuSelectors) {
    const menus = document.querySelectorAll(selector);
    if (menus.length > 0) {
      console.log(`${selector} 메뉴 요소:`, menus.length);
    }
  }
  
  console.log('=== 분석 완료 ===');
}

/**
 * 쿠팡플레이 자막 설정 버튼을 조작하여 다른 언어 활성화 시도
 */
function tryToggleSubtitleButton(language: 'ko' | 'en'): void {
  console.log(`쿠팡플레이 UI를 통한 ${language} 자막 활성화 시도...`);
  
  // 1단계: video.js 메뉴 아이템에서 직접 언어 옵션 찾기 (분석에서 발견됨)
  const languageMenuItems = Array.from(document.querySelectorAll('.vjs-menu-item.vjs-subtitles-menu-item'));
  console.log('video.js 자막 메뉴 아이템:', languageMenuItems.length);
  
  for (const item of languageMenuItems) {
    const text = item.textContent?.trim().toLowerCase() || '';
    const className = item.className || '';
    
    console.log('자막 메뉴 아이템:', {
      text: item.textContent?.trim(),
      className: className,
      isSelected: className.includes('vjs-selected')
    });
    
    // 원하는 언어인지 확인
    const isTargetLanguage = (language === 'en' && text === 'en') || 
                            (language === 'ko' && text === 'ko, selected');
    
    if (isTargetLanguage && !className.includes('vjs-selected')) {
      console.log(`${language} 언어 메뉴 아이템 클릭:`, item);
      
      // 강력한 클릭 이벤트 시뮬레이션
      const element = item as HTMLElement;
      
      // 1. 마우스 이벤트 시뮬레이션
      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      });
      
      // 2. 포커스 및 키보드 이벤트
      element.focus();
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true
      });
      element.dispatchEvent(enterEvent);
      
      // 3. aria-checked 상태 변경
      element.setAttribute('aria-checked', 'true');
      
      // 4. 클래스 강제 변경
      setTimeout(() => {
        element.classList.add('vjs-selected');
        element.setAttribute('aria-checked', 'true');
        
        // 한국어 메뉴 아이템에서 선택 상태 제거
        const koItems = document.querySelectorAll('.vjs-menu-item.vjs-subtitles-menu-item.vjs-selected');
        koItems.forEach(koItem => {
          if (koItem !== element) {
            koItem.classList.remove('vjs-selected');
            koItem.setAttribute('aria-checked', 'false');
          }
        });
        
        console.log('메뉴 아이템 상태 강제 변경 완료');
      }, 100);
      
      // 5. 클릭 후 DOM 변화 확인 (더 긴 대기 시간)
      setTimeout(() => {
        console.log(`${language} 자막 활성화 후 상태 확인...`);
        checkSubtitleActivation(language);
      }, 2000);
      
      return; // 성공적으로 클릭했으면 종료
    }
  }
  
  // 2단계: video.js 자막 버튼을 통한 메뉴 열기
  const vjsSubtitleButtons = Array.from(document.querySelectorAll('.vjs-subs-caps-button'));
  console.log('video.js 자막 버튼:', vjsSubtitleButtons.length);
  
  for (const button of vjsSubtitleButtons) {
    console.log('video.js 자막 버튼 클릭:', button);
    (button as HTMLElement).click();
    
    // 메뉴가 열린 후 언어 옵션 찾기
    setTimeout(() => {
      const menuItems = Array.from(document.querySelectorAll('.vjs-menu-item.vjs-subtitles-menu-item'));
      
      for (const item of menuItems) {
        const text = item.textContent?.trim().toLowerCase() || '';
        const isTargetLanguage = (language === 'en' && text === 'en') || 
                                (language === 'ko' && text.includes('ko'));
        
        if (isTargetLanguage) {
          console.log(`메뉴에서 ${language} 언어 옵션 클릭:`, item);
          (item as HTMLElement).click();
          
          setTimeout(() => checkSubtitleActivation(language), 1000);
          return;
        }
      }
    }, 500);
    
    break; // 첫 번째 버튼만 시도
  }
  
  // 3단계: 쿠팡플레이 자체 자막 버튼 시도
  const coupangSubtitleButtons = Array.from(document.querySelectorAll('.AudioSubtitle_subtitle___Mql9'));
  console.log('쿠팡플레이 자막 버튼:', coupangSubtitleButtons.length);
  
  for (const button of coupangSubtitleButtons) {
    console.log('쿠팡플레이 자막 버튼 클릭:', button);
    (button as HTMLElement).click();
    
    // 언어 옵션 찾기
    setTimeout(() => {
      const options = Array.from(document.querySelectorAll('button, div, span')).filter(el => {
        const text = el.textContent?.trim().toLowerCase() || '';
        return text === '영어' || text === 'english' || text === 'en';
      });
      
      for (const option of options) {
        if ((option as HTMLElement).click) {
          console.log(`쿠팡플레이에서 ${language} 옵션 클릭:`, option);
          (option as HTMLElement).click();
          setTimeout(() => checkSubtitleActivation(language), 1000);
          return;
        }
      }
    }, 500);
    
    break;
  }
}

/**
 * 자막 활성화 후 상태 확인
 */
function checkSubtitleActivation(language: 'ko' | 'en'): void {
  console.log(`${language} 자막 활성화 상태 확인 중...`);
  
  const container = document.querySelector('.vjs-text-track-display');
  if (container) {
    const koreanElements = container.querySelectorAll('.vjs-text-track-cue-ko');
    const englishElements = container.querySelectorAll('.vjs-text-track-cue-en');
    
    console.log('활성화 확인 결과:', {
      korean: koreanElements.length,
      english: englishElements.length,
      total: koreanElements.length + englishElements.length
    });
    
    if (language === 'en' && englishElements.length > 0) {
      console.log('✅ 영어 자막 활성화 성공!');
    } else if (language === 'ko' && koreanElements.length > 0) {
      console.log('✅ 한국어 자막 활성화 성공!');
    } else {
      console.log('❌ 자막 활성화 실패 - 다른 방법 시도 필요');
      
      // 추가 시도: DOM 이벤트 직접 발생
      setTimeout(() => {
        triggerSubtitleChangeEvent(language);
      }, 1000);
    }
  }
}

/**
 * 자막 변경 이벤트 직접 발생
 */
function triggerSubtitleChangeEvent(language: 'ko' | 'en'): void {
  console.log(`${language} 자막 변경 이벤트 직접 발생 시도...`);
  
  const video = document.querySelector('video') as HTMLVideoElement;
  if (video) {
    // texttrackchange 이벤트 발생
    const event = new Event('texttrackchange', { bubbles: true });
    video.dispatchEvent(event);
    
    // video.js 플레이어 이벤트 발생
    const player = (video as any).player;
    if (player && player.trigger) {
      player.trigger('texttrackchange');
      console.log('video.js texttrackchange 이벤트 발생됨');
    }
  }
}

/**
 * 쿠팡플레이에서 ko와 en 자막 파일을 모두 강제 로드
 */
function createVirtualEnglishSubtitle(container: Element, koreanText: string): Element | null {
  console.log('🚀 ko/en 자막 파일 동시 로드 시도 중...');
  
  // 현재 로드된 자막 URL 탐지
  const currentSubtitleUrls = detectCurrentSubtitleUrls();
  
  if (currentSubtitleUrls.length > 0) {
    console.log('감지된 자막 URL:', currentSubtitleUrls);
    
    // 각 자막 URL에 대해 ko와 en 버전 모두 로드 시도
    currentSubtitleUrls.forEach(url => {
      loadBothLanguageSubtitles(url, container);
    });
  }
  
  // 기존 커스텀 자막 요소는 매번 제거하고 다시 생성
  removeExistingCustomSubtitles();
  
  // 이중 자막 컨테이너 준비 (스크린샷과 일치하는 구조)
  let dualSubtitleContainer = document.getElementById('play-learneng-subtitle-container');
  if (!dualSubtitleContainer) {
    dualSubtitleContainer = createDualSubtitleContainer();
  } else {
    // 기존 컨테이너가 있으면 내용 비우기
    dualSubtitleContainer.innerHTML = '';
  }
  
  // 한국어 자막 렌더링
  renderDualSubtitle(dualSubtitleContainer, koreanText, 'ko');
  
  // 임시 영어 자막 표시 (실제 영어 자막을 로드하기 전까지)
  renderDualSubtitle(dualSubtitleContainer, `[Loading EN] ${koreanText}`, 'en');
  
  return null; // 실제 DOM 요소를 반환하지 않고 커스텀 컨테이너를 사용
}

/**
 * 가상 한국어 자막 생성 (en → ko)
 */
function createVirtualKoreanSubtitle(container: Element, englishText: string): Element | null {
  console.log('🚀 en/ko 자막 파일 동시 로드 시도 중...');
  
  const currentSubtitleUrls = detectCurrentSubtitleUrls();
  
  if (currentSubtitleUrls.length > 0) {
    currentSubtitleUrls.forEach(url => {
      loadBothLanguageSubtitles(url, container);
    });
  }
  
  // 기존 커스텀 자막 요소는 매번 제거하고 다시 생성
  removeExistingCustomSubtitles();
  
  // 이중 자막 컨테이너 준비 (스크린샷과 일치하는 구조)
  let dualSubtitleContainer = document.getElementById('play-learneng-subtitle-container');
  if (!dualSubtitleContainer) {
    dualSubtitleContainer = createDualSubtitleContainer();
  } else {
    // 기존 컨테이너가 있으면 내용 비우기
    dualSubtitleContainer.innerHTML = '';
  }
  
  // 임시 한국어 자막 표시 (실제 한국어 자막을 로드하기 전까지)
  renderDualSubtitle(dualSubtitleContainer, `[Loading KO] ${englishText}`, 'ko');
  
  // 영어 자막 렌더링
  renderDualSubtitle(dualSubtitleContainer, englishText, 'en');
  
  return null; // 실제 DOM 요소를 반환하지 않고 커스텀 컨테이너를 사용
}

/**
 * 현재 로드된 자막 URL들을 탐지
 */
function detectCurrentSubtitleUrls(): string[] {
  const urls: string[] = [];
  
  // 1. video 요소의 track 태그에서 URL 추출
  const video = document.querySelector('video');
  if (video) {
    const tracks = video.querySelectorAll('track');
    tracks.forEach(track => {
      if (track.src) {
        urls.push(track.src);
      }
    });
  }
  
  // 2. video.js textTracks에서 URL 추출
  const textTracks = video?.textTracks;
  if (textTracks) {
    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      if ((track as any).src) {
        urls.push((track as any).src);
      }
    }
  }
  
  // 3. 네트워크 요청에서 감지된 자막 URL 사용
  const detectedUrls = getDetectedSubtitleUrls();
  urls.push(...detectedUrls);
  
  console.log('탐지된 자막 URL들:', urls);
  return [...new Set(urls)]; // 중복 제거
}

/**
 * 네트워크 요청에서 감지된 자막 URL들 가져오기
 */
function getDetectedSubtitleUrls(): string[] {
  const urls: string[] = [];
  
  // 1. capturedSubtitles에서 URL 가져오기
  if ((window as any).capturedSubtitles) {
    urls.push((window as any).capturedSubtitles.url);
  }
  
  // 2. 전역 변수에서 이전에 감지된 자막 URL들 가져오기
  const detectedUrls = (window as any).__detectedSubtitleUrls || [];
  urls.push(...detectedUrls);
  
  // 3. performance API를 사용해 .vtt 요청 찾기
  if (performance && performance.getEntriesByType) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const subtitleResources = resources.filter(resource => 
      resource.name.includes('.vtt') ||
      resource.name.includes('subtitle') ||
      resource.name.includes('caption') ||
      resource.name.includes('track')
    );
    
    subtitleResources.forEach(resource => {
      urls.push(resource.name);
    });
  }
  
  console.log('모든 감지된 자막 URL들:', urls);
  return [...new Set(urls)]; // 중복 제거
}

/**
 * ko와 en 자막 파일을 모두 로드
 */
function loadBothLanguageSubtitles(baseUrl: string, container: Element): void {
  console.log('📥 자막 파일 동시 로드:', baseUrl);
  
  // URL 패턴 분석 및 언어별 URL 생성
  const urls = generateLanguageUrls(baseUrl);
  
  urls.forEach(({ url, language }) => {
    console.log(`${language} 자막 로드 시도:`, url);
    
    fetch(url)
      .then(response => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(`Failed to load ${language} subtitle: ${response.status}`);
      })
      .then(vttContent => {
        console.log(`✅ ${language} 자막 로드 성공!`);
        console.log(`${language} VTT 내용 (첫 200자):`, vttContent.substring(0, 200));
        
        // VTT 내용을 파싱하여 DOM에 자막 요소 생성
        parseAndCreateSubtitleElements(vttContent, language, container);
      })
      .catch(error => {
        console.log(`❌ ${language} 자막 로드 실패:`, error.message);
      });
  });
}

/**
 * 기본 URL에서 ko/en 언어별 URL 생성
 */
function generateLanguageUrls(baseUrl: string): Array<{ url: string; language: 'ko' | 'en' }> {
  const urls: Array<{ url: string; language: 'ko' | 'en' }> = [];
  
  // 쿠팡플레이 자막 URL 패턴 분석
  // 예상 패턴: .../subtitle_ko.vtt, .../subtitle_en.vtt
  // 또는: .../subtitle?lang=ko, .../subtitle?lang=en
  
  if (baseUrl.includes('_ko.') || baseUrl.includes('lang=ko')) {
    // 한국어 URL이면 영어 URL 생성
    const enUrl = baseUrl.replace('_ko.', '_en.').replace('lang=ko', 'lang=en');
    urls.push({ url: baseUrl, language: 'ko' });
    urls.push({ url: enUrl, language: 'en' });
  } else if (baseUrl.includes('_en.') || baseUrl.includes('lang=en')) {
    // 영어 URL이면 한국어 URL 생성
    const koUrl = baseUrl.replace('_en.', '_ko.').replace('lang=en', 'lang=ko');
    urls.push({ url: koUrl, language: 'ko' });
    urls.push({ url: baseUrl, language: 'en' });
  } else {
    // 패턴을 모르는 경우 추측해서 생성
    const koUrl = baseUrl.replace(/\.vtt$/, '_ko.vtt');
    const enUrl = baseUrl.replace(/\.vtt$/, '_en.vtt');
    urls.push({ url: koUrl, language: 'ko' });
    urls.push({ url: enUrl, language: 'en' });
  }
  
  return urls;
}

/**
 * VTT 내용을 파싱하여 DOM에 자막 요소 생성
 */
function parseAndCreateSubtitleElements(vttContent: string, language: 'ko' | 'en', container: Element): void {
  console.log(`${language} VTT 파싱 및 DOM 생성 중...`);
  
  // VTT 파싱 - 자막 시간과 텍스트 추출
  const subtitleData = parseVttContent(vttContent);
  
  if (subtitleData.length === 0) {
    console.log(`파싱된 ${language} 자막 데이터 없음`);
    return;
  }
  
  console.log(`파싱된 ${language} 자막 데이터:`, subtitleData.length, '항목');
  
  // 현재 시간에 가장 가까운 자막 찾기
  const videoElement = document.querySelector('video') as HTMLVideoElement;
  const currentTime = videoElement ? videoElement.currentTime : 0;
  
  const currentSubtitle = findClosestSubtitle(subtitleData, currentTime);
  
  if (currentSubtitle) {
    console.log(`현재(${currentTime}초) ${language} 자막:`, currentSubtitle.text);
    
    // 커스텀 자막 컨테이너 찾거나 생성
    let dualSubtitleContainer = document.getElementById('play-learneng-subtitle-container');
    if (!dualSubtitleContainer) {
      dualSubtitleContainer = createDualSubtitleContainer();
    }
    
    // 해당 언어 자막 요소 업데이트
    updateDualSubtitle(dualSubtitleContainer, currentSubtitle.text, language);
    
    // 자막 변경 시 비디오 시간 이벤트 리스너 설정 (아직 없는 경우)
    if (!videoElement.hasAttribute('subtitle-tracking')) {
      setupSubtitleTimeTracking(videoElement, subtitleData, language);
    }
  } else {
    console.log(`현재 시간에 맞는 ${language} 자막을 찾을 수 없음`);
  }
}

/**
 * 이중 자막 요소의 텍스트 업데이트
 */
function updateDualSubtitle(container: HTMLElement, text: string, language: 'ko' | 'en'): void {
  // 해당 언어의 자막 요소 찾기
  let subtitleElement = container.querySelector(`.play-learneng-subtitle-${language}`) as HTMLElement;
  
  if (subtitleElement) {
    // 요소가 이미 존재하는 경우 텍스트만 업데이트
    subtitleElement.textContent = text;
    console.log(`이중 자막 업데이트 (${language}):`, text);
  } else {
    // 요소가 없는 경우 새로 생성
    const newElement = document.createElement('div');
    newElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${language}`;
    newElement.textContent = text;
    
    // 기존 스타일링 적용
    if (language === 'ko') {
      newElement.style.cssText = `
        color: #ffffff;
        padding: 4px 10px;
        margin-bottom: 5px;
        font-size: 20px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        line-height: 1.4;
        white-space: pre-wrap;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
      `;
    } else {
      newElement.style.cssText = `
        color: #56c7ff; /* 스크린샷의 밝은 파란색 */
        padding: 4px 10px;
        font-size: 18px;
        font-weight: 400;
        max-width: 90%;
        text-align: center;
        line-height: 1.4;
        white-space: pre-wrap;
        margin-bottom: 0;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
      `;
    }
    
    container.appendChild(newElement);
    console.log(`새로운 ${language} 자막 요소 생성 및 추가:`, text);
  }
}

/**
 * 비디오 시간에 따라 자막 동기화 설정
 */
function setupSubtitleTimeTracking(videoElement: HTMLVideoElement, subtitleData: any[], language: 'ko' | 'en'): void {
  console.log(`${language} 자막 동기화 설정 중...`);
  
  // 기존의 타이머가 있다면 정지
  if ((videoElement as any).__subtitleSyncTimer) {
    clearInterval((videoElement as any).__subtitleSyncTimer);
  }
  
  // 새로운 타이머 설정
  (videoElement as any).__subtitleSyncTimer = setInterval(() => {
    const currentTime = videoElement.currentTime;
    
    // 현재 시간에 가장 가까운 자막 찾기
    const currentSubtitle = findClosestSubtitle(subtitleData, currentTime);
    
    if (currentSubtitle) {
      // 자막 텍스트 업데이트
      const container = document.getElementById('play-learneng-subtitle-container');
      if (container) {
        updateDualSubtitle(container as HTMLElement, currentSubtitle.text, language);
      }
    }
  }, 500); // 500ms 간격으로 체크
}

/**
 * 현재 시간에 가장 가까운 자막 찾기
 */
function findClosestSubtitle(subtitleData: any[], currentTime: number): any {
  let closest = null;
  let minDiff = Number.MAX_VALUE;
  
  subtitleData.forEach(subtitle => {
    const startTime = parseFloat(subtitle.start);
    const endTime = parseFloat(subtitle.end);
    
    // 현재 시간이 자막 시간 범위 내에 있는지 확인
    if (currentTime >= startTime && currentTime <= endTime) {
      const diff = Math.min(Math.abs(currentTime - startTime), Math.abs(currentTime - endTime));
      
      if (diff < minDiff) {
        minDiff = diff;
        closest = subtitle;
      }
    }
  });
  
  return closest;
}

/**
 * VTT 콘텐츠 파싱 (간단한 구현체 - 필요에 따라 수정)
 */
function parseVttContent(vttContent: string): any[] {
  const lines = vttContent.split('\\n');
  const cues: any[] = []; // Explicitly type cues as any[]
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line && !line.startsWith('NOTE') && !line.startsWith('WEBVTT')) {
      // 타임스탬프 라인인지 확인
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})/);
      
      if (timeMatch) {
        // 시작 및 종료 시간 추출
        const times = line.split(' --> ');
        if (times.length === 2) {
          const start = times[0].trim();
          const end = times[1].trim();
          
          // 자막 텍스트 라인
          i++;
          const textLine = lines[i]?.trim();
          
          if (textLine) {
            cues.push({
              start,
              end,
              text: textLine
            });
          }
        }
      }
    }
    
    i++;
  }
  
  return cues;
}
