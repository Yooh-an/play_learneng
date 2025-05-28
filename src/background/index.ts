console.log('Play LearnEng Background Script Loaded');

// 설정 기본값
const DEFAULT_SETTINGS = {
  primaryLanguage: 'ko',
  secondaryLanguage: 'en',
  displayMode: 'dual',
  subtitleStyle: {
    position: 'bottom',
    fontSize: 16,
    fontWeight: 'normal',
    color: '#ffffff',
    backgroundColor: '#000000',
    opacity: 0.8,
    autoWrap: true,
  }
};

// 확장 프로그램 설치 또는 업데이트 시 실행
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Play LearnEng installed');
    
    // 기본 설정 초기화
    await chrome.storage.sync.set({
      settings: DEFAULT_SETTINGS,
      savedSubtitles: []
    });
    
    // 설치 후 옵션 페이지 열기
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Play LearnEng updated');
    
    // 업데이트 시 필요한 마이그레이션 작업
    try {
      const data = await chrome.storage.sync.get('settings');
      if (!data.settings) {
        // 설정이 없는 경우 기본값으로 초기화
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
      }
    } catch (error) {
      console.error('설정 마이그레이션 중 오류 발생:', error);
    }
  }
});

// Content Script와 통신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    // 설정 데이터 요청 처리
    chrome.storage.sync.get('settings', (data) => {
      sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
  
  if (message.action === 'saveSubtitle') {
    // 자막 저장 처리
    chrome.storage.sync.get('savedSubtitles', (data) => {
      const savedSubtitles = data.savedSubtitles || [];
      savedSubtitles.push({
        ...message.subtitle,
        savedAt: new Date().toISOString()
      });
      
      chrome.storage.sync.set({ savedSubtitles }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
