// Play LearnEng Background Script
import { logger } from '../utils/logger';

// 설정 기본값
const DEFAULT_SETTINGS = {
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

// VTT 파싱 함수 강화 - 더 세밀한 파싱과 검증
// 타입 정의 통합 및 정리
interface VttCue {
  id?: string;
  startTime: number;
  endTime: number;
  text: string;
  settings?: string; // 위치, 정렬 등의 WebVTT 설정
}

interface ProcessedSubtitleData {
  language: string;
  cues: VttCue[];
  videoId?: string;
  totalCues: number;
  duration?: number; // 전체 자막 지속 시간
  isValid: boolean;
}

interface VttMessagePayload {
  url: string;
  vtt: string;
  lang: string;
  videoId?: string;
}

interface SubtitleUrls {
  koUrl?: string;
  enUrl?: string;
}

interface TabSubtitleData {
  koUrl?: string;
  enUrl?: string;
  koVtt?: string;
  enVtt?: string;
  videoId?: string;
  // 가공된 데이터도 캐시
  processedKorean?: ProcessedSubtitleData;
  processedEnglish?: ProcessedSubtitleData;
}

interface SavedSubtitleFromPopup {
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
}

function parseVTT(vttContent: string): VttCue[] {
  const lines = vttContent.split('\n');
  const cues: VttCue[] = [];
  let i = 0;

  // WEBVTT 헤더 및 NOTE 섹션 스킵
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) break;
    if (line.startsWith('NOTE') || line.startsWith('WEBVTT') || line === '') {
      i++;
      continue;
    }
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 빈 라인 스킵
    if (line === '') {
      i++;
      continue;
    }
    
    // 큐 ID 확인 (선택적)
    let cueId: string | undefined;
    if (!line.includes('-->')) {
      // 다음 라인이 시간 정보인지 확인
      if (i + 1 < lines.length && lines[i + 1].includes('-->')) {
        cueId = line;
        i++;
      }
    }
    
    // 시간 정보 파싱
    const currentLine = lines[i].trim();
    if (currentLine.includes('-->')) {
      const timeMatch = currentLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})(.*)?/);
      if (timeMatch) {
        const startTime = timeToSeconds(timeMatch[1]);
        const endTime = timeToSeconds(timeMatch[2]);
        const settings = timeMatch[3] ? timeMatch[3].trim() : undefined;
        
        // 다음 라인들에서 텍스트 수집
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          const textLine = lines[i].trim();
          if (textLine) {
            textLines.push(textLine);
          }
          i++;
        }
        
        if (textLines.length > 0) {
          cues.push({
            id: cueId,
            startTime,
            endTime,
            text: textLines.join('\n'),
            settings
          });
        }
      }
    }
    i++;
  }

  // 시간순 정렬
  cues.sort((a, b) => a.startTime - b.startTime);
  
  logger.log(`[Background] Parsed ${cues.length} VTT cues`);
  return cues;
}

function timeToSeconds(timeString: string): number {
  const [time, ms] = timeString.split('.');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
}

// 자막 데이터 검증 및 메타데이터 추가
function processSubtitleData(vttContent: string, language: string, videoId?: string): ProcessedSubtitleData {
  try {
    const cues = parseVTT(vttContent);
    const duration = cues.length > 0 ? cues[cues.length - 1].endTime : 0;
    
    return {
      language,
      cues,
      videoId,
      totalCues: cues.length,
      duration,
      isValid: cues.length > 0
    };
  } catch (error) {
    logger.error(`[Background] Error processing subtitle data for ${language}:`, error);
    return {
      language,
      cues: [],
      videoId,
      totalCues: 0,
      duration: 0,
      isValid: false
    };
  }
}

// 전역 상태 관리
const contentScriptReadyTabs = new Set<number>();
const pendingVttMessages = new Map<number, VttMessagePayload[]>();
const tabVideoIdMap = new Map<number, string>();
const tabSubtitleData = new Map<number, TabSubtitleData>();
const targetTabs = new Set<number>();

