import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { detectPlayerWithRetry, watchPageChanges, extractVideoInfo, hideOriginalSubtitles, showOriginalSubtitles } from '../utils/playerDetector';
import PlayerController from '../components/player/PlayerController';

// 디버깅 도구 임포트
import { analyzeVideoPlayerDOM } from '../utils/debugDomStructure'; // highlightSubtitleElements 제거
// import { interceptSubtitleRequests, fetchSubtitleManually } from '../utils/subtitleCapturer'; // chrome.debugger 사용으로 주석 처리
import { fetchSubtitleManually, parseVTT } from '../utils/subtitleCapturer'; // parseVTT 임포트 추가
import vttSubtitleManager from '../services/subtitles/vttSubtitleService';
import { cleanupExtensionResources, restoreOriginalSubtitles } from '../utils/cleanupHelper';
// 자막 트랙 관리 유틸리티 추가
import { activateAllTextTracks, setSubtitleLanguage, getActiveSubtitleText } from '../utils/trackManager';

console.log('Play LearnEng Content Script Loaded');

/**
 * 확장 프로그램 UI 초기화
 */
async function initialize() {
  console.log('Play LearnEng: 초기화 중...');
  
  // Extension context 유효성 확인
  if (!isExtensionContextValid()) {
    console.error('[Content Script] Extension context is invalid. Reload required.');
    showInvalidContextMessage();
    return;
  }
  
  // 백그라운드 스크립트에 컨텐트 스크립트 준비 완료 알림
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
    console.log('[Content Script] Background notified of readiness:', response);
  } catch (error) {
    console.error('[Content Script] Error notifying background of readiness:', error);
    if (error.message.includes('Extension context invalidated')) {
      showInvalidContextMessage();
      return;
    }
  }
  
  // 디버깅: 쿠팡 플레이 DOM 구조 분석 실행
  console.log('DOM 분석 결과:', analyzeVideoPlayerDOM());
  
  // 플레이어 및 자막 컨테이너 감지
  const detection = await detectPlayerWithRetry(15, 1000);
  
  if (!detection) {
    console.warn('Play LearnEng: 플레이어 감지 실패. 쿠팡 플레이 영상 페이지가 맞는지 확인해주세요.');
    return;
  }
  
  const { videoElement, subtitleContainer } = detection;
  const videoInfo = extractVideoInfo();
  
  console.log('Play LearnEng: 비디오 정보', videoInfo);
  console.log('자막 컨테이너:', subtitleContainer);
  
  // TextTracks API를 사용한 자막 활성화 시도
  console.log('텍스트 트랙 API를 통한 자막 활성화 시도...');
  activateAllTextTracks(videoElement);
  
  // 한국어와 영어 자막 모두 활성화 시도
  setTimeout(() => {
    setSubtitleLanguage(videoElement, 'ko');
    setTimeout(() => {
      // 활성화된 자막 텍스트 확인
      const activeSubtitles = getActiveSubtitleText(videoElement);
      console.log('활성화된 자막 텍스트:', activeSubtitles);
    }, 1000);
  }, 2000);

  // 자막 요청 인터셉션 초기화 (chrome.debugger 사용으로 주석 처리)
  // console.log('자막 인터셉션 초기화 중...');
  // interceptSubtitleRequests();
  
  // VTT 자막 매니저 초기화 (chrome.debugger 사용으로 주석 처리 또는 로직 변경 필요)
  // vttSubtitleManager.start(); 
  // TODO: VTTSubtitleManager가 백그라운드로부터 받은 VTT 데이터를 사용하도록 수정 필요
  console.log('[Content Script] VTTSubtitleManager 시작은 chrome.debugger 결과를 받아 처리하도록 변경 예정');

  // 백그라운드로부터 VTT 데이터 수신 리스너
  const messageListener = (message, sender, sendResponse) => {
    try {
      if (message.type === "VTT_RECEIVED") {
        console.log('[Content Script] VTT_RECEIVED from background:', message.payload);
        const { url, vtt, lang, videoId } = message.payload;
        
        try {
          const cues = parseVTT(vtt);
          console.log(`[Content Script] Parsed VTT from background: ${cues.length} cues (${lang})`);
          
          // VTTSubtitleManager를 통해 자막 데이터 업데이트
          if (vttSubtitleManager.processCapturedVTT) {
             vttSubtitleManager.processCapturedVTT({ url, content: vtt, cues, language: lang });
          } else {
            console.warn('[Content Script] vttSubtitleManager.processCapturedVTT method not found. Manual processing needed.');
            // 수동으로 primary/secondary subtitle 업데이트 로직 (임시)
            if (lang === 'ko') {
              console.log('[Content Script] Received Korean VTT, needs method to set in VTTManager');
            } else if (lang === 'en') {
              console.log('[Content Script] Received English VTT, needs method to set in VTTManager');
            }
          }

        } catch (error) {
          console.error('[Content Script] Error processing VTT from background:', error);
        }
        sendResponse({ success: true });
      } else if (message.type === 'JUMP_TO_TIME') {
        console.log(`[Content Script] JUMP_TO_TIME message received:`, message.timestamp);
        const videoElement = document.querySelector('video');
        if (videoElement && typeof message.timestamp === 'number') {
          videoElement.currentTime = message.timestamp;
          sendResponse({ success: true });
        } else {
          console.error('[Content Script] Video element not found or timestamp invalid for JUMP_TO_TIME.');
          sendResponse({ success: false, error: 'Video element not found or timestamp invalid' });
        }
      } else if (message.type === 'LE_GET_CURRENT_TIME') {
        // Attempt to find the main video element on the page.
        // This selector might need to be adjusted for Coupang Play or other target sites.
        const videoElement = document.querySelector('video'); 
        if (videoElement) {
          sendResponse({ currentTime: videoElement.currentTime });
        } else {
          console.warn('LE_GET_CURRENT_TIME: Video element not found.');
          sendResponse({ currentTime: 0 }); // Fallback or error indication
        }
        return true; // Required for asynchronous sendResponse
      } else if (message.type === 'SETTINGS_UPDATED') {
        // Handle settings update if needed in content script directly
        console.log('Content script received settings update:', message.settings);
        // You might want to update a local copy of settings or trigger a re-render of DualSubtitles
        // if it doesn't pick up changes from chrome.storage.onChanged itself.
      }
    } catch (error) {
      console.error('[Content Script] Error handling message:', error);
      // Don't rethrow the error - just log it
    }
    return true;
  };
  
  chrome.runtime.onMessage.addListener(messageListener);
  
  // 쿠팡플레이 기본 자막 비활성화
  hideOriginalSubtitles();
  
  // UI 요소 마운트
  mountUserInterface(videoElement, subtitleContainer, videoInfo);
}

