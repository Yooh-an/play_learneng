import React, { useEffect } from 'react';
import useSubtitleStore from '../../store/subtitleStore';

interface DualSubtitlesProps {
  style?: React.CSSProperties;
  source?: 'dom' | 'vtt';
}

const DualSubtitles: React.FC<DualSubtitlesProps> = ({ style, source = 'dom' }) => {
  const { 
    activeSubtitles, 
    displayMode, 
    primaryLanguage, 
    secondaryLanguage 
  } = useSubtitleStore();
  
  // 디버깅 모드에서만 소스 표시
  const [showSource, setShowSource] = React.useState<boolean>(false);
  
  // 자막 변경시 DOM 자막 요소 생성/업데이트
  React.useEffect(() => {
    if (activeSubtitles) {
      updateDOMSubtitles(activeSubtitles, displayMode);
    }
  }, [activeSubtitles, displayMode]);
  
  // 실제 DOM 자막 요소 업데이트 함수
  const updateDOMSubtitles = (subtitle: any, mode: string) => {
    // 자막 컨테이너 찾기
    let container = document.getElementById('play-learneng-subtitle-container');
    if (!container) return;
    
    // 컨테이너 내용 비우기
    container.innerHTML = '';
    
    // 현재 표시 모드에 따른 자막 DOM 생성
    if (mode === 'dual' || mode === 'primary') {
      const primaryElement = document.createElement('div');
      primaryElement.className = 'play-learneng-subtitle-text play-learneng-subtitle-ko';
      primaryElement.textContent = subtitle.primaryText;
      
      // 스크린샷에 맞는 스타일
      primaryElement.style.cssText = `
        background-color: rgba(0, 0, 0, 0.5);
        color: #ffffff;
        padding: 4px 10px;
        margin-bottom: 5px;
        border-radius: 4px;
        font-size: 20px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        line-height: 1.4;
        white-space: pre-wrap;
      `;
      
      container.appendChild(primaryElement);
    }
    
    if (mode === 'dual' || mode === 'secondary') {
      const secondaryElement = document.createElement('div');
      secondaryElement.className = 'play-learneng-subtitle-text play-learneng-subtitle-en';
      secondaryElement.textContent = subtitle.secondaryText;
      
      // 스크린샷에 맞는 스타일
      secondaryElement.style.cssText = `
        background-color: rgba(0, 0, 0, 0.5);
        color: #56c7ff;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 18px;
        font-weight: 400;
        max-width: 90%;
        text-align: center;
        line-height: 1.4;
        white-space: pre-wrap;
        margin-bottom: 0;
      `;
      
      container.appendChild(secondaryElement);
    }
  };
  
  // 이 컴포넌트는 실제 UI를 렌더링하지 않고 DOM 조작만 수행
  return null;
};

export default DualSubtitles;
