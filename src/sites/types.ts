import type { SiteCapabilityDefinition } from '../shared/siteCapability';

export interface SiteAdapterDefinition {
  id: string;
  name: string;
  matches: string[];
  capabilities: SiteCapabilityDefinition[];
}

export function matchPattern(url: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`).test(url);
}
