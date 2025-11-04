import { Candidate, Mode, ModelId, PerTabSession, ScreenshotItem } from '../types.js';
import { takeScreenshot } from '../capture/screenshot.js';
import { defaultCorpusPathForMode, loadCorpus } from '../corpora/loader.js';
import { putSession, listSessions } from '../state/db.js';
import { loadApiKey, saveApiKey } from '../state/settings.js';
import { buildPacket, sendWithFallback } from '../openai/client.js';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const elMode = byId<HTMLSelectElement>('mode');
const elModel = byId<HTMLSelectElement>('model');
const elCorpusPath = byId<HTMLInputElement>('corpusPath');
const elManual = byId<HTMLTextAreaElement>('manualPrompt');
const elBlur = byId<HTMLInputElement>('blurUsernames');
const elApiKey = byId<HTMLInputElement>('apiKey');
const elTray = byId<HTMLDivElement>('tray');
const elShotInfo = byId<HTMLSpanElement>('shotInfo');
const elSend = byId<HTMLButtonElement>('send');
const elOptimize = byId<HTMLButtonElement>('optimize');
const elStatus = byId<HTMLSpanElement>('status');
const elCandidates = byId<HTMLDivElement>('candidates');
const elComposer = byId<HTMLTextAreaElement>('composer');
const elCopy = byId<HTMLButtonElement>('copy');
const elActivity = byId<HTMLDivElement>('activity');
const elTakeShot = byId<HTMLButtonElement>('takeShot');
const elClearAll = byId<HTMLButtonElement>('clearAll');

let session: PerTabSession | null = null;
let sessionInc = 0;

console.log('[popup] script loaded');

function normalizeSession(raw: Partial<PerTabSession> | null | undefined, windowId: number, tabId: number): PerTabSession {
  const baseId = raw?.id && raw.id.includes('-') ? raw.id : sessionId(windowId, tabId);
  const screenshots = raw && Array.isArray(raw.screenshots) ? raw.screenshots.slice() : [];
  const activityLog = raw && Array.isArray(raw.activityLog) ? raw.activityLog.slice() : [];
  const candidates = raw && Array.isArray(raw.candidates) ? raw.candidates : [];

  return {
    id: baseId,
    windowId,
    tabId,
    mode: (raw?.mode as Mode) ?? 'comment_under_post',
    screenshots,
    manualPrompt: raw?.manualPrompt ?? '',
    model: (raw?.model as ModelId) ?? 'gpt-5',
    corpusRef: raw?.corpusRef ?? defaultCorpusPathForMode('comment_under_post'),
    status: raw?.status ?? 'idle',
    requestId: raw?.requestId,
    candidates,
    compiledResponse: raw?.compiledResponse ?? '',
    activityLog,
    blurUsernames: !!raw?.blurUsernames,
  };
}

function log(event: string, meta?: Record<string, unknown>) {
  if (!session) return;
  if (!Array.isArray(session.activityLog)) {
    session.activityLog = [];
  }
  session.activityLog.push({ ts: Date.now(), event, meta });
  putSession(session).catch(err => {
    console.warn('putSession(log) failed', err);
  });
  const div = document.createElement('div');
  div.textContent = `${new Date().toLocaleTimeString()} – ${event}`;
  elActivity.prepend(div);
}

async function getActiveTabInfo(): Promise<{ windowId: number; tabId: number }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab');
  if (typeof tab.id !== 'number') throw new Error('Active tab missing id');
  if (typeof tab.windowId !== 'number') throw new Error('Active tab missing window');
  console.log('[popup] active tab info', { windowId: tab.windowId, tabId: tab.id });
  return { windowId: tab.windowId, tabId: tab.id };
}

function sessionId(win: number, tab: number): string {
  return `${win}-${tab}-${sessionInc}`;
}

function updateShotInfo() {
  if (!session) return;
  const n = session.screenshots.length;
  const warn = n > 8 ? ' (exceeds cap; will warn)' : '';
  elShotInfo.textContent = `${n} screenshot(s)${warn}`;
}

function renderTray() {
  if (!session) return;
  elTray.innerHTML = '';
  session.screenshots.forEach((s, idx) => {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    const img = document.createElement('img');
    img.src = s.dataURI;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const ts = new Date(s.createdAt).toLocaleTimeString();
    const note = document.createElement('span');
    note.textContent = s.note ? s.note : ts;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!session) return;
      session.screenshots.splice(idx, 1);
      putSession(session);
      renderTray();
      updateShotInfo();
    };
    const up = document.createElement('button');
    up.textContent = '▲';
    up.onclick = () => {
      if (idx <= 0 || !session) return;
      const [it] = session.screenshots.splice(idx, 1);
      session.screenshots.splice(idx - 1, 0, it);
      putSession(session);
      renderTray();
    };
    const down = document.createElement('button');
    down.textContent = '▼';
    down.onclick = () => {
      if (!session || idx >= session.screenshots.length - 1) return;
      const [it] = session.screenshots.splice(idx, 1);
      session.screenshots.splice(idx + 1, 0, it);
      putSession(session);
      renderTray();
    };
    meta.append(note, up, down, del);
    cell.append(img, meta);
    elTray.append(cell);
  });
}

