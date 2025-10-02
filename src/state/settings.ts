const STORAGE_KEY = 'openai_api_key';

export async function loadApiKey(): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEY, items => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      const value = items?.[STORAGE_KEY];
      resolve(typeof value === 'string' && value ? value : undefined);
    });
  });
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const value = apiKey.trim();
  if (!value) {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.remove(STORAGE_KEY, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
