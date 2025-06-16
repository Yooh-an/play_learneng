import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';

type TabType = 'review' | 'analysis' | 'subtitle';

interface SavedSubtitle {
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
  savedDate: string; // 'YYYY-MM-DD' 형식의 저장 날짜
}

interface SubtitleSettings {
  enabled: boolean;
  primaryLanguage: 'ko' | 'en';
  secondaryLanguage: 'ko' | 'en';
  fontSize: number;
  position: number; // 0 (top) to 100 (bottom) percentage
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


// 날짜 관련 유틸리티 함수
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '알 수 없음';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '오늘';
  } else if (diffDays === 1) {
    return '어제';
  } else {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  }
};

const getCurrentDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateStringFromDaysAgo = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// 최근 7일간의 날짜 배열 생성 ('all'포함)
const generateLastSevenDays = (): { value: string, label: string }[] => {
  const dates = [{ value: 'all', label: '전체' }];
  
  for (let i = 0; i < 7; i++) {
    const dateString = getDateStringFromDaysAgo(i);
    dates.push({
      value: dateString,
      label: formatDateForDisplay(dateString)
    });
  }
  
  return dates;
};

const Popup = () => {
  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [isPlaying, setIsPlaying] = useState(false); // Represents if Coupang Play video is active
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark theme state
  const [selectedDate, setSelectedDate] = useState<string>('all'); // 선택된 날짜 필터 ('all' 또는 'YYYY-MM-DD')
  const [settings, setSettings] = useState<SubtitleSettings>({
    enabled: true,
    primaryLanguage: 'ko',
    secondaryLanguage: 'en',
    fontSize: 30,
    position: 85,
    opacity: 0.30
  });
  const [savedSubtitles, setSavedSubtitles] = useState<SavedSubtitle[]>([]);
  const [koreanVttSubtitles, setKoreanVttSubtitles] = useState<VttSubtitle[]>([]);
  const [englishVttSubtitles, setEnglishVttSubtitles] = useState<VttSubtitle[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null); // 'fontSize', 'position', 'opacity' 또는 null
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const [tempSettings, setTempSettings] = useState<SubtitleSettings | null>(null); // 드래그 중 임시 설정

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
    if (!vttContent || typeof vttContent !== 'string' || vttContent.trim() === '') {
      return [];
    }
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
        
        // 현재 동영상 정보 요청
        chrome.tabs.sendMessage(tabs[0].id!, { type: 'GET_CURRENT_VIDEO_INFO' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('현재 동영상 정보를 가져오는 중 오류 발생:', chrome.runtime.lastError);
            return;
          }
          
          // 응답이 있고 비디오 ID가 있다면 이를 백그라운드에 전달
          if (response && response.videoId) {
            chrome.runtime.sendMessage({ 
              type: 'POPUP_VERIFY_VIDEO_ID', 
              payload: { 
                tabId: tabs[0].id!,
                videoId: response.videoId 
              } 
            });
          }
        });
      }
    });
    
    chrome.storage.sync.get(['subtitleSettings', 'savedSubtitles', 'isDarkMode'], (data) => {
      if (data.subtitleSettings) {
        setSettings(data.subtitleSettings);
      }
      if (data.savedSubtitles) {
        // 자막 데이터를 로드하면서 오래된 자막 데이터는 자동으로 정리
        const cleanedSubtitles = cleanupOldSubtitles(data.savedSubtitles);
        
        // 정리된 데이터가 원본과 다르면 저장소도 업데이트
        if (cleanedSubtitles.length !== data.savedSubtitles.length) {
          chrome.storage.sync.set({ savedSubtitles: cleanedSubtitles });
        }
        
        setSavedSubtitles(cleanedSubtitles);
      }
      if (data.isDarkMode !== undefined) {
        setIsDarkMode(data.isDarkMode);
      }
    });

    const fetchVttFromStorage = () => {
      chrome.storage.local.get(['koreanVttContent', 'englishVttContent'], (data) => {
        if (data.koreanVttContent && typeof data.koreanVttContent === 'string') {
          const parsedKorean = parseVTT(data.koreanVttContent, 'ko');
          setKoreanVttSubtitles(parsedKorean);
        } else {
          setKoreanVttSubtitles([]);
        }
        if (data.englishVttContent && typeof data.englishVttContent === 'string') {
          const parsedEnglish = parseVTT(data.englishVttContent, 'en');
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
          setSettings(changes.subtitleSettings.newValue as SubtitleSettings || { enabled: true, primaryLanguage: 'ko', secondaryLanguage: 'en', fontSize: 16, position: 75, opacity: 0.9 });
        }
        if (changes.savedSubtitles) {
          setSavedSubtitles(changes.savedSubtitles.newValue as SavedSubtitle[] || []);
        }
      }
      if (areaName === 'local') {
        if (changes.koreanVttContent) {
          const newKoreanVtt = changes.koreanVttContent.newValue;
          if (newKoreanVtt && typeof newKoreanVtt === 'string') {
            const parsedKorean = parseVTT(newKoreanVtt, 'ko');
            setKoreanVttSubtitles(parsedKorean);
          } else {
            setKoreanVttSubtitles([]);
          }
        }
        if (changes.englishVttContent) {
          const newEnglishVtt = changes.englishVttContent.newValue;
          if (newEnglishVtt && typeof newEnglishVtt === 'string') {
            const parsedEnglish = parseVTT(newEnglishVtt, 'en');
            setEnglishVttSubtitles(parsedEnglish);
          } else {
            setEnglishVttSubtitles([]);
          }
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

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    chrome.storage.sync.set({ isDarkMode: newDarkMode });
  };

  const saveSettings = (newSettings: SubtitleSettings) => {
    setSettings(newSettings);
    chrome.storage.sync.set({ subtitleSettings: newSettings });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes('coupangplay.com')) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings: newSettings });
        }
    });
  };

  const handleSliderMouseDown = useCallback((e: React.MouseEvent, sliderType: 'fontSize' | 'position' | 'opacity') => {
    setIsDragging(sliderType);
    setDragStartX(e.clientX);
    setTempSettings(settings); // 드래그 시작 시 현재 설정을 임시 설정으로 복사
    
    let currentValue = 0;
    switch (sliderType) {
      case 'fontSize':
        currentValue = settings.fontSize;
        break;
      case 'position':
        currentValue = settings.position;
        break;
      case 'opacity':
        currentValue = settings.opacity * 100; // 0-100 스케일로 변환
        break;
    }
    setDragStartValue(currentValue);
    e.preventDefault();
  }, [settings]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !tempSettings) return;
    
    const deltaX = e.clientX - dragStartX;
    let sensitivity = 1;
    let min = 0;
    let max = 100;
    
    switch (isDragging) {
      case 'fontSize':
        sensitivity = 0.05; // 20-40 범위이므로 더 작은 sensitivity
        min = 20;
        max = 40;
        break;
      case 'position':
        sensitivity = 0.3; // 배경 투명도와 동일한 sensitivity로 조정
        min = 0;
        max = 100;
        break;
      case 'opacity':
        sensitivity = 0.3;
        min = 0;
        max = 100;
        break;
    }
    
    const newValue = Math.max(min, Math.min(max, dragStartValue + deltaX * sensitivity));
    
    // 드래그 중에는 임시 설정만 업데이트 (저장소에는 저장하지 않음)
    let updatedTempSettings = { ...tempSettings };
    switch (isDragging) {
      case 'fontSize':
        updatedTempSettings.fontSize = Math.round(newValue);
        break;
      case 'position':
        updatedTempSettings.position = Math.round(newValue);
        break;
      case 'opacity':
        updatedTempSettings.opacity = newValue / 100;
        break;
    }
    
    setTempSettings(updatedTempSettings);
    setSettings(updatedTempSettings); // UI 업데이트를 위해 로컬 상태도 업데이트
    
    // 실시간으로 컨텐츠 스크립트에만 전송 (저장소는 업데이트하지 않음)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes('coupangplay.com')) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings: updatedTempSettings });
        }
    });
  }, [isDragging, dragStartX, dragStartValue, tempSettings]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && tempSettings) {
      // 드래그 완료 시에만 저장소에 저장
      chrome.storage.sync.set({ subtitleSettings: tempSettings });
    }
    setIsDragging(null);
    setTempSettings(null);
  }, [isDragging, tempSettings]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 오래된 자막 데이터 정리 (7일 이상 지난 데이터 삭제)
  const cleanupOldSubtitles = (subtitles: SavedSubtitle[]): SavedSubtitle[] => {
    const cutoffDate = getDateStringFromDaysAgo(7); // 7일 전 날짜
    
    return subtitles.filter(sub => {
      // savedDate가 없는 경우(기존 데이터) 또는 cutoffDate보다 최신인 경우에만 유지
      return !sub.savedDate || sub.savedDate >= cutoffDate;
    });
  };
  
  const deleteSubtitle = (id: string) => {
    const updatedSubtitles = savedSubtitles.filter(sub => sub.id !== id);
    setSavedSubtitles(updatedSubtitles);
    chrome.storage.sync.set({ savedSubtitles: updatedSubtitles });
  };
  
  // 날짜별 필터링된 자막 목록 얻기
  const getFilteredSubtitles = (): SavedSubtitle[] => {
    if (selectedDate === 'all') {
      return savedSubtitles;
    }
    
    return savedSubtitles.filter(sub => sub.savedDate === selectedDate);
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
          ? `border-blue-500 text-blue-600 ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-blue-50'}`
          : `border-gray-200 ${isDarkMode ? 'text-[#9CA3AF] hover:text-[#EAEAEA] hover:bg-[#2C2C2C]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'} hover:border-gray-300`
      }`}
    >
      {label}
    </button>
  );

  const ReviewTab = () => {
    // 최근 7일 날짜 옵션 생성
    const dateOptions = generateLastSevenDays();
    
    // 날짜 선택 변경 핸들러
    const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedDate(e.target.value);
    };
    
    // 선택된 날짜에 따라 필터링된 자막 목록
    const filteredSubtitles = getFilteredSubtitles();

    // 시간-분-초 형식으로 변환하는 함수
    const formatTimestampForExport = (timeInSeconds: number): string => {
      if (isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00:00";
      const hours = Math.floor(timeInSeconds / 3600);
      const minutes = Math.floor((timeInSeconds % 3600) / 60);
      const seconds = Math.floor(timeInSeconds % 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // 데이터 내보내기 함수
    const exportData = () => {
      const dataToExport = filteredSubtitles.map(subtitle => ({
        '주요자막': subtitle.primaryText,
        '보조자막': subtitle.secondaryText,
        '에피소드제목': subtitle.episodeTitle || '',
        '저장날짜': subtitle.savedDate,
        '시간': formatTimestampForExport(subtitle.timestamp),
      }));

      let textData = "";
      dataToExport.forEach(item => {
        textData += `주요자막:\n${item['주요자막']}\n`;
        textData += `보조자막:\n${item['보조자막']}\n`;
        textData += `에피소드제목: ${item['에피소드제목']}\n`;
        textData += `저장날짜: ${item['저장날짜']}\n`;
        textData += `시간: ${item['시간']}\n`;
        textData += "--------------------\n";
      });

      const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LearnEng_Review_Export_${selectedDate === 'all' ? 'all' : selectedDate}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    
    return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-900'}`}>단어장</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportData}
            disabled={filteredSubtitles.length === 0}
            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
              isDarkMode
                ? 'border-[#374151] text-[#EAEAEA] hover:bg-[#2C2C2C] disabled:opacity-50 disabled:cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title="현재 선택된 날짜의 단어장 내보내기"
          >
            내보내기
          </button>
          <span className="text-xl">🗓️</span>
          <select
            value={selectedDate}
            onChange={handleDateChange}
            className={`text-sm py-1 px-2 rounded border ${
              isDarkMode 
              ? 'bg-[#1F1F1F] border-[#374151] text-[#EAEAEA]' 
              : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {dateOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filteredSubtitles.length === 0 ? (
        <div className={`text-center py-10 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
          <div className="text-4xl mb-3">📚</div>
          <p className="font-medium">저장된 자막이 없습니다.</p>
          <p className="text-sm mt-1">영상에서 자막을 클릭하거나 <span className="font-medium">Shift+C</span> 단축키로 단어장에 추가해보세요!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[270px] overflow-y-auto pr-2 mb-3">
          {filteredSubtitles.map((subtitle) => (
            <div key={subtitle.id} className={`${isDarkMode ? 'bg-[#1F1F1F] hover:bg-[#2C2C2C]' : 'bg-white hover:shadow-md'} p-3 rounded-lg shadow transition-shadow`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {subtitle.primaryText && <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-800'}`}>{subtitle.primaryText}</p>}
                  {subtitle.secondaryText && <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>{subtitle.secondaryText}</p>}
                  {subtitle.episodeTitle && (
                    <p className={`text-xs mt-2 leading-relaxed ${isDarkMode ? 'text-[#6B7280]' : 'text-gray-400'} italic`}>
                      📺 {subtitle.episodeTitle}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => deleteSubtitle(subtitle.id)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1 ml-2 flex-shrink-0"
                  title="삭제"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={`flex items-center justify-center h-10 text-xs border-t ${isDarkMode ? 'border-[#374151] text-[#9CA3AF]' : 'border-gray-200 text-gray-500'}`}>
        <div className="flex items-center">
          <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono mr-1">Shift+C</span>
          <span>자막 저장</span>
        </div>
      </div>
    </div>
  );
  };

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
        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-900'}`}>스크립트 분석</h3>
        
        <div className="mb-3">
          <input
            type="text"
            placeholder="시간, 단어 또는 문장 검색..."
            className={`w-full p-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 ${
              isDarkMode 
                ? 'bg-[#1F1F1F] border-[#374151] text-[#EAEAEA] placeholder-[#9CA3AF]' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className={`flex border-b mb-3 ${isDarkMode ? 'border-[#374151]' : 'border-gray-200'}`}>
          <button 
            onClick={() => setSelectedAnalysisLanguage('ko')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'ko' ? `border-b-2 border-blue-500 text-blue-600 ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-blue-50'}` : `${isDarkMode ? 'text-[#9CA3AF] hover:text-[#EAEAEA] hover:bg-[#2C2C2C]' : 'text-gray-500 hover:text-gray-700'} hover:border-gray-300`}`}
          >
            한국어 ({koreanSubs.length || 0})
          </button>
          <button 
            onClick={() => setSelectedAnalysisLanguage('en')} 
            className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${selectedAnalysisLanguage === 'en' ? `border-b-2 border-blue-500 text-blue-600 ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-blue-50'}` : `${isDarkMode ? 'text-[#9CA3AF] hover:text-[#EAEAEA] hover:bg-[#2C2C2C]' : 'text-gray-500 hover:text-gray-700'} hover:border-gray-300`}`}
          >
            영어 ({englishSubs.length || 0})
          </button>
        </div>
        
        {!isPlayerActive && (koreanSubs.length > 0 || englishSubs.length > 0) && (
            <div className={`mb-3 p-2 text-sm border rounded-md ${
              isDarkMode 
                ? 'text-orange-300 bg-orange-900 border-orange-700' 
                : 'text-orange-700 bg-orange-100 border-orange-300'
            }`}>
                참고: 영상 시간으로 이동 기능은 쿠팡 플레이 영상이 활성화된 탭에서만 작동합니다.
            </div>
        )}

        {(koreanSubs.length === 0 && englishSubs.length === 0) ? (
          <div className={`text-center py-10 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
            <div className="text-4xl mb-3">📺</div>
            <p className="font-medium">로드된 자막 데이터가 없습니다.</p>
            <p className="text-sm mt-1">쿠팡플레이 영상 페이지에서 자막이 로드되면 여기에 표시됩니다.</p>
          </div>
        ) : filteredSubtitles.length > 0 ? (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2">
            {filteredSubtitles.map((sub) => (
              <div 
                key={sub.id} 
                className={`p-3 rounded-lg transition-colors shadow-sm ${
                  isPlayerActive 
                    ? `cursor-pointer ${isDarkMode ? 'bg-[#1F1F1F] hover:bg-[#2C2C2C]' : 'bg-gray-50 hover:bg-gray-100'}` 
                    : `cursor-default ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-gray-100'}`
                }`}
                onClick={() => {
                  if (isPlayerActive) {
                    onJumpToTimestamp(sub.startTime);
                  }
                }}
                title={isPlayerActive ? "클릭하여 영상 시간으로 이동" : "쿠팡플레이 영상 재생 중 이동 가능"}
              >
                <div className={`text-sm font-medium whitespace-pre-wrap ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-800'}`}>{sub.text}</div>
                <div className="text-xs text-blue-500 mt-1 font-mono">
                  {formatTime(sub.startTime)} ~ {formatTime(sub.endTime)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-10 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
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
      <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-900'}`}>자막 설정</h3>
      
      <div className="flex items-center justify-between">
        <label htmlFor="dual-subtitle-toggle" className={`text-sm font-medium ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>이중 자막 표시</label>
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
        <label htmlFor="primary-lang-select" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>주 언어</label>
        <select
          id="primary-lang-select"
          value={settings.primaryLanguage}
          onChange={(e) => saveSettings({ ...settings, primaryLanguage: e.target.value as 'ko' | 'en' })}
          className={`w-full p-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 ${
            isDarkMode 
              ? 'bg-[#1F1F1F] border-[#374151] text-[#EAEAEA]' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label htmlFor="secondary-lang-select" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>보조 언어</label>
        <select
          id="secondary-lang-select"
          value={settings.secondaryLanguage}
          onChange={(e) => saveSettings({ ...settings, secondaryLanguage: e.target.value as 'ko' | 'en' })}
          className={`w-full p-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 ${
            isDarkMode 
              ? 'bg-[#1F1F1F] border-[#374151] text-[#EAEAEA]' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label htmlFor="font-size-range" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>
          글자 크기: {settings.fontSize}px
        </label>
        <input
          id="font-size-range"
          type="range"
          min="20"
          max="40"
          value={settings.fontSize}
          onChange={(e) => saveSettings({ ...settings, fontSize: parseInt(e.target.value) })}
          onMouseDown={(e) => handleSliderMouseDown(e, 'fontSize')}
          className={`w-full h-2 bg-gray-200 rounded-lg appearance-none ${isDragging === 'fontSize' ? 'cursor-grabbing' : 'cursor-grab'} accent-blue-500`}
        />
        <div className={`flex justify-between text-xs mt-1 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
          <span>작게</span>
          <span>크게</span>
        </div>
      </div>

      <div>
        <label htmlFor="position-range" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>
          자막 위치: {settings.position}%
        </label>
        <input
          id="position-range"
          type="range"
          min="0"
          max="100"
          value={settings.position}
          onChange={(e) => saveSettings({ ...settings, position: parseInt(e.target.value) })}
          onMouseDown={(e) => handleSliderMouseDown(e, 'position')}
          className={`w-full h-2 bg-gray-200 rounded-lg appearance-none ${isDragging === 'position' ? 'cursor-grabbing' : 'cursor-grab'} accent-blue-500`}
        />
        <div className={`flex justify-between text-xs mt-1 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
          <span>상단 (0%)</span>
          <span>중앙 (50%)</span>
          <span>하단 (100%)</span>
        </div>
      </div>

      <div>
        <label htmlFor="opacity-range" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#EAEAEA]' : 'text-gray-700'}`}>
          배경 투명도: {Math.round(settings.opacity * 100)}%
        </label>
        <input
          id="opacity-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.opacity}
          onChange={(e) => saveSettings({ ...settings, opacity: parseFloat(e.target.value) })}
          onMouseDown={(e) => handleSliderMouseDown(e, 'opacity')}
          className={`w-full h-2 bg-gray-200 rounded-lg appearance-none ${isDragging === 'opacity' ? 'cursor-grabbing' : 'cursor-grab'} accent-blue-500`}
        />
        <div className={`flex justify-between text-xs mt-1 ${isDarkMode ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
          <span>투명하게</span>
          <span>불투명하게</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`w-96 shadow-xl flex flex-col ${isDarkMode ? 'bg-[#121212]' : 'bg-white'}`} style={{ maxHeight: '600px' }}>
      <div className={`p-4 border-b ${isDarkMode ? 'border-[#374151]' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-xl font-bold text-blue-600`}>Play LearnEng</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-[#1F1F1F] hover:bg-[#2C2C2C] text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={isDarkMode ? "라이트 테마로 전환" : "다크 테마로 전환"}
            >
              {isDarkMode ? '☀️' : '🌔'}
            </button>
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} title={isPlaying ? "쿠팡플레이 영상 활성" : "쿠팡플레이 영상 비활성 또는 감지 안됨"}></div>
          </div>
        </div>
      </div>

      <div className={`flex border-b ${isDarkMode ? 'bg-[#1F1F1F] border-[#374151]' : 'bg-gray-50 border-gray-200'}`}>
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