function setStatus(text: string) {
  elStatus.textContent = text;
}

async function ensureSession(): Promise<void> {
  console.log('[popup] ensureSession start');
  const { windowId, tabId } = await getActiveTabInfo();
  // Try to find existing session for this tab
  let candidates: PerTabSession[] = [];
  try {
    const all = await listSessions();
    candidates = all.filter(s => s.windowId === windowId && s.tabId === tabId);
  } catch (err) {
    console.warn('listSessions failed, continuing with temporary session', err);
  }
  console.log('[popup] ensureSession candidates', candidates.length);
  if (candidates.length) {
    // pick latest by created ts inferred from id suffix
    candidates.sort((a, b) => (a.id > b.id ? -1 : 1));
    session = normalizeSession(candidates[0], windowId, tabId);
  } else {
    sessionInc = Date.now();
    session = normalizeSession(null, windowId, tabId);
    try {
      await putSession(session);
    } catch (err) {
      console.warn('putSession(create) failed', err);
    }
  }
  // Reflect session into UI
  elMode.value = session.mode;
  elModel.value = session.model;
  elCorpusPath.value = typeof session.corpusRef === 'string' ? session.corpusRef : '';
  elManual.value = session.manualPrompt;
  elBlur.checked = !!session.blurUsernames;
  console.log('[popup] ensureSession ready', { windowId: session.windowId, tabId: session.tabId });
}

function applyCorpusAutoPath() {
  const mode = elMode.value as Mode;
  if (!elCorpusPath.value.trim()) {
    elCorpusPath.placeholder = defaultCorpusPathForMode(mode);
  }
}

async function onTakeScreenshot() {
  console.log('[popup] capture clicked', { hasSession: !!session });
  try {
    if (!session) {
      await ensureSession();
    }
    if (!session) {
      setStatus('No active tab. Please focus a tab and reopen the popup.');
      return;
    }
    setStatus('Capturing...');
    console.log('[popup] capturing via takeScreenshot', { windowId: session.windowId });
    const shot = await takeScreenshot(session.windowId, undefined, !!elBlur.checked);
    if (!Array.isArray(session.screenshots)) {
      session.screenshots = [];
    }
    session.screenshots.push(shot);
    try {
      await putSession(session);
    } catch (err) {
      console.warn('putSession(screenshot) failed', err);
    }
    renderTray();
    updateShotInfo();
    log('screenshot_captured');
    setStatus('Screenshot captured');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(`Capture failed: ${msg}`);
    console.error('[popup] capture failed', e);
    log('screenshot_failed', { error: String(e) });
  }
}

function validatePayloadWarn(): string | null {
  if (!session) return 'No session';
  if (session.screenshots.length === 0) return 'Please capture at least 1 screenshot';
  if (session.screenshots.length > 8) return 'Limit 8 screenshots per request';
  // Rough payload size estimate (base64 ~ 1.37x). Warn if > ~8MB
  const total = session.screenshots.reduce((acc, s) => acc + s.dataURI.length, 0);
  if (total > 8_000_000) return 'Payload seems large; consider fewer shots or optimize.';
  return null;
}

async function onSend() {
  console.log('session status:' + session?.status);
  if (!session) return;
  // if (session.status === 'sending') return;
  const warn = validatePayloadWarn();
  if (warn) { setStatus(warn); return; }

  const mode = elMode.value as Mode;
  const isDM = mode !== 'comment_under_post';
  const corpusPath = elCorpusPath.value.trim() || defaultCorpusPathForMode(mode);
  session.mode = mode;
  session.model = elModel.value as ModelId;
  session.manualPrompt = elManual.value;
  session.corpusRef = corpusPath;
  session.blurUsernames = !!elBlur.checked;
  session.status = 'sending';
  await putSession(session);
  setStatus('Sending...');
  elSend.disabled = true;
  log('send_start', { model: session.model, mode });

  try {
    const corpus = await loadCorpus(corpusPath);
    // Enforce length policy proactively
    const maxLen = corpus.constraints.max_length_chars ?? (isDM ? 600 : 220);
    const packet = buildPacket({ mode, corpus, manualPrompt: session.manualPrompt, screenshots: session.screenshots });

    const apiKey = elApiKey.value.trim();
    if (!apiKey) throw new Error('Enter OpenAI API key');
    try {
      await saveApiKey(apiKey);
    } catch (err) {
      console.warn('saveApiKey(send) failed', err);
    }

    const result = await sendWithFallback({ apiKey, preferredModel: session.model, packet, isDM });
    const needsTrim = (t: string) => t.length > maxLen;
    const trimmed = result.candidates.map(c => ({ ...c, text: needsTrim(c.text) ? c.text.slice(0, maxLen) : c.text }));

    session.status = 'success';
    session.candidates = trimmed;
    await putSession(session);
    renderCandidates(trimmed);
    setStatus(`Done via ${result.modelUsed}${result.fallbackChain.length > 1 ? ' (fallback used)' : ''}`);
    log('send_success', { modelUsed: result.modelUsed });
  } catch (e) {
    session.status = 'error';
    await putSession(session);
    setStatus(`Error: ${(e as Error).message}`);
    log('send_error', { error: String(e) });
  } finally {
    elSend.disabled = false;
  }
}

