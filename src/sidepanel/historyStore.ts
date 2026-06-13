import type { ImageAsset, ImageMode } from '../shared/assets';
import type { ChatMessage } from '../shared/messages';

const DB_NAME = 'gy-ai-history';
const DB_VERSION = 2;
const CHAT_STORE = 'chatSessions';
const TEXT_STORE = 'textGenerations';
const IMAGE_STORE = 'imageGenerations';
const IMAGE_BLOB_STORE = 'imageBlobs';
const GIF_STORE = 'gifGenerations';
const GIF_BLOB_STORE = 'gifBlobs';
const CHAT_LIMIT = 100;
const TEXT_LIMIT = 200;
const IMAGE_LIMIT = 50;
const GIF_LIMIT = 30;

export interface ChatSessionHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelConfigId: string;
  agentConfigId?: string;
  agentName?: string;
  agentPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TextGenerationHistory {
  id: string;
  prompt: string;
  result: string;
  modelConfigId: string;
  pageTitle?: string;
  pageUrl?: string;
  createdAt: number;
}

export interface ImageGenerationHistory {
  id: string;
  mode: ImageMode;
  prompt: string;
  blobId: string;
  mimeType: string;
  modelConfigId: string;
  createdAt: number;
}

export interface GifGenerationHistory {
  id: string;
  userPrompt: string;
  optimizedPrompt: string;
  frameCount: number;
  blobId: string;
  textModelConfigId: string;
  imageModelConfigId: string;
  createdAt: number;
}

