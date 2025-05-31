// 개발/프로덕션 환경 구분 및 로깅 유틸리티

// 개발 환경 감지
export const isDevelopment = () => {
  // Chrome 확장 프로그램에서는 unpacked extension인지 확인
  return chrome.runtime.getManifest().version_name?.includes('dev') || 
         chrome.runtime.id === 'unpacked-extension-id' ||
         !chrome.runtime.getManifest().update_url; // unpacked extension일 때 update_url이 없음
};

// 프로덕션용 로거
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment()) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args); // 경고는 프로덕션에서도 표시
  },
  error: (...args: any[]) => {
    console.error(...args); // 에러는 프로덕션에서도 표시
  },
  debug: (...args: any[]) => {
    if (isDevelopment()) {
      console.log('[DEBUG]', ...args);
    }
  }
};

// 레거시 console.log를 교체하기 위한 타입 안전 로거
export default logger;
