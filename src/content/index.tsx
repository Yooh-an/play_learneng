import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { detectPlayerWithRetry, watchPageChanges, extractVideoInfo, hideOriginalSubtitles, showOriginalSubtitles } from '../utils/playerDetector';
import PlayerController from '../components/player/PlayerController';

// 디버깅 도구 임포트
import { analyzeVideoPlayerDOM, highlightSubtitleElements } from '../utils/debugDomStructure';
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
  
  // 백그라운드 스크립트에 컨텐트 스크립트 준비 완료 알림
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
    console.log('[Content Script] Background notified of readiness:', response);
  } catch (error) {
    console.error('[Content Script] Error notifying background of readiness:', error);
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
  
  // 디버깅: 감지된 자막 요소 강조 표시
  setTimeout(() => {
    console.log(highlightSubtitleElements());
  }, 5000); // 5초 후에 강조 표시 (페이지 로드 완료 후)
  
  // 자막 요청 인터셉션 초기화 (chrome.debugger 사용으로 주석 처리)
  // console.log('자막 인터셉션 초기화 중...');
  // interceptSubtitleRequests();
  
  // VTT 자막 매니저 초기화 (chrome.debugger 사용으로 주석 처리 또는 로직 변경 필요)
  // vttSubtitleManager.start(); 
  // TODO: VTTSubtitleManager가 백그라운드로부터 받은 VTT 데이터를 사용하도록 수정 필요
  console.log('[Content Script] VTTSubtitleManager 시작은 chrome.debugger 결과를 받아 처리하도록 변경 예정');

  // 백그라운드로부터 VTT 데이터 수신 리스너
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    }
    return true;
  });
  
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
  if (cleanup) {
    cleanup();
  }
  
  cleanup = watchPageChanges(() => {
    console.log('Play LearnEng: 페이지 변경 감지, 재초기화합니다.');
    setTimeout(initialize, 1000); // 페이지 로딩을 위해 약간의 지연
  });
}

// 초기화 및 페이지 변경 감지 설정
initialize();
setupPageChangeDetection();

// 커스텀 디버깅 명령 등록 (콘솔에서 사용)
(window as any).playLearnEngDebug = {
  analyzeDOM: analyzeVideoPlayerDOM,
  highlightSubtitles: highlightSubtitleElements,
  
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
  
  console.log('Play LearnEng: 확장 프로그램 자원이 정리되었습니다.');
}

// 언마운트 시 정리
window.addEventListener('beforeunload', cleanupExtension);
