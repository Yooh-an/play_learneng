import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSubtitleStore from '../../store/subtitleStore';

console.log('[DualSubtitles] Component SCRIPT LOADED'); // 최상단에 추가

interface DualSubtitlesProps {
  style?: React.CSSProperties;
  source?: 'dom' | 'vtt';
}

interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: number; // 0 (top) to 100 (bottom) percentage
  opacity: number;
}

interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
}

// DOM 요소의 경로를 가져오는 유틸리티 함수
const getPathToElement = (element: HTMLElement) => {
  const path: string[] = [];
  let currentElem: HTMLElement | null = element;
  
  while (currentElem && currentElem !== document.body) {
    let selector = currentElem.tagName.toLowerCase();
    
    if (currentElem.id) {
      selector += '#' + currentElem.id;
    } else if (currentElem.className) {
      selector += '.' + currentElem.className.replace(/\s+/g, '.');
    } else {
      // 몇 번째 자식인지 인덱스를 추가
      const parent = currentElem.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(currentElem) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    currentElem = currentElem.parentElement;
  }
  
  return path.join(' > ');
};

const DualSubtitles: React.FC<DualSubtitlesProps> = ({ style, source = 'dom' }) => {
  console.log('[DualSubtitles] Component RENDERING/MOUNTING'); // 컴포넌트 함수 시작 부분에 추가
  const { 
    koreanSubtitle,
    englishSubtitle,
    displayMode,
    setKoreanSubtitle,
    setEnglishSubtitle
  } = useSubtitleStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSettings, setCurrentSettings] = useState<SubtitleSettings | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log('[DualSubtitles] Settings useEffect RUNNING'); // useEffect 시작 부분에 추가
    const fetchSettings = async () => {
      const settingsResult: { subtitleSettings?: SubtitleSettings } = await new Promise(resolve => {
        chrome.storage.sync.get('subtitleSettings', data => resolve(data as { subtitleSettings?: SubtitleSettings }));
      });
      if (settingsResult.subtitleSettings) {
        setCurrentSettings(settingsResult.subtitleSettings);
      } else {
        setCurrentSettings({
          enabled: true,
          primaryLanguage: 'ko',
          secondaryLanguage: 'en',
          fontSize: 16,
          position: 80, // 80% from top (near bottom)
          opacity: 0.9
        });
      }
    };
    fetchSettings();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'sync' && changes.subtitleSettings) {
        setCurrentSettings(changes.subtitleSettings.newValue as SubtitleSettings);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);
  
  const renderSubtitleInternal = useCallback((
    container: HTMLElement, 
    text: string, 
    styleProps: React.CSSProperties,
    language: 'ko' | 'en' = 'ko' // 언어 추가
  ) => {
    const element = document.createElement('div');
    element.className = `play-learneng-subtitle-text play-learneng-subtitle-${language}`; // 언어 클래스 추가
    element.textContent = text;
    
    Object.assign(element.style, {
      padding: '4px 10px',
      maxWidth: '90%',
      textAlign: 'center',
      lineHeight: '1.4',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8)',
      pointerEvents: 'auto',
      cursor: 'pointer',
      userSelect: 'none', // 텍스트 선택 방지
      borderRadius: '4px',
      transition: 'all 0.2s ease',
      ...styleProps
    });
    
    // 호버 효과 추가
    element.onmouseenter = () => {
      element.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
      element.style.transform = 'scale(1.02)';
      // 도움말 툴팁 추가
      element.title = '클릭하여 리뷰에 저장';
    };
    
    element.onmouseleave = () => {
      element.style.backgroundColor = 'transparent';
      element.style.transform = 'scale(1)';
    };
    
    // 클릭 효과 추가
    element.onmousedown = () => {
      element.style.transform = 'scale(0.98)';
      element.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
    };
    
    element.onmouseup = () => {
      element.style.transform = 'scale(1.02)';
    };

    element.onclick = async (e) => {
      e.stopPropagation(); // 이벤트 버블링 방지
      e.preventDefault(); // 기본 동작 방지
      
      console.log('[DualSubtitles] Subtitle clicked:', text);
      
      console.log('클릭한 요소 정보:', {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent,
        path: getPathToElement(element)
      });

      // 클릭된 자막 텍스트 직접 사용
      const subtitleText = text;
      const isKorean = element.className.includes('subtitle-ko');
      const isEnglish = element.className.includes('subtitle-en');
      
      // 현재 자막 데이터 (두 언어 모두)
      const currentKoreanText = isKorean ? subtitleText : koreanSubtitle;
      const currentEnglishText = isEnglish ? subtitleText : englishSubtitle;
      
      if (!currentKoreanText && !currentEnglishText) {
        console.warn('[DualSubtitles] No subtitle text found to save.');
        setFeedbackMessage('저장할 자막을 찾을 수 없습니다.');
        return;
      }

      try {
        // 언어 설정에 따라 주/부 자막 결정
        const primaryText = currentSettings?.primaryLanguage === 'ko' ? currentKoreanText : currentEnglishText;
        const secondaryText = currentSettings?.primaryLanguage === 'ko' ? currentEnglishText : currentKoreanText;

        // 고유 ID 생성
        const uniqueId = `subtitle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const reviewSubtitle: SavedSubtitle = { // Explicitly type here
          id: uniqueId,
          primaryText: primaryText || '',
          secondaryText: secondaryText || '',
        };
        
        console.log('[DualSubtitles] Saving subtitle directly to storage:', reviewSubtitle);
        
        // Storage API를 직접 사용하여 저장
        chrome.storage.sync.get(['savedSubtitles'], (data) => {
          const savedSubtitles = data.savedSubtitles || [];
          savedSubtitles.unshift(reviewSubtitle); // 배열 앞에 추가
          
          chrome.storage.sync.set({ savedSubtitles }, () => {
            if (chrome.runtime.lastError) {
              console.error('[DualSubtitles] Storage error:', chrome.runtime.lastError);
              setFeedbackMessage('자막 저장 중 오류가 발생했습니다.');
            } else {
              console.log('[DualSubtitles] Subtitle saved to storage successfully');
              // 저장된 자막 일부를 피드백 메시지에 포함
              const shortPrimaryText = primaryText ? (primaryText.substring(0, 15) + (primaryText.length > 15 ? '...' : '')) : "";
              setFeedbackMessage(`"${shortPrimaryText}" 자막이 단어장에 저장되었습니다!`);
              
              // 백그라운드에도 알림 (선택사항)
              try {
                chrome.runtime.sendMessage({ 
                  type: 'SUBTITLE_SAVED_TO_STORAGE',
                  payload: reviewSubtitle 
                });
              } catch (err) {
                console.log('[DualSubtitles] Failed to notify background, but storage succeeded:', err);
              }
              
              // 2초 후 피드백 메시지 숨기기
              setTimeout(() => {
                setFeedbackMessage(null);
              }, 2000);
            }
          });
        });
      } catch (error) {
        console.error('[DualSubtitles] Error in click handler:', error);
        setFeedbackMessage('오류가 발생했습니다. 다시 시도해주세요.');
      }
    };
    
    container.appendChild(element);
  }, [currentSettings]);

  const updateSubtitles = useCallback(() => {
    let container = containerRef.current;
    console.log('[DualSubtitles] updateSubtitles CALLED. Initial currentSettings:', JSON.stringify(currentSettings)); // 이 로그는 유지
    console.log('[DualSubtitles] updateSubtitles CALLED. displayMode from store:', displayMode);

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
      container.style.pointerEvents = 'auto';
      container.style.cursor = 'pointer';
      container.style.padding = '0 20px';
      container.style.boxSizing = 'border-box';
      document.body.appendChild(container);
      if (!containerRef.current) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
      }
    }
    
    container.innerHTML = ''; // Clear existing subtitles
    
    if (!currentSettings) { 
      console.log('[DualSubtitles] currentSettings is NULL, returning.');
      return;
    }

    // Log the crucial values just before the decision logic
    console.log('[DualSubtitles] DECISION POINT. currentSettings.enabled:', currentSettings.enabled, 'Primary Lang:', currentSettings.primaryLanguage);
    console.log('[DualSubtitles] DECISION POINT. koreanSubtitle:', koreanSubtitle ? `"${koreanSubtitle.substring(0,10)}..."` : 'null');
    console.log('[DualSubtitles] DECISION POINT. englishSubtitle:', englishSubtitle ? `"${englishSubtitle.substring(0,10)}..."` : 'null');

    const primaryStyle: React.CSSProperties = {
      color: '#ffffff',
      fontSize: '22px',
      marginBottom: '5px',
      fontWeight: '500'
    };
    const secondaryStyle: React.CSSProperties = {
      color: '#56c7ff',
      fontSize: '22px',
      marginBottom: '0px', // Ensure this is 0px if it's the only one or last one
      fontWeight: '400'
    };

    if (!currentSettings.enabled) {
      // Feature is disabled, show only the primary language subtitle
      console.log('[DualSubtitles] LOGIC: Rendering with enabled: false');
      if (currentSettings.primaryLanguage === 'ko' && koreanSubtitle) {
        console.log('[DualSubtitles] LOGIC: Rendering KO sub as primary');
        renderSubtitleInternal(container, koreanSubtitle, primaryStyle, 'ko');
      } else if (currentSettings.primaryLanguage === 'en' && englishSubtitle) {
        console.log('[DualSubtitles] LOGIC: Rendering EN sub as primary');
        renderSubtitleInternal(container, englishSubtitle, primaryStyle, 'en');
      } else {
        console.log('[DualSubtitles] LOGIC: No primary subtitle to render (lang:', currentSettings.primaryLanguage, 'koSub:', !!koreanSubtitle, 'enSub:', !!englishSubtitle, ')');
      }
    } else {
      // Feature is enabled, use displayMode and settings to determine rendering
      console.log('[DualSubtitles] LOGIC: Rendering with enabled: true, displayMode:', displayMode);
      const isKoreanPrimary = currentSettings.primaryLanguage === 'ko';
      
      const primarySubText = isKoreanPrimary ? koreanSubtitle : englishSubtitle;
      const secondarySubText = isKoreanPrimary ? englishSubtitle : koreanSubtitle;
      
      const primaryLang = isKoreanPrimary ? 'ko' : 'en';
      const secondaryLang = isKoreanPrimary ? 'en' : 'ko';

      let primaryRendered = false;
      // Render primary subtitle
      if ((displayMode === 'dual' || displayMode === 'primary') && primarySubText) {
        renderSubtitleInternal(container, primarySubText, primaryStyle, primaryLang);
        primaryRendered = true;
      }
      
      // Render secondary subtitle
      if ((displayMode === 'dual' || displayMode === 'secondary') && secondarySubText) {
        const styleForSecondary = {...secondaryStyle};
        if (!primaryRendered && displayMode === 'secondary') {
          // If only secondary is shown, adjust its margin to behave like primary
          // Or, alternatively, use primaryStyle if it's the sole subtitle.
          // For now, let's ensure it doesn't have extra top margin if it's alone.
          // The original primary had marginBottom: '5px', secondary had '0'.
          // If secondary is alone, it should not have a differing bottom margin than if primary was alone.
          // Let's keep it simple: primary has bottom margin, secondary doesn't.
          // If secondary is shown alone, it will just have its standard style.
        }
         // Adjust margin for secondary if primary is not rendered (it becomes the "bottom" subtitle)
        const finalSecondaryStyle = {
            ...secondaryStyle,
            marginBottom: primaryRendered ? '0px' : '5px', // Mimic primary's bottom margin if it's the only one
        };
        renderSubtitleInternal(container, secondarySubText, primaryRendered ? secondaryStyle : primaryStyle, secondaryLang);
      }
    }
  }, [displayMode, koreanSubtitle, englishSubtitle, renderSubtitleInternal, currentSettings]);
  
  useEffect(() => {
    console.log('[DualSubtitles] updateSubtitles useEffect RUNNING'); // useEffect 시작 부분에 추가
    updateSubtitles();
    
    return () => {
      const container = containerRef.current;
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [updateSubtitles]);
  
  // 피드백 메시지 표시
  useEffect(() => {
    if (!feedbackMessage) return;        // 피드백 메시지 표시 엘리먼트 생성
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'play-learneng-feedback';
    
    // 기존 피드백 제거 (중복 방지)
    const existingFeedback = document.getElementById('play-learneng-feedback');
    if (existingFeedback && existingFeedback.parentNode) {
      existingFeedback.parentNode.removeChild(existingFeedback);
    }
    
    // 피드백 메시지에 아이콘 추가
    const isSuccess = feedbackMessage.includes('저장되었습니다');
    feedbackElement.innerHTML = `
      <span style="margin-right: 8px">${isSuccess ? '✅' : '⚠️'}</span>
      <span>${feedbackMessage}</span>
    `;
    
    // 스타일 적용
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
    
    // 애니메이션 효과
    setTimeout(() => {
      feedbackElement.style.opacity = '1';
    }, 10);
    
    // 일정 시간 후 제거
    setTimeout(() => {
      feedbackElement.style.opacity = '0';
      setTimeout(() => {
        if (feedbackElement && feedbackElement.parentNode) {
          feedbackElement.parentNode.removeChild(feedbackElement);
        }
      }, 300);
    }, 2000);
    
  }, [feedbackMessage]);
  
  useEffect(() => {
    if (source === 'vtt') {
      const detectAndExtractSubtitles = () => {
        // ...
      };
      
      const interval = setInterval(detectAndExtractSubtitles, 500);
      return () => clearInterval(interval);
    }
  }, [source]);

  return null; 
};

export default DualSubtitles;