interface ImageBlobRecord {
  id: string;
  blob: Blob;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | undefined;

export async function listChatSessions(): Promise<ChatSessionHistory[]> {
  return sortByUpdatedAt(await getAll<ChatSessionHistory>(CHAT_STORE));
}

export async function saveChatSession(session: ChatSessionHistory): Promise<void> {
  await put(CHAT_STORE, session);
  await trimStore(CHAT_STORE, CHAT_LIMIT, 'updatedAt');
}

export async function deleteChatSession(id: string): Promise<void> {
  await deleteRecord(CHAT_STORE, id);
}

export async function listTextGenerations(): Promise<TextGenerationHistory[]> {
  return sortByCreatedAt(await getAll<TextGenerationHistory>(TEXT_STORE));
}

export async function saveTextGeneration(item: TextGenerationHistory): Promise<void> {
  await put(TEXT_STORE, item);
  await trimStore(TEXT_STORE, TEXT_LIMIT, 'createdAt');
}

export async function deleteTextGeneration(id: string): Promise<void> {
  await deleteRecord(TEXT_STORE, id);
}

export async function listImageGenerations(): Promise<ImageGenerationHistory[]> {
  return sortByCreatedAt(await getAll<ImageGenerationHistory>(IMAGE_STORE));
}

export async function saveImageGenerationFromAsset(item: Omit<ImageGenerationHistory, 'blobId' | 'mimeType'>, asset: ImageAsset): Promise<ImageGenerationHistory> {
  const blob = await dataUrlToBlob(asset.dataUrl);
  const blobId = crypto.randomUUID();
  const history: ImageGenerationHistory = { ...item, blobId, mimeType: blob.type || asset.mimeType || 'image/png' };
  await withStores([IMAGE_STORE, IMAGE_BLOB_STORE], 'readwrite', (stores) => {
    stores[IMAGE_BLOB_STORE].put({ id: blobId, blob, createdAt: item.createdAt } satisfies ImageBlobRecord);
    stores[IMAGE_STORE].put(history);
  });
  await trimImages();
  return history;
}

export async function deleteImageGeneration(id: string): Promise<void> {
  const item = await get<ImageGenerationHistory>(IMAGE_STORE, id);
  await withStores([IMAGE_STORE, IMAGE_BLOB_STORE], 'readwrite', (stores) => {
    stores[IMAGE_STORE].delete(id);
    if (item?.blobId) stores[IMAGE_BLOB_STORE].delete(item.blobId);
  });
}

export async function getImageAssetFromHistory(item: ImageGenerationHistory): Promise<ImageAsset> {
  const record = await get<ImageBlobRecord>(IMAGE_BLOB_STORE, item.blobId);
  if (!record) throw new Error('图片历史文件不存在');
  return {
    id: item.id,
    source: item.mode === 'edit' ? 'edited' : 'generated',
    mimeType: item.mimeType,
    dataUrl: await blobToDataUrl(record.blob),
    createdByModelConfigId: item.modelConfigId,
    prompt: item.prompt,
    createdAt: item.createdAt
  };
}

export async function getImageObjectUrl(item: ImageGenerationHistory): Promise<string> {
  const record = await get<ImageBlobRecord>(IMAGE_BLOB_STORE, item.blobId);
  if (!record) throw new Error('图片历史文件不存在');
  return URL.createObjectURL(record.blob);
}

export async function listGifGenerations(): Promise<GifGenerationHistory[]> {
  return sortByCreatedAt(await getAll<GifGenerationHistory>(GIF_STORE));
}

export async function saveGifGeneration(item: Omit<GifGenerationHistory, 'blobId'>, gifBlob: Blob): Promise<GifGenerationHistory> {
  const blobId = crypto.randomUUID();
  const history: GifGenerationHistory = { ...item, blobId };
  await withStores([GIF_STORE, GIF_BLOB_STORE], 'readwrite', (stores) => {
    stores[GIF_BLOB_STORE].put({ id: blobId, blob: gifBlob, createdAt: item.createdAt } satisfies ImageBlobRecord);
    stores[GIF_STORE].put(history);
  });
  await trimGifs();
  return history;
}

export async function deleteGifGeneration(id: string): Promise<void> {
  const item = await get<GifGenerationHistory>(GIF_STORE, id);
  await withStores([GIF_STORE, GIF_BLOB_STORE], 'readwrite', (stores) => {
    stores[GIF_STORE].delete(id);
    if (item?.blobId) stores[GIF_BLOB_STORE].delete(item.blobId);
  });
}

export async function getGifObjectUrl(item: GifGenerationHistory): Promise<string> {
  const record = await get<ImageBlobRecord>(GIF_BLOB_STORE, item.blobId);
  if (!record) throw new Error('GIF 历史文件不存在');
  return URL.createObjectURL(record.blob);
}

export async function clearAllHistory(): Promise<void> {
  await withStores([CHAT_STORE, TEXT_STORE, IMAGE_STORE, IMAGE_BLOB_STORE, GIF_STORE, GIF_BLOB_STORE], 'readwrite', (stores) => {
    stores[CHAT_STORE].clear();
    stores[TEXT_STORE].clear();
    stores[IMAGE_STORE].clear();
    stores[IMAGE_BLOB_STORE].clear();
    stores[GIF_STORE].clear();
    stores[GIF_BLOB_STORE].clear();
  });
}

export async function getHistoryCacheStats(): Promise<{ size: number; count: number }> {
  const [chatSessions, textGenerations, imageGenerations, imageBlobs, gifGenerations, gifBlobs] = await Promise.all([
    getAll<ChatSessionHistory>(CHAT_STORE),
    getAll<TextGenerationHistory>(TEXT_STORE),
    getAll<ImageGenerationHistory>(IMAGE_STORE),
    getAll<ImageBlobRecord>(IMAGE_BLOB_STORE),
    getAll<GifGenerationHistory>(GIF_STORE),
    getAll<ImageBlobRecord>(GIF_BLOB_STORE)
  ]);
  const textSize = byteLength(JSON.stringify([...chatSessions, ...textGenerations, ...imageGenerations, ...gifGenerations]));
  const imageSize = imageBlobs.reduce((total, item) => total + item.blob.size, 0);
  const gifSize = gifBlobs.reduce((total, item) => total + item.blob.size, 0);
  return {
    size: textSize + imageSize + gifSize,
    count: chatSessions.length + textGenerations.length + imageGenerations.length + imageBlobs.length + gifGenerations.length + gifBlobs.length
  };
}

async function trimImages() {
  const items = sortByCreatedAt(await getAll<ImageGenerationHistory>(IMAGE_STORE));
  const expired = items.slice(IMAGE_LIMIT);
  if (!expired.length) return;
  await withStores([IMAGE_STORE, IMAGE_BLOB_STORE], 'readwrite', (stores) => {
    for (const item of expired) {
      stores[IMAGE_STORE].delete(item.id);
      stores[IMAGE_BLOB_STORE].delete(item.blobId);
    }
  });
}

async function trimGifs() {
  const items = sortByCreatedAt(await getAll<GifGenerationHistory>(GIF_STORE));
  const expired = items.slice(GIF_LIMIT);
  if (!expired.length) return;
  await withStores([GIF_STORE, GIF_BLOB_STORE], 'readwrite', (stores) => {
    for (const item of expired) {
      stores[GIF_STORE].delete(item.id);
      stores[GIF_BLOB_STORE].delete(item.blobId);
    }
  });
}

async function trimStore(storeName: string, limit: number, key: 'createdAt' | 'updatedAt') {
  const items = (await getAll<any>(storeName)).sort((a, b) => b[key] - a[key]);
  const expired = items.slice(limit);
  if (!expired.length) return;
  await withStores([storeName], 'readwrite', (stores) => {
    for (const item of expired) stores[storeName].delete(item.id);
  });
}

function openHistoryDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of [CHAT_STORE, TEXT_STORE, IMAGE_STORE, IMAGE_BLOB_STORE, GIF_STORE, GIF_BLOB_STORE]) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function get<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, item: T): Promise<void> {
  await withStores([storeName], 'readwrite', (stores) => stores[storeName].put(item));
}

async function deleteRecord(storeName: string, id: string): Promise<void> {
  await withStores([storeName], 'readwrite', (stores) => stores[storeName].delete(id));
}

async function withStores(storeNames: string[], mode: IDBTransactionMode, callback: (stores: Record<string, IDBObjectStore>) => void): Promise<void> {
  const db = await openHistoryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    callback(stores);
  });
}

function sortByCreatedAt<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

function sortByUpdatedAt<T extends { updatedAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