// 유틸리티 함수들
function isValidTabId(tabId: number | undefined): tabId is number {
  return typeof tabId === 'number' && tabId !== chrome.tabs.TAB_ID_NONE;
}

function clearPendingVttMessagesAndVideoId(tabId: number) {
  pendingVttMessages.delete(tabId);
  tabVideoIdMap.delete(tabId);
  tabSubtitleData.delete(tabId);
  contentScriptReadyTabs.delete(tabId);
  targetTabs.delete(tabId);
  // 탭 데이터 정리
}

function isCoupangPlayMpdUrl(url: string): boolean {
  return url.includes('coupangstreaming.com') && url.endsWith('.mpd');
}

// MPD 파싱 함수 (Service Worker 호환)
async function parseMpdForSubtitles(mpdUrl: string, mpdContent: string): Promise<SubtitleUrls> {
  try {
    // MPD 파싱 중...
    
    // AdaptationSet 요소들을 정규식으로 추출
    const adaptationSetRegex = /<AdaptationSet[^>]*>[\s\S]*?<\/AdaptationSet>/g;
    const adaptationSets = mpdContent.match(adaptationSetRegex) || [];
    
    let koUrl: string | undefined;
    let enUrl: string | undefined;

    for (const adaptationSetXml of adaptationSets) {
      // contentType과 mimeType 확인
      const contentTypeMatch = adaptationSetXml.match(/contentType=['"]([^'"]*)['"]/);
      const mimeTypeMatch = adaptationSetXml.match(/mimeType=['"]([^'"]*)['"]/);
      
      const contentType = contentTypeMatch ? contentTypeMatch[1] : '';
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : '';

      // 자막 AdaptationSet인지 확인
      if (contentType === "text" || mimeType === "text/vtt" || mimeType === "application/ttml+xml") {
        logger.log('[Background] Found text AdaptationSet:', contentType, mimeType);
        
        // lang 속성 추출
        const langMatch = adaptationSetXml.match(/lang=['"]([^'"]*)['"]/);
        const lang = langMatch ? langMatch[1] : '';
        
        logger.log('[Background] Language detected:', lang);

        // Representation 요소들 추출
        const representationRegex = /<Representation[^>]*>[\s\S]*?<\/Representation>/g;
        const representations = adaptationSetXml.match(representationRegex) || [];
        
        if (representations.length > 0) {
          // VTT mimeType을 가진 representation을 우선 선택, 없으면 첫 번째 사용
          let targetRepresentation = representations.find(rep => 
            rep.includes('mimeType="text/vtt"')
          ) || representations[0];
          
          if (targetRepresentation) {
            // BaseURL 추출
            const baseUrlMatch = targetRepresentation.match(/<BaseURL[^>]*>(.*?)<\/BaseURL>/);
            if (baseUrlMatch && baseUrlMatch[1]) {
              let subtitleUrl = baseUrlMatch[1].trim();
              
              // 상대 URL을 절대 URL로 변환
              if (subtitleUrl && !subtitleUrl.startsWith('http')) {
                try {
                  subtitleUrl = new URL(subtitleUrl, mpdUrl).href;
                } catch (e) {
                  console.warn(`[Background] Invalid BaseURL '${subtitleUrl}' in MPD:`, e);
                  continue;
                }
              }

              if (subtitleUrl) {
                logger.log(`[Background] Found subtitle URL for lang ${lang}: ${subtitleUrl}`);
                
                // 언어별로 URL 저장
                if (lang && (lang.toLowerCase().startsWith("ko") || lang.toLowerCase().startsWith("kor"))) {
                  koUrl = subtitleUrl;
                  logger.log('[Background] Korean subtitle URL found:', koUrl);
                } else if (lang && (lang.toLowerCase().startsWith("en") || lang.toLowerCase().startsWith("eng"))) {
                  enUrl = subtitleUrl;
                  logger.log('[Background] English subtitle URL found:', enUrl);
                }
              }
            }
          }
        }
      }
    }
    
    logger.log('[Background] Final subtitle URLs:', { koUrl, enUrl });
    return { koUrl, enUrl };
  } catch (e) {
    console.error('[Background] Exception during MPD parsing:', e);
    return {};
  }
}

