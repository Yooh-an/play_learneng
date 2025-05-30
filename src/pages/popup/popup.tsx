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

// Added VttSubtitle interface outside Popup for clarity
interface VttSubtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
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

  const [koreanVttSubtitles, setKoreanVttSubtitles] = useState<VttSubtitle[]>([]);
  const [englishVttSubtitles, setEnglishVttSubtitles] = useState<VttSubtitle[]>([]);
  
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

    // Load VTT subtitles from chrome.storage.local
    chrome.storage.local.get(['koreanVttContent', 'englishVttContent'], (data) => {
      if (data.koreanVttContent) {
        const parsedKorean = parseVTT(data.koreanVttContent, 'ko');
        setKoreanVttSubtitles(parsedKorean);
      }
      if (data.englishVttContent) {
        const parsedEnglish = parseVTT(data.englishVttContent, 'en');
        setEnglishVttSubtitles(parsedEnglish);
      }
    });
  }, []);

  // 설정 저장
  const saveSettings = (newSettings: SubtitleSettings) => {
    setSettings(newSettings);
    chrome.storage.sync.set({ subtitleSettings: newSettings });
    
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

  // Helper function to parse VTT timestamp (e.g., 00:00:01.234 or 01:23.456)
  const parseVttTimestamp = (timestampStr: string): number => {
    const parts = timestampStr.split(':');
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS.mmm
      seconds += parseInt(parts[0], 10) * 3600;
      seconds += parseInt(parts[1], 10) * 60;
      seconds += parseFloat(parts[2].replace(',', '.'));
    } else if (parts.length === 2) { // MM:SS.mmm
      seconds += parseInt(parts[0], 10) * 60;
      seconds += parseFloat(parts[1].replace(',', '.'));
    } else if (parts.length === 1) { // SS.mmm (less common, but handle)
      seconds += parseFloat(parts[0].replace(',', '.'));
    }
    return seconds;
  };

  const parseVTT = (vttContent: string, languagePrefix: 'ko' | 'en'): VttSubtitle[] => {
    const subtitles: VttSubtitle[] = [];
    const lines = vttContent.split(/\r?\n/);
    let i = 0;
    let cueIndex = 0;

    // Skip WEBVTT header and any initial metadata until a blank line or a cue
    while (i < lines.length) {
        const currentLine = lines[i].trim();
        if (currentLine.toUpperCase() === 'WEBVTT') {
            i++;
            continue;
        }
        // Break if we find a cue identifier, a timeline, or a blank line indicating end of headers
        if (currentLine.match(/^\d+$/) || currentLine.includes('-->') || currentLine === '') {
            break; 
        }
        i++; // Skip other metadata lines
    }
    
    for (; i < lines.length; i++) {
      let lineContent = lines[i]?.trim();
      if (!lineContent) continue; // Skip empty lines typically separating cues

      // Check for cue identifier (optional, can be just a number or more complex)
      // If the next line is a timeline, this line might be a cue ID.
      if (lines[i+1]?.includes('-->') && !lineContent.includes('-->')) {
         // Potentially a cue ID, but we don't strictly need to parse it if it's not just a number.
         // If it's not a number, it might be the start of the text if the VTT is malformed.
         // For simplicity, if it's not a timeline, we assume it's either a cue ID (to be skipped) or text.
         // The critical part is finding the '-->' for the timeline.
         if (lineContent.match(/^\d+$/)) { // If it's purely numeric, assume it's a cue ID and skip.
            i++; 
            lineContent = lines[i]?.trim();
            if (!lineContent) continue;
         }
      }


      if (lineContent.includes('-->')) {
        const timeLine = lineContent;
        const timeParts = timeLine.split(' --> ');
        if (timeParts.length < 2) continue; // Malformed time line

        const startTimeStr = timeParts[0].trim();
        // Take only the timestamp part if there are other settings on the line (e.g., position cues)
        const endTimeStr = timeParts[1].trim().split(' ')[0]; 


        const startTime = parseVttTimestamp(startTimeStr);
        const endTime = parseVttTimestamp(endTimeStr);

        let textLines: string[] = [];
        i++; // Move to the first line of subtitle text
        while (i < lines.length && lines[i]?.trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        const text = textLines.join('\n').trim();

        if (!isNaN(startTime) && !isNaN(endTime) && text) {
          subtitles.push({ 
            id: `vtt-${languagePrefix}-${cueIndex++}-${startTime}`, 
            startTime, 
            endTime, 
            text 
          });
        }
        // The loop will increment i, effectively skipping the blank line after text block if present
      }
    }
    return subtitles.sort((a, b) => a.startTime - b.startTime);
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

  // Updated AnalysisTab to remove file upload and use loaded VTT data
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

    const formatTime = (timeInSeconds: number) => {
      const minutes = Math.floor(timeInSeconds / 60);
      const seconds = timeInSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
    };

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
        <h3 className="text-lg font-semibold mb-4">스크립트 분석</h3>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="시간, 단어 또는 문장 검색..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex border-b mb-4">
          <button 
            onClick={() => setSelectedAnalysisLanguage('ko')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'ko' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            한국어 자막 ({koreanSubs.length})
          </button>
          <button 
            onClick={() => setSelectedAnalysisLanguage('en')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'en' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            영어 자막 ({englishSubs.length})
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
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2"> {/* Adjusted max-h to accommodate search bar */}
            {filteredSubtitles.map((sub) => (
              <div 
                key={sub.id} 
                className={`p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${isPlayerActive ? 'cursor-pointer' : 'cursor-default'}`}
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
