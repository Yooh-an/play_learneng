/**
 * WebVTT 자막 관련 서비스 구현
 */
import { parseVTT } from '../../utils/subtitleCapturer';

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

interface CapturedSubtitle {
  url: string;
  content: string;
  cues: SubtitleCue[];
  language?: string;
}

interface SubtitleListener {
  onSubtitleLoaded: (subtitle: CapturedSubtitle) => void;
  onSubtitleError: (error: Error) => void;
}

/**
 * 비디오 플레이어에서 현재 재생 시간에 맞는 자막 찾기
 */
export function findActiveSubtitleCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;
  
  // 현재 시간에 맞는 자막 찾기 (이진 탐색 최적화 가능)
  return cues.find(cue => currentTime >= cue.startTime && currentTime <= cue.endTime) || null;
}

/**
 * 감지된 자막 요청 URL을 통해 VTT 자막 파일 로드
 */
export async function loadVTTSubtitle(url: string, language: string = 'unknown'): Promise<CapturedSubtitle | null> {
  try {
    console.log(`VTT 자막 파일 로드 중: ${url} (${language})`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const content = await response.text();
    const cues = parseVTT(content);
    
    console.log(`VTT 자막 로드 완료: ${cues.length}개의 큐`);
    
    return {
      url,
      content,
      cues,
      language
    };
  } catch (error) {
    console.error('VTT 자막 로드 실패:', error);
    return null;
  }
}

/**
 * 두 개의 자막(예: 한국어, 영어)을 단일 이중 자막으로 동기화
 */
export function synchronizeSubtitles(
  primaryCues: SubtitleCue[], 
  secondaryCues: SubtitleCue[]
): Map<number, {primary: SubtitleCue | null, secondary: SubtitleCue | null}> {
  const syncMap = new Map<number, {primary: SubtitleCue | null, secondary: SubtitleCue | null}>();
  
  // 모든 시간 포인트(시작/종료) 수집
  const timePoints = new Set<number>();
  [...primaryCues, ...secondaryCues].forEach(cue => {
    timePoints.add(cue.startTime);
    timePoints.add(cue.endTime);
  });
  
  // 정렬된 시간 포인트
  const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
  
  // 각 시간 간격마다 해당하는 자막 찾기
  for (let i = 0; i < sortedTimePoints.length - 1; i++) {
    const startTime = sortedTimePoints[i];
    const endTime = sortedTimePoints[i + 1];
    const midPoint = (startTime + endTime) / 2;
    
    const primary = findActiveSubtitleCue(primaryCues, midPoint);
    const secondary = findActiveSubtitleCue(secondaryCues, midPoint);
    
    if (primary || secondary) {
      syncMap.set(startTime, { primary, secondary });
    }
  }
  
  return syncMap;
}

/**
 * VTT 자막 감지 및 처리를 위한 클래스
 */
export class VTTSubtitleManager {
  private primarySubtitle: CapturedSubtitle | null = null;
  private secondarySubtitle: CapturedSubtitle | null = null;
  private listeners: SubtitleListener[] = [];
  private interceptActive: boolean = false;
  
  /**
   * 자막 감지 시작
   */
  public start(): void {
    if (this.interceptActive) return;
    
    this.interceptActive = true;
    this.setupInterception();
    
    console.log('VTT 자막 매니저가 시작되었습니다.');
  }
  
  /**
   * 자막 감지 중지
   */
  public stop(): void {
    this.interceptActive = false;
    console.log('VTT 자막 매니저가 중지되었습니다.');
    // 실제 fetch 가로채기 해제는 페이지를 새로고침해야 함
  }
  
  /**
   * 자막 이벤트 리스너 등록
   */
  public addListener(listener: SubtitleListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * 자막 이벤트 리스너 제거
   */
  public removeListener(listener: SubtitleListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * 현재 재생 시간에 맞는 자막 찾기
   * @param currentTime 현재 재생 시간
   * @param syncOffset 자막 싱크 조절 값 (초 단위)
   */
  public getActiveSubtitles(currentTime: number, syncOffset: number = 0): {
    primary: SubtitleCue | null;
    secondary: SubtitleCue | null;
  } {
    // 자막 싱크 조절 적용
    const adjustedTime = currentTime - syncOffset;
    
    // 자막이 없을 경우 정상 작동을 위한 디버깅 (너무 자주 출력하지 않도록 제한)
    if (!this.primarySubtitle && !this.secondarySubtitle) {
      // 로그 제한
      const now = Date.now();
      if (!this._lastLogTime || now - this._lastLogTime > 5000) { // 5초에 한번만 출력
        console.log('VTT 자막이 로드되지 않았습니다. 자막을 찾을 수 없습니다.');
        this._lastLogTime = now;
      }
    }
    
    // 현재 시간에 맞는 자막 찾기 (싱크 조절 적용)
    const primary = this.primarySubtitle && this.primarySubtitle.cues && this.primarySubtitle.cues.length > 0
      ? findActiveSubtitleCue(this.primarySubtitle.cues, adjustedTime)
      : null;
    
    const secondary = this.secondarySubtitle && this.secondarySubtitle.cues && this.secondarySubtitle.cues.length > 0
      ? findActiveSubtitleCue(this.secondarySubtitle.cues, adjustedTime)
      : null;
    
    return { primary, secondary };
  }
  
  // 로그 제한을 위한 시간 추적
  private _lastLogTime: number = 0;
  
  /**
   * fetch API 가로채기 설정
   */
  private setupInterception(): void {
    if (typeof window === 'undefined' || !window.fetch) return;
    
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const response = await originalFetch.apply(this, [input, init]);
      
      if (self.interceptActive && url.includes('subtitle') && url.includes('.vtt')) {
        try {
          const clonedResponse = response.clone();
          const content = await clonedResponse.text();
          const cues = parseVTT(content);
          
          // 자막 언어 감지 로직 개선 및 디버깅 로깅 추가
          let language = 'unknown';
          
          console.log(`자막 URL 분석: ${url}`);
          
          // 1. URL에서 언어 코드 추출 시도 - 더 포괄적인 패턴 추가
          if (url.includes('-ko') || url.includes('ko-') || url.includes('korean') || url.includes('kor') || 
              url.includes('ko.vtt') || url.includes('.ko.') || url.includes('Korean') || url.includes('KOR')) {
            language = 'ko';
            console.log(`한국어 자막 감지됨 (URL): ${url}`);
          } else if (url.includes('-en') || url.includes('en-') || url.includes('english') || url.includes('eng') || 
                    url.includes('en.vtt') || url.includes('.en.') || url.includes('English') || url.includes('ENG')) {
            language = 'en';
            console.log(`영어 자막 감지됨 (URL): ${url}`);
          } 
          // 2. 언어 감지가 되지 않으면 콘텐츠 분석
          else {
            // 임시로 콘텐츠의 일부 표시 
            console.log(`자막 내용 샘플: ${content.substring(0, 100)}...`);
            language = detectLanguageFromContent(content, cues);
            console.log(`URL 기반 언어 감지 실패, 콘텐츠 분석 결과: ${language}, URL: ${url}`);
          }
          
          console.log(`자막 언어 감지: ${language} (${url})`);
          
          const subtitle = {
            url,
            content,
            cues,
            language
          };
          
          // 언어에 따라 다르게 저장
          if (language === 'ko') {
            self.primarySubtitle = subtitle;
            console.log('한국어 자막이 primarySubtitle으로 설정됨');
          } else if (language === 'en') {
            self.secondarySubtitle = subtitle;
            console.log('영어 자막이 secondarySubtitle으로 설정됨');
          } else {
            // 언어를 판별할 수 없는 경우 내용 분석
            const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content);
            const hasEnglish = /[a-zA-Z]/.test(content);
            
            if (hasKorean && !self.primarySubtitle) {
              self.primarySubtitle = subtitle;
              console.log('내용 분석 결과 한국어 자막으로 판단하여 primarySubtitle으로 설정됨');
            } else if (hasEnglish && !self.secondarySubtitle) {
              self.secondarySubtitle = subtitle;
              console.log('내용 분석 결과 영어 자막으로 판단하여 secondarySubtitle으로 설정됨');
            } else {
              // 기본적으로 주 자막으로 설정 (이미 설정된 경우 보조 자막으로)
              if (!self.primarySubtitle) {
                self.primarySubtitle = subtitle;
                console.log('기본값으로 primarySubtitle으로 설정됨');
              } else if (!self.secondarySubtitle) {
                self.secondarySubtitle = subtitle;
                console.log('기본값으로 secondarySubtitle으로 설정됨');
              }
            }
          }
          
          // 리스너에게 알림
          self.listeners.forEach(listener => {
            listener.onSubtitleLoaded(subtitle);
          });
          
          console.log(`자막 파일이 로드되었습니다: ${language}, ${cues.length}개의 큐`);
        } catch (error) {
          console.error('자막 처리 중 오류:', error);
          
          // 오류 알림
          self.listeners.forEach(listener => {
            listener.onSubtitleError(error instanceof Error ? error : new Error(String(error)));
          });
        }
      }
      
      return response;
    };
  }
}

/**
 * 자막 내용 분석을 통한 언어 감지
 */
function detectLanguageFromContent(content: string, cues: SubtitleCue[]): string {
  // 간단한 언어 감지 로직 구현
  // 한글 포함 여부 체크
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
  
  // 영어 단어 체크 (일반적인 영어 단어)
  const englishCommonWords = /\b(the|and|is|in|to|of|that|this|you|for|are|with|have|be|on|not|it)\b/i;
  
  // 내용에서 처음 50개 큐 샘플링
  const sampleCues = cues.slice(0, 50);
  let koreanCount = 0;
  let englishCount = 0;
  
  for (const cue of sampleCues) {
    if (koreanRegex.test(cue.text)) {
      koreanCount++;
    }
    if (englishCommonWords.test(cue.text)) {
      englishCount++;
    }
  }
  
  // 감지된 비율에 따라 언어 결정
  if (koreanCount > englishCount) {
    return 'ko';
  } else if (englishCount > koreanCount) {
    return 'en';
  }
  
  // 확실하지 않은 경우 기본값
  return 'unknown';
}

export default new VTTSubtitleManager();
