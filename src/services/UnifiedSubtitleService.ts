/**
 * 통합 자막 서비스 - VTT 기반 자막 데이터를 화면 출력과 분석 모두에 사용
 */
import { logger } from '../utils/logger';

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface CapturedSubtitle {
  url: string;
  content: string;
  cues: SubtitleCue[];
  language?: string;
}

// 화면 출력용 자막 정보 인터페이스 (기존 SubtitleInfo와 호환)
export interface DisplaySubtitleInfo {
  text: string;
  language: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

// 통합 자막 리스너 인터페이스
interface UnifiedSubtitleListener {
  // VTT 데이터 로드 완료
  onSubtitleLoaded?: (subtitle: CapturedSubtitle) => void;
  // 현재 시간 기반 자막 변경 (화면 출력용)
  onDisplaySubtitleChanged?: (subtitles: DisplaySubtitleInfo[]) => void;
  // 자막 제거됨
  onSubtitleCleared?: () => void;
  // 에러 발생
  onSubtitleError?: (error: Error) => void;
}

/**
 * 비디오 플레이어에서 현재 재생 시간에 맞는 자막 찾기
 */
export function findActiveSubtitleCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;
  
  return cues.find(cue => currentTime >= cue.startTime && currentTime <= cue.endTime) || null;
}

/**
 * 통합 자막 서비스 클래스
 * - VTT 데이터를 단일 소스로 사용
 * - 화면 출력용과 분석용 모두 지원
 * - 기존 SubtitleObserver를 대체
 */
export class UnifiedSubtitleService {
  private primarySubtitle: CapturedSubtitle | null = null;
  private secondarySubtitle: CapturedSubtitle | null = null;
  private listeners: UnifiedSubtitleListener[] = [];
  
  // 화면 출력용 실시간 업데이트
  private updateInterval: number | null = null;
  private currentVideoElement: HTMLVideoElement | null = null;
  private lastDisplayedSubtitles: DisplaySubtitleInfo[] = [];
  
  // 로그 제한을 위한 시간 추적
  private _lastLogTime: number = 0;

  /**
   * 서비스 시작 (화면 출력용 실시간 업데이트 포함)
   */
  public start(videoElement?: HTMLVideoElement): void {
    logger.log('통합 자막 서비스 시작됨');
    
    if (videoElement) {
      this.currentVideoElement = videoElement;
      this.startDisplayUpdate();
    }
  }

  /**
   * 서비스 중지
   */
  public stop(): void {
    this.stopDisplayUpdate();
    this.currentVideoElement = null;
    logger.log('통합 자막 서비스 중지됨');
  }

