import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';

interface SettingsType {
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  subtitleStyle: {
    position: 'top' | 'middle' | 'bottom';
    fontSize: number;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    opacity: number;
    autoWrap: boolean;
  };
}

const DEFAULT_SETTINGS: SettingsType = {
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

const Options = () => {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // 설정 로드
  useEffect(() => {
    chrome.storage.sync.get('settings', (data) => {
      if (data.settings) {
        setSettings(data.settings);
      }
    });
  }, []);
  
  // 설정 저장
  const saveSettings = () => {
    setIsSaving(true);
    chrome.storage.sync.set({ settings }, () => {
      setIsSaving(false);
      setSaveMessage('설정이 저장되었습니다.');
      setTimeout(() => setSaveMessage(''), 3000);
    });
  };
  
  // 설정 변경 핸들러
  const handleChange = (field: string, value: any) => {
    setSettings({ ...settings, [field]: value });
  };
  
  // 자막 스타일 설정 변경 핸들러
  const handleStyleChange = (field: string, value: any) => {
    setSettings({
      ...settings,
      subtitleStyle: {
        ...settings.subtitleStyle,
        [field]: value
      }
    });
  };
  
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-blue-600">Play LearnEng 설정</h1>
        <div>
          {saveMessage && (
            <span className="text-green-600 mr-3">{saveMessage}</span>
          )}
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            onClick={saveSettings}
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">언어 설정</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주 자막 언어
            </label>
            <select
              className="w-full p-2 border rounded"
              value={settings.primaryLanguage}
              onChange={(e) => handleChange('primaryLanguage', e.target.value)}
            >
              <option value="ko">한국어</option>
              <option value="en">영어</option>
              <option value="jp">일본어</option>
              <option value="zh">중국어</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              보조 자막 언어
            </label>
            <select
              className="w-full p-2 border rounded"
              value={settings.secondaryLanguage}
              onChange={(e) => handleChange('secondaryLanguage', e.target.value)}
            >
              <option value="ko">한국어</option>
              <option value="en">영어</option>
              <option value="jp">일본어</option>
              <option value="zh">중국어</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            자막 표시 모드
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                value="primary"
                checked={settings.displayMode === 'primary'}
                onChange={(e) => handleChange('displayMode', 'primary')}
              />
              <span className="ml-2">주 자막만</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                value="secondary"
                checked={settings.displayMode === 'secondary'}
                onChange={(e) => handleChange('displayMode', 'secondary')}
              />
              <span className="ml-2">보조 자막만</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                value="dual"
                checked={settings.displayMode === 'dual'}
                onChange={(e) => handleChange('displayMode', 'dual')}
              />
              <span className="ml-2">이중 자막</span>
            </label>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">자막 스타일</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              자막 위치
            </label>
            <select
              className="w-full p-2 border rounded"
              value={settings.subtitleStyle.position}
              onChange={(e) => handleStyleChange('position', e.target.value)}
            >
              <option value="top">상단</option>
              <option value="middle">중단</option>
              <option value="bottom">하단</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              글꼴 크기
            </label>
            <input
              type="range"
              min="12"
              max="24"
              value={settings.subtitleStyle.fontSize}
              onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-500 text-right">{settings.subtitleStyle.fontSize}px</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              글꼴 굵기
            </label>
            <select
              className="w-full p-2 border rounded"
              value={settings.subtitleStyle.fontWeight}
              onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
            >
              <option value="normal">보통</option>
              <option value="bold">굵게</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              글꼴 색상
            </label>
            <input
              type="color"
              value={settings.subtitleStyle.color}
              onChange={(e) => handleStyleChange('color', e.target.value)}
              className="w-full h-10 p-0 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              배경색
            </label>
            <input
              type="color"
              value={settings.subtitleStyle.backgroundColor}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              className="w-full h-10 p-0 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              배경 불투명도
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.subtitleStyle.opacity * 100}
              onChange={(e) => handleStyleChange('opacity', Number(e.target.value) / 100)}
              className="w-full"
            />
            <div className="text-sm text-gray-500 text-right">{Math.round(settings.subtitleStyle.opacity * 100)}%</div>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={settings.subtitleStyle.autoWrap}
              onChange={(e) => handleStyleChange('autoWrap', e.target.checked)}
              className="form-checkbox"
            />
            <span className="ml-2">긴 자막 자동 줄바꿈</span>
          </label>
        </div>
      </div>
      
      <div className="mt-8 text-right">
        <button
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 mr-3"
          onClick={() => setSettings(DEFAULT_SETTINGS)}
        >
          기본값으로 되돌리기
        </button>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          onClick={saveSettings}
          disabled={isSaving}
        >
          {isSaving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

// 옵션 페이지 렌더링
ReactDOM.createRoot(document.getElementById('options-root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
