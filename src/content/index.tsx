import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { detectPlayerWithRetry, extractVideoInfo, hideOriginalSubtitles, watchPageChanges } from '../utils/playerDetector';
import PlayerController from '../components/player/PlayerController';
import { logger } from '../utils/logger';

logger.log('Play LearnEng Content Script Loaded');

// VTT 데이터 상태 관리
interface ProcessedSubtitleData {
  language: string;
  cues: Array<{
    id?: string;
    startTime: number;
    endTime: number;
    text: string;
    settings?: string;
  }>;
  videoId?: string;
  totalCues: number;
  duration?: number;
  isValid: boolean;
}

// 전역 상태로 VTT 데이터 관리
let currentKoreanSubtitles: ProcessedSubtitleData | null = null;
let currentEnglishSubtitles: ProcessedSubtitleData | null = null;
let currentVideoId: string | null = null;

/**
 * 단축키 설정 
 * Shift+C 단축키로 현재 화면의 자막을 저장
 */
function setupKeyboardShortcuts(): void {
  logger.log('[Content Script] 단축키 설정 중 (Shift+C)...');
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'C' && event.shiftKey) {
      logger.log('[Content Script] 단축키 감지: Shift+C');
      saveCurrentSubtitles();
    }
  });
  
  logger.log('[Content Script] 단축키 설정 완료');
}

/**
 * 현재 화면에 보이는 자막을 저장하는 함수
 */
function saveCurrentSubtitles(): void {
  logger.log('[Content Script] 현재 자막 저장 시도...');
  
  const subtitleElements = document.querySelectorAll('.play-learneng-subtitle-text');
  
  if (subtitleElements.length === 0) {
    logger.log('[Content Script] 저장할 자막을 찾을 수 없습니다.');
    showFeedbackMessage('저장할 자막을 찾을 수 없습니다.');
    return;
  }
  
  (subtitleElements[0] as HTMLElement).click();
  logger.log('[Content Script] 자막 저장을 위해 자막 요소 클릭됨');
}

/**
 * 피드백 메시지 표시 함수
 */
function showFeedbackMessage(message: string): void {
  const feedbackElement = document.createElement('div');
  feedbackElement.id = 'play-learneng-feedback';
  
  const existingFeedback = document.getElementById('play-learneng-feedback');
  if (existingFeedback && existingFeedback.parentNode) {
    existingFeedback.parentNode.removeChild(existingFeedback);
  }
  
  const isSuccess = message.includes('저장되었습니다');
  feedbackElement.innerHTML = `
    <span style="margin-right: 8px">${isSuccess ? '✅' : '⚠️'}</span>
    <span>${message}</span>
  `;
  
  Object.assign(feedbackElement.style, {
    position: 'fixed',
    top: '50px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    backgroundColor: isSuccess ? 'rgba(25, 135, 84, 0.85)' : 'rgba(220, 53, 69, 0.85)',
    color: '#fff',
    borderRadius: '6px',
    fontWeight: 'bold',
    zIndex: '10000',
    transition: 'all 0.3s ease',
    opacity: '0',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  });
  
  document.body.appendChild(feedbackElement);
  
  setTimeout(() => {
    feedbackElement.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    feedbackElement.style.opacity = '0';
    setTimeout(() => {
      if (feedbackElement.parentNode) {
        feedbackElement.parentNode.removeChild(feedbackElement);
      }
    }, 300);
  }, 3000);
}

/**
 * 확장 프로그램 UI 초기화
 */
