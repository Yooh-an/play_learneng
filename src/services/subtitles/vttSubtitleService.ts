/**
 * WebVTT 자막 관련 서비스 구현
 */
import { parseVTT } from '../../utils/subtitleCapturer';
import { logger } from '../../utils/logger';

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface CapturedSubtitle { // export 추가
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
    logger.log(`VTT 자막 파일 로드 중: ${url} (${language})`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const content = await response.text();
    const cues = parseVTT(content);
    
    logger.log(`VTT 자막 로드 완료: ${cues.length}개의 큐`);
    
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
    // if (this.interceptActive) return; // interceptActive 플래그는 더 이상 fetch 가로채기에 사용되지 않음
    // this.interceptActive = true;
    // this.setupInterception(); // chrome.debugger 사용으로 fetch 가로채기 로직 제거
    
    logger.log('VTT 자막 매니저가 시작되었습니다. (chrome.debugger로부터 데이터 수신 대기)');
  }
  
  /**
   * 자막 감지 중지
   */
  public stop(): void {
    // this.interceptActive = false; // interceptActive 플래그는 더 이상 fetch 가로채기에 사용되지 않음
    logger.log('VTT 자막 매니저가 중지되었습니다.');
  }

  /**
   * 백그라운드 스크립트로부터 캡처된 VTT 데이터를 처리하는 메소드
   */
  public processCapturedVTT(subtitleData: CapturedSubtitle): void {
    if (!subtitleData || !subtitleData.cues) {
      console.warn('[VTTSubtitleManager] Invalid subtitle data received from background.');
      this.listeners.forEach(listener => {
        listener.onSubtitleError(new Error('Invalid subtitle data received'));
      });
      return;
    }

    const { url, content, cues, language } = subtitleData;
    logger.log(`[VTTSubtitleManager] Processing VTT data from background: ${url}, lang: ${language}, cues: ${cues.length}`);

    const subtitle: CapturedSubtitle = {
      url,
      content,
      cues,
      language
    };

    // 언어에 따라 다르게 저장 (기존 로직과 유사하게)
    if (language === 'ko') {
      this.primarySubtitle = subtitle;
      logger.log('[VTTSubtitleManager] 한국어 자막이 primarySubtitle으로 설정됨 (from background)');
    } else if (language === 'en') {
      this.secondarySubtitle = subtitle;
      logger.log('[VTTSubtitleManager] 영어 자막이 secondarySubtitle으로 설정됨 (from background)');
    } else {
      // 언어를 판별할 수 없는 경우 (기존 로직 참고)
      const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content);
      const hasEnglish = /[a-zA-Z]/.test(content);
      
      if (hasKorean && !this.primarySubtitle) {
        this.primarySubtitle = subtitle;
        logger.log('[VTTSubtitleManager] 내용 분석 결과 한국어 자막으로 판단하여 primarySubtitle으로 설정됨 (from background)');
      } else if (hasEnglish && !this.secondarySubtitle) {
        this.secondarySubtitle = subtitle;
        logger.log('[VTTSubtitleManager] 내용 분석 결과 영어 자막으로 판단하여 secondarySubtitle으로 설정됨 (from background)');
      } else {
        if (!this.primarySubtitle) {
          this.primarySubtitle = subtitle;
          logger.log('[VTTSubtitleManager] 기본값으로 primarySubtitle으로 설정됨 (from background)');
        } else if (!this.secondarySubtitle) {
          this.secondarySubtitle = subtitle;
          logger.log('[VTTSubtitleManager] 기본값으로 secondarySubtitle으로 설정됨 (from background)');
        }
      }
    }

    // 리스너에게 알림
    this.listeners.forEach(listener => {
      listener.onSubtitleLoaded(subtitle);
    });

    logger.log(`[VTTSubtitleManager] 자막 파일이 로드 및 처리되었습니다: ${language}, ${cues.length}개의 큐 (from background)`);
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
        logger.log('VTT 자막이 로드되지 않았습니다. 자막을 찾을 수 없습니다.');
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
   * fetch API 가로채기 설정 (chrome.debugger 사용으로 더 이상 사용되지 않음)
   */
  private setupInterception(): void {
    // 이 메소드는 chrome.debugger API를 사용함에 따라 더 이상 호출되지 않습니다.
    // console.log('[VTTSubtitleManager] setupInterception is deprecated.');
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
