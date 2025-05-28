console.log('Play LearnEng Background Script Loaded');

// 확장 프로그램 설치 또는 업데이트 시 실행
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Play LearnEng installed');
    // 기본 설정 초기화 등의 작업 수행
  } else if (details.reason === 'update') {
    console.log('Play LearnEng updated');
  }
});
