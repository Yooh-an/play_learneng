import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSubtitleStore from '../../store/subtitleStore';

interface DualSubtitlesProps {
  style?: React.CSSProperties;
  source?: 'dom' | 'vtt';
}

interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: 'bottom' | 'top';
  opacity: number;
}

interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
}

const DualSubtitles: React.FC<DualSubtitlesProps> = ({ style, source = 'dom' }) => {
  const { 
    koreanSubtitle,
    englishSubtitle,
    displayMode,
    setKoreanSubtitle,
    setEnglishSubtitle
  } = useSubtitleStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSettings, setCurrentSettings] = useState<SubtitleSettings | null>(null);

  useEffect(() => {
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
          position: 'bottom',
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
    styleProps: React.CSSProperties
  ) => {
    const element = document.createElement('div');
    element.className = 'play-learneng-subtitle-text';
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
      userSelect: 'none', // Prevent text selection
      ...styleProps
    });

    element.onclick = async () => {
      console.error('!!! DUALSUBTITLES ONCLICK FIRED !!! Subtitle clicked:', text); // MODIFIED FOR VISIBILITY
      const { koreanSubtitle, englishSubtitle } = useSubtitleStore.getState();
      const currentKoreanText = koreanSubtitle;
      const currentEnglishText = englishSubtitle;
      console.log('[DualSubtitles] Current subtitles from store:', { currentKoreanText, currentEnglishText });

      if (!currentKoreanText && !currentEnglishText) {
        console.warn('[DualSubtitles] No subtitle text found to save.');
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({ type: 'LE_GET_CURRENT_TIME' });
        console.log('[DualSubtitles] Received timestamp response:', response);
        if (chrome.runtime.lastError) {
          console.error('[DualSubtitles] Error getting current time:', chrome.runtime.lastError.message);
          return;
        }
        const timestamp = response?.currentTime;
        if (typeof timestamp !== 'number') {
          console.error('[DualSubtitles] Invalid timestamp received:', timestamp);
          return;
        }

        const primaryText = currentSettings?.primaryLanguage === 'ko' ? currentKoreanText : currentEnglishText;
        const secondaryText = currentSettings?.primaryLanguage === 'ko' ? currentEnglishText : currentKoreanText;

        const reviewSubtitle: Omit<SavedSubtitle, 'id' | 'episodeTitle'> = {
          primaryText: primaryText || '',
          secondaryText: secondaryText || '',
          timestamp,
        };
        console.log('[DualSubtitles] Sending review subtitle to background:', reviewSubtitle);
        chrome.runtime.sendMessage({ type: 'ADD_REVIEW_SUBTITLE', payload: reviewSubtitle }, (bgResponse) => {
          if (chrome.runtime.lastError) {
            console.error('[DualSubtitles] Error sending to background:', chrome.runtime.lastError.message);
          } else {
            console.log('[DualSubtitles] Background script response:', bgResponse);
          }
        });
      } catch (error) {
        console.error('[DualSubtitles] Error in handleClick:', error);
      }
    };
    
    container.appendChild(element);
  }, [currentSettings]);

  const updateSubtitles = useCallback(() => {
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
      if (!containerRef.current) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
      }
    }
    
    container.innerHTML = '';
    
    if ((displayMode === 'dual' || displayMode === 'primary') && koreanSubtitle) {
      renderSubtitleInternal(container, koreanSubtitle, {
        color: '#ffffff',
        fontSize: '20px',
        marginBottom: '5px',
        fontWeight: '500'
      });
    }
    
    if ((displayMode === 'dual' || displayMode === 'secondary') && englishSubtitle) {
      renderSubtitleInternal(container, englishSubtitle, {
        color: '#56c7ff',
        fontSize: '18px',
        marginBottom: '0',
        fontWeight: '400'
      });
    }
  }, [displayMode, koreanSubtitle, englishSubtitle, renderSubtitleInternal]);
  
  useEffect(() => {
    updateSubtitles();
    
    return () => {
      const container = containerRef.current;
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [updateSubtitles]);
  
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
