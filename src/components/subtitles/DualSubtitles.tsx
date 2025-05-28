import React from 'react';
import useSubtitleStore from '../../store/subtitleStore';

interface DualSubtitlesProps {
  style?: React.CSSProperties;
}

const DualSubtitles: React.FC<DualSubtitlesProps> = ({ style }) => {
  const { 
    activeSubtitles, 
    displayMode, 
    primaryLanguage, 
    secondaryLanguage 
  } = useSubtitleStore();
  
  if (!activeSubtitles) {
    return null;
  }
  
  const { primaryText, secondaryText } = activeSubtitles;
  
  // 현재 자막 모드에 따라 표시할 컨텐츠 결정
  const renderContent = () => {
    switch (displayMode) {
      case 'primary':
        return (
          <div className="subtitle-text primary-text">
            {primaryText}
          </div>
        );
      case 'secondary':
        return (
          <div className="subtitle-text secondary-text">
            {secondaryText}
          </div>
        );
      case 'dual':
      default:
        return (
          <>
            <div className="subtitle-text primary-text">
              {primaryText}
            </div>
            <div className="subtitle-text secondary-text mt-1">
              {secondaryText}
            </div>
          </>
        );
    }
  };
  
  return (
    <div 
      className="dual-subtitles-container bg-black/70 p-3 rounded text-center"
      style={style}
    >
      {renderContent()}
    </div>
  );
};

export default DualSubtitles;
