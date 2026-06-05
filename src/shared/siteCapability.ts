export interface PageContext {
  title: string;
  url: string;
  selectedText?: string;
  text: string;
  capturedAt: number;
}

export type SiteCapabilityType =
  | 'read-page'
  | 'copy-yuque-markdown'
  | 'insert-text'
  | 'replace-selection'
  | 'read-editor'
  | 'rewrite-editor'
  | 'replace-editor'
  | 'insert-image'
  | 'read-config'
  | 'update-config'
  | 'upload-asset';

export interface SiteCapabilityDefinition {
  type: SiteCapabilityType;
  label: string;
  description: string;
  risk: 'safe' | 'confirm' | 'danger';
}

export interface SiteContext {
  adapterId: string;
  name: string;
  url: string;
  capabilities: SiteCapabilityDefinition[];
  details?: Record<string, unknown>;
}