async function initialize() {
  logger.log('Play LearnEng: 초기화 중...');

  // Extension context 유효성 확인
  if (!isExtensionContextValid()) {
    console.error('[Content Script] Extension context is invalid. Reload required.');
    showInvalidContextMessage();
    return;
  }
  
  // 백그라운드 스크립트에 컨텐트 스크립트 준비 완료 알림
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
    logger.log('[Content Script] Background notified of readiness:', response);
  } catch (error) {
    console.error('[Content Script] Error notifying background of readiness:', error);
    if (error.message.includes('Extension context invalidated')) {
      showInvalidContextMessage();
      return;
    }
  }
  
  // 단축키 이벤트 리스너 등록
  setupKeyboardShortcuts();
  
  // 플레이어 감지 (자막 컨테이너는 더 이상 필요하지 않음)
  const detection = await detectPlayerWithRetry(15, 1000);
  
  if (!detection) {
    console.warn('Play LearnEng: 플레이어 감지 실패. 쿠팡 플레이 영상 페이지가 맞는지 확인해주세요.');
    return;
  }
  
  const { videoElement } = detection;
  const videoInfo = extractVideoInfo();
  
  logger.log('Play LearnEng: 비디오 정보', videoInfo);
  
  // 백그라운드에 새 동영상 감지 알림
  if (videoInfo && videoInfo.videoId) {
    try {
      logger.log(`Play LearnEng: 백그라운드에 동영상 감지 알림 (videoId: ${videoInfo.videoId})`);
      currentVideoId = videoInfo.videoId;
      
      const response = await chrome.runtime.sendMessage({
        type: 'VIDEO_ELEMENT_FOUND',
        payload: { videoId: videoInfo.videoId }
      });
      logger.log('백그라운드에 비디오 감지 알림 성공:', response);
    } catch (error) {
      console.error('비디오 감지 알림 중 오류 발생:', error);
    }
  }

  // 백그라운드로부터 VTT 데이터 수신 리스너 설정
  setupBackgroundMessageListener();
  
  // 쿠팡플레이 기본 자막 비활성화
  hideOriginalSubtitles();
  
  // UI 요소 마운트 (subtitleContainer 제거)
  mountUserInterface(videoElement, videoInfo);
}

/**
 * 백그라운드 메시지 리스너 설정
 */
function setupBackgroundMessageListener() {
  const messageListener = (message: any, sender: any, sendResponse: any) => {
    try {
      if (message.type === 'VIDEO_CHANGED') {
        currentKoreanSubtitles = null;
        currentEnglishSubtitles = null;
        currentVideoId = message.payload?.videoId || null;
        sendResponse({ success: true });
      }
      else if (message.type === 'PROCESSED_SUBTITLE_RECEIVED') {
        const subtitleData = message.payload as ProcessedSubtitleData;
        
        if (!subtitleData.isValid || subtitleData.totalCues === 0) {
          console.warn(`[Content Script] Invalid subtitle data received for ${subtitleData.language}`);
          sendResponse({ success: false, error: 'Invalid subtitle data' });
          return;
        }
        
        // 중복 데이터 체크 및 저장
        let isNewData = false;
        if (subtitleData.language === 'ko') {
          if (!currentKoreanSubtitles || currentKoreanSubtitles.totalCues !== subtitleData.totalCues) {
            currentKoreanSubtitles = subtitleData;
            isNewData = true;
            logger.log(`[Content Script] Korean subtitles loaded: ${subtitleData.totalCues} cues`);
          }
        } else if (subtitleData.language === 'en') {
          if (!currentEnglishSubtitles || currentEnglishSubtitles.totalCues !== subtitleData.totalCues) {
            currentEnglishSubtitles = subtitleData;
            isNewData = true;
            logger.log(`[Content Script] English subtitles loaded: ${subtitleData.totalCues} cues`);
          }
        }
        
        // 새로운 데이터가 있을 때만 이벤트 발송
        if (isNewData) {
          const updateEvent = new CustomEvent('vttSubtitlesUpdated', {
            detail: {
              korean: currentKoreanSubtitles,
              english: currentEnglishSubtitles,
              videoId: currentVideoId
            }
          });
          document.dispatchEvent(updateEvent);
        }
        
        sendResponse({ success: true });
      }
      else if (message.type === 'JUMP_TO_TIME') {
        const videoElement = document.querySelector('video');
        if (videoElement && typeof message.timestamp === 'number') {
          videoElement.currentTime = message.timestamp;
          sendResponse({ success: true });
        } else {
          console.error('[Content Script] Video element not found or timestamp invalid for JUMP_TO_TIME.');
          sendResponse({ success: false, error: 'Video element not found or timestamp invalid' });
        }
      } 
      else if (message.type === 'GET_CURRENT_VIDEO_INFO') {
        try {
          const videoInfo = extractVideoInfo();
          
          if (videoInfo && videoInfo.videoId) {
            sendResponse({ videoId: videoInfo.videoId, title: videoInfo.title });
          } else {
            sendResponse({ error: 'No video info available' });
          }
        } catch (error) {
          console.error('[Content Script] Error getting video info:', error);
          sendResponse({ error: 'Failed to get video info' });
        }
        return true;
      } 
      else if (message.type === 'LE_GET_CURRENT_TIME') {
        const videoElement = document.querySelector('video'); 
        if (videoElement) {
          sendResponse({ currentTime: videoElement.currentTime });
        } else {
          sendResponse({ currentTime: 0 });
        }
        return true;
      } 
      else if (message.type === 'SETTINGS_UPDATED') {
        // 설정 업데이트 이벤트 전달
        const settingsEvent = new CustomEvent('settingsUpdated', {
          detail: message.settings
        });
        document.dispatchEvent(settingsEvent);
      }
    } catch (error) {
      console.error('[Content Script] Error handling message:', error);
    }
    return true;
  };
  
  chrome.runtime.onMessage.addListener(messageListener);
}

