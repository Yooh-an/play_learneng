import React, { useEffect, useState } from 'react';
import SubtitleObserver, { SubtitleChangeListener } from '../../content/observers/SubtitleObserver';
import useSubtitleStore, { ActiveSubtitle } from '../../store/subtitleStore';
import DualSubtitles from '../subtitles/DualSubtitles';
import { v4 as uuidv4 } from 'uuid';
import vttSubtitleManager, { VTTSubtitleManager } from '../../services/subtitles/vttSubtitleService';
import { interceptSubtitleRequests } from '../../utils/subtitleCapturer';

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
    activeSubtitles,
    subtitleSync,
    adjustSubtitleSync
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
    // 현재 자막 상태
    let lastDomSubtitle = '';
    let lastTimestamp = 0;
    
    // DOM 기반 자막 감지 리스너 구현
    const subtitleListener: SubtitleChangeListener = {
      onSubtitleChanged: (subtitles) => {
        console.log('DOM에서 감지된 자막:', subtitles);
        
        if (subtitles.length > 0) {
          // "Play Video" 같은 컨트롤 텍스트는 필터링
          const validSubtitles = subtitles.filter(sub => {
            const text = sub.text.trim();
            return text &&
              text !== 'Play Video' &&
              text !== '재생' &&
              text !== '일시정지' &&
              !text.includes('paused') &&
              !text.includes('loading') &&
              text.length > 1; // 너무 짧은 텍스트는 무시
          });
          
          if (validSubtitles.length === 0) {
            console.log('유효한 자막이 없습니다. 컨트롤 텍스트가 필터링됨');
            return;
          }
          
          // 이중 자막 지원: 한국어와 영어 자막을 구분하여 처리
          let primaryText = '';
          let secondaryText = '';
          
          // 자막 요소들을 언어별로 분류
          const koreanSubtitles = validSubtitles.filter(sub => {
            const element = sub as any; // 임시 타입 처리
            const className = element.element?.className || '';
            return className.includes('ko') || /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(sub.text);
          });
          
          const englishSubtitles = validSubtitles.filter(sub => {
            const element = sub as any; // 임시 타입 처리
            const className = element.element?.className || '';
            return className.includes('en') || /^[a-zA-Z\s.,!?'"-]+$/.test(sub.text);
          });
          
          console.log('언어별 자막 분류:', {
            korean: koreanSubtitles.length,
            english: englishSubtitles.length,
            total: validSubtitles.length
          });
          
          // 확장 프로그램 설정에 따른 우선순위 적용
          if (primaryLanguage === 'ko') {
            primaryText = koreanSubtitles.length > 0 ? koreanSubtitles[0].text : '';
            secondaryText = englishSubtitles.length > 0 ? englishSubtitles[0].text : '';
          } else {
            primaryText = englishSubtitles.length > 0 ? englishSubtitles[0].text : '';
            secondaryText = koreanSubtitles.length > 0 ? koreanSubtitles[0].text : '';
          }
          
          // 둘 중 하나라도 없으면 첫 번째 유효한 자막을 primary로 사용
          if (!primaryText && !secondaryText && validSubtitles.length > 0) {
            primaryText = validSubtitles[0].text;
          }
          
          // 보조 자막이 없고 주 자막이 있으면 더미 보조 자막 생성
          if (primaryText && !secondaryText) {
            secondaryText = `[${secondaryLanguage}] ${primaryText}`;
          }
          
          lastDomSubtitle = primaryText; // 최근 DOM 자막 저장
          lastTimestamp = videoElement.currentTime;
          
          // 중복 업데이트 방지
          if (activeSubtitles && 
              activeSubtitles.primaryText === primaryText && 
              activeSubtitles.secondaryText === secondaryText &&
              Math.abs(videoElement.currentTime - lastTimestamp) < 0.5) {
            return;
          }
          
          const activeSubtitle: ActiveSubtitle = {
            primaryText,
            secondaryText,
            timestamp: videoElement.currentTime
          };
          
          console.log('새로운 이중 자막 설정:', activeSubtitle);
          setActiveSubtitles(activeSubtitle);
          
          // 스크린샷 구조로 자막 렌더링
          renderDualSubtitles(activeSubtitle);
        }
      },
      onSubtitleCleared: () => {
        // VTT에서 자막이 있는지 확인 후 설정
        const vttSubtitles = vttSubtitleManager.getActiveSubtitles(videoElement.currentTime);
        if (vttSubtitles.primary || vttSubtitles.secondary) {
          // VTT 자막이 있으면 VTT 자막 사용
          const primaryText = vttSubtitles.primary?.text || '';
          const secondaryText = vttSubtitles.secondary?.text || '';
          
          if (primaryText || secondaryText) {
            setActiveSubtitles({
              primaryText: primaryText || (secondaryText ? `[${primaryLanguage}] ${secondaryText}` : ''),
              secondaryText: secondaryText || (primaryText ? `[${secondaryLanguage}] ${primaryText}` : ''),
              timestamp: videoElement.currentTime
            });
            return;
          }
        }
        
        // 어떤 자막도 없으면 null 설정
        setActiveSubtitles(null);
        lastDomSubtitle = '';
      }
    };
    
    // 자막 옵저버 생성 및 시작 (DOM 기반)
    const observer = new SubtitleObserver(videoElement, subtitleContainer);
    observer.addListener(subtitleListener);
    observer.start();
    
    // VTT 자막 인터셉션 활성화
    console.log('VTT 자막 인터셉션 시작');
    interceptSubtitleRequests();
    
    // VTT 자막 매니저 활성화
    vttSubtitleManager.start();
    
    // 다른 언어 자막 파일 강제 요청 시도
    setTimeout(() => {
      tryLoadAlternativeSubtitles();
    }, 3000);
    
    // 자막 시간 업데이트를 위한 이벤트 핸들러 (1초에 한번만 실행)
    let lastUpdateTime = 0;
    const THROTTLE_INTERVAL = 1000; // 1초
    
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_INTERVAL) {
        return; // 너무 빈번한 업데이트 방지
      }
      lastUpdateTime = now;
      
      const currentTime = videoElement.currentTime;
      // 자막 싱크 조절 적용
      const vttSubtitles = vttSubtitleManager.getActiveSubtitles(currentTime, subtitleSync);
      
      // 자막 컨테이너에서 텍스트 노드 찾기 - 더 구체적인 선택자 사용
      // 먼저 영문 자막 요소를 찾습니다
      const englishSubtitleElements = Array.from(subtitleContainer.querySelectorAll('.vjs-text-track-cue-en, [class*="vjs-text-track-cue-en"], [class*="subtitle-en"], [class*="caption-en"]'));
      const koreanSubtitleElements = Array.from(subtitleContainer.querySelectorAll('.vjs-text-track-cue-ko, [class*="vjs-text-track-cue-ko"], [class*="subtitle-ko"], [class*="caption-ko"]'));
      const genericSubtitleElements = Array.from(subtitleContainer.querySelectorAll('p, span, div:not([role])'));
      
      // 영문 자막 요소 처리
      const validEnglishElements = englishSubtitleElements.filter(el => {
        const text = el.textContent?.trim();
        return text && 
               text !== 'Play Video' && 
               text !== '재생' && 
               text !== '일시정지' &&
               !text.includes('Loading') &&
               text.length > 1;
      });
      
      // 한글 자막 요소 처리
      const validKoreanElements = koreanSubtitleElements.filter(el => {
        const text = el.textContent?.trim();
        return text && 
               text !== 'Play Video' && 
               text !== '재생' && 
               text !== '일시정지' &&
               !text.includes('Loading') &&
               text.length > 1;
      });
      
      // 일반 자막 요소 처리
      const validGenericElements = genericSubtitleElements.filter(el => {
        const text = el.textContent?.trim();
        return text && 
               text !== 'Play Video' && 
               text !== '재생' && 
               text !== '일시정지' &&
               !text.includes('Loading') &&
               text.length > 1;
      });
      
      // 영어와 한글 자막을 모두 찾았을 경우 (이중언어 모드)
      const primaryText = validKoreanElements.length > 0 ? validKoreanElements[0].textContent?.trim() || "" : "";
      const secondaryText = validEnglishElements.length > 0 ? validEnglishElements[0].textContent?.trim() || "" : "";
      
      // 일반 자막 텍스트 (언어 구분이 없는 경우)
      const domSubtitle = validGenericElements.length > 0 ? validGenericElements[0].textContent?.trim() || "" : "";
      
      // 영어 자막이 발견되면 로그 출력
      if (secondaryText && secondaryText.length > 0) {
        console.log('영어 자막 발견!', secondaryText);
      }
      
      // 중복 업데이트 방지 및 디버깅 로그 추가
      console.log('자막 상태 확인:', {
        'VTT 자막': vttSubtitles.primary?.text || '(없음)',
        'DOM 자막': domSubtitle || '(없음)',
        '현재 활성 자막': activeSubtitles?.primaryText || '(없음)'
      });
      
      if (activeSubtitles) {
        const currentPrimary = activeSubtitles.primaryText;
        const newPrimary = vttSubtitles.primary?.text || domSubtitle || '';
        
        // 자막이 이미 표시 중이고 변경되지 않았다면 중복 업데이트 하지 않음
        // 단, "Play Video" 같은 컨트롤 텍스트는 항상 새로운 자막으로 업데이트
        if (currentPrimary === newPrimary && 
            newPrimary !== '' && 
            newPrimary !== 'Play Video' && 
            newPrimary !== '재생') {
          return;
        }
      }
      
      // DOM 또는 VTT에서 자막을 가져와 표시
      const hasVttPrimary = vttSubtitles.primary && vttSubtitles.primary.text;
      const hasVttSecondary = vttSubtitles.secondary && vttSubtitles.secondary.text;
      
      if (hasVttPrimary || hasVttSecondary || primaryText || secondaryText || domSubtitle) {
        // 최종 기본 자막 텍스트 결정 (우선순위: VTT 자막 > DOM에서 찾은 한글 자막 > 일반 DOM 자막)
        const finalPrimaryText = (hasVttPrimary ? vttSubtitles.primary!.text : "") || primaryText || domSubtitle || '';
        
        // 최종 보조 자막 텍스트 결정
        let finalSecondaryText = '';
        
        if (hasVttSecondary) {
          // VTT 보조 자막이 있는 경우
          finalSecondaryText = vttSubtitles.secondary!.text;
        } else if (secondaryText && secondaryText.length > 0) {
          // DOM에서 찾은 영어 자막이 있는 경우
          finalSecondaryText = secondaryText;
        } else if (hasVttPrimary) {
          // 주 자막만 있는 경우 (쌍으로 형성)
          finalSecondaryText = `[${secondaryLanguage}] ${finalPrimaryText}`;
        } else if (primaryText || domSubtitle) {
          // DOM 자막만 있는 경우
          finalSecondaryText = `[${secondaryLanguage}] ${finalPrimaryText}`;
        }
        
        if (finalPrimaryText || finalSecondaryText) {
          // 디버깅: 로그 출력 횟수 줄이기
          if (finalPrimaryText !== 'Play Video') {
            console.log('자막 업데이트:', { primary: finalPrimaryText, secondary: finalSecondaryText });
          }
          
          setActiveSubtitles({
            primaryText: finalPrimaryText,
            secondaryText: finalSecondaryText,
            timestamp: currentTime
          });
        }
      } else {
        // 자막이 없는 경우 초기화
        if (activeSubtitles) {
          setActiveSubtitles(null);
        }
      }
    };
    
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      observer.removeListener(subtitleListener);
      observer.stop();
      vttSubtitleManager.stop();
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [subtitleContainer, videoElement, setActiveSubtitles, primaryLanguage, secondaryLanguage]);
  
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 다른 언어 자막 파일 강제 요청 함수
  const tryLoadAlternativeSubtitles = async () => {
    console.log('다른 언어 자막 파일 강제 요청 시도 중...');
    
    // 현재 페이지의 네트워크 요청을 분석하여 자막 URL 패턴 찾기
    const currentUrl = window.location.href;
    const videoId = videoInfo.videoId;
    
    // 쿠팡플레이의 일반적인 자막 URL 패턴들
    const subtitlePatterns = [
      // 기본 패턴 (현재 감지된 자막에서 언어 코드만 변경)
      'ko', 'en', 'korean', 'english',
      'ko-KR', 'en-US', 'kor', 'eng'
    ];
    
    // 이미 요청된 URL들을 추적
    const attemptedUrls = new Set<string>();
    
    // 네트워크 요청 감시를 통해 자막 URL 패턴 추론
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('.vtt') && entry.name.includes('subtitle')) {
          const originalUrl = entry.name;
          console.log('감지된 자막 URL:', originalUrl);
          
          // 다른 언어 버전 시도
          for (const lang of subtitlePatterns) {
            // URL에서 언어 코드 부분을 다른 언어로 치환
            const alternativeUrls = [
              originalUrl.replace(/ko/g, lang).replace(/korean/g, lang),
              originalUrl.replace(/en/g, lang).replace(/english/g, lang),
              originalUrl.replace(/-ko/g, `-${lang}`).replace(/-en/g, `-${lang}`),
              originalUrl.replace(/\.ko\./g, `.${lang}.`).replace(/\.en\./g, `.${lang}.`)
            ];
            
            for (const altUrl of alternativeUrls) {
              if (altUrl !== originalUrl && !attemptedUrls.has(altUrl)) {
                attemptedUrls.add(altUrl);
                console.log(`다른 언어 자막 요청 시도: ${altUrl}`);
                
                // 자막 파일 요청
                fetch(altUrl)
                  .then(response => {
                    if (response.ok) {
                      console.log(`성공적으로 로드된 대안 자막: ${altUrl}`);
                      return response.text();
                    }
                    throw new Error(`HTTP ${response.status}`);
                  })
                  .then(content => {
                    // VTT 내용 처리는 이미 인터셉터에서 처리됨
                    console.log(`대안 자막 내용 로드 완료: ${altUrl.substring(0, 100)}...`);
                  })
                  .catch(error => {
                    console.log(`대안 자막 로드 실패: ${altUrl} - ${error.message}`);
                  });
              }
            }
          }
        }
      }
    });
    
    // 네트워크 요청 감시 시작
    try {
      observer.observe({ entryTypes: ['resource'] });
      
      // 10초 후 감시 중지
      setTimeout(() => {
        observer.disconnect();
        console.log('다른 언어 자막 요청 시도 완료');
      }, 10000);
    } catch (error) {
      console.warn('PerformanceObserver 지원되지 않음:', error);
      
      // 대안: 일반적인 쿠팡플레이 자막 URL 패턴으로 직접 시도
      const basePatterns = [
        `/subtitle/${videoId}/ko.vtt`,
        `/subtitle/${videoId}/en.vtt`,
        `/subtitles/${videoId}-ko.vtt`,
        `/subtitles/${videoId}-en.vtt`,
        `/api/subtitle/${videoId}/korean.vtt`,
        `/api/subtitle/${videoId}/english.vtt`
      ];
      
      for (const pattern of basePatterns) {
        const testUrl = window.location.origin + pattern;
        console.log(`직접 자막 URL 시도: ${testUrl}`);
        
        fetch(testUrl)
          .then(response => {
            if (response.ok) {
              console.log(`직접 요청으로 성공한 자막: ${testUrl}`);
              return response.text();
            }
            throw new Error(`HTTP ${response.status}`);
          })
          .then(content => {
            console.log(`직접 요청 자막 내용 로드 완료: ${testUrl}`);
          })
          .catch(error => {
            console.log(`직접 요청 자막 로드 실패: ${testUrl} - ${error.message}`);
          });
      }
    }
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
  
  // 자막을 별도 컨테이너에 렌더링
  useEffect(() => {
    if (showSubtitles && activeSubtitles) {
      const subtitleContainer = document.getElementById('play-learn-eng-subtitles');
      if (subtitleContainer) {
        // 기존 자막 제거
        subtitleContainer.innerHTML = '';
        
        // 새 자막 요소 생성
        const subtitleElement = document.createElement('div');
        subtitleElement.style.cssText = `
          position: fixed;
          bottom: 15%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999999;
          max-width: 80%;
          background-color: rgba(0, 0, 0, 0.8);
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
          color: white;
          text-align: center;
          font-size: 18px;
          line-height: 1.5;
          font-family: Arial, sans-serif;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          pointer-events: none;
        `;
        
        // 자막 내용 추가
        if (displayMode === 'primary') {
          subtitleElement.innerHTML = `<div>${activeSubtitles.primaryText}</div>`;
        } else if (displayMode === 'secondary') {
          subtitleElement.innerHTML = `<div>${activeSubtitles.secondaryText}</div>`;
        } else {
          subtitleElement.innerHTML = `
            <div style="margin-bottom: 8px;">${activeSubtitles.primaryText}</div>
            <div style="opacity: 0.9;">${activeSubtitles.secondaryText}</div>
          `;
        }
        
        subtitleContainer.appendChild(subtitleElement);
      }
    } else {
      // 자막이 없으면 컨테이너 비우기
      const subtitleContainer = document.getElementById('play-learn-eng-subtitles');
      if (subtitleContainer) {
        subtitleContainer.innerHTML = '';
      }
    }
  }, [showSubtitles, activeSubtitles, displayMode]);
  
  /**
   * 스크린샷 구조에 맞게 이중 자막 렌더링
   */
  function renderDualSubtitles(subtitle: ActiveSubtitle) {
    // 자막 컨테이너 찾기
    let container = document.getElementById('play-learneng-subtitle-container');
    if (!container) {
      // 컨테이너가 없으면 생성
      const videoContainer = document.querySelector('.video-js') || 
                           document.querySelector('[id*="player"]') || 
                           document.querySelector('.player-container');
      
      if (videoContainer) {
        container = document.createElement('div');
        container.id = 'play-learneng-subtitle-container';
        
        // 스크린샷과 동일한 스타일링
        container.style.cssText = `
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
        
        videoContainer.appendChild(container);
      } else {
        console.warn('비디오 컨테이너를 찾을 수 없어 자막을 표시할 수 없습니다.');
        return;
      }
    }
    
    // 기존 자막 제거
    container.innerHTML = '';
    
    // 현재 표시 모드에 따라 자막 렌더링
    if (displayMode === 'dual' || displayMode === 'primary') {
      const primaryElement = document.createElement('div');
      primaryElement.className = 'play-learneng-subtitle-text play-learneng-subtitle-ko';
      primaryElement.textContent = subtitle.primaryText;
      
      // 스크린샷과 일치하는 한국어 자막 스타일링
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
    
    if (displayMode === 'dual' || displayMode === 'secondary') {
      const secondaryElement = document.createElement('div');
      secondaryElement.className = 'play-learneng-subtitle-text play-learneng-subtitle-en';
      secondaryElement.textContent = subtitle.secondaryText;
      
      // 스크린샷과 일치하는 영어 자막 스타일링
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
  }
  
  return (
    <>
      
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
              
              {/* 자막 싱크 조절 UI */}
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
                    싱크: {subtitleSync > 0 ? '+' : ''}{subtitleSync}s
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
