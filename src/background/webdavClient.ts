import type { BackupPayload, WebDavConfig } from '../shared/modelConfig';

export async function testWebDavConnection(config: WebDavConfig): Promise<string> {
  const url = buildFileUrl(config);
  const directoryUrl = url.slice(0, url.lastIndexOf('/') + 1);
  const response = await fetch(directoryUrl, {
    method: 'PROPFIND',
    headers: createHeaders(config, { Depth: '0' })
  });

  if (response.ok || response.status === 207 || response.status === 404) {
    return 'WebDAV 连接可用';
  }

  throw new Error(`WebDAV 连接失败：${response.status} ${await response.text()}`);
}

export async function uploadBackup(config: WebDavConfig, payload: BackupPayload): Promise<string> {
  const fileUrl = buildFileUrl(config);
  const dirUrl = fileUrl.slice(0, fileUrl.lastIndexOf('/'));

  // ensure parent directory exists
  const mkcolResponse = await fetch(dirUrl, {
    method: 'MKCOL',
    headers: createHeaders(config)
  });
  if (!mkcolResponse.ok && mkcolResponse.status !== 405 && mkcolResponse.status !== 201) {
    throw new Error(`WebDAV 创建目录失败：${mkcolResponse.status} ${await mkcolResponse.text()}`);
  }

  const response = await fetch(fileUrl, {
    method: 'PUT',
    headers: createHeaders(config, { 'Content-Type': 'application/json; charset=utf-8' }),
    body: JSON.stringify(payload, null, 2)
  });

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`WebDAV 备份失败：${response.status} ${await response.text()}`);
  }

  return `已备份 ${payload.models.length} 个模型配置、${(payload.agents || []).length} 个 Agent`;
}

export async function downloadBackup(config: WebDavConfig): Promise<BackupPayload> {
  const response = await fetch(buildFileUrl(config), {
    method: 'GET',
    headers: createHeaders(config)
  });

  if (!response.ok) {
    throw new Error(`WebDAV 恢复失败：${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload?.app !== 'gy-ai-crx' || payload?.version !== 1 || !Array.isArray(payload?.models) || (payload.agents && !Array.isArray(payload.agents))) {
    throw new Error('备份文件格式不正确');
  }

  return payload;
}

function buildFileUrl(config: WebDavConfig): string {
  if (!config.url.trim()) throw new Error('请先填写 WebDAV 地址');
  const base = config.url.trim().replace(/\/+$/, '');
  const path = config.filePath.trim() || 'simple-ai-assistant-crx/configs.json';
  return `${base}/${path.replace(/^\/+/, '')}`;
}

function createHeaders(config: WebDavConfig, headers: Record<string, string> = {}): HeadersInit {
  const auth = btoa(`${config.username}:${config.password}`);
  return {
    ...headers,
    Authorization: `Basic ${auth}`
  };
}
