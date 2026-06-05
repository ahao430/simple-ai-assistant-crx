export const PANEL_BACKGROUND_STORAGE_KEY = 'simple-ai-assistant:panel-background';

export type PanelTheme = 'light' | 'dark';
export type PanelBackgroundFit = 'cover' | 'contain' | 'auto';

export interface PanelBackgroundItem {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

export interface PanelBackgroundConfig {
  activeId: string;
  theme: PanelTheme;
  fit: PanelBackgroundFit;
  opacity: number;
  history: PanelBackgroundItem[];
}

export function createDefaultPanelBackgroundConfig(): PanelBackgroundConfig {
  return {
    activeId: '',
    theme: 'light',
    fit: 'cover',
    opacity: 0.18,
    history: []
  };
}

export function normalizePanelBackgroundConfig(input?: Partial<PanelBackgroundConfig>): PanelBackgroundConfig {
  const fallback = createDefaultPanelBackgroundConfig();
  const history = Array.isArray(input?.history) ? input.history.filter((item) => item.id && item.url).slice(0, 10) : [];
  const activeId = history.some((item) => item.id === input?.activeId) ? input?.activeId || '' : '';
  return {
    ...fallback,
    ...input,
    activeId,
    theme: input?.theme === 'dark' ? 'dark' : 'light',
    fit: input?.fit === 'contain' || input?.fit === 'auto' ? input.fit : 'cover',
    opacity: typeof input?.opacity === 'number' ? Math.min(1, Math.max(0, input.opacity)) : fallback.opacity,
    history
  };
}

export function upsertPanelBackgroundItem(config: PanelBackgroundConfig, input: Omit<PanelBackgroundItem, 'id' | 'createdAt'>): PanelBackgroundConfig {
  const now = Date.now();
  const item: PanelBackgroundItem = {
    id: crypto.randomUUID(),
    name: input.name,
    url: input.url,
    createdAt: now
  };
  return {
    ...config,
    activeId: item.id,
    history: [item, ...config.history.filter((historyItem) => historyItem.url !== item.url)].slice(0, 10)
  };
}
