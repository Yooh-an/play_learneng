import React, { useEffect, useState } from 'react';
import SubtitleObserver, { SubtitleChangeListener } from '../../content/observers/SubtitleObserver';
import useSubtitleStore, { ActiveSubtitle } from '../../store/subtitleStore';
import DualSubtitles from '../subtitles/DualSubtitles';
import { v4 as uuidv4 } from 'uuid';

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
  
  // Zustand 스토어에서 상태와 액션 가져오기
  const { 
    setActiveSubtitles, 
    setIsPlaying: setStoreIsPlaying,
    setCurrentVideo,
    displayMode, 
    setDisplayMode,
    saveSubtitle,
    primaryLanguage,
    secondaryLanguage,
    activeSubtitles
  } = useSubtitleStore();
  
  // 비디오 정보 설정
  useEffect(() => {
    setCurrentVideo(videoInfo.videoId, videoInfo.title);
  }, [videoInfo.videoId, videoInfo.title, setCurrentVideo]);
  
  // 비디오 이벤트 리스너 설정
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
    
    // 이벤트 리스너 등록
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    
    // 초기 상태 업데이트
    setIsPlaying(!videoElement.paused);
    setStoreIsPlaying(!videoElement.paused);
    setCurrentTime(videoElement.currentTime);
    if (videoElement.duration && !isNaN(videoElement.duration)) {
      setDuration(videoElement.duration);
    }
    
    // 정리 함수
    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
    };
  }, [videoElement, setStoreIsPlaying]);
  
  // 자막 컨테이너 감시 설정
  useEffect(() => {
    // 자막 감지 리스너 구현
    const subtitleListener: SubtitleChangeListener = {
      onSubtitleChanged: (subtitles) => {
        if (subtitles.length > 0) {
          // 쿠팡 플레이의 경우 일반적으로 하나의 자막만 활성화되어 있음
          const primaryText = subtitles[0].text;
          let secondaryText = '';
          
          // 만약 두 번째 언어 자막이 있다면 (향후 API 연동 또는 번역 기능 추가 시)
          if (subtitles.length > 1) {
            secondaryText = subtitles[1].text;
          }
          
          const activeSubtitle: ActiveSubtitle = {
            primaryText,
            secondaryText,
            timestamp: videoElement.currentTime
          };
          
          setActiveSubtitles(activeSubtitle);
        }
      },
      onSubtitleCleared: () => {
        setActiveSubtitles(null);
      }
    };
    
    // 자막 옵저버 생성 및 시작
    const observer = new SubtitleObserver(videoElement, subtitleContainer);
    observer.addListener(subtitleListener);
    observer.start();
    
    return () => {
      observer.removeListener(subtitleListener);
      observer.stop();
    };
  }, [subtitleContainer, videoElement, setActiveSubtitles]);
  
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 디스플레이 모드 토글
  const toggleDisplayMode = () => {
    const modes: Array<'primary' | 'secondary' | 'dual'> = ['primary', 'secondary', 'dual'];
    const currentIndex = modes.indexOf(displayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setDisplayMode(modes[nextIndex]);
  };
  
  // 현재 자막 저장
  const handleSaveSubtitle = () => {
    if (activeSubtitles) {
      saveSubtitle({
        id: uuidv4(),
        primaryText: activeSubtitles.primaryText,
        secondaryText: activeSubtitles.secondaryText,
        startTime: videoElement.currentTime,
        videoId: videoInfo.videoId,
        savedAt: new Date().toISOString()
      });
      
      // 저장 확인 피드백
      alert('자막이 저장되었습니다.');
    } else {
      alert('저장할 자막이 없습니다.');
    }
  };
  
  return (
    <>
      {/* 커스텀 자막 */}
      {showSubtitles && activeSubtitles && (
        <DualSubtitles 
          style={{ 
            position: 'absolute', 
            bottom: '80px', 
            left: '50%', 
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: '80%'
          }}
        />
      )}
      
      {/* 컨트롤 패널 */}
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
                  {displayMode === 'primary' ? '주 자막' : 
                   displayMode === 'secondary' ? '보조 자막' : '이중 자막'}
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
                  disabled={!activeSubtitles}
                >
                  자막 저장
                </button>
              </div>
              
              <div className="mt-1 text-xs text-gray-500">
                <p>언어: {primaryLanguage} / {secondaryLanguage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PlayerController;
