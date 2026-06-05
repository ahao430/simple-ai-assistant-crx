import type { PageContext, SiteContext } from '../shared/siteCapability';

const MAX_PAGE_TEXT_LENGTH = 16000;

export function readPageContext(): PageContext {
  const selectedText = window.getSelection()?.toString().trim() || undefined;
  const root = findReadableRoot();
  const text = normalizeText(readElementText(root)).slice(0, MAX_PAGE_TEXT_LENGTH);

  return {
    title: document.title,
    url: location.href,
    selectedText,
    text,
    capturedAt: Date.now()
  };
}

function findReadableRoot(): HTMLElement {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>([
    'article',
    'main',
    '[role="main"]',
    '[class*="article"]',
    '[class*="content"]',
    '[class*="markdown"]',
    '[class*="post"]',
    '[class*="doc"]'
  ].join(',')));

  const scored = candidates
    .filter((element) => element.offsetParent !== null && !isDiscardableContainer(element))
    .map((element) => ({ element, score: scoreReadableRoot(element) }))
    .filter((item) => item.score > 300)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.element || document.body;
}

function isDiscardableContainer(element: HTMLElement): boolean {
  if (isDirectoryLike(element)) return false;
  return Boolean(element.closest('nav, header, footer, aside, [role="navigation"], [role="menu"]'));
}

function isDirectoryLike(element: HTMLElement): boolean {
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const listItems = element.querySelectorAll('li').length;
  const paragraphs = element.querySelectorAll('p').length;
  const links = element.querySelectorAll('a').length;
  return (headings >= 3 && listItems >= 5 && paragraphs <= 3) || (listItems >= 8 && links >= 8 && paragraphs <= 3);
}

function scoreReadableRoot(element: HTMLElement): number {
  const textLength = normalizeText(element.innerText || element.textContent || '').length;
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const paragraphs = element.querySelectorAll('p').length;
  const listItems = element.querySelectorAll('li').length;
  const links = element.querySelectorAll('a').length;
  const linkPenalty = links > 20 && paragraphs < 5 && !isDirectoryLike(element) ? links * 40 : links * 4;
  return textLength + headings * 120 + paragraphs * 80 + listItems * 12 - linkPenalty;
}

function readElementText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript, svg, canvas, iframe, input, button, [aria-hidden="true"]').forEach((node) => node.remove());

  if (element === document.body && !isDirectoryLike(element)) {
    clone.querySelectorAll('nav, header, footer, aside, [role="navigation"], [role="menu"], [class*="navbar"], [class*="sidebar"], [class*="menu"], [class*="footer"]').forEach((node) => node.remove());
  }

  return clone.innerText || clone.textContent || document.body.innerText || document.body.textContent || '';
}

function normalizeText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function insertTextAtFocus(text: string): void {
  const target = document.activeElement;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    target.focus();
    return;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    pasteText(target, text);
    return;
  }

  throw new Error('未找到可写入的光标位置');
}

function replaceSelectionAtFocus(text: string): void {
  const target = document.activeElement;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    if (start === end) throw new Error('请先在页面中选中要替换的内容');
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: text }));
    target.focus();
    return;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) throw new Error('请先在页面中选中要替换的内容');
    pasteText(target, text);
    return;
  }

  throw new Error('未找到可替换的选中内容');
}

function pasteText(target: HTMLElement, text: string): void {
  target.focus();
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
}

async function insertImageAtFocus(dataUrl: string): Promise<void> {
  const target = document.activeElement;
  if (!(target instanceof HTMLElement)) throw new Error('未找到可插入图片的光标位置');

  target.focus();
  document.execCommand('insertImage', false, dataUrl);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'content:read-page') {
    sendResponse({ ok: true, pageContext: readPageContext() });
    return true;
  }

  if (message.type === 'content:detect-site') {
    const siteContext: SiteContext = {
      adapterId: 'common',
      name: '通用网页',
      url: location.href,
      capabilities: [
        { type: 'read-page', label: '读取页面', description: '读取当前页面正文用于聊天。', risk: 'safe' }
      ]
    };
    sendResponse({ ok: true, siteContext });
    return true;
  }

  if (message.type === 'content:site-action') {
    try {
      if (message.action.type === 'insert-text') {
        insertTextAtFocus(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已插入文本' } });
        return true;
      }

      if (message.action.type === 'replace-selection') {
        replaceSelectionAtFocus(String((message.action.payload as { text?: string })?.text || ''));
        sendResponse({ ok: true, result: { ok: true, message: '已替换选中内容' } });
        return true;
      }

      if (message.action.type === 'insert-image') {
        insertImageAtFocus(String((message.action.payload as { dataUrl?: string })?.dataUrl || ''))
          .then(() => sendResponse({ ok: true, result: { ok: true, message: '已尝试插入图片' } }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  return false;
});
