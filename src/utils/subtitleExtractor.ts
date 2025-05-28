/**
 * 자막 텍스트 추출 및 처리를 위한 유틸리티
 */

/**
 * 자막 정보 인터페이스
 */
export interface SubtitleInfo {
  text: string;
  language?: string;
  startTime?: number;
  endTime?: number;
  isActive: boolean;
}

/**
 * 쿠팡 플레이 자막 요소에서 자막 텍스트 추출
 */
export function extractSubtitleText(subtitleElement: Element): string | null {
  if (!subtitleElement) return null;
  
  // 단순 텍스트만 있을 경우
  if (subtitleElement.childElementCount === 0) {
    return subtitleElement.textContent?.trim() || null;
  }
  
  // 자식 요소를 가진 복잡한 구조의 자막일 경우 (예: 스타일링된 자막)
  const textFragments: string[] = [];
  
  // 텍스트 노드 누적
  const extractText = (element: Element | ChildNode) => {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent?.trim();
      if (text) textFragments.push(text);
      return;
    }
    
    // HTML 요소인 경우 자식들을 재귀적으로 처리
    if (element.nodeType === Node.ELEMENT_NODE) {
      if (element.nodeName === 'BR') {
        textFragments.push('\n');
      }
      
      for (const child of Array.from(element.childNodes)) {
        extractText(child);
      }
    }
  };
  
  extractText(subtitleElement);
  return textFragments.join(' ') || null;
}

/**
 * 자막 요소에서 자막 상태 정보 추출
 */
export function extractSubtitleInfo(subtitleElement: Element, videoPlayer: HTMLVideoElement): SubtitleInfo | null {
  if (!subtitleElement) return null;
  
  const text = extractSubtitleText(subtitleElement);
  if (!text) return null;
  
  // 기본 정보로 자막 객체 생성
  return {
    text,
    isActive: true, // 볼 수 있는 자막은 활성 상태로 간주
    // startTime과 endTime은 자막 요소에 timestamp 정보가 포함되어 있다면 추출 가능
    startTime: videoPlayer.currentTime,
  };
}

/**
 * 자막 컨테이너에서 활성화된 자막 요소 찾기
 */
export function findActiveSubtitles(subtitleContainer: Element): Element[] {
  if (!subtitleContainer) return [];
  
  // 일반적인 자막 요소 선택자 (사이트마다 다를 수 있음)
  const subtitleSelectors = [
    '.subtitle-cue', // 일반적인 자막 클래스
    '.subtitle-text',
    '.caption-text',
    '[data-testid="subtitle-text"]',
  ];
  
  // 모든 선택자에 대해 시도
  for (const selector of subtitleSelectors) {
    const elements = Array.from(subtitleContainer.querySelectorAll(selector));
    if (elements.length > 0) {
      // 보이는 요소만 필터링 (display: none 아닌 것)
      return elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    }
  }
  
  // 선택자로 찾을 수 없다면 모든 자식 요소 중 텍스트가 있는 것들 반환
  return Array.from(subtitleContainer.children).filter(el => 
    (el.textContent?.trim().length || 0) > 0
  );
}

export default {
  extractSubtitleText,
  extractSubtitleInfo,
  findActiveSubtitles
};
