/**
 * 쿠팡 플레이 자막 요청을 가로채고 분석하는 유틸리티
 */
import { logger } from './logger';

interface VTTCue {
  startTime: number;
  endTime: number;
  text: string;
}

// 전역 타입 확장
declare global {
  interface Window {
    capturedSubtitles?: {
      url: string;
      raw: string;
      cues: VTTCue[];
      timestamp: string;
    };
    playLearnEngDebug?: any;
  }
}

/**
 * 특정 언어의 자막을 찾아 추출하는 함수
 * @param vttSubtitles - VTT 자막 트랙 배열
 * @param timestamp - 현재 비디오 타임스탬프
 * @param languageCode - 찾을 언어 코드 (기본값: 'en')
 * @returns 찾은 자막 텍스트
 */
export const extractSubtitleByLanguage = (
  vttSubtitles: any[], 
  timestamp: number,
  languageCode: string = 'en'
): string => {
  if (!vttSubtitles || vttSubtitles.length === 0) return '';
  
  const targetTrack = vttSubtitles.find(track => 
    track.language?.toLowerCase().includes(languageCode) || 
    track.label?.toLowerCase().includes(getLanguageName(languageCode))
  );
  
  if (targetTrack && targetTrack.cues) {
    const currentCue = targetTrack.cues.find((cue: any) => 
      timestamp >= cue.startTime && timestamp <= cue.endTime
    );
    return currentCue?.text || '';
  }
  
  return '';
};

/**
 * 언어 코드로부터 언어 이름 가져오기
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string[]> = {
    'en': ['english', 'eng'],
    'ko': ['korean', 'kor', '한국어'],
    'ja': ['japanese', 'jpn', '日本語'],
    'zh': ['chinese', 'chn', '中文']
  };
  
  return languages[code]?.[0] || code;
}

/**
 * DOM에서 특정 언어의 자막 요소를 찾아 텍스트 추출
 * @param container - 자막 컨테이너 요소
 * @param languageCode - 찾을 언어 코드 (기본값: 'en')
 * @returns 찾은 자막 텍스트
 */
export const extractSubtitleFromDOM = (container: Element, languageCode: string = 'en'): string => {
  // 자막 선택자 패턴
  const selectors = [
    `.vjs-text-track-cue-${languageCode}`,
    `.vjs-text-track-cue[class*="${languageCode}"]`,
    `.subtitle-${languageCode}`,
    `.caption-${languageCode}`
  ];
  
  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element && element.textContent?.trim()) {
      return element.textContent.trim();
    }
  }
  
  return '';
};


/**
 * 모든 네트워크 요청을 모니터링하고 자막 요청을 가로채는 함수
 * @deprecated 현재 chrome.debugger 방식을 사용하므로 이 함수는 사용되지 않음
 */
export function interceptSubtitleRequests() {
  console.warn('interceptSubtitleRequests is deprecated. Using chrome.debugger approach instead.');
  return '자막 모니터링은 background script의 chrome.debugger를 통해 처리됩니다.';
}

/**
 * WebVTT 형식을 파싱하여 큐 목록으로 변환
 * @param vttContent - VTT 자막 내용
 * @returns 파싱된 VTT 큐 배열
 */
