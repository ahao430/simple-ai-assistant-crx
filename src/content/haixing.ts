function readPossibleJsonFromPage() {
  const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], .monaco-editor textarea'));
  const values = candidates
    .map((node) => (node instanceof HTMLTextAreaElement ? node.value : node.textContent || ''))
    .map((text) => text.trim())
    .filter((text) => text.startsWith('{') || text.startsWith('['));

  return {
    schema: values[0] || '',
    config: values[1] || '',
    candidates: values
  };
}

function writeFirstJsonCandidate(text: string): void {
  const editor = document.querySelector('textarea, [contenteditable="true"]');
  if (!editor) throw new Error('未找到可写入的海星配置编辑器');

  if (editor instanceof HTMLTextAreaElement) {
    editor.value = text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return;
  }

  editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
  editor.textContent = text;
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'content:site-action') {
    try {
      if (message.action.type === 'read-config') {
        sendResponse({ ok: true, result: { ok: true, message: '已读取海星配置候选内容', data: readPossibleJsonFromPage() } });
        return true;
      }

      if (message.action.type === 'update-config') {
        writeFirstJsonCandidate(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已尝试写入海星配置编辑器' } });
        return true;
      }

      if (message.action.type === 'upload-asset') {
        sendResponse({ ok: true, result: { ok: false, message: '海星图片上传需要接入实际上传接口或页面上传控件后启用' } });
        return true;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  return false;
});
