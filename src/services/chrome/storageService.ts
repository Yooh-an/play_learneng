/**
 * Chrome Storage API를 간편하게 사용하기 위한 유틸리티 서비스
 */

/**
 * Chrome 스토리지에서 데이터를 가져오는 함수
 * @param key 가져올 데이터의 키
 * @param storageArea 'sync' 또는 'local' 스토리지 영역 (기본값: 'sync')
 */
export async function getFromStorage<T>(key: string, storageArea: 'sync' | 'local' = 'sync'): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage[storageArea].get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

/**
 * Chrome 스토리지에 데이터를 저장하는 함수
 * @param key 저장할 데이터의 키
 * @param value 저장할 데이터 값
 * @param storageArea 'sync' 또는 'local' 스토리지 영역 (기본값: 'sync')
 */
export async function saveToStorage<T>(key: string, value: T, storageArea: 'sync' | 'local' = 'sync'): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage[storageArea].set({ [key]: value }, () => {
      resolve();
    });
  });
}

/**
 * Chrome 스토리지에서 데이터를 삭제하는 함수
 * @param keys 삭제할 데이터의 키 또는 키 배열
 * @param storageArea 'sync' 또는 'local' 스토리지 영역 (기본값: 'sync')
 */
export async function removeFromStorage(keys: string | string[], storageArea: 'sync' | 'local' = 'sync'): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage[storageArea].remove(keys, () => {
      resolve();
    });
  });
}

/**
 * Chrome 스토리지의 모든 데이터를 가져오는 함수
 * @param storageArea 'sync' 또는 'local' 스토리지 영역 (기본값: 'sync')
 */
export async function getAllStorage(storageArea: 'sync' | 'local' = 'sync'): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage[storageArea].get(null, (result) => {
      resolve(result);
    });
  });
}

/**
 * Chrome 스토리지 변경 이벤트를 감시하는 함수
 * @param callback 변경 이벤트 발생 시 호출될 콜백 함수
 * @param storageArea 감시할 스토리지 영역 ('sync', 'local', 'all') (기본값: 'all')
 */
export function watchStorage(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void,
  storageArea: 'sync' | 'local' | 'all' = 'all'
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (storageArea === 'all' || areaName === storageArea) {
      callback(changes, areaName);
    }
  });
}

export default {
  get: getFromStorage,
  save: saveToStorage,
  remove: removeFromStorage,
  getAll: getAllStorage,
  watch: watchStorage,
};
