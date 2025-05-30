import React, { useCallback, useEffect, useRef } from 'react';
import useSubtitleStore from '../../store/subtitleStore';

interface DualSubtitlesProps {
  style?: React.CSSProperties;
  source?: 'dom' | 'vtt';
}

const DualSubtitles: React.FC<DualSubtitlesProps> = ({ style, source = 'dom' }) => {
  const { 
    koreanSubtitle,
    englishSubtitle,
    displayMode,
    primaryLanguage,
    secondaryLanguage,
    setKoreanSubtitle,
    setEnglishSubtitle
  } = useSubtitleStore();
  
  // 자막 컨테이너 참조
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 자막 업데이트 함수
  const updateSubtitles = useCallback(() => {
    // 자막 컨테이너 찾기 (없으면 생성)
    let container = containerRef.current;
    if (!container) {
      container = document.createElement('div');
      container.id = 'play-learneng-subtitle-container';
      container.style.position = 'fixed';
      container.style.bottom = '80px';
      container.style.left = '0';
      container.style.right = '0';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.zIndex = '9999';
      container.style.pointerEvents = 'none';
      container.style.padding = '0 20px';
      container.style.boxSizing = 'border-box';
      document.body.appendChild(container);
      // containerRef.current는 readonly이므로 직접 할당하지 않고 ref 콜백 사용
      if (!containerRef.current) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
      }
    }
    
    // 컨테이너 내용 비우기
    container.innerHTML = '';
    
    // 한국어 자막 표시 (주 자막)
    if ((displayMode === 'dual' || displayMode === 'primary') && koreanSubtitle) {
      renderSubtitle(container, koreanSubtitle, {
        color: '#ffffff',
        fontSize: '20px',
        marginBottom: '5px',
        fontWeight: '500'
      });
    }
    
    // 영어 자막 표시 (보조 자막)
    if ((displayMode === 'dual' || displayMode === 'secondary') && englishSubtitle) {
      renderSubtitle(container, englishSubtitle, {
        color: '#56c7ff',
        fontSize: '18px',
        marginBottom: '0',
        fontWeight: '400'
      });
    }
  }, [displayMode, koreanSubtitle, englishSubtitle, primaryLanguage, secondaryLanguage]);
  
  // 자막 렌더링 함수
  const renderSubtitle = (container: HTMLElement, text: string, style: React.CSSProperties) => {
    const element = document.createElement('div');
    element.className = 'play-learneng-subtitle-text';
    element.textContent = text;
    
    // 스타일 적용
    Object.assign(element.style, {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '4px 10px',
      borderRadius: '4px',
      maxWidth: '90%',
      textAlign: 'center',
      lineHeight: '1.4',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      ...style
    });
    
    container.appendChild(element);
  };
  
  // 자막 변경 감지 및 업데이트
  useEffect(() => {
    updateSubtitles();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      const container = containerRef.current;
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [updateSubtitles]);
  
  // 자막 추출 로직 (기존 자막 감지 로직과 연동)
  useEffect(() => {
    if (source === 'vtt') {
      // VTT 소스에서 자막 추출 (기존 로직과 연동)
      const detectAndExtractSubtitles = () => {
        // 기존 자막 감지 로직과 연동
        // ...
      };
      
      const interval = setInterval(detectAndExtractSubtitles, 500);
      return () => clearInterval(interval);
    }
  }, [source]);

  // 컴포넌트 반환 (React 컴포넌트로 수정)
  return null;
};

export default DualSubtitles;
