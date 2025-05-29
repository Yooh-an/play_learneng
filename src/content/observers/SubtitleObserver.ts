import { findActiveSubtitles, extractSubtitleInfo, SubtitleInfo } from '../../utils/subtitleExtractor';

export interface SubtitleChangeListener {
  onSubtitleChanged: (subtitles: SubtitleInfo[]) => void;
  onSubtitleCleared: () => void;
}

/**
 * 쿠팡 플레이의 자막 변경을 감지하고 처리하는 클래스
 */
export default class SubtitleObserver {
  private observer: MutationObserver | null = null;
  private listeners: SubtitleChangeListener[] = [];
  private currentSubtitles: SubtitleInfo[] = [];
  private videoElement: HTMLVideoElement;
  private subtitleContainer: Element;
  
  constructor(videoElement: HTMLVideoElement, subtitleContainer: Element) {
    this.videoElement = videoElement;
    this.subtitleContainer = subtitleContainer;
  }
  
  /**
   * 자막 변경 리스너 등록
   */
  public addListener(listener: SubtitleChangeListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * 자막 변경 리스너 제거
   */
  public removeListener(listener: SubtitleChangeListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * 자막 변경 감지 시작
   */
  public start(): void {
    if (this.observer) {
      this.stop();
    }
    
    this.observer = new MutationObserver(this.handleMutation);
    
    // 자막 컨테이너 변화 감지 설정
    this.observer.observe(this.subtitleContainer, {
      childList: true,      // 자식 노드 추가/제거 감시
      subtree: true,        // 자식의 자식까지 감시
      characterData: true,  // 텍스트 내용 변경 감시
      attributes: false     // 속성 변경은 제외
    });
    
    // 초기 자막이 이미 화면에 있는 경우 처리
    this.processCurrentSubtitles();
    
    console.log('Play LearnEng: 자막 변경 감지 시작됨');
  }
  
  /**
   * 자막 변경 감지 중지
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('Play LearnEng: 자막 변경 감지 중지됨');
    }
  }
  
  /**
   * 현재 표시된 자막 처리
   */
  private processCurrentSubtitles = (): void => {
    const activeSubtitleElements = findActiveSubtitles(this.subtitleContainer);
    
    console.log('활성 자막 요소 수:', activeSubtitleElements.length);
    
    if (activeSubtitleElements.length === 0) {
      if (this.currentSubtitles.length > 0) {
        this.currentSubtitles = [];
        this.notifySubtitleCleared();
      }
      return;
    }
    
    const newSubtitles = activeSubtitleElements
      .map(el => extractSubtitleInfo(el, this.videoElement))
      .filter((info): info is SubtitleInfo => info !== null);
    
    console.log('추출된 자막 정보:', newSubtitles);
    
    if (newSubtitles.length > 0) {
      this.currentSubtitles = newSubtitles;
      this.notifySubtitleChanged();
    }
  }
  
  /**
   * DOM 변경 처리
   */
  private handleMutation = (mutations: MutationRecord[]): void => {
    let shouldProcess = false;
    
    for (const mutation of mutations) {
      // 자막 관련 변경사항인지 확인
      if (
        mutation.type === 'childList' || 
        mutation.type === 'characterData'
      ) {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      // DOM 변경 후 약간의 지연을 주어 안정화
      setTimeout(this.processCurrentSubtitles, 50);
    }
  }
  
  /**
   * 자막 변경 알림
   */
  private notifySubtitleChanged(): void {
    for (const listener of this.listeners) {
      listener.onSubtitleChanged(this.currentSubtitles);
    }
  }
  
  /**
   * 자막 제거 알림
   */
  private notifySubtitleCleared(): void {
    for (const listener of this.listeners) {
      listener.onSubtitleCleared();
    }
  }
}
