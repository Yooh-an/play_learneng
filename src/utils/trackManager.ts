/**
 * 텍스트 트랙(자막) 관리 유틸리티
 */
import { logger } from './logger';

/**
 * 비디오에 연결된 모든 텍스트 트랙 활성화 시도
 */
export function activateAllTextTracks(videoElement: HTMLVideoElement): void {
  if (!videoElement || !videoElement.textTracks) {
    logger.log('유효한 비디오 요소나 텍스트 트랙이 없습니다.');
    return;
  }
  
  logger.log(`비디오 텍스트 트랙 활성화 시도. 총 ${videoElement.textTracks.length}개의 트랙 확인 중...`);
  
  // 모든 텍스트 트랙 정보 로깅
  for (let i = 0; i < videoElement.textTracks.length; i++) {
    const track = videoElement.textTracks[i];
    logger.log(`트랙 ${i}: ${track.label || '라벨 없음'} (${track.language || '언어 없음'}) - ${track.kind}, mode=${track.mode}`);
    
    // 자막 트랙인 경우에만 활성화
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      try {
        // 트랙을 표시 모드로 설정
        track.mode = 'showing';
        logger.log(`트랙 ${i} (${track.language || '언어 없음'}) 활성화 성공`);
      } catch(e) {
        console.error(`트랙 ${i} 활성화 실패:`, e);
      }
    }
  }
  
  // 5초 후에 활성화된 트랙 다시 확인
  setTimeout(() => {
    logger.log('=== 트랙 활성화 상태 확인 ===');
    for (let i = 0; i < videoElement.textTracks.length; i++) {
      const track = videoElement.textTracks[i];
      logger.log(`트랙 ${i}: ${track.label || '라벨 없음'} - mode=${track.mode}, activeCues=${track.activeCues?.length || 0}`);
      
      // 활성화된 cue가 있다면 내용 확인
      if (track.activeCues && track.activeCues.length > 0) {
        for (let j = 0; j < track.activeCues.length; j++) {
          const cue = track.activeCues[j] as VTTCue;
          logger.log(`활성 Cue ${j}:`, cue.text);
        }
      }
    }
  }, 5000);
}

/**
 * 지정된 언어로 자막 설정
 */
export function setSubtitleLanguage(videoElement: HTMLVideoElement, language: string): void {
  if (!videoElement || !videoElement.textTracks) {
    logger.log('유효한 비디오 요소나 텍스트 트랙이 없습니다.');
    return;
  }
  
  logger.log(`${language} 언어 자막 활성화 시도 중...`);
  let foundMatchingTrack = false;
  
  // 모든 트랙을 검사하고 지정된 언어와 일치하는 트랙만 활성화
  for (let i = 0; i < videoElement.textTracks.length; i++) {
    const track = videoElement.textTracks[i];
    
    // 이 트랙이 우리가 찾는 언어인지 확인
    const isTargetLanguage = 
      track.language === language || 
      track.language?.startsWith(language) ||
      track.label?.toLowerCase().includes(language);
    
    if (isTargetLanguage && (track.kind === 'subtitles' || track.kind === 'captions')) {
      logger.log(`${language} 언어 트랙 발견:`, track.label);
      try {
        track.mode = 'showing';
        foundMatchingTrack = true;
        logger.log(`${language} 언어 트랙 활성화 성공`);
      } catch (e) {
        console.error(`${language} 언어 트랙 활성화 실패:`, e);
      }
    } else if (track.kind === 'subtitles' || track.kind === 'captions') {
      // 다른 언어 트랙은 비활성화
      track.mode = 'hidden';
    }
  }
  
  if (!foundMatchingTrack) {
    logger.log(`${language} 언어에 맞는 자막 트랙을 찾을 수 없습니다.`);
  }
}

/**
 * 현재 활성화된 자막 텍스트 가져오기
 */
export function getActiveSubtitleText(videoElement: HTMLVideoElement): {text: string, language: string}[] {
  if (!videoElement || !videoElement.textTracks) {
    return [];
  }
  
  const result: {text: string, language: string}[] = [];
  
  for (let i = 0; i < videoElement.textTracks.length; i++) {
    const track = videoElement.textTracks[i];
    
    if ((track.mode === 'showing' || track.mode === 'hidden') && 
        track.activeCues && 
        track.activeCues.length > 0) {
      const cue = track.activeCues[0] as VTTCue;
      if (cue && cue.text && cue.text.trim() !== '') {
        result.push({
          text: cue.text,
          language: track.language || detectLanguage(cue.text)
        });
      }
    }
  }
  
  return result;
}

/**
 * 텍스트에서 언어 감지
 */
function detectLanguage(text: string): string {
  // 한글 감지
  if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
    return 'ko';
  }
  
  // 영어 감지 (대부분 영어 문자로만 구성된 경우)
  if (/^[a-zA-Z\s.,!?'"-]+$/.test(text)) {
    return 'en';
  }
  
  // 기본값
  return 'unknown';
}