export function parseVTT(vttContent: string): VTTCue[] {
  const cues: VTTCue[] = [];
  
  try {
    // 빈 콘텐츠 확인
    if (!vttContent || vttContent.trim() === '') {
      console.warn('자막 콘텐츠가 비어있습니다.');
      return cues;
    }
    
    
    // 쿠팡 플레이 특화 포맷 체크 - 일부 쿠팡 플레이 자막은 특이한 형식을 가질 수 있음
    const isCoupangPlayFormat = vttContent.includes('STYLE') && vttContent.includes('::cue');
    
    // WEBVTT 헤더 확인 (일부 자막 파일은 형식이 다를 수 있음)
    if (!vttContent.trim().startsWith('WEBVTT') && !vttContent.includes('-->')) {
      // 쿠팡플레이 자막은 헤더가 다를 수 있으므로 추가 체크
      if (isCoupangPlayFormat || vttContent.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/)) {
        logger.log('특수한 형식의 자막 파일 감지됨 - 쿠팡플레이 형식');
      } else {
        console.warn('유효한 WebVTT 형식이 아니거나 자막 시간 형식이 포함되어 있지 않습니다.');
        logger.log('자막 콘텐츠 일부:', vttContent.substring(0, 100));
        return cues;
      }
    }
  
  // 각 큐 블록 처리
  const lines = vttContent.split('\n');
  let i = 0;
  
  // 헤더 건너뛰기
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
    // 큐 처리
    while (i < lines.length) {
      // 시간대 행 찾기
      if (lines[i].includes('-->')) {
        const timeLine = lines[i];
        // 유연한 시간 형식 매칭 (쿠팡플레이 포함)
        const timeMatch = timeLine.match(/(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+) --> (\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)/);
        
        if (timeMatch) {
          const startTime = parseTimeString(timeMatch[1]);
          const endTime = parseTimeString(timeMatch[2]);
          
          // 텍스트 행 수집
          let textContent = '';
          i++;
          
          while (i < lines.length && lines[i].trim() !== '') {
            // 쿠팡플레이 특화: HTML 태그가 포함된 자막 처리
            const line = lines[i]
              .replace(/<[^>]*>/g, '') // HTML 태그 제거
              .replace(/&lt;/g, '<')   // HTML 엔티티 처리
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&nbsp;/g, ' ')
              .trim();
              
            if (line) {
              textContent += (textContent ? '\n' : '') + line;
            }
            i++;
          }
          
          if (textContent) {
            // 컨트롤 텍스트 필터링
            if (textContent !== 'Play Video' && 
                textContent !== '재생' && 
                textContent !== '일시정지' && 
                !textContent.includes('Loading')) {
              cues.push({
                startTime,
                endTime,
                text: textContent
              });
            }
          }
        }
      }
      
      i++;
    }
    
    return cues;
  } catch (parseError) {
    console.error('자막 파싱 중 오류 발생:', parseError);
    return cues;
  }
}

/**
 * 다양한 형식의 시간 문자열을 초 단위 숫자로 변환
 * 지원 형식: "00:00:00.000", "00:00.000", "0:00:00.000"
 */
function parseTimeString(timeString: string): number {
  // 입력 값 정리
  timeString = timeString.trim();
  
  try {
    if (!timeString.includes(':')) {
      // 콜론이 없으면 단순히 초로 취급
      return parseFloat(timeString);
    }
    
    const parts = timeString.split(':');
    
    if (parts.length === 3) {
      // 00:00:00.000 형식 (시:분:초)
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // 00:00.000 형식 (분:초)
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    }
    
    // 형식이 맞지 않으면 직접 파싱 시도
    return parseFloat(timeString);
  } catch (error) {
    console.error('시간 문자열 파싱 오류:', timeString, error);
    return 0;
  }
}

/**
 * 캡처된 자막을 Chrome Storage에 저장
 */
export function saveCapturedSubtitle(url: string, content: string) {
  // URL에서 파일명 추출
  const fileName = url.split('/').pop() || 'subtitle.vtt';
  
  // Chrome Storage에 저장
  if (chrome?.storage?.local) {
    const capturedSubtitle = {
      url,
      fileName,
      content,
      timestamp: new Date().toISOString()
    };
    
    chrome.storage.local.set({ capturedSubtitle }, () => {
      logger.log('자막 파일이 저장되었습니다:', fileName);
    });
  } else {
    logger.log('Chrome Storage API를 사용할 수 없어 자막을 저장할 수 없습니다.');
  }
}

/**
 * 서비스 워커와 페이지 간 통신 설정
 * @returns 통신 설정 상태 객체
 */
export function setupSubtitleComms() {
  logger.log('자막 통신 시스템 초기화...');
  
  // 서비스 워커와의 통신 채널 설정
  if (chrome?.runtime?.onMessage) {
    // 자막 정보 수신 리스너 등록
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SUBTITLE_REQUEST') {
        const currentSubtitles = window.capturedSubtitles;
        sendResponse({ success: true, subtitles: currentSubtitles });
        return true; // 비동기 응답을 위해 true 반환
      }
    });
    
    logger.log('자막 통신 리스너 등록 완료');
    return { status: 'initialized', communicationChannel: 'chrome.runtime' };
  } 
  
  console.warn('Chrome 런타임 API가 없어 자막 통신을 설정할 수 없습니다.');
  return { status: 'failed', error: 'Chrome runtime API unavailable' };
}

/**
 * 테스트용: 수동으로 자막 파일 가져오기
 */
export async function fetchSubtitleManually(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    logger.log('자막 파일 가져오기 성공!');
    logger.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    
    // 큐로 파싱
    const cues = parseVTT(text);
    logger.log(`파싱된 자막 큐 ${cues.length}개:`, cues.slice(0, 5));
    
    return {
      url,
      raw: text,
      cues
    };
  } catch (error) {
    console.error('자막 파일 가져오기 실패:', error);
    return null;
  }
}

export default {
  interceptSubtitleRequests,
  fetchSubtitleManually,
  parseVTT
};
