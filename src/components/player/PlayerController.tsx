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
      videoElement.removeEventListener('timeupdate', handleTimeUpdate); // 이 timeupdate는 UI용, 자막용은 별도
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

          let primaryText = '';
          let secondaryText = '';
          const koreanSubtitles = validSubtitles.filter(sub => (sub as any).element?.className?.includes('ko') || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(sub.text));
          const englishSubtitles = validSubtitles.filter(sub => (sub as any).element?.className?.includes('en') || /^[a-zA-Z\s.,!?'"-]+$/.test(sub.text));

          if (primaryLanguage === 'ko') {
            primaryText = koreanSubtitles[0]?.text || '';
            secondaryText = englishSubtitles[0]?.text || '';
          } else {
            primaryText = englishSubtitles[0]?.text || '';
            secondaryText = koreanSubtitles[0]?.text || '';
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
        const currentTime = videoElement.currentTime;
        const vttCues = vttSubtitleManager.getActiveSubtitles(currentTime, subtitleSync);
        let primaryText = '';
        let secondaryText = '';

        const vttManagerPrimaryText = vttCues.primary?.text || '';
        const vttManagerSecondaryText = vttCues.secondary?.text || '';

        if (primaryLanguage === 'ko') { 
            primaryText = vttManagerPrimaryText; 
            secondaryText = vttManagerSecondaryText; 
        } else { 
            primaryText = vttManagerSecondaryText; 
            secondaryText = vttManagerPrimaryText; 
        }
        
        // 디버깅 로그 추가
        console.log('[PlayerController DEBUG] onSubtitleLoaded - Values before setActiveSubtitles:');
        console.log('[PlayerController DEBUG]   currentTime:', currentTime);
        console.log('[PlayerController DEBUG]   vttCues.primary:', vttCues.primary);
        console.log('[PlayerController DEBUG]   vttCues.secondary:', vttCues.secondary);
        console.log('[PlayerController DEBUG]   vttManagerPrimaryText (detected language):', vttManagerPrimaryText);
        console.log('[PlayerController DEBUG]   vttManagerSecondaryText (detected language):', vttManagerSecondaryText);
        console.log('[PlayerController DEBUG]   primaryLanguage (user setting):', primaryLanguage);
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
  }, [videoElement, subtitleContainer, primaryLanguage, secondaryLanguage, setActiveSubtitles, subtitleSync]);

  // VTT 자막 업데이트를 위한 timeupdate 핸들러 및 로직
  useEffect(() => {
    const updateSubtitlesFromVTT = () => {
      const localCurrentTime = videoElement.currentTime; 
      const vttCues = vttSubtitleManager.getActiveSubtitles(localCurrentTime, subtitleSync);
      
      let vttPrimaryTextForDisplay = '';
      let vttSecondaryTextForDisplay = '';

      const vttManagerPrimaryText = vttCues.primary?.text || '';
      const vttManagerSecondaryText = vttCues.secondary?.text || '';

      if (primaryLanguage === 'ko') {
        vttPrimaryTextForDisplay = vttManagerPrimaryText;
        vttSecondaryTextForDisplay = vttManagerSecondaryText;
      } else {
        vttPrimaryTextForDisplay = vttManagerSecondaryText; 
        vttSecondaryTextForDisplay = vttManagerPrimaryText;
      }
          
      if (vttPrimaryTextForDisplay || vttSecondaryTextForDisplay) {
        const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
        if (currentActiveStoreSubtitles?.primaryText !== vttPrimaryTextForDisplay || currentActiveStoreSubtitles?.secondaryText !== vttSecondaryTextForDisplay) {
          // console.log('[PlayerController] Setting VTT subtitles as active (timeupdate):', { primaryText: vttPrimaryTextForDisplay, secondaryText: vttSecondaryTextForDisplay });
          setActiveSubtitles({ primaryText: vttPrimaryTextForDisplay, secondaryText: vttSecondaryTextForDisplay, timestamp: localCurrentTime });
        }
      } else {
        // VTT 자막이 현재 시간에 없을 때, DOM 자막도 없다면 (domObserver가 onSubtitleCleared를 호출하기 전일 수 있음)
        // 명시적으로 activeSubtitles를 null로 설정하여 이전 VTT 자막이 남아있는 것을 방지.
        const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
        if (currentActiveStoreSubtitles && (currentActiveStoreSubtitles.primaryText || currentActiveStoreSubtitles.secondaryText)) {
            // 만약 DOM 자막도 없다면 (lastDomSubtitle을 여기서 직접 참조하기는 어려움)
            // 이전에 VTT 자막이 있다가 사라진 경우, 그리고 DOM 자막도 없다면 명시적으로 null 처리.
            // 이 부분은 domObserver의 onSubtitleCleared와 타이밍 이슈가 있을 수 있으므로,
            // 좀 더 견고하게 하려면 domObserver의 상태도 고려해야 함.
            // 우선은, VTT가 없고, 이전에 activeSubtitles가 있었다면 null로 설정.
            // 단, 이로 인해 DOM 자막이 잠깐 사라졌다 다시 나타나는 깜빡임이 생길 수 있음.
            // console.log('[PlayerController] No VTT at current time (timeupdate), and previous active subtitles existed. Clearing active subtitles.');
            // setActiveSubtitles(null); // 이 부분은 DOM 자막과의 상호작용을 고려하여 신중하게 결정해야 함. 주석 처리.
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
  }, [videoElement, setActiveSubtitles, primaryLanguage, secondaryLanguage, subtitleSync]);

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
    container.innerHTML = '';

    let primaryDisplay = subtitle.primaryText;
    let secondaryDisplay = subtitle.secondaryText;

    if (displayMode === 'dual' || displayMode === 'primary') {
      if (primaryDisplay) {
        const primaryElement = document.createElement('div');
        primaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${primaryLanguage}`;
        primaryElement.textContent = primaryDisplay;
        primaryElement.style.cssText = `
          color: ${primaryLanguage === 'ko' ? '#ffffff' : '#56c7ff'};
          padding: 4px 10px; margin-bottom: 5px;
          font-size: 20px; font-weight: 500; max-width: 90%;
          text-align: center; line-height: 1.4; white-space: pre-wrap;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
        container.appendChild(primaryElement);
      }
    }
    
    if (displayMode === 'dual' || displayMode === 'secondary') {
      if (secondaryDisplay) {
        const secondaryElement = document.createElement('div');
        secondaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${secondaryLanguage}`;
        secondaryElement.textContent = secondaryDisplay;
        secondaryElement.style.cssText = `
          color: ${secondaryLanguage === 'en' ? '#56c7ff' : '#ffffff'};
          padding: 4px 10px;
          font-size: 18px; font-weight: 400; max-width: 90%;
          text-align: center; line-height: 1.4; white-space: pre-wrap; margin-bottom: 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8), 1px -1px 2px rgba(0, 0, 0, 0.8), -1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
        container.appendChild(secondaryElement);
      }
    }
  }, [displayMode, primaryLanguage, secondaryLanguage]);

  useEffect(() => {
    const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles; 
    if (showSubtitles && currentActiveStoreSubtitles) {
      renderDualSubtitles(currentActiveStoreSubtitles);
    } else {
      const container = document.getElementById('play-learneng-subtitle-container');
      if (container) container.innerHTML = '';
    }
  }, [showSubtitles, activeSubtitles, displayMode, renderDualSubtitles]); 
  
  return (
    <>
      <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2">
        <div className={`p-3 bg-white rounded shadow-lg transition-opacity ${isVisible ? 'opacity-100' : 'opacity-40'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-blue-600">Play LearnEng</h3>
            <button 
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition"
              onClick={() => setIsVisible(!isVisible)}
            >
              {isVisible ? '접기' : '펼치기'}
            </button>
          </div>
          
          {isVisible && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="text-xs">
                <p className="font-semibold truncate max-w-[200px]" title={videoInfo.title || '제목 없음'}>
                  {videoInfo.title || '제목 없음'}
                </p>
                {videoInfo.episodeInfo && (
                  <p className="text-gray-500 truncate max-w-[200px]" title={videoInfo.episodeInfo}>
                    {videoInfo.episodeInfo}
                  </p>
                )}
              </div>
              
              <div className="text-xs text-gray-700">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              <div className="flex flex-wrap gap-1">
                <button 
                  className={`px-2 py-1 ${displayMode === 'dual' ? 'bg-blue-500 text-white' : 'bg-gray-200'} text-xs rounded hover:bg-blue-600 hover:text-white transition`}
                  onClick={toggleDisplayMode}
                >
                  {displayMode === 'primary' ? `주: ${primaryLanguage.toUpperCase()}` : 
                   displayMode === 'secondary' ? `보조: ${secondaryLanguage.toUpperCase()}` : '이중 자막'}
                </button>
                <button 
                  className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300 transition"
                  onClick={() => setShowSubtitles(!showSubtitles)}
                >
                  {showSubtitles ? '자막 숨기기' : '자막 보기'}
                </button>
                <button 
                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition"
                  onClick={handleSaveSubtitle}
                  disabled={!useSubtitleStore.getState().activeSubtitles || !videoInfo.videoId}
                >
                  자막 저장
                </button>
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300 transition"
                    onClick={() => adjustSubtitleSync(-0.5)}
                    title="자막 0.5초 앞으로"
                  >
                    -0.5s
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300 transition"
                    onClick={() => adjustSubtitleSync(-0.1)}
                    title="자막 0.1초 앞으로"
                  >
                    -0.1s
                  </button>
                  <span className="text-xs px-2 bg-gray-100 rounded">
                    싱크: {subtitleSync > 0 ? '+' : ''}{subtitleSync.toFixed(1)}s
                  </span>
                  <button
                    className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300 transition"
                    onClick={() => adjustSubtitleSync(0.1)}
                    title="자막 0.1초 뒤로"
                  >
                    +0.1s
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300 transition"
                    onClick={() => adjustSubtitleSync(0.5)}
                    title="자막 0.5초 뒤로"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
              
              <div className="mt-1 text-xs text-gray-500">
                <p>선호 언어: 주({primaryLanguage.toUpperCase()}) / 보조({secondaryLanguage.toUpperCase()})</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PlayerController;
