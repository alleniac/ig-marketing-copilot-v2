const ROOT_ID = 'tfsf-floating-capture';

function render(tabId?: number, windowId?: number) {
  if (document.getElementById(ROOT_ID)) return;

  const btnId = crypto.randomUUID();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.position = 'fixed';
  root.style.top = '12px';
  root.style.right = '12px';
  root.style.zIndex = '2147483646';
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.gap = '6px';
  root.style.background = 'rgba(15, 23, 42, 0.9)';
  root.style.color = '#f8fafc';
  root.style.padding = '8px 10px';
  root.style.borderRadius = '10px';
  root.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.35)';
  root.style.fontSize = '12px';
  root.style.fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const btn = document.createElement('button');
  btn.textContent = 'Screenshot';
  btn.style.border = 'none';
  btn.style.background = '#2563eb';
  btn.style.color = '#fff';
  btn.style.padding = '6px 10px';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';
  btn.style.fontWeight = '600';
  btn.onclick = () => {
    console.log(`floating button clicked | tabId=${tabId ?? 'n/a'} | windowId=${windowId ?? 'n/a'} | btnId=${btnId}`);
  };

  root.append(btn);
  document.body?.append(root);
}

chrome.runtime.sendMessage({ type: 'floating_get_tab' }, resp => {
  if (resp && typeof resp.tabId === 'number') {
    render(resp.tabId, resp.windowId);
  } else {
    render();
  }
});
