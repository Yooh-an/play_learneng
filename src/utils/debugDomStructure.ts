/**
 * 쿠팡 플레이 DOM 구조 분석 및 디버깅을 위한 유틸리티
 */

/**
 * 쿠팡 플레이 영상 페이지의 DOM 구조를 분석하여 자막 관련 요소를 찾습니다.
 */
export function analyzeVideoPlayerDOM() {
  console.log('==== 쿠팡 플레이 DOM 구조 분석 시작 ====');
  
  // 1. 비디오 요소 분석
  const videoElements = document.querySelectorAll('video');
  console.log(`비디오 요소 수: ${videoElements.length}`);
  
  videoElements.forEach((video, index) => {
    console.log(`비디오 요소 ${index + 1}:`, {
      id: video.id,
      className: video.className,
      src: video.src,
      currentSrc: video.currentSrc,
      parentElement: {
        tagName: video.parentElement?.tagName,
        id: video.parentElement?.id,
        className: video.parentElement?.className
      }
    });
  });
  
  // 2. 자막 관련 요소 검색
  const possibleSubtitleContainers = [
    ...document.querySelectorAll('.subtitle'),
    ...document.querySelectorAll('.subtitles'),
    ...document.querySelectorAll('.caption'),
    ...document.querySelectorAll('.captions'),
    ...document.querySelectorAll('[data-test*="subtitle"]'),
    ...document.querySelectorAll('[data-test*="caption"]'),
    ...document.querySelectorAll('[class*="subtitle"]'),
    ...document.querySelectorAll('[class*="caption"]'),
    ...document.querySelectorAll('[aria-live="polite"]')
  ];
  
  console.log(`잠재적 자막 컨테이너 수: ${possibleSubtitleContainers.length}`);
  
  possibleSubtitleContainers.forEach((container, index) => {
    console.log(`자막 컨테이너 후보 ${index + 1}:`, {
      tagName: container.tagName,
      id: container.id,
      className: container.className,
      textContent: container.textContent?.trim().substring(0, 50) + '...',
      attributes: Array.from(container.attributes).map(attr => `${attr.name}="${attr.value}"`),
      children: container.childElementCount,
      rect: container.getBoundingClientRect()
    });
    
    // 자막 텍스트 요소로 보이는 자식 요소들 분석
    Array.from(container.children).forEach((child, childIndex) => {
      if (child.textContent?.trim()) {
        console.log(`  - 자식 요소 ${childIndex + 1}:`, {
          tagName: child.tagName,
          className: child.className,
          textContent: child.textContent?.trim(),
        });
      }
    });
  });
  
  // 3. DOM 변화 감지 설정
  console.log('DOM 변화 감지 설정 중...');
  
  // 자막으로 추정되는 요소를 클릭하면 해당 요소의 정보를 콘솔에 출력하는 이벤트 리스너
  document.body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // 클릭한 요소가 텍스트를 포함하는 경우
    if (target && target.textContent?.trim() && !target.querySelector('input, button, a')) {
      console.log('클릭한 요소 정보:', {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        textContent: target.textContent.trim(),
        path: getElementPath(target)
      });
      
      e.stopPropagation();
    }
  }, true);
  
  console.log('==== 쿠팡 플레이 DOM 구조 분석 완료 ====');
  return '분석이 완료되었습니다. 개발자 도구 콘솔을 확인해주세요.';
}

/**
 * 특정 요소의 CSS 선택자 경로를 생성합니다.
 */
function getElementPath(element: Element): string {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  const path = [];
  let currentElement: Element | null = element;
  
  while (currentElement && currentElement !== document.body) {
    let selector = currentElement.tagName.toLowerCase();
    
    if (currentElement.id) {
      selector += `#${currentElement.id}`;
    } else {
      const siblings = Array.from(currentElement.parentElement?.children || []);
      const sameTagSiblings = siblings.filter(sibling => 
        sibling.tagName === currentElement!.tagName
      );
      
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(currentElement);
        selector += `:nth-of-type(${index + 1})`;
      }
    }
    
    path.unshift(selector);
    currentElement = currentElement.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * 페이지에서 자막이 있는 부분을 강조 표시합니다.
 */
export function highlightSubtitleElements() {
  const possibleSubtitleContainers = [
    ...document.querySelectorAll('.subtitle'),
    ...document.querySelectorAll('.subtitles'),
    ...document.querySelectorAll('.caption'),
    ...document.querySelectorAll('.captions'),
    ...document.querySelectorAll('[data-test*="subtitle"]'),
    ...document.querySelectorAll('[data-test*="caption"]'),
    ...document.querySelectorAll('[class*="subtitle"]'),
    ...document.querySelectorAll('[class*="caption"]'),
    ...document.querySelectorAll('[aria-live="polite"]')
  ];
  
  possibleSubtitleContainers.forEach((container) => {
    // 원래 스타일 백업
    const originalStyle = {
      outline: container.style.outline,
      backgroundColor: container.style.backgroundColor,
      boxShadow: container.style.boxShadow
    };
    
    // 강조 스타일 적용
    container.style.outline = '3px solid red';
    container.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    container.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    
    // 콘솔에 정보 출력
    console.log('강조 표시된 자막 요소:', container);
    
    // 10초 후 원래 스타일로 복원
    setTimeout(() => {
      container.style.outline = originalStyle.outline;
      container.style.backgroundColor = originalStyle.backgroundColor;
      container.style.boxShadow = originalStyle.boxShadow;
    }, 10000);
  });
  
  return `${possibleSubtitleContainers.length}개의 자막 요소를 강조 표시했습니다. 10초 동안 빨간색으로 표시됩니다.`;
}
