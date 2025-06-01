// 개발/프로덕션 환경 구분 및 로깅 유틸리티

// Vite's build-time development mode flag
// This helps in conditionally logging errors that occur during development environment detection itself.
const RUNNING_IN_DEV_MODE = import.meta.env.DEV;

// 개발 환경 감지
export const isDevelopment = () => {
  try {
    // Chrome 확장 프로그램에서는 unpacked extension인지 확인
    const manifest = chrome.runtime.getManifest();
    return manifest.version_name?.includes('dev') || 
           chrome.runtime.id === 'unpacked-extension-id' ||
           !manifest.update_url; // unpacked extension일 때 update_url이 없음
  } catch (e) {
    // Only log this specific error if we are in a development build.
    // In a production build, this error will be suppressed.
    if (RUNNING_IN_DEV_MODE) {
      console.error('[Play LearnEng Logger] Failed to get manifest (during dev check, will assume prod):', e);
    }
    return false; // 에러 발생 시 안전하게 false 반환 (프로덕션 환경으로 간주)
  }
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
