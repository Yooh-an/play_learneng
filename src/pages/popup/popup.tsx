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

// Ensure VttSubtitle and SavedSubtitle interfaces are defined or imported
interface VttSubtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  // Add other properties if your VttSubtitle interface has them
}

interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
}

// Define SubtitleSettings if not already (should match other files)
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
  const [isPlaying, setIsPlaying] = useState(false); // Represents if Coupang Play video is active
  const [settings, setSettings] = useState<SubtitleSettings>({
    enabled: true,
    primaryLanguage: 'ko',
    secondaryLanguage: 'en',
    fontSize: 16,
    position: 'bottom',
    opacity: 0.9
  });
  const [savedSubtitles, setSavedSubtitles] = useState<SavedSubtitle[]>([]);
  const [koreanVttSubtitles, setKoreanVttSubtitles] = useState<VttSubtitle[]>([]);
  const [englishVttSubtitles, setEnglishVttSubtitles] = useState<VttSubtitle[]>([]);
  
  const parseVttTimestamp = (timestampStr: string): number => {
    const parts = timestampStr.split(':');
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS.mmm
      seconds += parseInt(parts[0]) * 3600;
      seconds += parseInt(parts[1]) * 60;
      seconds += parseFloat(parts[2]);
    } else if (parts.length === 2) { // MM:SS.mmm
      seconds += parseInt(parts[0]) * 60;
      seconds += parseFloat(parts[1]);
    } else if (parts.length === 1) { // SS.mmm
      seconds += parseFloat(parts[0]);
    }
    return seconds;
  };

  // Helper to parse VTT (ensure this is robust)
  const parseVTT = (vttContent: string, languagePrefix: 'ko' | 'en'): VttSubtitle[] => {
    if (!vttContent) return [];
    const subtitles: VttSubtitle[] = [];
    const lines = vttContent.split(/\r?\n/);
    let i = 0;
    let cueIndex = 0;

    while (i < lines.length && !lines[i].includes('-->') && lines[i].toUpperCase() !== 'WEBVTT' && lines[i].trim() !== '') {
        if (lines[i].toUpperCase() === 'WEBVTT') {
          i++;
          while(i < lines.length && (lines[i].trim() === '' || lines[i].startsWith('NOTE') || lines[i].startsWith('COMMENT'))) {
            i++;
          }
          continue;
        }
        i++;
    }
    while (i < lines.length && lines[i].trim() === '') {
        i++;
    }


    for (; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      let cueId = '';
      if (line.match(/^\d+$/) && lines[i+1]?.includes('-->')) {
          cueId = line;
          i++; 
      } else if (!line.includes('-->') && lines[i+1]?.includes('-->')) {
          cueId = line;
          i++; 
      }
      
      const timeLine = lines[i]?.trim();
      if (!timeLine || !timeLine.includes('-->')) continue;

      const timeParts = timeLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}|\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}|\d{2}\.\d{3})/);
      if (!timeParts) continue;

      const startTime = parseVttTimestamp(timeParts[1]);
      const endTime = parseVttTimestamp(timeParts[2]);
      
      let textLines: string[] = [];
      i++; 
      while (i < lines.length && lines[i]?.trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }
      
      if (textLines.length > 0) {
        subtitles.push({
          id: cueId || `${languagePrefix}-${cueIndex++}`,
          startTime,
          endTime,
          text: textLines.join('\n')
        });
      }
    }
    return subtitles.sort((a, b) => a.startTime - b.startTime);
  };

  // Function to format time (moved here to be accessible by ReviewTab)
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00.000";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
  };

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('coupangplay.com')) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    });
    
    chrome.storage.sync.get(['subtitleSettings', 'savedSubtitles'], (data) => {
      if (data.subtitleSettings) setSettings(data.subtitleSettings as SubtitleSettings);
      if (data.savedSubtitles) setSavedSubtitles(data.savedSubtitles as SavedSubtitle[]);
    });

    const fetchVttFromStorage = () => {
      chrome.storage.local.get(['koreanVttContent', 'englishVttContent'], (data) => {
        if (data.koreanVttContent) {
          const parsedKorean = parseVTT(data.koreanVttContent as string, 'ko');
          setKoreanVttSubtitles(parsedKorean);
        } else {
          setKoreanVttSubtitles([]);
        }
        if (data.englishVttContent) {
          const parsedEnglish = parseVTT(data.englishVttContent as string, 'en');
          setEnglishVttSubtitles(parsedEnglish);
        } else {
          setEnglishVttSubtitles([]);
        }
      });
    };
    fetchVttFromStorage();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'sync') {
        if (changes.subtitleSettings) {
          setSettings(changes.subtitleSettings.newValue as SubtitleSettings || { enabled: true, primaryLanguage: 'ko', secondaryLanguage: 'en', fontSize: 16, position: 'bottom', opacity: 0.9 });
        }
        if (changes.savedSubtitles) {
          setSavedSubtitles(changes.savedSubtitles.newValue as SavedSubtitle[] || []);
        }
      }
      if (areaName === 'local') {
        if (changes.koreanVttContent) {
          const parsedKorean = parseVTT(changes.koreanVttContent.newValue as string || '', 'ko');
          setKoreanVttSubtitles(parsedKorean);
        }
        if (changes.englishVttContent) {
          const parsedEnglish = parseVTT(changes.englishVttContent.newValue as string || '', 'en');
          setEnglishVttSubtitles(parsedEnglish);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.type === 'PLAYER_STATUS_UPDATE') {
            setIsPlaying(message.isPlaying);
        }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const saveSettings = (newSettings: SubtitleSettings) => {
    setSettings(newSettings);
    chrome.storage.sync.set({ subtitleSettings: newSettings });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes('coupangplay.com')) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings: newSettings });
        }
    });
  };

  const deleteSubtitle = (id: string) => {
    const updatedSubtitles = savedSubtitles.filter(sub => sub.id !== id);
    setSavedSubtitles(updatedSubtitles);
    chrome.storage.sync.set({ savedSubtitles: updatedSubtitles });
  };

  const jumpToTimestamp = (timestamp: number) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0].url?.includes('coupangplay.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'JUMP_TO_TIME', timestamp });
      } else {
        console.warn("Coupang Play tab not active or found for jumpToTimestamp.");
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
      className={`flex-1 py-2.5 px-3 text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none ${
        isActive
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
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
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {savedSubtitles.slice().reverse().map((subtitle) => ( 
            <div key={subtitle.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
              <div className="flex justify-between items-start mb-1.5">
                <div className="flex-1 mr-2">
                  <div className="font-medium text-gray-800 mb-1 whitespace-pre-wrap">{subtitle.primaryText}</div>
                  {subtitle.secondaryText && (
                    <div className="text-sm text-gray-500 whitespace-pre-wrap">{subtitle.secondaryText}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteSubtitle(subtitle.id)}
                  className="ml-2 text-red-500 hover:text-red-700 text-xl p-1 leading-none"
                  title="삭제"
                >
                  &times;
                </button>
              </div>
              {subtitle.episodeTitle && (
                <div className="text-xs text-gray-400 mb-1.5 italic">{subtitle.episodeTitle}</div>
              )}
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(subtitle.timestamp)} 
                </span>
                <button
                  onClick={() => jumpToTimestamp(subtitle.timestamp)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    isPlaying 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!isPlaying}
                  title={isPlaying ? "영상 시간으로 이동" : "쿠팡플레이 영상 재생 중 이동 가능"}
                >
                  재생 위치로
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

  const AnalysisTab = ({ 
    koreanSubs, 
    englishSubs, 
    onJumpToTimestamp,
    isPlayerActive
  }: {
    koreanSubs: VttSubtitle[];
    englishSubs: VttSubtitle[];
    onJumpToTimestamp: (timestamp: number) => void;
    isPlayerActive: boolean;
  }) => {
    const [selectedAnalysisLanguage, setSelectedAnalysisLanguage] = useState<'ko' | 'en'>('ko');
    const [searchTerm, setSearchTerm] = useState('');

    // formatTime is already defined in the outer Popup scope

    const subtitlesToDisplayOriginal = selectedAnalysisLanguage === 'ko' ? koreanSubs : englishSubs;

    const filteredSubtitles = subtitlesToDisplayOriginal.filter(sub => {
      const formattedStartTime = formatTime(sub.startTime);
      const formattedEndTime = formatTime(sub.endTime);
      const searchTermLower = searchTerm.toLowerCase();

      return (
        sub.text.toLowerCase().includes(searchTermLower) ||
        formattedStartTime.includes(searchTermLower) ||
        formattedEndTime.includes(searchTermLower)
      );
    });

    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3">스크립트 분석</h3>
        
        <div className="mb-3">
          <input
            type="text"
            placeholder="시간, 단어 또는 문장 검색..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex border-b mb-3">
          <button 
            onClick={() => setSelectedAnalysisLanguage('ko')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'ko' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            한국어 ({koreanSubs.length})
          </button>
          <button 
            onClick={() => setSelectedAnalysisLanguage('en')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'en' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            영어 ({englishSubs.length})
          </button>
        </div>
        
        {!isPlayerActive && (koreanSubs.length > 0 || englishSubs.length > 0) && (
            <div className="mb-3 p-2 text-sm text-orange-700 bg-orange-100 border border-orange-300 rounded-md">
                참고: 영상 시간으로 이동 기능은 쿠팡 플레이 영상이 활성화된 탭에서만 작동합니다.
            </div>
        )}

        {(koreanSubs.length === 0 && englishSubs.length === 0) ? (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-3">📺</div>
            <p className="font-medium">로드된 자막 데이터가 없습니다.</p>
            <p className="text-sm mt-1">쿠팡플레이 영상 페이지에서 자막이 로드되면 여기에 표시됩니다.</p>
          </div>
        ) : filteredSubtitles.length > 0 ? (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2">
            {filteredSubtitles.map((sub) => (
              <div 
                key={sub.id} 
                className={`p-3 rounded-lg transition-colors shadow-sm ${isPlayerActive ? 'cursor-pointer bg-gray-50 hover:bg-gray-100' : 'cursor-default bg-gray-100'}`}
                onClick={() => {
                  if (isPlayerActive) {
                    onJumpToTimestamp(sub.startTime);
                  }
                }}
                title={isPlayerActive ? "클릭하여 영상 시간으로 이동" : "쿠팡플레이 영상 재생 중 이동 가능"}
              >
                <div className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{sub.text}</div>
                <div className="text-xs text-blue-500 mt-1 font-mono">
                  {formatTime(sub.startTime)} ~ {formatTime(sub.endTime)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-3">🤔</div>
            <p className="font-medium">
              {searchTerm ? `'${searchTerm}'에 대한 검색 결과가 없습니다.` : `선택된 언어 (${selectedAnalysisLanguage === 'ko' ? '한국어' : '영어'})의 자막이 없습니다.`}
            </p>
            <p className="text-sm mt-1">
              {searchTerm ? '다른 검색어를 입력하거나 선택된 언어를 확인해보세요.' : '다른 언어 탭을 확인해보세요.'}
            </p>
          </div>
        )}
      </div>
    );
  };

  const SubtitleTab = () => (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold mb-4">자막 설정</h3>
      
      <div className="flex items-center justify-between">
        <label htmlFor="dual-subtitle-toggle" className="text-sm font-medium">이중 자막 표시</label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="dual-subtitle-toggle"
            checked={settings.enabled}
            onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div>
        <label htmlFor="primary-lang-select" className="block text-sm font-medium mb-1">주 언어 (자막 저장 시 기준)</label>
        <select
          id="primary-lang-select"
          value={settings.primaryLanguage}
          onChange={(e) => saveSettings({ ...settings, primaryLanguage: e.target.value as 'ko' | 'en' })}
          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label htmlFor="secondary-lang-select" className="block text-sm font-medium mb-1">보조 언어</label>
        <select
          id="secondary-lang-select"
          value={settings.secondaryLanguage}
          onChange={(e) => saveSettings({ ...settings, secondaryLanguage: e.target.value as 'ko' | 'en' })}
          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="en">English</option>
          <option value="ko">한국어</option>
        </select>
      </div>

      <div>
        <label htmlFor="font-size-range" className="block text-sm font-medium mb-1">글자 크기: {settings.fontSize}px</label>
        <input
          id="font-size-range"
          type="range"
          min="12"
          max="30" // Increased max font size
          value={settings.fontSize}
          onChange={(e) => saveSettings({ ...settings, fontSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>작게</span>
          <span>크게</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">자막 위치</label>
        <div className="flex space-x-2">
          <button
            onClick={() => saveSettings({ ...settings, position: 'bottom' })}
            className={`flex-1 py-2 px-3 text-sm rounded transition-colors ${
              settings.position === 'bottom' 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            하단
          </button>
          <button
            onClick={() => saveSettings({ ...settings, position: 'top' })}
            className={`flex-1 py-2 px-3 text-sm rounded transition-colors ${
              settings.position === 'top' 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            상단
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="opacity-range" className="block text-sm font-medium mb-1">배경 투명도: {Math.round(settings.opacity * 100)}%</label>
        <input
          id="opacity-range"
          type="range"
          min="0.1" // Min opacity
          max="1"
          step="0.05"
          value={settings.opacity}
          onChange={(e) => saveSettings({ ...settings, opacity: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>투명하게</span>
          <span>불투명하게</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-96 bg-white shadow-xl flex flex-col" style={{ maxHeight: '600px' }}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">Play LearnEng</h1>
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} title={isPlaying ? "쿠팡플레이 영상 활성" : "쿠팡플레이 영상 비활성 또는 감지 안됨"}></div>
        </div>
      </div>

      <div className="flex border-b bg-gray-50">
        <TabButton
          tab="review"
          label="📖 단어장"
          isActive={activeTab === 'review'}
          onClick={() => setActiveTab('review')}
        />
        <TabButton
          tab="analysis"
          label="📊 스크립트 분석"
          isActive={activeTab === 'analysis'}
          onClick={() => setActiveTab('analysis')}
        />
        <TabButton
          tab="subtitle"
          label="⚙️ 자막 설정"
          isActive={activeTab === 'subtitle'}
          onClick={() => setActiveTab('subtitle')}
        />
      </div>

      <div className="flex-grow overflow-y-auto">
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'analysis' && (
          <AnalysisTab 
            koreanSubs={koreanVttSubtitles}
            englishSubs={englishVttSubtitles}
            onJumpToTimestamp={jumpToTimestamp}
            isPlayerActive={isPlaying} 
          />
        )}
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
