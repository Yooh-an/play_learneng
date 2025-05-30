import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';

type TabType = 'review' | 'analysis' | 'subtitle';

interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
}

interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: 'bottom' | 'top';
  opacity: number;
}

const Popup = () => {
  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState<SubtitleSettings>({
    enabled: true,
    primaryLanguage: 'ko',
    secondaryLanguage: 'en',
    fontSize: 16,
    position: 'bottom',
    opacity: 0.9
  });
  const [savedSubtitles, setSavedSubtitles] = useState<SavedSubtitle[]>([]);
  const [currentSubtitles, setCurrentSubtitles] = useState<any[]>([]);
  
  // 초기화
  useEffect(() => {
    // 현재 탭 정보 확인
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const isCoupangPlay = tabs[0].url.includes('coupangplay.com');
        setIsPlaying(isCoupangPlay);
      }
    });
    
    // 데이터 로드
    chrome.storage.sync.get(['subtitleSettings', 'savedSubtitles', 'currentSubtitles'], (data) => {
      if (data.subtitleSettings) setSettings(data.subtitleSettings);
      if (data.savedSubtitles) setSavedSubtitles(data.savedSubtitles);
      if (data.currentSubtitles) setCurrentSubtitles(data.currentSubtitles);
    });
  }, []);

  // 설정 저장
  const saveSettings = (newSettings: SubtitleSettings) => {
    setSettings(newSettings);
    chrome.storage.sync.set({ subtitleSettings: newSettings });
    
    // 활성 탭에 설정 변경 알림
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'SETTINGS_UPDATED', 
          settings: newSettings 
        });
      }
    });
  };

  // 저장된 자막 삭제
  const deleteSubtitle = (id: string) => {
    const updated = savedSubtitles.filter(sub => sub.id !== id);
    setSavedSubtitles(updated);
    chrome.storage.sync.set({ savedSubtitles: updated });
  };

  // 영상 시점으로 이동
  const jumpToTimestamp = (timestamp: number) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'JUMP_TO_TIME', 
          timestamp 
        });
      }
    });
  };

  const TabButton = ({ tab, label, isActive, onClick }: {
    tab: TabType;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  const ReviewTab = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">단어장</h3>
        <span className="text-sm text-gray-500">{savedSubtitles.length}개</span>
      </div>
      
      {savedSubtitles.length > 0 ? (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {savedSubtitles.slice().reverse().map((subtitle) => (
            <div key={subtitle.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">{subtitle.primaryText}</div>
                  {subtitle.secondaryText && (
                    <div className="text-sm text-gray-600">{subtitle.secondaryText}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteSubtitle(subtitle.id)}
                  className="ml-2 text-red-400 hover:text-red-600 text-sm"
                >
                  ✕
                </button>
              </div>
              {subtitle.episodeTitle && (
                <div className="text-xs text-gray-400 mb-2">{subtitle.episodeTitle}</div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {new Date(subtitle.timestamp).toLocaleString()}
                </span>
                <button
                  onClick={() => jumpToTimestamp(subtitle.timestamp)}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={!isPlaying}
                >
                  이동
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📝</div>
          <p>저장된 자막이 없습니다</p>
          <p className="text-sm mt-1">영상에서 자막을 클릭하여 저장해보세요</p>
        </div>
      )}
    </div>
  );

  const AnalysisTab = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">스크립트</h3>
        <span className="text-sm text-gray-500">{currentSubtitles.length}개</span>
      </div>
      
      {isPlaying ? (
        currentSubtitles.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {currentSubtitles.map((subtitle, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => jumpToTimestamp(subtitle.startTime)}>
                <div className="text-sm font-medium">{subtitle.text}</div>
                {subtitle.translation && (
                  <div className="text-xs text-gray-600 mt-1">{subtitle.translation}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {Math.floor(subtitle.startTime / 60)}:{(subtitle.startTime % 60).toFixed(1).padStart(4, '0')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📺</div>
            <p>자막 데이터가 없습니다</p>
            <p className="text-sm mt-1">영상을 재생하면 자막이 표시됩니다</p>
          </div>
        )
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🎬</div>
          <p>쿠팡 플레이 페이지가 아닙니다</p>
          <p className="text-sm mt-1">영상 페이지로 이동해주세요</p>
        </div>
      )}
    </div>
  );

  const SubtitleTab = () => (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold mb-4">자막 설정</h3>
      
      {/* 자막 활성화 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">이중 자막 표시</label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* 주 언어 */}
      <div>
        <label className="block text-sm font-medium mb-2">주 언어</label>
        <select
          value={settings.primaryLanguage}
          onChange={(e) => saveSettings({ ...settings, primaryLanguage: e.target.value as 'ko' | 'en' })}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* 보조 언어 */}
      <div>
        <label className="block text-sm font-medium mb-2">보조 언어</label>
        <select
          value={settings.secondaryLanguage}
          onChange={(e) => saveSettings({ ...settings, secondaryLanguage: e.target.value as 'ko' | 'en' })}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="en">English</option>
          <option value="ko">한국어</option>
        </select>
      </div>

      {/* 글자 크기 */}
      <div>
        <label className="block text-sm font-medium mb-2">글자 크기</label>
        <input
          type="range"
          min="12"
          max="24"
          value={settings.fontSize}
          onChange={(e) => saveSettings({ ...settings, fontSize: parseInt(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>작게</span>
          <span>{settings.fontSize}px</span>
          <span>크게</span>
        </div>
      </div>

      {/* 위치 */}
      <div>
        <label className="block text-sm font-medium mb-2">자막 위치</label>
        <div className="flex space-x-2">
          <button
            onClick={() => saveSettings({ ...settings, position: 'bottom' })}
            className={`flex-1 py-2 px-3 text-sm rounded ${
              settings.position === 'bottom' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            하단
          </button>
          <button
            onClick={() => saveSettings({ ...settings, position: 'top' })}
            className={`flex-1 py-2 px-3 text-sm rounded ${
              settings.position === 'top' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            상단
          </button>
        </div>
      </div>

      {/* 투명도 */}
      <div>
        <label className="block text-sm font-medium mb-2">투명도</label>
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.1"
          value={settings.opacity}
          onChange={(e) => saveSettings({ ...settings, opacity: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>투명</span>
          <span>{Math.round(settings.opacity * 100)}%</span>
          <span>불투명</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-96 bg-white">
      {/* 헤더 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">Play LearnEng</h1>
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b">
        <TabButton
          tab="review"
          label="Review"
          isActive={activeTab === 'review'}
          onClick={() => setActiveTab('review')}
        />
        <TabButton
          tab="analysis"
          label="Analysis"
          isActive={activeTab === 'analysis'}
          onClick={() => setActiveTab('analysis')}
        />
        <TabButton
          tab="subtitle"
          label="Subtitle"
          isActive={activeTab === 'subtitle'}
          onClick={() => setActiveTab('subtitle')}
        />
      </div>

      {/* 탭 컨텐츠 */}
      <div className="min-h-96">
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'analysis' && <AnalysisTab />}
        {activeTab === 'subtitle' && <SubtitleTab />}
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