/**
 * 사용자 인터페이스 마운트 (subtitleContainer 제거)
 */
function mountUserInterface(
  videoElement: HTMLVideoElement, 
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
  
  // React 컴포넌트 렌더링 (subtitleContainer props 제거)
  try {
    ReactDOM.createRoot(mountPoint).render(
      <React.StrictMode>
        <PlayerController 
          videoElement={videoElement} 
          videoInfo={videoInfo}
          // 가공된 VTT 데이터 전달을 위한 getter 함수들
          getKoreanSubtitles={() => currentKoreanSubtitles}
          getEnglishSubtitles={() => currentEnglishSubtitles}
        />
      </React.StrictMode>
    );
    logger.log('Play LearnEng: UI 컴포넌트가 성공적으로 마운트되었습니다.');
  } catch (error) {
    console.error('Play LearnEng: UI 렌더링 중 오류 발생:', error);
  }
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
      logger.log('Play LearnEng: 페이지 변경 감지, 재초기화합니다.');
      // VTT 데이터 초기화
      currentKoreanSubtitles = null;
      currentEnglishSubtitles = null;
      currentVideoId = null;
      setTimeout(initialize, 1000);
    });
  } catch (error) {
    console.error('Error setting up page change detection:', error);
  }
}

// 초기화 및 페이지 변경 감지 설정
try {
  if (isExtensionContextValid()) {
    initialize();
    setupPageChangeDetection();
  } else {
    console.error('확장 프로그램 컨텍스트가 유효하지 않아 초기화를 시작할 수 없습니다.');
    setTimeout(showInvalidContextMessage, 1000);
  }
} catch (error) {
  console.error('초기화 중 오류 발생:', error);
  if (error.message && error.message.includes('Extension context invalidated')) {
    setTimeout(showInvalidContextMessage, 1000);
  }
}

// VTT 데이터 접근을 위한 전역 디버깅 객체 (로그 제거)
(window as any).playLearnEngDebug = {
  getCurrentSubtitles: () => ({
    korean: currentKoreanSubtitles,
    english: currentEnglishSubtitles,
    videoId: currentVideoId
  }),
  
  getCurrentSubtitleText: (currentTime: number) => {
    const korean = currentKoreanSubtitles?.cues.find(cue => 
      currentTime >= cue.startTime && currentTime <= cue.endTime
    )?.text || '';
    
    const english = currentEnglishSubtitles?.cues.find(cue => 
      currentTime >= cue.startTime && currentTime <= cue.endTime
    )?.text || '';
    
    return { korean, english, currentTime };
  },
  
  triggerSubtitleUpdate: () => {
    const updateEvent = new CustomEvent('vttSubtitlesUpdated', {
      detail: {
        korean: currentKoreanSubtitles,
        english: currentEnglishSubtitles,
        videoId: currentVideoId
      }
    });
    document.dispatchEvent(updateEvent);
  },
  
  getCurrentVideoTime: () => {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
  }
};