  /**
   * 화면 출력용 실시간 업데이트 시작
   */
  private startDisplayUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // 100ms마다 현재 자막 확인 및 업데이트
    this.updateInterval = window.setInterval(() => {
      this.updateDisplaySubtitles();
    }, 100);
  }

  /**
   * 화면 출력용 실시간 업데이트 중지
   */
  private stopDisplayUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 현재 재생 시간 기반으로 화면 출력용 자막 업데이트
   */
  private updateDisplaySubtitles(): void {
    if (!this.currentVideoElement) return;

    const currentTime = this.currentVideoElement.currentTime;
    const activeSubtitles = this.getActiveSubtitles(currentTime);
    
    const displaySubtitles: DisplaySubtitleInfo[] = [];
    
    // Primary 자막 추가
    if (activeSubtitles.primary) {
      displaySubtitles.push({
        text: activeSubtitles.primary.text,
        language: this.primarySubtitle?.language || 'primary',
        startTime: activeSubtitles.primary.startTime,
        endTime: activeSubtitles.primary.endTime,
        isActive: true
      });
    }
    
    // Secondary 자막 추가
    if (activeSubtitles.secondary) {
      displaySubtitles.push({
        text: activeSubtitles.secondary.text,
        language: this.secondarySubtitle?.language || 'secondary',
        startTime: activeSubtitles.secondary.startTime,
        endTime: activeSubtitles.secondary.endTime,
        isActive: true
      });
    }

    // 자막 변경 감지 및 알림
    if (this.hasDisplaySubtitlesChanged(displaySubtitles)) {
      this.lastDisplayedSubtitles = displaySubtitles;
      
      if (displaySubtitles.length === 0) {
        this.notifySubtitleCleared();
      } else {
        this.notifyDisplaySubtitleChanged(displaySubtitles);
      }
    }
  }

  /**
   * 화면 출력용 자막이 변경되었는지 확인
   */
  private hasDisplaySubtitlesChanged(newSubtitles: DisplaySubtitleInfo[]): boolean {
    if (this.lastDisplayedSubtitles.length !== newSubtitles.length) {
      return true;
    }

    for (let i = 0; i < newSubtitles.length; i++) {
      const current = this.lastDisplayedSubtitles[i];
      const newSub = newSubtitles[i];
      
      if (!current || 
          current.text !== newSub.text || 
          current.language !== newSub.language ||
          current.startTime !== newSub.startTime ||
          current.endTime !== newSub.endTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * 모든 내부 자막 데이터 초기화
   */
  public clearSubtitles(): void {
    this.primarySubtitle = null;
    this.secondarySubtitle = null;
    this.lastDisplayedSubtitles = [];
    this.notifySubtitleCleared();
    logger.log('[UnifiedSubtitleService] 모든 자막 데이터가 초기화되었습니다.');
  }

  /**
   * 백그라운드 스크립트로부터 VTT 데이터 처리
   */
  public processCapturedVTT(subtitleData: CapturedSubtitle): void {
    if (!subtitleData || !subtitleData.cues) {
      logger.warn('[UnifiedSubtitleService] 잘못된 자막 데이터 수신');
      this.notifySubtitleError(new Error('Invalid subtitle data received'));
      return;
    }

    const { url, content, cues, language } = subtitleData;
    logger.log(`[UnifiedSubtitleService] VTT 데이터 처리 중: ${url}, 언어: ${language}, 큐 수: ${cues.length}`);

    const subtitle: CapturedSubtitle = {
      url,
      content,
      cues,
      language
    };

    // 언어별 자막 할당
    this.assignSubtitleByLanguage(subtitle, language, content);

    // 리스너에게 로드 완료 알림
    this.notifySubtitleLoaded(subtitle);

    logger.log(`[UnifiedSubtitleService] 자막 처리 완료: ${language}, ${cues.length}개 큐`);
  }

  /**
   * 언어별 자막 할당 로직
   */
  private assignSubtitleByLanguage(subtitle: CapturedSubtitle, language: string = 'unknown', content: string): void {
    if (language === 'ko') {
      this.primarySubtitle = subtitle;
      logger.log('[UnifiedSubtitleService] 한국어 자막 → Primary');
    } else if (language === 'en') {
      this.secondarySubtitle = subtitle;
      logger.log('[UnifiedSubtitleService] 영어 자막 → Secondary');
    } else {
      // 언어 자동 감지
      const detectedLanguage = this.detectLanguageFromContent(content, subtitle.cues);
      
      if (detectedLanguage === 'ko' && !this.primarySubtitle) {
        this.primarySubtitle = subtitle;
        logger.log('[UnifiedSubtitleService] 감지된 한국어 자막 → Primary');
      } else if (detectedLanguage === 'en' && !this.secondarySubtitle) {
        this.secondarySubtitle = subtitle;
        logger.log('[UnifiedSubtitleService] 감지된 영어 자막 → Secondary');
      } else {
        // 기본 할당
        if (!this.primarySubtitle) {
          this.primarySubtitle = subtitle;
          logger.log('[UnifiedSubtitleService] 기본 할당 → Primary');
        } else if (!this.secondarySubtitle) {
          this.secondarySubtitle = subtitle;
          logger.log('[UnifiedSubtitleService] 기본 할당 → Secondary');
        }
      }
    }
  }

  /**
   * 자막 내용 기반 언어 감지
   */
  private detectLanguageFromContent(content: string, cues: SubtitleCue[]): string {
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    const englishCommonWords = /\b(the|and|is|in|to|of|that|this|you|for|are|with|have|be|on|not|it)\b/i;
    
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
    
    if (koreanCount > englishCount) {
      return 'ko';
    } else if (englishCount > koreanCount) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * 현재 재생 시간에 맞는 자막 반환 (기존 VTTSubtitleManager 호환)
   */
  public getActiveSubtitles(currentTime: number, syncOffset: number = 0): {
    primary: SubtitleCue | null;
    secondary: SubtitleCue | null;
  } {
    const adjustedTime = currentTime - syncOffset;
    
    // 자막 부재 시 로그 제한
    if (!this.primarySubtitle && !this.secondarySubtitle) {
      const now = Date.now();
      if (!this._lastLogTime || now - this._lastLogTime > 5000) {
        logger.log('VTT 자막이 로드되지 않았습니다.');
        this._lastLogTime = now;
      }
    }
    
    const primary = this.primarySubtitle?.cues?.length 
      ? findActiveSubtitleCue(this.primarySubtitle.cues, adjustedTime)
      : null;
    
    const secondary = this.secondarySubtitle?.cues?.length
      ? findActiveSubtitleCue(this.secondarySubtitle.cues, adjustedTime)
      : null;
    
    return { primary, secondary };
  }

  /**
   * 리스너 관리
   */
  public addListener(listener: UnifiedSubtitleListener): void {
    this.listeners.push(listener);
  }

  public removeListener(listener: UnifiedSubtitleListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 리스너 알림 메소드들
   */
  private notifySubtitleLoaded(subtitle: CapturedSubtitle): void {
    this.listeners.forEach(listener => {
      listener.onSubtitleLoaded?.(subtitle);
    });
  }

  private notifyDisplaySubtitleChanged(subtitles: DisplaySubtitleInfo[]): void {
    this.listeners.forEach(listener => {
      listener.onDisplaySubtitleChanged?.(subtitles);
    });
  }

  private notifySubtitleCleared(): void {
    this.listeners.forEach(listener => {
      listener.onSubtitleCleared?.();
    });
  }

  private notifySubtitleError(error: Error): void {
    this.listeners.forEach(listener => {
      listener.onSubtitleError?.(error);
    });
  }

  /**
   * 현재 로드된 자막 정보 반환
   */
  public getLoadedSubtitles(): {
    primary: CapturedSubtitle | null;
    secondary: CapturedSubtitle | null;
  } {
    return {
      primary: this.primarySubtitle,
      secondary: this.secondarySubtitle
    };
  }
}

/**
 * 싱글톤 인스턴스 export
 */
export default new UnifiedSubtitleService();
