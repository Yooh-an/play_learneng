import React, { useEffect, useState, useCallback } from 'react';
import useSubtitleStore, { ActiveSubtitle } from '../../store/subtitleStore';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

interface PlayerControllerProps {
  videoElement: HTMLVideoElement;
  videoInfo: {
    title: string;
    episodeInfo: string;
    videoId: string;
  };
  // VTT 데이터 접근을 위한 getter 함수들
  getKoreanSubtitles: () => ProcessedSubtitleData | null;
  getEnglishSubtitles: () => ProcessedSubtitleData | null;
}

// VTT 데이터 타입 정의
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

// 자막 설정 타입 정의
interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: number;
  opacity: number;
}

const PlayerController: React.FC<PlayerControllerProps> = ({ 
  videoElement, 
  videoInfo,
  getKoreanSubtitles,
  getEnglishSubtitles
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(!videoElement.paused);
  const [currentTime, setCurrentTime] = useState<number>(videoElement.currentTime);
  const [duration, setDuration] = useState<number>(videoElement.duration);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings | null>(null);
  
  const { 
    setActiveSubtitles, 
    setIsPlaying: setStoreIsPlaying,
    setCurrentVideo,
    displayMode, 
    setDisplayMode,
    saveSubtitle,
    activeSubtitles,
    subtitleSync,
    adjustSubtitleSync
  } = useSubtitleStore();
  
  // 자막 설정 로드 및 감시
  useEffect(() => {
    const fetchSettings = () => {
      chrome.storage.sync.get('subtitleSettings', (data) => {
        if (chrome.runtime.lastError) {
          console.error('[PlayerController] Error fetching subtitleSettings:', chrome.runtime.lastError.message);
          return;
        }
        if (data.subtitleSettings) {
          setSubtitleSettings(data.subtitleSettings);
        } else {
          const defaultSettings: SubtitleSettings = {
            enabled: true,
            primaryLanguage: 'ko',
            secondaryLanguage: 'en',
            fontSize: 25,
            position: 85,
            opacity: 0.15,
          };
          setSubtitleSettings(defaultSettings);
          chrome.storage.sync.set({ subtitleSettings: defaultSettings });
        }
      });
    };

    fetchSettings();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'sync' && changes.subtitleSettings) {
        setSubtitleSettings(changes.subtitleSettings.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // 설정 업데이트 커스텀 이벤트 리스너
    const handleSettingsUpdate = (event: CustomEvent) => {
      setSubtitleSettings(event.detail);
    };

    document.addEventListener('settingsUpdated', handleSettingsUpdate as EventListener);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      document.removeEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
    };
  }, []);

  // 비디오 정보 설정
  useEffect(() => {
    if (videoInfo && videoInfo.videoId && videoInfo.title) {
      setCurrentVideo(videoInfo.videoId, videoInfo.title);
    }
  }, [videoInfo, setCurrentVideo]);
  
  // 비디오 기본 이벤트 리스너 설정
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

  // VTT 데이터 업데이트 리스너
  useEffect(() => {
    const handleVttUpdate = (event: CustomEvent) => {
      // VTT 데이터가 업데이트되면 현재 시간에 맞는 자막을 찾아서 설정
      setTimeout(() => {
        updateCurrentSubtitles();
      }, 100);
    };

    document.addEventListener('vttSubtitlesUpdated', handleVttUpdate as EventListener);

    return () => {
      document.removeEventListener('vttSubtitlesUpdated', handleVttUpdate as EventListener);
    };
  }, []);

  // 현재 시간에 맞는 자막 업데이트
  const updateCurrentSubtitles = useCallback(() => {
    if (!subtitleSettings) return;

    const currentVideoTime = videoElement.currentTime + subtitleSync;
    const koreanData = getKoreanSubtitles();
    const englishData = getEnglishSubtitles();

    // 현재 시간에 해당하는 자막 찾기
    const currentKoreanCue = koreanData?.cues.find(cue => 
      currentVideoTime >= cue.startTime && currentVideoTime <= cue.endTime
    );
    
    const currentEnglishCue = englishData?.cues.find(cue => 
      currentVideoTime >= cue.startTime && currentVideoTime <= cue.endTime
    );

    // 언어 설정에 따라 주/부 자막 결정
    let primaryText = '';
    let secondaryText = '';

    if (subtitleSettings.primaryLanguage === 'ko') {
      primaryText = currentKoreanCue?.text || '';
      secondaryText = currentEnglishCue?.text || '';
    } else {
      primaryText = currentEnglishCue?.text || '';
      secondaryText = currentKoreanCue?.text || '';
    }

    // 자막이 있을 때만 상태 업데이트
    if (primaryText || secondaryText) {
      const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
      if (currentActiveStoreSubtitles?.primaryText !== primaryText || 
          currentActiveStoreSubtitles?.secondaryText !== secondaryText) {
        setActiveSubtitles({ 
          primaryText, 
          secondaryText, 
          timestamp: currentVideoTime 
        });
      }
    } else {
      // 자막이 없으면 클리어
      const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
      if (currentActiveStoreSubtitles) {
        setActiveSubtitles(null);
      }
    }
  }, [videoElement, subtitleSync, subtitleSettings, getKoreanSubtitles, getEnglishSubtitles, setActiveSubtitles]);

  // 시간 업데이트에 따른 자막 동기화
  useEffect(() => {
    let lastUpdateTime = 0;
    const THROTTLE_INTERVAL = 250;
    
    const handleSubtitleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_INTERVAL) return;
      lastUpdateTime = now;
      
      updateCurrentSubtitles();
    };
    
    videoElement.addEventListener('timeupdate', handleSubtitleTimeUpdate);

    return () => {
      videoElement.removeEventListener('timeupdate', handleSubtitleTimeUpdate);
    };
  }, [videoElement, updateCurrentSubtitles]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    // CSS 스타일 주입
    const ensureStyles = () => {
      if (!document.getElementById('play-learneng-subtitle-styles')) {
        const style = document.createElement('style');
        style.id = 'play-learneng-subtitle-styles';
        style.textContent = `
          .play-learneng-subtitle-text {
            display: inline-block !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: 90% !important;
            box-sizing: border-box !important;
            text-align: center !important;
            margin: 0 auto !important;
          }
          #play-learneng-subtitle-container {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 0 !important;
          }
          #play-learneng-subtitle-container > div {
            display: inline-block !important;
            width: auto !important;
            margin: 0 auto !important;
          }
          #play-learneng-subtitle-container > div:first-child {
            margin-bottom: 0 !important;
          }
          #play-learneng-subtitle-container > div:last-child {
            margin-top: 8px !important;
          }
        `;
        document.head.appendChild(style);
      }
    };
    
    ensureStyles();
    
    let container = document.getElementById('play-learneng-subtitle-container');
    if (!container) {
      const videoContainer = document.querySelector('.video-js') || 
                           document.querySelector('[id*="player"]') || 
                           document.querySelector('.player-container');
      if (videoContainer) {
        container = document.createElement('div');
        container.id = 'play-learneng-subtitle-container';
        videoContainer.appendChild(container);
      } else {
        return;
      }
    }
    
    // 컨테이너 위치 설정
    if (subtitleSettings) {
      const topPercentage = 5 + (subtitleSettings.position * 0.8);
      
      container.style.cssText = `
        position: absolute !important; top: ${topPercentage}% !important; left: 0 !important; right: 0 !important;
        display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important;
        width: 100% !important; z-index: 9999 !important; pointer-events: none !important; padding: 0 30px !important; box-sizing: border-box !important;
        text-align: center !important; gap: 0 !important;
      `;
    }
    
    container.innerHTML = '';

    if (!subtitleSettings) return;

    const primaryTextToDisplay = subtitle.primaryText;
    const secondaryTextToDisplay = subtitle.secondaryText;

    const primaryLang = subtitleSettings.primaryLanguage;
    const secondaryLang = subtitleSettings.secondaryLanguage;

    // 주 자막 표시 로직
    if (primaryTextToDisplay && primaryTextToDisplay.trim()) {
      if (!subtitleSettings.enabled || 
          (subtitleSettings.enabled && (displayMode === 'primary' || displayMode === 'dual'))) {
        const primaryElement = document.createElement('div');
        primaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${primaryLang}`;
        primaryElement.textContent = primaryTextToDisplay;
        primaryElement.style.cssText = `
          color: #ffffff !important;
          padding: 6px 12px !important; margin: 0 auto 0 auto !important;
          font-size: ${subtitleSettings.fontSize}px !important; font-weight: 600 !important; max-width: 90% !important;
          text-align: center !important; line-height: 1.4 !important; white-space: pre-wrap !important;
          background-color: rgba(0, 0, 0, ${subtitleSettings.opacity}) !important;
          border-radius: 4px !important;
          text-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.9),
            1px 1px 2px rgba(0, 0, 0, 0.8),
            0 0 6px rgba(0, 0, 0, 0.6) !important;
          -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.7) !important;
          display: inline-block !important;
          width: auto !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          letter-spacing: 0.3px !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        `;
        container.appendChild(primaryElement);
      }
    }
    
    // 부 자막 표시 로직 강화
    if (secondaryTextToDisplay && secondaryTextToDisplay.trim()) {
      if (subtitleSettings.enabled && 
          (displayMode === 'secondary' || displayMode === 'dual')) {
        const secondaryElement = document.createElement('div');
        secondaryElement.className = `play-learneng-subtitle-text play-learneng-subtitle-${secondaryLang}`;
        secondaryElement.textContent = secondaryTextToDisplay;
        secondaryElement.style.cssText = `
          color: #ffffff !important;
          padding: 6px 12px !important; margin: 8px auto 0 auto !important;
          font-size: ${subtitleSettings.fontSize}px !important; font-weight: 600 !important; max-width: 90% !important;
          text-align: center !important; line-height: 1.4 !important; white-space: pre-wrap !important;
          background-color: rgba(0, 0, 0, ${subtitleSettings.opacity}) !important;
          border-radius: 4px !important;
          text-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.9),
            1px 1px 2px rgba(0, 0, 0, 0.8),
            0 0 6px rgba(0, 0, 0, 0.6) !important;
          -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.7) !important;
          display: inline-block !important;
          width: auto !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          letter-spacing: 0.3px !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        `;
        container.appendChild(secondaryElement);
      } else {
      }
    } else {
    }
  }, [displayMode, subtitleSettings]);

  // 활성 자막 렌더링
  useEffect(() => {
    const currentActiveStoreSubtitles = useSubtitleStore.getState().activeSubtitles;
    
    if (currentActiveStoreSubtitles) {
      renderDualSubtitles(currentActiveStoreSubtitles);
    } else {
      // 자막 클리어
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

  return null; // PlayerController는 UI 컴포넌트가 아니라 컨트롤러
};

export default PlayerController;
