import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SubtitleItem {
  id: string;
  primaryText: string;
  secondaryText: string;
  startTime: number;
  endTime?: number;
  videoId: string;
  savedAt?: string;
}

export interface ActiveSubtitle {
  primaryText: string;
  secondaryText: string;
  timestamp: number;
}

interface SubtitleState {
  // 설정
  primaryLanguage: string;
  secondaryLanguage: string;
  displayMode: 'primary' | 'secondary' | 'dual';
  
  // 자막 동기화 조절 (초 단위 +/- 값)
  subtitleSync: number;
  
  // 현재 상태
  isPlaying: boolean;
  currentVideoId: string | null;
  currentVideoTitle: string | null;
  activeSubtitles: ActiveSubtitle | null;
  
  // 저장된 자막
  savedSubtitles: Array<SubtitleItem>;
  
  // 액션
  setPrimaryLanguage: (lang: string) => void;
  setSecondaryLanguage: (lang: string) => void;
  setDisplayMode: (mode: 'primary' | 'secondary' | 'dual') => void;
  setSubtitleSync: (syncTime: number) => void;
  adjustSubtitleSync: (amount: number) => void;  // 자막 싱크 미세 조절
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentVideo: (videoId: string, title: string) => void;
  setActiveSubtitles: (subtitle: ActiveSubtitle | null) => void;
  saveSubtitle: (subtitle: SubtitleItem) => void;
  removeSavedSubtitle: (id: string) => void;
}

// 기본 스토어 정의
const useSubtitleStore = create<SubtitleState>()(
  // 로컬 스토리지 지속성 추가
  persist(
    (set) => ({
      // 설정 (기본값)
      primaryLanguage: 'ko',
      secondaryLanguage: 'en',
      displayMode: 'dual',
      subtitleSync: 0,  // 자막 동기화 초기값
      
      // 현재 상태
      isPlaying: false,
      currentVideoId: null,
      currentVideoTitle: null,
      activeSubtitles: null,
      
      // 저장된 자막
      savedSubtitles: [],
      
      // 액션
      setPrimaryLanguage: (lang) => set({ primaryLanguage: lang }),
      setSecondaryLanguage: (lang) => set({ secondaryLanguage: lang }),
      setDisplayMode: (mode) => set({ displayMode: mode }),
      
      // 자막 싱크 관련 함수
      setSubtitleSync: (syncTime) => set({ subtitleSync: syncTime }),
      adjustSubtitleSync: (amount) => set((state) => ({ 
        subtitleSync: Math.round((state.subtitleSync + amount) * 10) / 10 
      })),
      
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setCurrentVideo: (videoId, title) => set({ 
        currentVideoId: videoId, 
        currentVideoTitle: title 
      }),
      setActiveSubtitles: (subtitle) => set({ activeSubtitles: subtitle }),
      saveSubtitle: (subtitle) => set((state) => ({ 
        savedSubtitles: [...state.savedSubtitles, subtitle] 
      })),
      removeSavedSubtitle: (id) => set((state) => ({
        savedSubtitles: state.savedSubtitles.filter(sub => sub.id !== id)
      })),
    }),
    {
      name: 'play-learneng-subtitles',
      // 지속성을 적용할 상태만 선택
      partialize: (state) => ({
        primaryLanguage: state.primaryLanguage,
        secondaryLanguage: state.secondaryLanguage,
        displayMode: state.displayMode,
        subtitleSync: state.subtitleSync,
        savedSubtitles: state.savedSubtitles,
      }),
    }
  )
);

export default useSubtitleStore;