// 향상된 VTT 전송 함수
function sendProcessedSubtitleToContentScript(tabId: number, vttUrl: string, vttContent: string, language: string, videoId?: string) {
  if (!isValidTabId(tabId)) {
    console.warn(`[Background] Invalid tabId ${tabId} for sendProcessedSubtitleToContentScript.`);
    return;
  }

  // VTT 데이터 가공
  const processedData = processSubtitleData(vttContent, language, videoId);
  
  if (!processedData.isValid) {
    console.warn(`[Background] Invalid VTT data for ${language}, skipping send`);
    return;
  }

  if (contentScriptReadyTabs.has(tabId)) {
    logger.log(`[Background] Sending processed subtitle data to content script for tab ${tabId} (Lang: ${language}, Cues: ${processedData.totalCues})`);
    chrome.tabs.sendMessage(tabId, { 
      type: 'PROCESSED_SUBTITLE_RECEIVED', 
      payload: processedData 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[Background] Error sending processed subtitle to content script for tab ${tabId}:`, chrome.runtime.lastError.message);
        contentScriptReadyTabs.delete(tabId);
        // 원본 메시지를 큐에 저장
        queuePendingVttMessage(tabId, { url: vttUrl, vtt: vttContent, lang: language, videoId });
      } else {
        logger.log(`[Background] Successfully sent processed subtitle to content script for tab ${tabId} (${language})`);
      }
    });
  } else {
    logger.log(`[Background] Content script for tab ${tabId} not ready. Queuing processed subtitle (${language})`);
    queuePendingVttMessage(tabId, { url: vttUrl, vtt: vttContent, lang: language, videoId });
  }
}

// MPD 파일 처리 함수 - 가공된 데이터 캐싱 추가
async function processMpdFile(mpdUrl: string, mpdContent: string, tabId: number) {
  try {
    logger.log('[Background] Processing MPD file:', mpdUrl);
    const subtitleUrls = await parseMpdForSubtitles(mpdUrl, mpdContent);
    logger.log('[Background] Extracted subtitle URLs from MPD:', subtitleUrls);

    let currentData = tabSubtitleData.get(tabId) || { videoId: tabVideoIdMap.get(tabId) };
    let finalKoreanVttContent = '';
    let finalEnglishVttContent = '';

    // 한국어 자막 처리
    if (subtitleUrls.koUrl) {
        try {
          const koVttResponse = await fetch(subtitleUrls.koUrl);
          if (koVttResponse.ok) {
            const koVttText = await koVttResponse.text();
            finalKoreanVttContent = koVttText;
            currentData.koVtt = koVttText;
            
            // 가공된 데이터 생성 및 캐싱
            const processedKorean = processSubtitleData(koVttText, 'ko', currentData.videoId);
            currentData.processedKorean = processedKorean;
            
            // 가공된 자막 데이터 전송
            sendProcessedSubtitleToContentScript(tabId, subtitleUrls.koUrl, koVttText, 'ko', currentData.videoId);
          } else {
            console.error(`[Background] Failed to fetch Korean VTT from ${subtitleUrls.koUrl}: ${koVttResponse.status}`);
          }
        } catch (error) {
          console.error(`[Background] Error fetching Korean VTT:`, error);
        }
      currentData.koUrl = subtitleUrls.koUrl;
    } else {
      currentData.koUrl = undefined;
      currentData.koVtt = undefined;
      currentData.processedKorean = undefined;
    }

    // 영어 자막 처리
    if (subtitleUrls.enUrl) {
        try {
          const enVttResponse = await fetch(subtitleUrls.enUrl);
          if (enVttResponse.ok) {
            const enVttText = await enVttResponse.text();
            finalEnglishVttContent = enVttText;
            currentData.enVtt = enVttText;
            
            // 가공된 데이터 생성 및 캐싱
            const processedEnglish = processSubtitleData(enVttText, 'en', currentData.videoId);
            currentData.processedEnglish = processedEnglish;
            
            // 가공된 자막 데이터 전송
            sendProcessedSubtitleToContentScript(tabId, subtitleUrls.enUrl, enVttText, 'en', currentData.videoId);
          } else {
            console.error(`[Background] Failed to fetch English VTT from ${subtitleUrls.enUrl}: ${enVttResponse.status}`);
          }
        } catch (error) {
          console.error(`[Background] Error fetching English VTT:`, error);
        }
      currentData.enUrl = subtitleUrls.enUrl;
    } else {
      currentData.enUrl = undefined;
      currentData.enVtt = undefined;
      currentData.processedEnglish = undefined;
    }

    tabSubtitleData.set(tabId, currentData);

    // chrome.storage.local 업데이트
    const storageUpdateData = {
      koreanVttContent: finalKoreanVttContent,
      englishVttContent: finalEnglishVttContent
    };

    chrome.storage.local.set(storageUpdateData, () => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error saving VTT content to chrome.storage.local:', chrome.runtime.lastError);
      } else {
        logger.log('[Background] VTT content saved to chrome.storage.local');
      }
    });

  } catch (error) {
    console.error(`[Background] Error processing MPD file:`, error);
  }
}

// 큐에 VTT 메시지 추가
function queuePendingVttMessage(tabId: number, payload: VttMessagePayload) {
  if (!pendingVttMessages.has(tabId)) {
    pendingVttMessages.set(tabId, []);
  }
  const queue = pendingVttMessages.get(tabId)!;
  if (!queue.find(p => p.url === payload.url && p.lang === payload.lang)) {
    queue.push(payload);
    logger.log(`[Background] Queued VTT for tab ${tabId} (${payload.lang}). Queue size: ${queue.length}`);
  }
}

// 보류 중인 VTT 메시지 처리 - 새로운 전송 함수 사용
function processPendingVttMessages(tabId: number) {
  if (pendingVttMessages.has(tabId) && contentScriptReadyTabs.has(tabId)) {
    const messages = pendingVttMessages.get(tabId)!;
    if (messages.length > 0) {
      logger.log(`[Background] Processing ${messages.length} pending VTT messages for tab ${tabId}`);
      while (messages.length > 0) {
        const payload = messages.shift()!;
        sendProcessedSubtitleToContentScript(tabId, payload.url, payload.vtt, payload.lang, payload.videoId);
      }
      pendingVttMessages.delete(tabId);
    }
  }
}

// Chrome Extension 이벤트 리스너들
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    logger.log('Play LearnEng installed');
    await chrome.storage.sync.set({
      settings: DEFAULT_SETTINGS,
      savedSubtitles: []
    });
    // 설치 후 자동으로 옵션 페이지를 열지 않음
  } else if (details.reason === 'update') {
    logger.log('Play LearnEng updated');
    try {
      const data = await chrome.storage.sync.get('settings');
      if (!data.settings) {
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
      }
    } catch (error) {
      console.error('설정 마이그레이션 중 오류 발생:', error);
    }
  }
});

// WebRequest API를 사용한 네트워크 모니터링
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const { tabId, url, type } = details;
    
    if (!isValidTabId(tabId)) return;

    // 메인 프레임 로드 시 데이터 초기화
    if (type === "main_frame") {
      clearPendingVttMessagesAndVideoId(tabId);
      return;
    }
    
    // MPD 파일 감지 및 처리
    if (isCoupangPlayMpdUrl(url)) {
      logger.log('[Background] MPD file detected via webRequest:', url);
      try {
        const response = await fetch(url);
        if (response.ok) {
          const mpdContent = await response.text();
          await processMpdFile(url, mpdContent, tabId);
        } else {
          console.error(`[Background] Failed to fetch MPD: ${response.status}`);
        }
      } catch (error) {
        console.error(`[Background] Error processing MPD file:`, error);
      }
    }
  },
  { urls: ["*://*.coupangstreaming.com/*"] },
  []
);

// Runtime 메시지 리스너 - 누락된 핸들러 추가
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (!isValidTabId(tabId)) {
    sendResponse({ success: false, error: 'Invalid tab ID' });
    return true;
  }

  if (message.type === 'CONTENT_SCRIPT_READY') {
    logger.log(`[Background] Content script READY message received from tab ${tabId}`);
    contentScriptReadyTabs.add(tabId);
    processPendingVttMessages(tabId);
    sendResponse({ success: true });
    return true;
  } 
  else if (message.type === 'VIDEO_ELEMENT_FOUND') {
    if (message.payload?.videoId) {
      logger.log(`[Background] VIDEO_ELEMENT_FOUND from tab ${tabId}: videoId = ${message.payload.videoId}`);
      
      const prevVideoId = tabVideoIdMap.get(tabId);
      const newVideoId = message.payload.videoId;
      
      // 동영상이 변경된 경우 저장된 자막 데이터를 초기화
      if (prevVideoId && prevVideoId !== newVideoId) {
        logger.log(`[Background] Video changed from ${prevVideoId} to ${newVideoId}, clearing subtitle data`);
        
        chrome.storage.local.set({
          koreanVttContent: '',
          englishVttContent: ''
        }, () => {
          logger.log('[Background] Cleared previous subtitle data from storage');
        });
        
        tabSubtitleData.set(tabId, { videoId: newVideoId });

        // VTT 매니저 초기화 필요성을 콘텐츠 스크립트에 알림
        chrome.tabs.sendMessage(tabId, {
          type: 'VIDEO_CHANGED',
          payload: { videoId: newVideoId }
        }).catch(error => {
          logger.error(`[Background] Error sending VIDEO_CHANGED to tab ${tabId}:`, error);
        });
      } else {
        let currentData = tabSubtitleData.get(tabId);
        if (currentData) {
          currentData.videoId = newVideoId;
        } else {
          tabSubtitleData.set(tabId, { videoId: newVideoId });
        }
      }
      
      tabVideoIdMap.set(tabId, newVideoId);
      sendResponse({ success: true });
    } else {
      console.warn(`[Background] VIDEO_ELEMENT_FOUND from tab ${tabId} but no videoId in payload.`);
      sendResponse({ success: false, error: "No videoId in payload" });
    }
    return true;
  } 
  else if (message.type === 'REQUEST_SUBTITLE_CONTENT') {
    const { url: vttUrlToFetch, lang } = message.payload;
    logger.log(`[Background] Received REQUEST_SUBTITLE_CONTENT for URL: ${vttUrlToFetch}, Lang: ${lang}`);
    
    fetch(vttUrlToFetch)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.text();
      })
      .then(vttText => {
        sendProcessedSubtitleToContentScript(tabId, vttUrlToFetch, vttText, lang, tabVideoIdMap.get(tabId));
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error(`[Background] Failed to fetch VTT content for ${vttUrlToFetch}:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  else if (message.action === 'getSettings') {
    chrome.storage.sync.get('settings', (data) => {
      sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
    });
    return true;
  }
  else if (message.action === 'saveSubtitle') {
    chrome.storage.sync.get('savedSubtitles', (data) => {
      const savedSubtitles = data.savedSubtitles || [];
      savedSubtitles.push({
        ...message.subtitle,
        savedAt: new Date().toISOString()
      });
      
      chrome.storage.sync.set({ savedSubtitles }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  else if (message.type === 'ADD_REVIEW_SUBTITLE') {
    const newSubtitleData = message.payload as Omit<SavedSubtitleFromPopup, 'id' | 'episodeTitle'>;
    
    chrome.storage.sync.get(['savedSubtitles'], (data) => {
      if (chrome.runtime.lastError) {
        console.error("[Background] Error getting savedSubtitles:", chrome.runtime.lastError.message);
        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }

      const savedSubtitles: SavedSubtitleFromPopup[] = data.savedSubtitles || [];
      const uniqueId = `subtitle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const finalNewSubtitle: SavedSubtitleFromPopup = {
        ...newSubtitleData,
        id: uniqueId,
        episodeTitle: '미지정'
      };

      if (sender.tab && sender.tab.id) {
        const tabData = tabSubtitleData.get(sender.tab.id);
        if (tabData && tabData.videoId) {
          finalNewSubtitle.episodeTitle = `비디오 ID: ${tabData.videoId}`;
        } else {
          finalNewSubtitle.episodeTitle = sender.tab.title || '미지정';
        }
      }
      
      savedSubtitles.unshift(finalNewSubtitle);
      
      chrome.storage.sync.set({ savedSubtitles }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Background] Error setting savedSubtitles:", chrome.runtime.lastError.message);
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          logger.log('[Background] Subtitle saved to review tab:', finalNewSubtitle);
          sendResponse({ status: 'success', subtitle: finalNewSubtitle });
        }
      });
    });
    return true;
  }
  // 새로운 메시지 핸들러: 가공된 VTT 데이터 요청
  else if (message.type === 'GET_PROCESSED_SUBTITLES') {
    const { videoId } = message.payload || {};
    
    if (sender.tab?.id) {
      const tabData = tabSubtitleData.get(sender.tab.id);
      
      // 비디오 ID 검증
      if (videoId && tabData?.videoId !== videoId) {
        logger.warn(`[Background] Video ID mismatch for processed subtitles request: ${videoId} vs ${tabData?.videoId}`);
        sendResponse({ 
          success: false, 
          error: 'Video ID mismatch',
          korean: null,
          english: null
        });
        return true;
      }
      
      sendResponse({
        success: true,
        korean: tabData?.processedKorean || null,
        english: tabData?.processedEnglish || null,
        videoId: tabData?.videoId
      });
    } else {
      sendResponse({ 
        success: false, 
        error: 'No tab context',
        korean: null,
        english: null
      });
    }
    return true;
  }
  // 기존 GET_CURRENT_VTT_FOR_POPUP 핸들러 강화
  else if (message.type === 'GET_CURRENT_VTT_FOR_POPUP') {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const targetTab = activeTabs.find(t => t.url && t.url.includes("coupangplay.com"));
      const relevantTabId = targetTab?.id;

      if (relevantTabId) {
        const data = tabSubtitleData.get(relevantTabId);
        sendResponse({
          koreanVtt: data?.koVtt,
          englishVtt: data?.enVtt,
          videoId: data?.videoId,
          // 가공된 데이터도 함께 제공
          processedKorean: data?.processedKorean,
          processedEnglish: data?.processedEnglish
        });
      } else {
        chrome.storage.local.get(['koreanVttContent', 'englishVttContent'], (localData) => {
          // 저장된 원본 데이터로부터 가공된 데이터 생성
          const processedKorean = localData.koreanVttContent ? 
            processSubtitleData(localData.koreanVttContent, 'ko') : null;
          const processedEnglish = localData.englishVttContent ? 
            processSubtitleData(localData.englishVttContent, 'en') : null;
            
          sendResponse({
            koreanVtt: localData.koreanVttContent,
            englishVtt: localData.englishVttContent,
            videoId: null,
            processedKorean,
            processedEnglish
          });
        });
      }
    });
    return true;
  }
  else if (message.type === 'LE_GET_CURRENT_TIME') {
    logger.log('[Background] LE_GET_CURRENT_TIME request received from:', sender.tab?.id);
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'LE_GET_CURRENT_TIME' })
        .then(response => {
          if (response && response.currentTime !== undefined) {
            logger.log('[Background] Forwarding time from content script:', response);
            sendResponse(response);
          } else {
            console.warn('[Background] Invalid response from content script, sending fallback time');
            sendResponse({ currentTime: Math.floor(Date.now() / 1000) });
          }
        })
        .catch(error => {
          console.warn('[Background] Failed to get time from content script:', error);
          sendResponse({ currentTime: Math.floor(Date.now() / 1000) });
        });
    } else {
      console.warn('[Background] No valid tab ID for LE_GET_CURRENT_TIME request');
      sendResponse({ currentTime: Math.floor(Date.now() / 1000) });
    }
    
    return true;
  }

  // 알 수 없는 메시지 타입에 대한 기본 응답
  sendResponse({ success: false, error: 'Unknown message type' });
  return true;
});