/**
 * 사용자 인터페이스 마운트
 */
function mountUserInterface(
  videoElement: HTMLVideoElement, 
  subtitleContainer: Element,
  videoInfo: { title: string; episodeInfo: string; videoId: string }
) {
  // 기존에 마운트된 요소가 있다면 제거
  const existingMount = document.getElementById('play-learneng-container');
  if (existingMount) {
    existingMount.remove();
  }
  
  // 새 마운트 포인트 생성 및 추가
  const mountPoint = document.createElement('div');
  mountPoint.id = 'play-learneng-container';
  document.body.appendChild(mountPoint);
  
  // React 컴포넌트 렌더링
  try {
    ReactDOM.createRoot(mountPoint).render(
      <React.StrictMode>
        <PlayerController 
          videoElement={videoElement} 
          subtitleContainer={subtitleContainer} 
          videoInfo={videoInfo}
        />
      </React.StrictMode>
    );
    console.log('Play LearnEng: UI 컴포넌트가 성공적으로 마운트되었습니다.');
    
    // 스크린샷 구조에 맞게 자막 컨테이너 생성
    setupDualSubtitleContainer();
  } catch (error) {
    console.error('Play LearnEng: UI 렌더링 중 오류 발생:', error);
  }
}

// 스크린샷 구조에 맞는 자막 컨테이너 설정
function setupDualSubtitleContainer() {
  // 기존 자막 컨테이너가 있다면 제거
  const existingContainer = document.getElementById('play-learneng-subtitle-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 비디오 컨테이너 찾기
  const videoContainer = document.querySelector('.video-js') || 
                         document.querySelector('[id*="player"]') || 
                         document.querySelector('.player-container');
  
  if (videoContainer) {
    // 새 자막 컨테이너 생성
    const subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'play-learneng-subtitle-container';
    
    // 스크린샷과 동일한 스타일링 적용
    subtitleContainer.style.cssText = `
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
    
    videoContainer.appendChild(subtitleContainer);
    console.log('이중 자막 컨테이너 설정 완료:', subtitleContainer);
    return subtitleContainer;
  }
  
  console.warn('비디오 컨테이너를 찾을 수 없어 자막 컨테이너를 생성할 수 없습니다.');
  return null;
}

// 페이지 변경 감지 및 재초기화
let cleanup: (() => void) | null = null;

function setupPageChangeDetection() {
  try {
    if (cleanup) {
      cleanup();
    }
    
    if (!isExtensionContextValid()) {
      console.warn('Extension context is invalid. Cannot set up page change detection.');
      return;
    }
    
    cleanup = watchPageChanges(() => {
      console.log('Play LearnEng: 페이지 변경 감지, 재초기화합니다.');
      setTimeout(initialize, 1000); // 페이지 로딩을 위해 약간의 지연
    });
  } catch (error) {
    console.error('Error setting up page change detection:', error);
    // 확장 컨텍스트가 끊어진 경우 복구는 불가능하므로 추가 조치는 취하지 않음
  }
}

// 초기화 및 페이지 변경 감지 설정
try {
  if (isExtensionContextValid()) {
    initialize();
    setupPageChangeDetection();
  } else {
    console.error('확장 프로그램 컨텍스트가 유효하지 않아 초기화를 시작할 수 없습니다.');
    // 페이지가 로드된 후 메시지 표시
    setTimeout(showInvalidContextMessage, 1000);
  }
} catch (error) {
  console.error('초기화 중 오류 발생:', error);
  if (error.message && error.message.includes('Extension context invalidated')) {
    setTimeout(showInvalidContextMessage, 1000);
  }
}

// 커스텀 디버깅 명령 등록 (콘솔에서 사용)
(window as any).playLearnEngDebug = {
  analyzeDOM: analyzeVideoPlayerDOM,
  
  // 자막 캡처 기능 추가 (interceptSubtitles는 chrome.debugger로 대체되어 제거)
  fetchSubtitle: fetchSubtitleManually,
  vttManager: vttSubtitleManager,
  
  // TextTrack API 관련 디버깅 명령 추가
  trackManager: {
    activateAll: () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) activateAllTextTracks(video);
      return 'TextTrack 활성화 시도 완료';
    },
    setLanguage: (lang: string) => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) setSubtitleLanguage(video, lang);
      return `${lang} 언어 자막 활성화 시도 완료`;
    },
    getActive: () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) return getActiveSubtitleText(video);
      return [];
    },
    listTracks: () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video || !video.textTracks) return '비디오 요소나 텍스트 트랙이 없습니다';
      
      return Array.from(video.textTracks).map((track, i) => ({
        index: i,
        kind: track.kind,
        label: track.label,
        language: track.language,
        mode: track.mode,
        activeCues: track.activeCues?.length || 0
      }));
    }
  },
  
  // 자막 검사 및 추출 함수
  checkSubtitles: async () => {
    try {
      // 미리 import된 함수 사용
      const { findSubtitleContainer } = await import('../utils/playerDetector');
      const { findActiveSubtitles, extractSubtitleText } = await import('../utils/subtitleExtractor');
      
      console.log('자막 컨테이너 검색 중...');
      const container = findSubtitleContainer();
      
      if (!container) {
        console.error('자막 컨테이너를 찾을 수 없습니다');
        return null;
      }
      
      console.log('자막 컨테이너:', container);
      const subtitleElements = findActiveSubtitles(container);
      console.log(`${subtitleElements.length}개의 자막 요소를 찾았습니다:`);
      
      subtitleElements.forEach((el, index) => {
        const text = extractSubtitleText(el);
        console.log(`자막 ${index + 1}: "${text}"`);
      });
      
      return { container, elements: subtitleElements };
    } catch (error) {
      console.error('자막 검사 중 오류 발생:', error);
      return null;
    }
  },
  
  // 현재 상태 가져오기
  getState: async () => {
    try {
      const { default: useSubtitleStore } = await import('../store/subtitleStore');
      return useSubtitleStore.getState();
    } catch (error) {
      console.error('상태 가져오기 실패:', error);
      return null;
    }
  },
  
  // 활성화된 VTT 자막 가져오기
  getActiveVttSubtitles: () => {
    try {
      const videoElement = document.querySelector('video');
      if (!videoElement) {
        console.error('비디오 요소를 찾을 수 없습니다');
        return null;
      }
      
      return vttSubtitleManager.getActiveSubtitles(videoElement.currentTime);
    } catch (error) {
      console.error('VTT 자막 가져오기 실패:', error);
      return null;
    }
  }
};

console.log('Play LearnEng 디버깅 명령이 등록되었습니다. window.playLearnEngDebug로 접근하세요.');

// 확장 프로그램 정리 함수
function cleanupExtension() {
  try {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    
    // 원본 자막 복원
    showOriginalSubtitles();
    
    // 확장 프로그램이 생성한 DOM 요소 제거
    const subtitleContainer = document.getElementById('play-learn-eng-subtitles');
    if (subtitleContainer) {
      subtitleContainer.remove();
    }
    
    const uiContainer = document.getElementById('play-learneng-container');
    if (uiContainer) {
      uiContainer.remove();
    }
    
    // 상태 알림 메시지 제거
    const feedbackElement = document.getElementById('play-learneng-feedback');
    if (feedbackElement) {
      feedbackElement.remove();
    }
    
    // Extension context invalidated 오류 알림 메시지 찾아서 제거
    const notifications = document.querySelectorAll('div');
    notifications.forEach(element => {
      if (element.textContent && 
          element.textContent.includes('확장 프로그램 컨텍스트가 무효화되었습니다')) {
        element.remove();
      }
    });
    
    // 런타임 메시지 리스너 제거 시도 - Chrome API 접근 오류 시 조용히 실패
    try {
      if (chrome.runtime && chrome.runtime.onMessage) {
        // 이 시점에서는 리스너 참조가 없어 직접 제거는 불가능하지만,
        // 확장이 다시 로드되면 모든 리스너가 자동으로 제거됨
        console.log('메시지 리스너는 확장 재로드 시 자동으로 제거됩니다.');
      }
    } catch (error) {
      console.log('메시지 리스너 정리 중 오류 발생 (정상):', error.message);
    }
    
    console.log('Play LearnEng: 확장 프로그램 자원이 정리되었습니다.');
  } catch (error) {
    console.error('확장 프로그램 정리 중 오류:', error);
  }
}

// 언마운트 시 정리
window.addEventListener('beforeunload', cleanupExtension);

// 자막 저장 관련 타입 정의
interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  savedAt?: string;
}

// 자막 클릭 이벤트 처리를 위한 전역 이벤트 리스너 추가
document.addEventListener('click', (e) => {
  try {
    const target = e.target as HTMLElement;
    
    // 자막 요소 확인 (play-learneng-subtitle-text 클래스를 가진 요소)
    if (target && target.classList && 
        (target.classList.contains('play-learneng-subtitle-text') || 
         (target.className && target.className.includes('play-learneng-subtitle-')))) {
      
      e.stopPropagation();
      e.preventDefault();
      
      // 확장 프로그램 컨텍스트가 유효한지 확인
      if (!isExtensionContextValid()) {
        console.error('확장 프로그램 컨텍스트가 유효하지 않습니다. 자막을 저장할 수 없습니다.');
        showInvalidContextMessage();
        return;
      }
      
      console.log('자막 요소 클릭됨:', target.textContent);
      
      // 클릭된 요소 정보
      console.log('클릭한 요소 정보:', {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        textContent: target.textContent
      });
      
      // 클릭된 자막이 한국어인지 영어인지 확인
      const isKorean = target.className.includes('subtitle-ko');
      const isEnglish = target.className.includes('subtitle-en');
      
      // 상대 언어 자막 찾기
      let pairSubtitleText = '';
      if (target.parentElement) {
        const siblingElements = Array.from(target.parentElement.children);
        
        if (isKorean) {
          // 한국어 자막이 클릭된 경우 영어 자막 찾기
          const englishElement = siblingElements.find(el => 
            el.className && el.className.includes('subtitle-en')
          ) as HTMLElement | undefined;
          pairSubtitleText = englishElement?.textContent || '';
        } else if (isEnglish) {
          // 영어 자막이 클릭된 경우 한국어 자막 찾기
          const koreanElement = siblingElements.find(el => 
            el.className && el.className.includes('subtitle-ko')
          ) as HTMLElement | undefined;
          pairSubtitleText = koreanElement?.textContent || '';
        }
      }
      
      const subtitleText = target.textContent || '';
      const koreanText = isKorean ? subtitleText : pairSubtitleText;
      const englishText = isEnglish ? subtitleText : pairSubtitleText;
      
      console.log('감지된 자막:', { koreanText, englishText });
      
      if (!koreanText && !englishText) {
        console.warn('저장할 자막 텍스트를 찾을 수 없습니다.');
        return;
      }
      
      // 비디오 시간 가져오기
      let currentTime = 0;
      const videoElement = document.querySelector('video');
      if (videoElement) {
        currentTime = videoElement.currentTime;
      }
      
      // 자막 저장
      saveSubtitleToStorage({
        primaryText: koreanText || '',
        secondaryText: englishText || '',
        timestamp: currentTime
      });
    }
  } catch (error) {
    console.error('자막 클릭 핸들러 오류:', error);
    
    // Extension context invalidated 에러인 경우 알림 표시
    if (error.message && error.message.includes('Extension context invalidated')) {
      showInvalidContextMessage();
    }
  }
}, true);

// 자막을 저장소에 저장하는 함수
function saveSubtitleToStorage(subtitle: { primaryText: string; secondaryText: string; timestamp: number }) {
  try {
    // 고유 ID 생성
    const uniqueId = `subtitle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const reviewSubtitle: SavedSubtitle = {
      id: uniqueId,
      primaryText: subtitle.primaryText,
      secondaryText: subtitle.secondaryText,
      savedAt: new Date().toISOString()
    };
    
    console.log('자막을 저장소에 저장:', reviewSubtitle);
    
    // 로컬 스토리지에 먼저 저장 (백업)
    try {
      chrome.storage.local.set({ 
        lastSavedSubtitle: reviewSubtitle 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('로컬 스토리지 저장 오류:', chrome.runtime.lastError);
        }
      });
    } catch (error) {
      console.error('로컬 스토리지 접근 중 오류:', error);
      showFeedback('확장 프로그램 컨텍스트 오류. 새로고침 필요', false);
      return; // 계속 진행하지 않음
    }
    
    // 동기화 스토리지 접근 시 오류 처리
    try {
      // 동기화 스토리지에서 기존 자막 가져오기
      chrome.storage.sync.get(['savedSubtitles'], (data) => {
        if (chrome.runtime.lastError) {
          console.error('동기화 스토리지 접근 오류:', chrome.runtime.lastError);
          showFeedback('확장 프로그램 컨텍스트 오류. 새로고침 필요', false);
          return;
        }
        
        let savedSubtitles = data.savedSubtitles as SavedSubtitle[] || [];
        
        // 배열이 아니라면 배열로 초기화
        if (!Array.isArray(savedSubtitles)) {
          savedSubtitles = [];
        }
        
        // 새 자막을 배열 앞에 추가
        savedSubtitles.unshift(reviewSubtitle);
        
        // 용량 제한을 피하기 위해 최대 100개만 유지
        if (savedSubtitles.length > 100) {
          savedSubtitles = savedSubtitles.slice(0, 100);
        }
        
        // 스토리지에 저장
        chrome.storage.sync.set({ savedSubtitles }, () => {
          if (chrome.runtime.lastError) {
            console.error('스토리지 저장 오류:', chrome.runtime.lastError);
            
            // 실패 시 로컬 스토리지에 저장
            try {
              chrome.storage.local.set({ savedSubtitles }, () => {
                if (chrome.runtime.lastError) {
                  console.error('로컬 스토리지 백업 저장 오류:', chrome.runtime.lastError);
                  showFeedback('저장 실패. 새로고침 후 다시 시도해보세요', false);
                } else {
                  showFeedback('저장소 오류로 로컬에만 저장되었습니다', false);
                }
              });
            } catch (storeError) {
              console.error('로컬 스토리지 백업 접근 오류:', storeError);
              showFeedback('저장 실패. 새로고침 후 다시 시도해보세요', false);
            }
          } else {
            console.log('자막이 성공적으로 저장되었습니다');
            
            // 한글 텍스트 우선 표시
            const displayText = subtitle.primaryText || subtitle.secondaryText;
            const shortDisplayText = displayText.substring(0, 15) + (displayText.length > 15 ? '...' : '');
            
            showFeedback(`"${shortDisplayText}" 저장됨!`, true);
          }
        });
      });
    } catch (error) {
      console.error('동기화 스토리지 접근 오류:', error);
      showFeedback('확장 프로그램 컨텍스트 오류. 새로고침 필요', false);
    }
  } catch (error) {
    console.error('자막 저장 중 예상치 못한 오류:', error);
    showFeedback('저장 실패. 새로고침 후 다시 시도해보세요', false);
  }
}

