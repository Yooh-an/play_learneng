import React, { useEffect, useState, useCallback } from 'react'; // useCallback 추가
import SubtitleObserver, { SubtitleChangeListener } from '../../content/observers/SubtitleObserver';
import useSubtitleStore, { ActiveSubtitle } from '../../store/subtitleStore';
import { v4 as uuidv4 } from 'uuid';
import vttSubtitleManager from '../../services/subtitles/vttSubtitleService';

interface PlayerControllerProps {
  videoElement: HTMLVideoElement;
  subtitleContainer: Element;
  videoInfo: {
    title: string;
    episodeInfo: string;
    videoId: string;
  };
}

// Define the structure of subtitleSettings (aligned with popup.tsx)
interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: 'bottom' | 'top';
  opacity: number;
}

const PlayerController: React.FC<PlayerControllerProps> = ({ 
  videoElement, 
  subtitleContainer, 
  videoInfo 
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(!videoElement.paused);
  const [currentTime, setCurrentTime] = useState<number>(videoElement.currentTime);
  const [duration, setDuration] = useState<number>(videoElement.duration);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  
  const { 
    setActiveSubtitles, 
    setIsPlaying: setStoreIsPlaying,
    setCurrentVideo,
    displayMode, 
    setDisplayMode,
    saveSubtitle,
    primaryLanguage,
    secondaryLanguage,
    activeSubtitles,
    subtitleSync,
    adjustSubtitleSync
  } = useSubtitleStore();
  
  // Fetch initial subtitle settings and listen for changes
  useEffect(() => {
    const fetchSettings = () => {
      chrome.storage.sync.get('subtitleSettings', (data) => {
        if (chrome.runtime.lastError) {
          console.error('[PlayerController] Error fetching subtitleSettings:', chrome.runtime.lastError.message);
          return;
        }
        if (data.subtitleSettings) {
          console.log('[PlayerController] Fetched subtitleSettings:', data.subtitleSettings);
          setSubtitleSettings(data.subtitleSettings);
        } else {
          // Initialize with default settings if not found
          const defaultSettings: SubtitleSettings = {
            enabled: true,
            primaryLanguage: 'ko',
            secondaryLanguage: 'en',
            fontSize: 20,
            position: 'bottom',
            opacity: 0.9,
          };
          console.log('[PlayerController] No subtitleSettings found, initializing with default:', defaultSettings);
          setSubtitleSettings(defaultSettings);
          chrome.storage.sync.set({ subtitleSettings: defaultSettings }, () => {
            if (chrome.runtime.lastError) {
              console.error('[PlayerController] Error saving default subtitleSettings:', chrome.runtime.lastError.message);
            }
          });
        }
      });
    };

    fetchSettings();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'sync' && changes.subtitleSettings) {
        console.log('[PlayerController] subtitleSettings changed:', changes.subtitleSettings.newValue);
        setSubtitleSettings(changes.subtitleSettings.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 비디오 정보 설정 (videoInfo 객체 자체를 의존성으로)
  useEffect(() => {
    if (videoInfo && videoInfo.videoId && videoInfo.title) {
      console.log('[PlayerController] videoInfo updated:', videoInfo);
      setCurrentVideo(videoInfo.videoId, videoInfo.title);
    } else {
      console.warn('[PlayerController] videoInfo is incomplete:', videoInfo);
    }
  }, [videoInfo, setCurrentVideo]);
  
  // 비디오 기본 이벤트 리스너 설정 (마운트 시 한 번만)
  useEffect(() => {
    const handlePlay = () => {
      setIsPlaying(true);
      setStoreIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      setStoreIsPlaying(false);
    };
    const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
    const handleDurationChange = () => setDuration(videoElement.duration);
    
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    
    setIsPlaying(!videoElement.paused);
    setStoreIsPlaying(!videoElement.paused);
    setCurrentTime(videoElement.currentTime);
    if (videoElement.duration && !isNaN(videoElement.duration)) {
      setDuration(videoElement.duration);
    }
    
    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
    };
  }, [videoElement, setStoreIsPlaying]);

  // DOM 자막 및 VTT 초기화 (마운트 시 한 번만)
  useEffect(() => {
    console.log('[PlayerController] Initializing subtitle systems...');
    let lastDomSubtitle = ''; // DOM 자막 처리를 위한 내부 상태

    const domSubtitleListener: SubtitleChangeListener = {
      onSubtitleChanged: (subtitles) => {
        console.log('[PlayerController] DOM subtitles detected:', subtitles);
        if (subtitles.length > 0) {
          const validSubtitles = subtitles.filter(sub => {
            const text = sub.text.trim();
            return text && text !== 'Play Video' && text !== '재생' && text !== '일시정지' && !text.includes('paused') && !text.includes('loading') && text.length > 1;
          });
          if (validSubtitles.length === 0) return;

          // Skip if subtitleSettings not loaded yet
          if (!subtitleSettings) {
            console.log('[PlayerController] subtitleSettings not loaded yet, skipping DOM subtitle processing');
            return;
          }

          let primaryText = '';
          let secondaryText = '';
          const koreanSubtitles = validSubtitles.filter(sub => (sub as any).element?.className?.includes('ko') || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(sub.text));
          const englishSubtitles = validSubtitles.filter(sub => (sub as any).element?.className?.includes('en') || /^[a-zA-Z\s.,!?'"-]+$/.test(sub.text));

          // Map subtitles based on both primary and secondary language settings
          if (subtitleSettings.primaryLanguage === 'ko') {
            primaryText = koreanSubtitles[0]?.text || '';
          } else {
            primaryText = englishSubtitles[0]?.text || '';
          }
          
          if (subtitleSettings.secondaryLanguage === 'ko') {
            secondaryText = koreanSubtitles[0]?.text || '';
          } else {
            secondaryText = englishSubtitles[0]?.text || '';
          }
          if (!primaryText && !secondaryText && validSubtitles[0]) primaryText = validSubtitles[0].text;
          
          lastDomSubtitle = primaryText;

          const currentVttCues = vttSubtitleManager.getActiveSubtitles(videoElement.currentTime, subtitleSync);
          if (!currentVttCues.primary?.text && !currentVttCues.secondary?.text) {
            const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
            if (currentActiveStoreSubtitles?.primaryText !== primaryText || currentActiveStoreSubtitles?.secondaryText !== secondaryText) {
              console.log('[PlayerController] Setting DOM subtitles as active (VTT not present):', { primaryText, secondaryText });
              setActiveSubtitles({ primaryText, secondaryText, timestamp: videoElement.currentTime });
            }
          }
        }
      },
      onSubtitleCleared: () => {
        const currentVttCues = vttSubtitleManager.getActiveSubtitles(videoElement.currentTime, subtitleSync);
        if (!currentVttCues.primary?.text && !currentVttCues.secondary?.text) {
          console.log('[PlayerController] DOM subtitles cleared, and no VTT. Clearing active subtitles.');
          setActiveSubtitles(null);
        }
        lastDomSubtitle = '';
      }
    };

    const domObserver = new SubtitleObserver(videoElement, subtitleContainer);
    domObserver.addListener(domSubtitleListener);
    domObserver.start();
    
    vttSubtitleManager.start();
    console.log('[Content Script] PlayerController mounted, VTTManager ready. Sending CONTENT_SCRIPT_READY to background.');
    chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" })
      .then(response => {
        if (chrome.runtime.lastError) {
          console.warn('[Content Script] Error sending/receiving ack for CONTENT_SCRIPT_READY:', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          console.log('[Content Script] Background acknowledged CONTENT_SCRIPT_READY message.');
        } else {
          console.warn('[Content Script] Background did not acknowledge CONTENT_SCRIPT_READY or sent unexpected response:', response);
        }
      })
      .catch(error => console.error('[Content Script] Failed to send CONTENT_SCRIPT_READY message:', error));

    const vttListener = {
      onSubtitleLoaded: (loadedSubtitle: import('../../services/subtitles/vttSubtitleService').CapturedSubtitle) => { 
        console.log(`[PlayerController] VTT subtitle file loaded via VTTManager listener: ${loadedSubtitle.url}, lang: ${loadedSubtitle.language}`);
        
        // Skip if subtitleSettings not loaded yet
        if (!subtitleSettings) {
          console.log('[PlayerController] subtitleSettings not loaded yet, skipping VTT processing');
          return;
        }
        
        const currentTime = videoElement.currentTime;
        const vttCues = vttSubtitleManager.getActiveSubtitles(currentTime, subtitleSync);
        let primaryText = '';
        let secondaryText = '';

        const vttManagerPrimaryText = vttCues.primary?.text || '';
        const vttManagerSecondaryText = vttCues.secondary?.text || '';

        // Map VTT cues based on both primary and secondary language settings
        if (subtitleSettings.primaryLanguage === 'ko') { 
            primaryText = vttManagerPrimaryText; 
        } else { 
            primaryText = vttManagerSecondaryText; 
        }
        
        if (subtitleSettings.secondaryLanguage === 'ko') { 
            secondaryText = vttManagerPrimaryText; 
        } else { 
            secondaryText = vttManagerSecondaryText; 
        }
        
        console.log('[PlayerController DEBUG] onSubtitleLoaded - Values before setActiveSubtitles:');
        console.log('[PlayerController DEBUG]   currentTime:', currentTime);
        console.log('[PlayerController DEBUG]   vttCues.primary:', vttCues.primary);
        console.log('[PlayerController DEBUG]   vttCues.secondary:', vttCues.secondary);
        console.log('[PlayerController DEBUG]   vttManagerPrimaryText (detected language):', vttManagerPrimaryText);
        console.log('[PlayerController DEBUG]   vttManagerSecondaryText (detected language):', vttManagerSecondaryText);
        console.log('[PlayerController DEBUG]   primaryLanguage (user setting):', subtitleSettings.primaryLanguage);
        console.log('[PlayerController DEBUG]   primaryText (for display):', primaryText);
        console.log('[PlayerController DEBUG]   secondaryText (for display):', secondaryText);
        console.log('[PlayerController DEBUG]   lastDomSubtitle:', lastDomSubtitle);

        if (primaryText || secondaryText) {
            console.log('[PlayerController] VTT loaded, setting VTT subtitles as active:', { primaryText, secondaryText });
            setActiveSubtitles({ primaryText, secondaryText, timestamp: currentTime });
        } else if (!lastDomSubtitle) { 
            console.log('[PlayerController] VTT loaded, but no VTT text for current time and no lastDomSubtitle. Clearing active subtitles.');
            setActiveSubtitles(null);
        } else {
            console.log('[PlayerController] VTT loaded, but no VTT text for current time. DOM subtitle might be active or will be set by observer.');
        }
      },
      onSubtitleError: (error: Error) => {
        console.error('[PlayerController] VTT subtitle load error via VTTManager listener:', error);
      }
    };
    vttSubtitleManager.addListener(vttListener);
    
    return () => {
      console.log('[PlayerController] Cleaning up subtitle systems...');
      domObserver.removeListener(domSubtitleListener);
      domObserver.stop();
      vttSubtitleManager.removeListener(vttListener);
      vttSubtitleManager.stop();
    };
  }, [videoElement, subtitleContainer, setActiveSubtitles, subtitleSync, subtitleSettings]);

  // VTT 자막 업데이트를 위한 timeupdate 핸들러 및 로직
  useEffect(() => {
    const updateSubtitlesFromVTT = () => {
      // Skip if subtitleSettings not loaded yet
      if (!subtitleSettings) {
        return;
      }
      
      const localCurrentTime = videoElement.currentTime; 
      const vttCues = vttSubtitleManager.getActiveSubtitles(localCurrentTime, subtitleSync);
      
      let vttPrimaryTextForDisplay = '';
      let vttSecondaryTextForDisplay = '';

      const vttManagerPrimaryText = vttCues.primary?.text || '';
      const vttManagerSecondaryText = vttCues.secondary?.text || '';

      // Map VTT cues based on both primary and secondary language settings
      if (subtitleSettings.primaryLanguage === 'ko') {
        vttPrimaryTextForDisplay = vttManagerPrimaryText;
      } else {
        vttPrimaryTextForDisplay = vttManagerSecondaryText;
      }
      
      if (subtitleSettings.secondaryLanguage === 'ko') {
        vttSecondaryTextForDisplay = vttManagerPrimaryText;
      } else {
        vttSecondaryTextForDisplay = vttManagerSecondaryText;
      }
          
      if (vttPrimaryTextForDisplay || vttSecondaryTextForDisplay) {
        const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
        if (currentActiveStoreSubtitles?.primaryText !== vttPrimaryTextForDisplay || currentActiveStoreSubtitles?.secondaryText !== vttSecondaryTextForDisplay) {
          setActiveSubtitles({ primaryText: vttPrimaryTextForDisplay, secondaryText: vttSecondaryTextForDisplay, timestamp: localCurrentTime });
        }
      } 
    };

    let lastUpdateTime = 0;
    const THROTTLE_INTERVAL = 250; 
    const handleSubtitleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_INTERVAL) return;
      lastUpdateTime = now;
      
      updateSubtitlesFromVTT();
    };
    
    videoElement.addEventListener('timeupdate', handleSubtitleTimeUpdate);

    return () => {
      videoElement.removeEventListener('timeupdate', handleSubtitleTimeUpdate);
    };
  }, [videoElement, setActiveSubtitles, subtitleSync, subtitleSettings]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const tryLoadAlternativeSubtitles = useCallback(async () => {
    if (!videoInfo.videoId) {
      console.warn('[PlayerController] videoId is not available for tryLoadAlternativeSubtitles.');
      return;
    }
    console.log('다른 언어 자막 파일 강제 요청 시도 중...');
    const videoId = videoInfo.videoId; 
    const subtitlePatterns = ['ko', 'en', 'korean', 'english', 'ko-KR', 'en-US', 'kor', 'eng'];
    const attemptedUrls = new Set<string>();
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('.vtt') && entry.name.includes('subtitle')) {
          const originalUrl = entry.name;
          
          for (const lang of subtitlePatterns) {
            const alternativeUrls = [
              originalUrl.replace(/ko/g, lang).replace(/korean/g, lang),
              originalUrl.replace(/en/g, lang).replace(/english/g, lang),
              originalUrl.replace(/-ko/g, `-${lang}`).replace(/-en/g, `-${lang}`),
              originalUrl.replace(/\.ko\./g, `.${lang}.`).replace(/\.en\./g, `.${lang}.`)
            ];
            
            for (const altUrl of alternativeUrls) {
              if (altUrl !== originalUrl && !attemptedUrls.has(altUrl)) {
                attemptedUrls.add(altUrl);
                fetch(altUrl)
                  .then(response => {
                    if (response.ok) return response.text();
                    throw new Error(`HTTP ${response.status}`);
                  })
                  .then(content => { /* console.log(`대안 자막 내용 로드 완료: ${altUrl.substring(0, 100)}...`) */ })
                  .catch(error => { /* console.log(`대안 자막 로드 실패: ${altUrl} - ${error.message}`) */ });
              }
            }
          }
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['resource'] });
      setTimeout(() => {
        observer.disconnect();
      }, 10000);
    } catch (error) {
      console.warn('PerformanceObserver 지원되지 않음:', error);
      const basePatterns = [
        `/subtitle/${videoId}/ko.vtt`, `/subtitle/${videoId}/en.vtt`,
        `/subtitles/${videoId}-ko.vtt`, `/subtitles/${videoId}-en.vtt`,
        `/api/subtitle/${videoId}/korean.vtt`, `/api/subtitle/${videoId}/english.vtt`
      ];
      for (const pattern of basePatterns) {
        const testUrl = window.location.origin + pattern;
        fetch(testUrl)
          .then(response => {
            if (response.ok) return response.text();
            throw new Error(`HTTP ${response.status}`);
          })
          .then(content => { /* console.log(`직접 요청 자막 내용 로드 완료: ${testUrl}`) */ })
          .catch(error => { /* console.log(`직접 요청 자막 로드 실패: ${testUrl} - ${error.message}`) */ });
      }
    }
  }, [videoInfo.videoId]);
  
  useEffect(() => {
    if (videoInfo.videoId) {
      // tryLoadAlternativeSubtitles(); 
    }
  }, [videoInfo.videoId, tryLoadAlternativeSubtitles]);

  const toggleDisplayMode = () => {
    const modes: Array<'primary' | 'secondary' | 'dual'> = ['primary', 'secondary', 'dual'];
    const currentIndex = modes.indexOf(displayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setDisplayMode(modes[nextIndex]);
  };
  
  const handleSaveSubtitle = () => {
    const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles; 
    if (currentActiveStoreSubtitles && videoInfo.videoId) {
      saveSubtitle({
        id: uuidv4(),
        primaryText: currentActiveStoreSubtitles.primaryText,
        secondaryText: currentActiveStoreSubtitles.secondaryText,
        startTime: videoElement.currentTime,
        videoId: videoInfo.videoId,
        savedAt: new Date().toISOString()
      });
      alert('자막이 저장되었습니다.');
    } else {
      alert('저장할 자막이 없거나 비디오 정보가 부족합니다.');
    }
  };
  
  const renderDualSubtitles = useCallback((subtitle: ActiveSubtitle) => {
    let container = document.getElementById('play-learneng-subtitle-container');
    if (!container) {
      const videoContainer = document.querySelector('.video-js') || 
                           document.querySelector('[id*="player"]') || 
                           document.querySelector('.player-container');
      if (videoContainer) {
        container = document.createElement('div');
        container.id = 'play-learneng-subtitle-container';
        container.style.cssText = `
          position: absolute; bottom: 70px; left: 0; right: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 100%; z-index: 9999; pointer-events: none; padding: 0 30px; box-sizing: border-box;
        `;
        videoContainer.appendChild(container);
      } else {
        console.warn('비디오 컨테이너를 찾을 수 없어 자막을 표시할 수 없습니다.');
        return;
      }
    }
    container.innerHTML = ''; // Always clear previous subtitles

    // If subtitle settings are not loaded yet, don't render anything.
    if (!subtitleSettings) {
      console.log('[PlayerController] Subtitle settings not yet loaded. Not rendering subtitles.');
      return;
    }

    const primaryTextToDisplay = subtitle.primaryText;
    const secondaryTextToDisplay = subtitle.secondaryText;

    // Get language preferences from subtitleSettings
    const primaryLang = subtitleSettings.primaryLanguage;
    const secondaryLang = subtitleSettings.secondaryLanguage;

    // Logic for displaying primary subtitle
    if (primaryTextToDisplay) {
      // Show primary if:
      // 1. Master toggle is OFF (!subtitleSettings.enabled) - always show primary in this case.
      // OR
      // 2. Master toggle is ON (subtitleSettings.enabled) AND displayMode allows primary ('primary' or 'dual').
      if (!subtitleSettings.enabled || 
          (subtitleSettings.enabled && (displayMode === 'primary' || displayMode === 'dual'))) {
        const primaryElement = document.createElement('div');
        primaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${primaryLang}`;
        primaryElement.textContent = primaryTextToDisplay;
        primaryElement.style.cssText = `
          color: ${primaryLang === 'ko' ? '#ffffff' : '#56c7ff'};
          padding: 4px 10px; margin-bottom: 5px;
          font-size: 20px; font-weight: 500; max-width: 90%;
          text-align: center; line-height: 1.4; white-space: pre-wrap;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
        container.appendChild(primaryElement);
      }
    }
    
    // Logic for displaying secondary subtitle
    // Show secondary ONLY if:
    // 1. Master toggle is ON (subtitleSettings.enabled)
    // AND
    // 2. displayMode allows secondary ('secondary' or 'dual')
    // AND
    // 3. There is secondary text to display.
    if (subtitleSettings.enabled && 
        (displayMode === 'secondary' || displayMode === 'dual') && 
        secondaryTextToDisplay) {
      const secondaryElement = document.createElement('div');
      secondaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${secondaryLang}`;
      secondaryElement.textContent = secondaryTextToDisplay;
      secondaryElement.style.cssText = `
        color: ${secondaryLang === 'en' ? '#56c7ff' : '#ffffff'};
        padding: 4px 10px;
        font-size: 18px; font-weight: 400; max-width: 90%;
        text-align: center; line-height: 1.4; white-space: pre-wrap; margin-bottom: 0;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
      `;
      container.appendChild(secondaryElement);
    }
  }, [displayMode, subtitleSettings]);

  useEffect(() => {
    const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
    if (currentActiveStoreSubtitles) {
      renderDualSubtitles(currentActiveStoreSubtitles);
    } else {
      // Clear subtitles if no active ones
      let container = document.getElementById('play-learneng-subtitle-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  }, [activeSubtitles, displayMode, renderDualSubtitles, subtitleSettings]); 

  const togglePlayPause = () => {
    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
  };

  return null; // PlayerController is a controller, not a UI component itself
};

export default PlayerController;
