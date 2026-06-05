import type { RuntimeRequest, RuntimeResponse } from './messages';

export async function sendRuntimeMessage<T extends RuntimeResponse>(message: RuntimeRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T;
  if (!response.ok) throw new Error(response.error);
  return response;
}
