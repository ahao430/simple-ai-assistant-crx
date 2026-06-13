import { useState } from 'react';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Slider from 'antd/es/slider';
import Space from 'antd/es/space';
import Upload from 'antd/es/upload';
import type { UploadFile } from 'antd/es/upload/interface';
import GIF from 'gif.js';
import { getSubmitShortcutHint, type SubmitShortcut } from '../shared/appSettings';
import { useTextareaSubmit } from './textareaSubmit';
import type { SelectGroupOption } from './ImagePanel';
import type { GifGenerationHistory } from './historyStore';

interface GifGenerationState {
  userPrompt: string;
  optimizedPrompt: string;
  spriteSheetUrl: string;
  frames: string[];
  gifUrl: string;
  progress: string;
  isGenerating: boolean;
}

interface SelectedHistory {
  item: GifGenerationHistory;
  gifUrl: string;
}

export function GifPanel(props: {
  textModelOptions: SelectGroupOption[];
  textModelId: string;
  setTextModelId: (id: string) => void;
  imageModelOptions: SelectGroupOption[];
  imageModelId: string;
  setImageModelId: (id: string) => void;
  submitShortcut: SubmitShortcut;
  onCopyText: (text?: string) => void;
  onGenerateText: (prompt: string) => Promise<string>;
  onGenerateImage: (prompt: string) => Promise<string>;
  onShowToast: (message: string) => void;
  onSaveHistory: (item: { userPrompt: string; optimizedPrompt: string; frameCount: number }, gifBlob: Blob) => Promise<void>;
  gifHistory: GifGenerationHistory[];
  gifHistoryUrls: Record<string, string>;
  onDeleteHistory: (id: string) => void;
}) {
  const [form] = Form.useForm();
  const { onCompositionStart, onCompositionEnd, onKeyDown } = useTextareaSubmit(props.submitShortcut);

  const [state, setState] = useState<GifGenerationState>({
    userPrompt: '',
    optimizedPrompt: '',
    spriteSheetUrl: '',
    frames: [],
    gifUrl: '',
    progress: '',
    isGenerating: false
  });

  const [frameCount, setFrameCount] = useState(8);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  const [selectedHistory, setSelectedHistory] = useState<SelectedHistory>();

  const uploadFiles: UploadFile[] = referenceImages.map((url, index) => ({
    uid: `${index}`,
    name: `参考图 ${index + 1}`,
    status: 'done',
    url
  }));

  async function handleFinish() {
    if (!state.userPrompt.trim() || !props.textModelId || !props.imageModelId || state.isGenerating) {
      return;
    }
    await generateAll();
  }

  async function onImageFiles(files: File[]) {
    const images = await Promise.all(files.map(readFileAsDataUrl));
    setReferenceImages(images);
  }

  async function generateAll() {
    try {
      setState(prev => ({
        ...prev,
        isGenerating: true,
        optimizedPrompt: '',
        spriteSheetUrl: '',
        frames: [],
        gifUrl: '',
        progress: '正在优化提示词...'
      }));

      // 步骤1：优化提示词
      const rows = Math.ceil(Math.sqrt(frameCount));
      const cols = Math.ceil(frameCount / rows);

      const optimizationPrompt = `你是提示词优化专家。将用户输入改写为适合生成动画序列帧的详细英文提示词。
要求：
1. 生成 ${rows}x${cols} 网格布局，共 ${frameCount} 帧
2. 每帧尺寸完全一致，紧密排列无间隙
3. 描述连贯的动作或变化序列
4. 主体保持一致性
5. 明确要求 "sprite sheet" 或 "animation frames grid layout" 形式
6. 示例格式：A sprite sheet of [subject] in ${rows} rows and ${cols} columns, showing [action], each frame is identical size, no gaps, grid layout, animation sequence

用户输入：${state.userPrompt}

请直接输出优化后的英文提示词，不要其他解释。`;

      const optimized = await props.onGenerateText(optimizationPrompt);

      setState(prev => ({
        ...prev,
        optimizedPrompt: optimized,
        progress: '提示词优化完成，开始生成图片...'
      }));

      // 步骤2：生成图片
      const imageUrl = await props.onGenerateImage(optimized);

      setState(prev => ({
        ...prev,
        spriteSheetUrl: imageUrl,
        progress: '图片生成完成，正在切割帧...'
      }));

      // 步骤3：切割图片
      const frames = await splitImageToFrames(imageUrl, rows, cols, frameCount);

      setState(prev => ({
        ...prev,
        frames,
        progress: '帧切割完成，正在合成 GIF...'
      }));

      // 步骤4：生成 GIF
      const { gifUrl, gifBlob } = await createGif(frames);

      setState(prev => ({
        ...prev,
        gifUrl,
        progress: 'GIF 生成完成！',
        isGenerating: false
      }));

      // 保存到历史记录
      await props.onSaveHistory({
        userPrompt: state.userPrompt,
        optimizedPrompt: optimized,
        frameCount
      }, gifBlob);

    } catch (error) {
      setState(prev => ({
        ...prev,
        progress: `生成失败: ${error instanceof Error ? error.message : String(error)}`,
        isGenerating: false
      }));
    }
  }

  async function splitImageToFrames(imageUrl: string, rows: number, cols: number, totalFrames: number): Promise<string[]> {
    const img = await loadImage(imageUrl);
    const frameWidth = img.width / cols;
    const frameHeight = img.height / rows;
    const frames: string[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth;
      canvas.height = frameHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 canvas context');

      ctx.drawImage(
        img,
        col * frameWidth, row * frameHeight, frameWidth, frameHeight,
        0, 0, frameWidth, frameHeight
      );

      frames.push(canvas.toDataURL());
    }

    return frames;
  }

  async function createGif(frames: string[]): Promise<{ gifUrl: string; gifBlob: Blob }> {
    return new Promise((resolve, reject) => {
      if (frames.length === 0) {
        reject(new Error('没有帧可以生成 GIF'));
        return;
      }

      const tempImg = new Image();
      tempImg.onload = () => {
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: tempImg.width,
          height: tempImg.height,
          workerScript: '/gif.worker.js'
        });

        let loadedCount = 0;
        const canvases: HTMLCanvasElement[] = [];

        frames.forEach((dataUrl, index) => {
          const frameImg = new Image();
          frameImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.width;
            canvas.height = tempImg.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(frameImg, 0, 0);
              canvases[index] = canvas;
            }

            loadedCount++;
            if (loadedCount === frames.length) {
              canvases.forEach(canvas => {
                gif.addFrame(canvas, { delay: 200, copy: true });
              });
              gif.render();
            }
          };
          frameImg.onerror = () => reject(new Error(`加载帧 ${index + 1} 失败`));
          frameImg.src = dataUrl;
        });

        gif.on('finished', (blob: Blob) => {
          const gifUrl = URL.createObjectURL(blob);
          resolve({ gifUrl, gifBlob: blob });
        });

        // GIF.js 的类型定义不完整，使用 any 来避免类型错误
        (gif as any).on('error', (error: Error) => {
          reject(new Error(`GIF 合成失败: ${error.message}`));
        });
      };
      tempImg.onerror = () => reject(new Error('无法加载第一帧'));
      tempImg.src = frames[0];
    });
  }

  function downloadGif() {
    if (!state.gifUrl) return;
    const link = document.createElement('a');
    link.download = `ai-gif-${Date.now()}.gif`;
    link.href = state.gifUrl;
    link.click();
  }

  async function downloadFrames() {
    if (state.frames.length === 0) return;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // 添加所有帧到 zip
      for (let i = 0; i < state.frames.length; i++) {
        const dataUrl = state.frames[i];
        const base64Data = dataUrl.split(',')[1];
        zip.file(`frame-${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true });
      }

      // 生成 zip 文件
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `gif-frames-${Date.now()}.zip`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      props.onShowToast('已下载帧图片压缩包');
    } catch (error) {
      props.onShowToast('下载失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function copyGifAsFirstFrame() {
    if (!state.gifUrl || state.frames.length === 0) return;
    try {
      // 复制第一帧作为静态图片
      const firstFrame = state.frames[0];
      const response = await fetch(firstFrame);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      props.onShowToast('已复制第一帧为图片');
    } catch (error) {
      console.error('复制失败:', error);
      props.onShowToast('复制失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function copyHistoryGifAsFirstFrame() {
    if (!selectedHistory) return;
    try {
      // 从历史 GIF 中提取第一帧
      const img = await loadImage(selectedHistory.gifUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 canvas context');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('无法生成图片');
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        props.onShowToast('已复制第一帧为图片');
      });
    } catch (error) {
      console.error('复制失败:', error);
      props.onShowToast('复制失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  function downloadHistoryGif() {
    if (!selectedHistory) return;
    const link = document.createElement('a');
    link.download = `ai-gif-${selectedHistory.item.id}.gif`;
    link.href = selectedHistory.gifUrl;
    link.click();
  }

  function closeHistoryDetail() {
    setSelectedHistory(undefined);
  }

  return (
    <section className="tab-panel gif-panel">
      <div className="gif-controls">
        <Form form={form} onFinish={handleFinish}>
          <Input.TextArea
            value={state.userPrompt}
            onChange={(event) => setState(prev => ({ ...prev, userPrompt: event.target.value }))}
            onKeyDown={(event) => onKeyDown(event, form)}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder="描述要生成的动画效果，例如：一只猫咪在跳舞"
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={state.isGenerating}
          />
          <div className="shortcut-hint">{getSubmitShortcutHint(props.submitShortcut)}</div>

          <div className="gif-frame-control">
            <div className="frame-label">帧数: {frameCount}</div>
            <Slider
              min={3}
              max={16}
              value={frameCount}
              onChange={setFrameCount}
              disabled={state.isGenerating}
            />
          </div>

          <div className="composer-bottom">
            <Upload
              className="composer-upload"
              listType="picture-card"
              multiple
              fileList={uploadFiles}
              beforeUpload={(_file, fileList) => {
                onImageFiles(fileList);
                return false;
              }}
              showUploadList={{ showPreviewIcon: false }}
              accept="image/*"
              disabled={state.isGenerating}
            >
              <PlusOutlined />
            </Upload>
            <div className="composer-right">
              <Select
                className="composer-model"
                value={props.textModelId || undefined}
                placeholder="文本模型"
                onChange={props.setTextModelId}
                options={props.textModelOptions}
                size="small"
                style={{ height: 'auto', marginBottom: 8 }}
                disabled={state.isGenerating}
              />
              <Select
                className="composer-model"
                value={props.imageModelId || undefined}
                placeholder="图像模型"
                onChange={props.setImageModelId}
                options={props.imageModelOptions}
                size="small"
                style={{ height: 'auto' }}
                disabled={state.isGenerating}
              />
              <Button
                className="composer-send"
                type="primary"
                htmlType="submit"
                loading={state.isGenerating}
                disabled={!props.textModelId || !props.imageModelId || !state.userPrompt.trim()}
              >
                生成 GIF
              </Button>
            </div>
          </div>
        </Form>
      </div>

      {state.progress && (
        <div className="gif-progress">{state.progress}</div>
      )}

      {(state.optimizedPrompt || state.gifUrl) && (
        <div className="gif-layout">
          <div className="gif-process">
            {state.optimizedPrompt && (
              <div className="gif-result-section">
                <div className="meta">优化后的提示词</div>
                <div className="optimized-prompt">{state.optimizedPrompt}</div>
                <Button size="small" onClick={() => props.onCopyText(state.optimizedPrompt)}>复制</Button>
              </div>
            )}

            {state.spriteSheetUrl && (
              <div className="gif-result-section">
                <div className="meta">生成的序列帧图片</div>
                <img className="sprite-sheet" src={state.spriteSheetUrl} alt="Sprite Sheet" />
              </div>
            )}

            {state.frames.length > 0 && (
              <div className="gif-result-section">
                <div className="meta">切割后的帧 ({state.frames.length} 帧)</div>
                <div className="frame-grid">
                  {state.frames.map((frame, index) => (
                    <img key={index} src={frame} alt={`Frame ${index + 1}`} />
                  ))}
                </div>
                <Button size="small" onClick={downloadFrames} style={{ marginTop: 8 }}>
                  打包下载帧图片
                </Button>
              </div>
            )}
          </div>

          {state.gifUrl && (
            <div className="gif-final">
              <div className="gif-result-section">
                <div className="meta">生成的 GIF</div>
                <img className="final-gif" src={state.gifUrl} alt="Generated GIF" />
                <Space>
                  <Button onClick={copyGifAsFirstFrame}>复制为图片</Button>
                  <Button onClick={downloadGif}>下载 GIF</Button>
                </Space>
              </div>
            </div>
          )}
        </div>
      )}

      {props.gifHistory.length > 0 && (
        <div className="gif-history">
          <div className="meta">GIF 生成历史</div>
          <div className="gif-history-grid">
            {props.gifHistory.map((item) => (
              <div className="gif-history-item" key={item.id}>
                {props.gifHistoryUrls[item.id] && (
                  <img
                    src={props.gifHistoryUrls[item.id]}
                    alt={item.userPrompt}
                    onClick={() => {
                      setSelectedHistory({
                        item,
                        gifUrl: props.gifHistoryUrls[item.id]
                      });
                    }}
                  />
                )}
                <div className="gif-history-prompt">{item.userPrompt}</div>
                <div className="gif-history-meta">{item.frameCount} 帧</div>
                <Space size="small">
                  <Button size="small" onClick={() => {
                    setSelectedHistory({
                      item,
                      gifUrl: props.gifHistoryUrls[item.id]
                    });
                  }}>查看</Button>
                  <Popconfirm
                    title="删除这个 GIF 历史？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => props.onDeleteHistory(item.id)}
                  >
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedHistory && (
        <div className="gif-history-detail">
          <div className="meta">GIF 历史详情 · {new Date(selectedHistory.item.createdAt).toLocaleString()}</div>

          <div className="gif-result-section">
            <div className="meta">用户输入</div>
            <div className="history-user-prompt">{selectedHistory.item.userPrompt}</div>
          </div>

          <div className="gif-result-section">
            <div className="meta">优化后的提示词</div>
            <div className="optimized-prompt">{selectedHistory.item.optimizedPrompt}</div>
            <Button size="small" onClick={() => props.onCopyText(selectedHistory.item.optimizedPrompt)}>复制</Button>
          </div>

          <div className="gif-result-section">
            <div className="meta">生成的 GIF ({selectedHistory.item.frameCount} 帧)</div>
            <img className="final-gif" src={selectedHistory.gifUrl} alt="Generated GIF" />
            <Space>
              <Button onClick={copyHistoryGifAsFirstFrame}>复制为图片</Button>
              <Button onClick={downloadHistoryGif}>下载 GIF</Button>
              <Button onClick={closeHistoryDetail}>关闭</Button>
            </Space>
          </div>
        </div>
      )}
    </section>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
