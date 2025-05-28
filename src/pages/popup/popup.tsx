import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';

const Popup = () => {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState(null);
  const [savedSubtitles, setSavedSubtitles] = useState([]);
  
  // 현재 탭 정보 가져오기
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setActiveTab(tabs[0].url);
        
        // 쿠팡 플레이 사이트인지 확인
        const isCoupangPlay = tabs[0].url.includes('coupangplay.com');
        setIsPlaying(isCoupangPlay);
      }
    });
    
    // 설정 로드
    chrome.storage.sync.get(['settings', 'savedSubtitles'], (data) => {
      if (data.settings) setSettings(data.settings);
      if (data.savedSubtitles) setSavedSubtitles(data.savedSubtitles);
    });
  }, []);
  
  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };
  
  return (
    <div className="p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-blue-600">Play LearnEng</h1>
        <button 
          onClick={openOptions}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          설정
        </button>
      </div>
      
      {isPlaying ? (
        <div className="bg-green-100 p-3 rounded mb-4">
          <p className="text-sm text-green-700">
            쿠팡 플레이가 감지되었습니다.
          </p>
          <p className="text-xs text-green-600 mt-1">
            페이지에서 Play LearnEng를 사용할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="bg-yellow-100 p-3 rounded mb-4">
          <p className="text-sm text-yellow-700">
            쿠팡 플레이 페이지가 아닙니다.
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            쿠팡 플레이 비디오 페이지로 이동해 주세요.
          </p>
        </div>
      )}
      
      <div className="border-t pt-3">
        <h2 className="text-md font-semibold mb-2">최근 저장한 자막</h2>
        {savedSubtitles.length > 0 ? (
          <div className="max-h-40 overflow-y-auto">
            {savedSubtitles.slice(-5).reverse().map((subtitle, index) => (
              <div key={index} className="mb-2 p-2 bg-gray-50 rounded text-xs">
                <div className="font-medium">{subtitle.primaryText}</div>
                {subtitle.secondaryText && (
                  <div className="text-gray-500 mt-1">{subtitle.secondaryText}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">저장된 자막이 없습니다.</p>
        )}
        
        <button 
          className="w-full mt-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/review/index.html') })}
        >
          모든 자막 보기
        </button>
      </div>
    </div>
  );
};

// 팝업 렌더링
ReactDOM.createRoot(document.getElementById('popup-root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
