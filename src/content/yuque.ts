import type { SiteContext } from '../shared/siteCapability';

const capabilities = [
  { type: 'read-editor' as const, label: '读取语雀编辑内容', description: '读取当前语雀编辑器中的内容。', risk: 'safe' as const },
  { type: 'copy-yuque-markdown' as const, label: '读取语雀 Markdown', description: '通过语雀导出按钮复制 Markdown 内容后读取。', risk: 'safe' as const }
];

function isEditing(): boolean {
  return Boolean(document.querySelector('[contenteditable="true"], textarea, .ProseMirror'));
}

function getEditor(): HTMLElement | HTMLTextAreaElement | null {
  return document.querySelector('[contenteditable="true"], textarea, .ProseMirror');
}

function readEditor(): string {
  const editor = getEditor();
  if (!editor) return '';
  return editor instanceof HTMLTextAreaElement ? editor.value : editor.textContent || '';
}

function insertText(text: string): void {
  const editor = getEditor();
  if (!editor) throw new Error('未找到语雀编辑器');

  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    editor.setRangeText(text, start, end, 'end');
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return;
  }

  pasteText(editor, text);
}

function replaceSelection(text: string): void {
  const editor = getEditor();
  if (!editor) throw new Error('未找到语雀编辑器');

  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    if (start === end) throw new Error('请先在语雀编辑器中选中要替换的内容');
    editor.setRangeText(text, start, end, 'end');
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: text }));
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) throw new Error('请先在语雀编辑器中选中要替换的内容');
  pasteText(editor, text);
}

function replaceEditor(text: string): void {
  const editor = getEditor();
  if (!editor) throw new Error('未找到语雀编辑器');

  if (editor instanceof HTMLTextAreaElement) {
    editor.value = text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return;
  }

  editor.focus();
  document.execCommand('selectAll');
  pasteText(editor, text);
}

function pasteText(target: HTMLElement, text: string): void {
  target.focus();
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
}

function copyYuqueMarkdown(): void {
  const button = document.querySelector<HTMLElement>('#header > .doc-head-inner [class*="ViewerHeader-module_offlineButton"]');
  if (!button) throw new Error('未找到语雀 Markdown 导出按钮');

  button.click();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'content:detect-site') {
    const siteContext: SiteContext = {
      adapterId: 'yuque',
      name: '语雀',
      url: location.href,
      capabilities: isEditing() ? capabilities : capabilities.filter((item) => item.type === 'read-editor'),
      details: { editing: isEditing() }
    };
    sendResponse({ ok: true, siteContext });
    return true;
  }

  if (message.type === 'content:site-action') {
    try {
      if (message.action.type === 'read-editor') {
        sendResponse({ ok: true, result: { ok: true, message: '已读取编辑内容', data: { text: readEditor(), editing: isEditing() } } });
        return true;
      }

      if (message.action.type === 'insert-text') {
        insertText(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已插入语雀编辑器' } });
        return true;
      }

      if (message.action.type === 'replace-selection') {
        replaceSelection(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已替换语雀选中内容' } });
        return true;
      }

      if (message.action.type === 'replace-editor' || message.action.type === 'rewrite-editor') {
        replaceEditor(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已写入语雀编辑器' } });
        return true;
      }

      if (message.action.type === 'copy-yuque-markdown') {
        copyYuqueMarkdown();
        sendResponse({ ok: true, result: { ok: true, message: '已触发语雀 Markdown 复制' } });
        return true;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  return false;
});