// 사용자에게 피드백 보여주기
function showFeedback(message: string, isSuccess: boolean) {
  try {
    // 기존 피드백 제거
    try {
      const existingFeedback = document.getElementById('play-learneng-feedback');
      if (existingFeedback && existingFeedback.parentNode) {
        existingFeedback.parentNode.removeChild(existingFeedback);
      }
    } catch (removeError) {
      console.error('기존 피드백 제거 중 오류:', removeError);
      // 계속 진행 (비정상 종료 방지)
    }
    
    // 새 피드백 요소 생성
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'play-learneng-feedback';
    
    feedbackElement.innerHTML = `
      <span style="margin-right: 6px; font-size: 12px;">${isSuccess ? '✓' : '!'}</span>
      <span>${message}</span>
    `;
    
    // 미니멀한 스타일 적용
    Object.assign(feedbackElement.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '8px 12px',
      backgroundColor: isSuccess ? 'rgba(0, 0, 0, 0.75)' : 'rgba(220, 53, 69, 0.75)',
      color: isSuccess ? '#4ade80' : '#ff6b6b',
      borderRadius: '4px',
      fontWeight: '400',
      fontSize: '13px',
      zIndex: '10000',
      transition: 'all 0.2s ease',
      opacity: '0',
      transform: 'translateY(-10px)',
      backdropFilter: 'blur(4px)',
      border: isSuccess ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
      display: 'flex',
      alignItems: 'center',
      maxWidth: '200px',
      wordBreak: 'break-word'
    });
    
    document.body.appendChild(feedbackElement);
    
    // 부드러운 애니메이션 효과
    setTimeout(() => {
      try {
        feedbackElement.style.opacity = '1';
        feedbackElement.style.transform = 'translateY(0)';
      } catch (animError) {
        console.error('피드백 애니메이션 효과 적용 중 오류:', animError);
      }
    }, 10);
    
    // 일정 시간 후 제거 (Extension context가 무효화된 경우를 제외하고)
    if (message.includes('새로고침') || message.includes('컨텍스트 오류')) {
      // 확장 컨텍스트 오류 관련 메시지는 더 오래 표시 (4초)
      setTimeout(() => {
        try {
          if (feedbackElement) {
            feedbackElement.style.opacity = '0';
            feedbackElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
              try {
                if (feedbackElement && feedbackElement.parentNode) {
                  feedbackElement.parentNode.removeChild(feedbackElement);
                }
              } catch (removeError) {
                console.error('피드백 요소 제거 중 오류:', removeError);
              }
            }, 200);
          }
        } catch (fadeError) {
          console.error('피드백 페이드아웃 중 오류:', fadeError);
        }
      }, 4000);
    } else {
      // 일반 메시지는 1.5초 표시 (더 빠른 피드백)
      setTimeout(() => {
        try {
          if (feedbackElement) {
            feedbackElement.style.opacity = '0';
            feedbackElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
              try {
                if (feedbackElement && feedbackElement.parentNode) {
                  feedbackElement.parentNode.removeChild(feedbackElement);
                }
              } catch (removeError) {
                console.error('피드백 요소 제거 중 오류:', removeError);
              }
            }, 200);
          }
        } catch (fadeError) {
          console.error('피드백 페이드아웃 중 오류:', fadeError);
        }
      }, 1500);
    }
  } catch (error) {
    // 피드백 표시에 실패했을 때 적어도 콘솔에는 기록
    console.error('피드백 표시 중 오류:', error, '원본 메시지:', message);
  }
}

