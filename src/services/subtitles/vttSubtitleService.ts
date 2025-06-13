/**
 * WebVTT 자막 관련 서비스 구현
 * 현재 VTT 기반 시스템에서는 findActiveSubtitleCue와 parseVTT 함수만 사용됩니다.
 */
import { parseVTT } from '../../utils/subtitleCapturer';

interface SubtitleCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface CapturedSubtitle {
  url: string;
  content: string;
  cues: SubtitleCue[];
  language?: string;
}

/**
 * 비디오 플레이어에서 현재 재생 시간에 맞는 자막 찾기
 * PlayerController에서 사용
 */
export function findActiveSubtitleCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;
  
  return cues.find(cue => currentTime >= cue.startTime && currentTime <= cue.endTime) || null;
}

// 현재 실제로 사용되는 것들만 export
export { parseVTT } from '../../utils/subtitleCapturer';
