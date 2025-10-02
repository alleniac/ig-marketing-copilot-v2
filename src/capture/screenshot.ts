import { ScreenshotItem } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function captureVisibleTabPNG(windowId?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = { format: 'png' as const };
    const cb = (dataUrl?: string) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (!dataUrl) return reject(new Error('No data URI from capture'));
      resolve(dataUrl);
    };
    if (typeof windowId === 'number') {
      chrome.tabs.captureVisibleTab(windowId, options, cb);
    } else {
      chrome.tabs.captureVisibleTab(options, cb);
    }
  });
}

export async function downscaleIfNeeded(dataUrl: string, maxWidth = 1280, blurAll = false): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const targetWidth = img.width > maxWidth ? maxWidth : img.width;
  const scale = img.width > 0 ? targetWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');
  if (blurAll) {
    // Mild blur for privacy when toggled
    // Note: Canvas filter support varies; this is optional best-effort.
    (ctx as any).filter = 'blur(3px)';
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.95);
}

export async function takeScreenshot(windowId: number | undefined, note?: string, blurAll?: boolean): Promise<ScreenshotItem> {
  const raw = await captureVisibleTabPNG(windowId);
  const dataURI = await downscaleIfNeeded(raw, 1280, !!blurAll);
  return {
    id: uuid(),
    dataURI,
    createdAt: Date.now(),
    note,
  };
}