function renderCandidates(cands: Candidate[]) {
  elCandidates.innerHTML = '';
  cands.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'cand';
    const text = document.createElement('div');
    text.textContent = c.text;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const insert = document.createElement('button');
    insert.textContent = 'Insert to composer';
    insert.onclick = () => {
      elComposer.value = (elComposer.value ? elComposer.value + '\n\n' : '') + c.text;
    };
    actions.append(insert);
    card.append(text, actions);
    elCandidates.append(card);
  });
}

elCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elComposer.value || '');
    setStatus('Copied');
    log('copied');
  } catch {
    setStatus('Copy failed');
  }
});

elMode.addEventListener('change', () => {
  applyCorpusAutoPath();
  if (!session) return;
  session.mode = elMode.value as Mode;
  putSession(session);
});

elModel.addEventListener('change', () => {
  if (!session) return;
  session.model = elModel.value as ModelId;
  putSession(session);
});

elCorpusPath.addEventListener('change', () => {
  if (!session) return;
  session.corpusRef = elCorpusPath.value.trim() || defaultCorpusPathForMode(session.mode);
  putSession(session);
});

elManual.addEventListener('input', () => {
  if (!session) return;
  session.manualPrompt = elManual.value;
  putSession(session);
});

elBlur.addEventListener('change', () => {
  if (!session) return;
  session.blurUsernames = !!elBlur.checked;
  putSession(session);
});

elApiKey.addEventListener('change', async () => {
  try {
    await saveApiKey(elApiKey.value);
  } catch (err) {
    console.warn('saveApiKey(change) failed', err);
  }
});

console.log('[popup] wiring capture button', { hasButton: !!elTakeShot });
elTakeShot.addEventListener('click', onTakeScreenshot);
elSend.addEventListener('click', onSend);
elOptimize.addEventListener('click', async () => {
  if (!session) return;
  try {
    setStatus('Optimizing...');
    const downs: ScreenshotItem[] = [];
    for (const s of session.screenshots) {
      const img = new Image();
      img.src = s.dataURI;
      await img.decode();
      const canvas = document.createElement('canvas');
      const targetW = Math.min(1280, img.width);
      const scale = targetW / img.width;
      canvas.width = targetW;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataURI = canvas.toDataURL('image/png');
      downs.push({ ...s, dataURI });
    }
    session.screenshots = downs;
    await putSession(session);
    renderTray();
    setStatus('Optimized');
    log('optimize_success');
  } catch (e) {
    setStatus(`Optimize failed: ${(e as Error).message}`);
    log('optimize_error', { error: String(e) });
  }
});

elClearAll.addEventListener('click', async () => {
  if (!session) return;
  session.manualPrompt = '';
  session.screenshots = [];
  elManual.value = '';
  renderTray();
  updateShotInfo();
  try {
    await putSession(session);
  } catch (err) {
    console.warn('putSession(clearAll) failed', err);
  }
  setStatus('Cleared manual prompt and screenshots');
  log('clear_all_clicked');
});

// Init
(async function init() {
  try {
    await ensureSession();
  } catch (e) {
    console.error('Failed to initialize session', e);
    setStatus((e instanceof Error ? e.message : String(e)) || 'Failed to initialize');
    return;
  }

  applyCorpusAutoPath();
  updateShotInfo();
  renderTray();
  try {
    const storedKey = await loadApiKey();
    if (storedKey) {
      elApiKey.value = storedKey;
    }
  } catch (err) {
    console.warn('loadApiKey failed', err);
  }
  let cands: Candidate[] | undefined = undefined;
  const sessAny: any = session as any;
  if (sessAny && Array.isArray(sessAny.candidates)) {
    cands = sessAny.candidates as Candidate[];
  }
  if (cands && cands.length > 0) {
    renderCandidates(cands);
  }
})();
