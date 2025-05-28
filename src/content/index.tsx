import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { detectPlayerWithRetry, watchPageChanges, extractVideoInfo } from '../utils/playerDetector';
import PlayerController from '../components/player/PlayerController';

console.log('Play LearnEng Content Script Loaded');

/**
 * 확장 프로그램 UI 초기화
 */
async function initialize() {
  console.log('Play LearnEng: 초기화 중...');
  
  // 플레이어 및 자막 컨테이너 감지
  const detection = await detectPlayerWithRetry(15, 1000);
  
  if (!detection) {
    console.warn('Play LearnEng: 플레이어 감지 실패. 쿠팡 플레이 영상 페이지가 맞는지 확인해주세요.');
    return;
  }
  
  const { videoElement, subtitleContainer } = detection;
  const videoInfo = extractVideoInfo();
  
  console.log('Play LearnEng: 비디오 정보', videoInfo);
  
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
  } catch (error) {
    console.error('Play LearnEng: UI 렌더링 중 오류 발생:', error);
  }
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

// 언마운트 시 정리
window.addEventListener('beforeunload', () => {
  if (cleanup) {
    cleanup();
  }
});
