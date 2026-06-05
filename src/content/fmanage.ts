import type { SiteContext } from '../shared/siteCapability';

const haixingHosts = new Set([
  'haixing-admin-v2-dev.19ego.cn',
  'haixing-admin-v2-test.19ego.cn',
  'haixing-admin-v2.19ego.cn'
]);

function findHaixingIframe(): HTMLIFrameElement | undefined {
  return Array.from(document.querySelectorAll('iframe')).find((iframe) => {
    try {
      return iframe.src && haixingHosts.has(new URL(iframe.src).hostname);
    } catch {
      return false;
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'content:detect-site') {
    const iframe = findHaixingIframe();
    const siteContext: SiteContext = {
      adapterId: 'fmanage-haixing',
      name: '大业管 / 海星',
      url: location.href,
      capabilities: iframe
        ? [
            { type: 'read-config', label: '读取海星配置', description: '读取 iframe 中当前配置页的 schema/config。', risk: 'safe' },
            { type: 'update-config', label: '修改海星配置', description: '确认后写入海星 schema/config。', risk: 'danger' },
            { type: 'upload-asset', label: '上传图片资源', description: '上传生成图片并插入配置。', risk: 'confirm' }
          ]
        : [],
      details: { hasHaixingIframe: Boolean(iframe), iframeSrc: iframe?.src }
    };
    sendResponse({ ok: true, siteContext });
    return true;
  }

  return false;
});
