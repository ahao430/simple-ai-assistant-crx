export interface ImageAsset {
  id: string;
  source: 'generated' | 'uploaded' | 'edited';
  mimeType: string;
  width?: number;
  height?: number;
  dataUrl: string;
  createdByModelConfigId?: string;
  prompt?: string;
  createdAt: number;
}

export type ImageMode = 'generate' | 'reference' | 'edit';

export interface ImageGenerationRequest {
  modelConfigId: string;
  mode: ImageMode;
  prompt: string;
  referenceImages?: string[];
  editImage?: string;
}
