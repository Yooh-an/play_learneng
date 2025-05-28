import { create } from 'zustand';

interface SubtitleItem {
  id: string;
  primaryText: string;
  secondaryText: string;
  startTime: number;
  endTime: number;
  videoId: string;
}

interface SubtitleState {
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  subtitles: Array<SubtitleItem>;
  savedSubtitles: Array<SubtitleItem>;
  
  // 액션
  setPrimaryLanguage: (lang: string) => void;
  setSecondaryLanguage: (lang: string) => void;
  setDisplayMode: (mode: 'primary' | 'secondary' | 'dual') => void;
  saveSubtitle: (subtitle: SubtitleItem) => void;
}

const useSubtitleStore = create<SubtitleState>((set) => ({
  primaryLanguage: 'ko',
  secondaryLanguage: 'en',
  displayMode: 'dual',
  subtitles: [],
  savedSubtitles: [],
  
  setPrimaryLanguage: (lang) => set({ primaryLanguage: lang }),
  setSecondaryLanguage: (lang) => set({ secondaryLanguage: lang }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  saveSubtitle: (subtitle) => set((state) => ({ 
    savedSubtitles: [...state.savedSubtitles, subtitle] 
  })),
}));

export default useSubtitleStore;