logger.log('Play LearnEng VTT 중개자 모드로 로드됨.');

// 자막 저장 관련 타입 정의
interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  savedAt?: string;
  timestamp?: number;
  episodeTitle?: string;
  savedDate?: string; // 'YYYY-MM-DD' 형식의 저장 날짜
}

// 자막 클릭 이벤트 처리를 위한 전역 이벤트 리스너 추가
document.addEventListener('click', (e) => {
  try {
    const target = e.target as HTMLElement;
    
    if (target && target.classList && 
        (target.classList.contains('play-learneng-subtitle-text') || 
         (target.className && target.className.includes('play-learneng-subtitle-')))) {
      
      e.stopPropagation();
      e.preventDefault();
      
      if (!isExtensionContextValid()) {
        console.error('확장 프로그램 컨텍스트가 유효하지 않습니다. 자막을 저장할 수 없습니다.');
        showInvalidContextMessage();
        return;
      }
      
      logger.log('자막 요소 클릭됨:', target.textContent);
      
      const isKorean = target.className.includes('subtitle-ko');
      const isEnglish = target.className.includes('subtitle-en');
      
      let pairSubtitleText = '';
      if (target.parentElement) {
        const siblingElements = Array.from(target.parentElement.children);
        
        if (isKorean) {
          const englishElement = siblingElements.find(el => 
            el.className && el.className.includes('subtitle-en')
          ) as HTMLElement | undefined;
          pairSubtitleText = englishElement?.textContent || '';
        } else if (isEnglish) {
          const koreanElement = siblingElements.find(el => 
            el.className && el.className.includes('subtitle-ko')
          ) as HTMLElement | undefined;
          pairSubtitleText = koreanElement?.textContent || '';
        }
      }
      
      const subtitleText = target.textContent || '';
      const koreanText = isKorean ? subtitleText : pairSubtitleText;
      const englishText = isEnglish ? subtitleText : pairSubtitleText;
      
      if (!koreanText && !englishText) {
        console.warn('저장할 자막 텍스트를 찾을 수 없습니다.');
        return;
      }
      
      let currentTime = 0;
      const videoElement = document.querySelector('video');
      if (videoElement) {
        currentTime = videoElement.currentTime;
      }
      
      saveSubtitleToStorage({
        primaryText: koreanText || '',
        secondaryText: englishText || '',
        timestamp: currentTime
      });
    }
  } catch (error) {
    console.error('자막 클릭 핸들러 오류:', error);
    
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
    
    // 현재 날짜 문자열 생성 ('YYYY-MM-DD' 형식)
    const now = new Date();
    const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 현재 영상 정보 추가 (제목과 에피소드 정보 결합)
    const videoInfo = extractVideoInfo();
    let episodeTitle = '';
    if (videoInfo) {
      // 제목과 에피소드 정보가 모두 있으면 결합, 아니면 하나만 사용
      if (videoInfo.title && videoInfo.episodeInfo) {
        episodeTitle = `${videoInfo.title} - ${videoInfo.episodeInfo}`;
      } else {
        episodeTitle = videoInfo.title || videoInfo.episodeInfo || '';
      }
    }
    
    const reviewSubtitle: SavedSubtitle = {
      id: uniqueId,
      primaryText: subtitle.primaryText,
      secondaryText: subtitle.secondaryText,
      savedAt: now.toISOString(),
      timestamp: subtitle.timestamp,
      savedDate: dateString, // 날짜 정보 추가
      episodeTitle: episodeTitle // 영상 제목과 에피소드 정보 결합
    };
    
    logger.log('자막을 저장소에 저장:', reviewSubtitle);
    
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
            logger.log('자막이 성공적으로 저장되었습니다');
            
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
    alert('확장 프로그램 컨텍스트 오류: 페이지를 새로고침 해주세요.');
  }
}
