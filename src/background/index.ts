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

import { parseVTT } from '../utils/subtitleCapturer';

// 타입 정의
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
}

interface SavedSubtitleFromPopup { // Assuming this structure from popup.tsx
  id: string;
  primaryText: string;
  secondaryText: string;
  timestamp: number;
  episodeTitle?: string;
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

// VTT 메시지 전송 함수
function sendVttToContentScript(tabId: number, vttUrl: string, vttContent: string, language: string, videoId?: string) {
  if (!isValidTabId(tabId)) {
    console.warn(`[Background] Invalid tabId ${tabId} for sendVttToContentScript.`);
    return;
  }

  const messagePayload: VttMessagePayload = {
    url: vttUrl,
    vtt: vttContent,
    lang: language,
    videoId: videoId,
  };

  if (contentScriptReadyTabs.has(tabId)) {
    logger.log(`[Background] Sending VTT to content script for tab ${tabId} (Lang: ${language})`);
    chrome.tabs.sendMessage(tabId, { type: 'VTT_RECEIVED', payload: messagePayload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[Background] Error sending VTT to content script for tab ${tabId}:`, chrome.runtime.lastError.message);
        contentScriptReadyTabs.delete(tabId);
        queuePendingVttMessage(tabId, messagePayload);
      } else {
        logger.log(`[Background] Successfully sent VTT to content script for tab ${tabId} (${language})`);
      }
    });
  } else {
    logger.log(`[Background] Content script for tab ${tabId} not ready. Queuing VTT (${language})`);
    queuePendingVttMessage(tabId, messagePayload);
  }
}

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

function processPendingVttMessages(tabId: number) {
  if (pendingVttMessages.has(tabId) && contentScriptReadyTabs.has(tabId)) {
    const messages = pendingVttMessages.get(tabId)!;
    if (messages.length > 0) {
      logger.log(`[Background] Processing ${messages.length} pending VTT messages for tab ${tabId}`);
      while (messages.length > 0) {
        const payload = messages.shift()!;
        sendVttToContentScript(tabId, payload.url, payload.vtt, payload.lang, payload.videoId);
      }
      pendingVttMessages.delete(tabId);
    }
  }
}

// MPD 파일 처리 함수
async function processMpdFile(mpdUrl: string, mpdContent: string, tabId: number) {
  try {
    logger.log('[Background] Processing MPD file:', mpdUrl);
    const subtitleUrls = await parseMpdForSubtitles(mpdUrl, mpdContent);
    logger.log('[Background] Extracted subtitle URLs from MPD:', subtitleUrls);

    let currentData = tabSubtitleData.get(tabId) || { videoId: tabVideoIdMap.get(tabId) };
    let changed = false;
    const storageUpdates: { [key: string]: string } = {};

    // 한국어 자막 처리
    if (subtitleUrls.koUrl && subtitleUrls.koUrl !== currentData.koUrl) {
      currentData.koUrl = subtitleUrls.koUrl;
      changed = true;
      try {
        const koVttResponse = await fetch(subtitleUrls.koUrl);
        if (koVttResponse.ok) {
          const koVttText = await koVttResponse.text();
          currentData.koVtt = koVttText;
          storageUpdates.koreanVttContent = koVttText; // Store in chrome.storage.local
          sendVttToContentScript(tabId, subtitleUrls.koUrl, koVttText, 'ko', currentData.videoId);
        } else {
          console.error(`[Background] Failed to fetch Korean VTT from ${subtitleUrls.koUrl}: ${koVttResponse.status}`);
        }
      } catch (error) {
        console.error(`[Background] Error fetching Korean VTT:`, error);
      }
    }

    // 영어 자막 처리
    if (subtitleUrls.enUrl && subtitleUrls.enUrl !== currentData.enUrl) {
      currentData.enUrl = subtitleUrls.enUrl;
      changed = true;
      try {
        const enVttResponse = await fetch(subtitleUrls.enUrl);
        if (enVttResponse.ok) {
          const enVttText = await enVttResponse.text();
          currentData.enVtt = enVttText;
          storageUpdates.englishVttContent = enVttText; // Store in chrome.storage.local
          sendVttToContentScript(tabId, subtitleUrls.enUrl, enVttText, 'en', currentData.videoId);
        } else {
          console.error(`[Background] Failed to fetch English VTT from ${subtitleUrls.enUrl}: ${enVttResponse.status}`);
        }
      } catch (error) {
        console.error(`[Background] Error fetching English VTT:`, error);
      }
    }

    if (changed || !tabSubtitleData.has(tabId)) {
      tabSubtitleData.set(tabId, currentData);
    }

    // Update chrome.storage.local if there are new VTT contents
    if (Object.keys(storageUpdates).length > 0) {
      chrome.storage.local.set(storageUpdates, () => {
        if (chrome.runtime.lastError) {
          console.error('[Background] Error saving VTT content to chrome.storage.local:', chrome.runtime.lastError);
        } else {
          logger.log('[Background] VTT content saved to chrome.storage.local:', storageUpdates);
        }
      });
    }
  } catch (error) {
    console.error(`[Background] Error processing MPD file:`, error);
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

// Runtime 메시지 리스너
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
  } 
  else if (message.type === 'VIDEO_ELEMENT_FOUND') {
    if (message.payload?.videoId) {
      logger.log(`[Background] VIDEO_ELEMENT_FOUND from tab ${tabId}: videoId = ${message.payload.videoId}`);
      tabVideoIdMap.set(tabId, message.payload.videoId);
      
      let currentData = tabSubtitleData.get(tabId);
      if (currentData) {
        currentData.videoId = message.payload.videoId;
      } else {
        tabSubtitleData.set(tabId, { videoId: message.payload.videoId });
      }
      sendResponse({ success: true });
    } else {
      console.warn(`[Background] VIDEO_ELEMENT_FOUND from tab ${tabId} but no videoId in payload.`);
      sendResponse({ success: false, error: "No videoId in payload" });
    }
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
        sendVttToContentScript(tabId, vttUrlToFetch, vttText, lang, tabVideoIdMap.get(tabId));
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
    
    chrome.storage.sync.get(['savedSubtitles', 'subtitleSettings'], (data) => {
      if (chrome.runtime.lastError) {
        console.error("[Background] Error getting savedSubtitles:", chrome.runtime.lastError.message);
        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }

      const savedSubtitles: SavedSubtitleFromPopup[] = data.savedSubtitles || [];
      
      // 고유 ID 생성 (타임스탬프 + 랜덤 문자열)
      const uniqueId = `subtitle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const finalNewSubtitle: SavedSubtitleFromPopup = {
        ...newSubtitleData,
        id: uniqueId,  // 고유 ID 추가
        episodeTitle: '미지정' // 기본값 설정
      };

      // 에피소드 제목/비디오 ID 추가 시도
      if (sender.tab && sender.tab.id) {
        const tabData = tabSubtitleData.get(sender.tab.id);
        if (tabData && tabData.videoId) {
          finalNewSubtitle.episodeTitle = `비디오 ID: ${tabData.videoId}`;
        } else {
          // 탭 제목 사용
          finalNewSubtitle.episodeTitle = sender.tab.title || '미지정';
        }
      }
      
      logger.log('[Background] Adding new subtitle to review tab:', finalNewSubtitle);
      
      // 새 자막을 목록 앞에 추가
      savedSubtitles.unshift(finalNewSubtitle);
      
      // 저장소에 저장
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
    return true; // 비동기 응답을 위한 true 반환
  }
  // Example: Forwarding VTT data if background script is responsible for fetching and distributing
  if (message.type === 'FETCHED_VTT_DATA') { // Assuming a message type like this
    if (sender.tab && sender.tab.id && message.payload) {
        // Store it in tabSubtitleData or forward to content script / popup
        const currentTabData = tabSubtitleData.get(sender.tab.id) || {};
        if (message.payload.lang === 'ko') {
            currentTabData.koVtt = message.payload.vtt;
            // Optionally send to content script if it needs raw VTT
            // chrome.tabs.sendMessage(sender.tab.id, { type: 'VTT_RECEIVED', payload: message.payload });
        } else if (message.payload.lang === 'en') {
            currentTabData.enVtt = message.payload.vtt;
            // chrome.tabs.sendMessage(sender.tab.id, { type: 'VTT_RECEIVED', payload: message.payload });
        }
        tabSubtitleData.set(sender.tab.id, currentTabData);
        
        // Save to chrome.storage.local for popup to pick up
        const storageUpdate: { [key: string]: string } = {};
        if (message.payload.lang === 'ko') storageUpdate.koreanVttContent = message.payload.vtt;
        if (message.payload.lang === 'en') storageUpdate.englishVttContent = message.payload.vtt;
        
        chrome.storage.local.set(storageUpdate, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving VTT to local storage:', chrome.runtime.lastError);
            } else {
                console.log('VTT content saved to local storage for popup.');
            }
        });
        sendResponse({status: 'VTT processed by background'});
    }
    return true;
  }
  
  // Handling content script readiness (if you use this pattern)
  if (message.type === 'CONTENT_SCRIPT_READY') {
    if (sender.tab && sender.tab.id) {
      contentScriptReadyTabs.add(sender.tab.id);
      console.log(`[Background] Content script ready for tab ${sender.tab.id}`);
      // Process any pending messages for this tab
      processPendingVttMessages(sender.tab.id); 
      sendResponse({ status: 'acknowledged' });
    }
    return true;
  }

  // Message from popup to get current VTT data for analysis tab
  if (message.type === 'GET_CURRENT_VTT_FOR_POPUP') {
    if (sender.tab && sender.tab.id) { // Or use a different way to identify the relevant tab
        // Try to get active tab's data if no specific ID is passed or makes sense
        chrome.tabs.query({ active: true, currentWindow: false }, (activeTabs) => {
            // Filter for Coupang Play tabs or the tab that the popup is inspecting
            const targetVideoTab = activeTabs.find(t => t.url && t.url.includes("coupangplay.com"));
            const relevantTabId = targetVideoTab?.id || sender.tab?.id; // Fallback to sender tab if needed

            if (relevantTabId) {
                const data = tabSubtitleData.get(relevantTabId);
                sendResponse({
                    koreanVtt: data?.koVtt,
                    englishVtt: data?.enVtt,
                    videoId: data?.videoId
                });
            } else {
                sendResponse({ koreanVtt: null, englishVtt: null, videoId: null });
            }
        });
    } else {
         // Fallback: check local storage directly if no tab context
        chrome.storage.local.get(['koreanVttContent', 'englishVttContent'], (localData) => {
            sendResponse({
                koreanVtt: localData.koreanVttContent,
                englishVtt: localData.englishVttContent,
                videoId: null // videoId might not be in local storage this way
            });
        });
    }
    return true;
  }
  
  // 현재 비디오 시간 제공 (콘텐츠 스크립트가 응답하지 않은 경우를 위한 백업 핸들러)
  else if (message.type === 'LE_GET_CURRENT_TIME') {
    console.log('[Background] LE_GET_CURRENT_TIME request received from:', sender.tab?.id);
    
    if (sender.tab?.id) {
      // 콘텐츠 스크립트에게 시간을 요청
      chrome.tabs.sendMessage(sender.tab.id, { type: 'LE_GET_CURRENT_TIME' }, 
        (response) => {
          if (chrome.runtime.lastError || !response) {
            console.warn('[Background] Failed to get time from content script, sending fallback time');
            // 응답이 없을 경우 기본값 전송
            sendResponse({ currentTime: Math.floor(Date.now() / 1000) });
          } else {
            console.log('[Background] Forwarding time from content script:', response);
            sendResponse(response);
          }
        }
      );
    } else {
      console.warn('[Background] No valid tab ID for LE_GET_CURRENT_TIME request');
      sendResponse({ currentTime: Math.floor(Date.now() / 1000) });
    }
    
    return true; // 비동기 응답 처리를 위한 true 반환
  }
  
  // Make sure to include any other message handlers that were in your original background script.
  // For example, the MPD processing and VTT fetching logic.
  // The following is a placeholder for where your existing network listeners might be.
  // Ensure this integrates correctly with the functions like processMpdFile.

});

// ... (rest of existing background script code, including webRequest listeners, 
//      parseMpdForSubtitles, processMpdFile, sendVttToContentScript, 
//      queuePendingVttMessage, processPendingVttMessages, etc.) ...

// Ensure functions like contentScriptReadyTabs and tabSubtitleData are defined globally in the script.
// Example:
// const contentScriptReadyTabs = new Set<number>();
// const tabSubtitleData = new Map<number, { koUrl?: string; enUrl?: string; koVtt?: string; enVtt?: string; videoId?: string }>();
// const pendingVttMessages = new Map<number, any[]>(); // Define type for VttMessagePayload if not already

// function processPendingVttMessages(tabId: number) { ... } // Ensure this function exists

// The webRequest listeners should call processMpdFile, which in turn might call
// sendVttToContentScript or directly store/send VTT data.
// The key is that VTT data (koVtt, enVtt) should end up in tabSubtitleData and chrome.storage.local.