/**
 * 확장 프로그램 컨텍스트의 유효성을 확인하는 함수
 * @returns 확장 프로그램 컨텍스트 유효 여부
 */
function isExtensionContextValid(): boolean {
  try {
    // chrome.runtime.id에 접근해봄으로써 컨텍스트 유효성 확인
    const extensionId = chrome.runtime.id;
    return !!extensionId;
  } catch (error) {
    console.error('Extension context validation error:', error);
    return false;
  }
}

/**
 * 확장 프로그램 컨텍스트가 무효화되었을 때 사용자에게 메시지 표시
 */
function showInvalidContextMessage(): void {
  const message = '확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침 해주세요.';
  showFeedback(message, false);
  
  try {
    // 페이지 상단에 영구적인 알림 메시지 추가
    const notificationBar = document.createElement('div');
    notificationBar.id = 'play-learneng-context-error';
    
    // CSS 스타일을 문자열로 설정
    notificationBar.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background-color: rgba(220, 53, 69, 0.9); color: white; text-align: center; padding: 10px; font-weight: bold; z-index: 10000; display: flex; justify-content: center; align-items: center;';
    
    // 새로고침 버튼 생성
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '페이지 새로고침';
    
    // 버튼에 CSS 스타일을 문자열로 설정
    refreshButton.style.cssText = 'margin-left: 15px; padding: 5px 10px; border: none; border-radius: 4px; background-color: white; color: #dc3545; cursor: pointer; font-weight: bold;';
    
    // 새로고침 이벤트 연결
    refreshButton.addEventListener('click', () => window.location.reload());
    
    // 텍스트 노드 추가
    const textNode = document.createTextNode(message);
    notificationBar.appendChild(textNode);
    notificationBar.appendChild(refreshButton);
    
    document.body.appendChild(notificationBar);
  } catch (error) {
    console.error('알림 메시지 표시 중 오류:', error);
    // 오류가 발생해도 최소한의 기능은 동작하도록 함
    alert('확장 프로그램 컨텍스트 오류: 페이지를 새로고침 해주세요.');
  }
}
