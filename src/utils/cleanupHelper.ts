/**
 * 확장 프로그램 정리 및 원래 상태로 복원하는 유틸리티
 */

/**
 * CSS 스타일 요소를 삭제하여 원래 자막 표시 복원
 */
export function restoreOriginalSubtitles(): void {
  try {
    console.log('원래 자막 표시 복원 중...');
    
    // 주입된 스타일 제거
    const styleElement = document.getElementById('play-learneng-subtitle-hider');
    if (styleElement) {
      styleElement.remove();
      console.log('주입된 스타일 제거됨');
    }
    
    // data-pleng-controlled 속성이 있는 자막 컨테이너 찾기
    const subtitleContainer = document.querySelector('[data-pleng-controlled="true"]');
    if (subtitleContainer) {
      // 원래 display 값 복원
      const originalDisplay = subtitleContainer.getAttribute('data-pleng-original-display');
      if (originalDisplay && subtitleContainer instanceof HTMLElement) {
        subtitleContainer.style.display = originalDisplay;
        subtitleContainer.style.opacity = '1';
        subtitleContainer.style.visibility = 'visible';
        subtitleContainer.style.pointerEvents = 'auto';
        subtitleContainer.removeAttribute('aria-hidden');
      }
      
      // 자식 요소들의 display 속성 복원
      const childElements = subtitleContainer.querySelectorAll('p, span, div');
      childElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = '';
          element.style.opacity = '1';
          element.style.visibility = 'visible';
        }
      });
      
      // 컨트롤 데이터 속성 제거
      subtitleContainer.removeAttribute('data-pleng-controlled');
      subtitleContainer.removeAttribute('data-pleng-original-display');
      
      console.log('원래 자막이 복원되었습니다');
    } else {
      console.log('제어된 자막 컨테이너를 찾을 수 없음');
    }
  } catch (error) {
    console.error('자막 복원 중 오류 발생:', error);
  }
}

/**
 * 확장 프로그램에 의해 설정된 모든 리소스와 이벤트 리스너 정리
 */
export function cleanupExtensionResources(): void {
  try {
    console.log('확장 프로그램 리소스 정리 중...');
    
    // 1. 원래 자막 복원
    restoreOriginalSubtitles();
    
    // 2. 확장에 의해 추가된 DOM 요소 제거
    const extensionElements = document.querySelectorAll('[data-pleng-element]');
    extensionElements.forEach(element => element.remove());
    
    // 3. 전역 변수 정리
    if (window.capturedSubtitles) {
      delete window.capturedSubtitles;
    }
    
    console.log('확장 프로그램 리소스 정리 완료');
  } catch (error) {
    console.error('리소스 정리 중 오류 발생:', error);
  }
}

// 페이지 언로드 시 정리 작업 수행
window.addEventListener('beforeunload', cleanupExtensionResources);

export default {
  restoreOriginalSubtitles,
  cleanupExtensionResources
};
