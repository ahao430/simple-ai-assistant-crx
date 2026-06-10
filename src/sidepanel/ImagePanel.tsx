import { useEffect, useState } from 'react';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Upload from 'antd/es/upload';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ImageAsset } from '../shared/assets';
import { getSubmitShortcutHint, type SubmitShortcut } from '../shared/appSettings';
import { useTextareaSubmit } from './textareaSubmit';
import { getImageAssetFromHistory, getImageObjectUrl, type ImageGenerationHistory } from './historyStore';

export type SelectGroupOption = {
  label: string;
  options: { value: string; label: string }[];
};

export function ImagePanel(props: {
  imageModelOptions: SelectGroupOption[];
  imageModelId: string;
  setImageModelId: (id: string) => void;
  imagePrompt: string;
  setImagePrompt: (value: string) => void;
  referenceImages: string[];
  onImageFiles: (files: File[]) => void;
  imageAsset?: ImageAsset;
  imageHistory: ImageGenerationHistory[];
  isGenerating: boolean;
  submitShortcut: SubmitShortcut;
  onGenerate: () => void;
  onCopyImage: (asset?: ImageAsset) => void;
  onCopyText: (text?: string) => void;
  onSetBackground: (asset?: ImageAsset) => void;
  onDeleteHistory: (id: string) => void;
}) {
  const [form] = Form.useForm();
  const [historyUrls, setHistoryUrls] = useState<Record<string, string>>({});
  const [selectedHistory, setSelectedHistory] = useState<ImageAsset>();
  const [selectedHistoryMeta, setSelectedHistoryMeta] = useState<ImageGenerationHistory>();
  const { onCompositionStart, onCompositionEnd, onKeyDown } = useTextareaSubmit(props.submitShortcut);
  const uploadFiles: UploadFile[] = props.referenceImages.map((url, index) => ({
    uid: `${index}`,
    name: `参考图 ${index + 1}`,
    status: 'done',
    url
  }));

  useEffect(() => {
    let active = true;
    const urls: string[] = [];

    Promise.all(props.imageHistory.map(async (item) => {
      const url = await getImageObjectUrl(item);
      urls.push(url);
      return [item.id, url] as const;
    })).then((entries) => {
      if (active) setHistoryUrls(Object.fromEntries(entries));
    }).catch(() => {});

    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [props.imageHistory]);

  function handleFinish() {
    if (!props.imageModelId || !props.imagePrompt.trim() || props.isGenerating) return;
    props.onGenerate();
  }

  async function viewHistory(item: ImageGenerationHistory) {
    setSelectedHistory(await getImageAssetFromHistory(item));
    setSelectedHistoryMeta(item);
  }

  function downloadImage(asset: ImageAsset) {
    const link = document.createElement('a');
    link.download = `ai-image-${Date.now()}.png`;
    link.href = asset.dataUrl;
    link.click();
  }

  return <section className="tab-panel image-panel">
    <div className="image-controls">
      <Form form={form} onFinish={handleFinish}>
        <Input.TextArea
          value={props.imagePrompt}
          onChange={(event) => props.setImagePrompt(event.target.value)}
          onKeyDown={(event) => onKeyDown(event, form)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder="描述要生成或修改的图片..."
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
        <div className="shortcut-hint">{getSubmitShortcutHint(props.submitShortcut)}</div>
        <div className="composer-bottom">
          <Upload
            className="composer-upload"
            listType="picture-card"
            multiple
            fileList={uploadFiles}
            beforeUpload={(_file, fileList) => {
              props.onImageFiles(fileList);
              return false;
            }}
            showUploadList={{ showPreviewIcon: false }}
            accept="image/*"
          >
            <PlusOutlined />
          </Upload>
          <div className="composer-right">
            <Select className="composer-model" value={props.imageModelId || undefined} placeholder="模型" onChange={props.setImageModelId} options={props.imageModelOptions} size="small" style={ {"height": "auto"}}/>
            <Button className="composer-send" type="primary" htmlType="submit" loading={props.isGenerating} disabled={!props.imageModelId || !props.imagePrompt.trim()}>生成</Button>
          </div>
        </div>
      </Form>
    </div>
    {props.isGenerating && <div className="image-loading">正在生成图片...</div>}
    {props.imageAsset && <>
      <img className="image-preview" src={props.imageAsset.dataUrl} alt="AI 生成图片" />
      <Space>
        <Button disabled={props.isGenerating} onClick={() => props.onCopyImage()}>复制</Button>
        <Button disabled={props.isGenerating} onClick={() => props.onSetBackground(props.imageAsset)}>设为背景</Button>
        <Button disabled={props.isGenerating} onClick={() => props.imageAsset && downloadImage(props.imageAsset)}>下载</Button>
      </Space>
    </>}
    {selectedHistory && selectedHistoryMeta && <div className="history-detail">
      <div className="meta">图片历史详情 · {new Date(selectedHistoryMeta.createdAt).toLocaleString()}</div>
      <img className="image-preview" src={selectedHistory.dataUrl} alt={selectedHistoryMeta.prompt} />
      <div className="history-prompt">
        <div className="meta">用户输入</div>
        <div>{selectedHistoryMeta.prompt}</div>
      </div>
      <Space wrap>
        <Button size="small" onClick={() => props.onCopyImage(selectedHistory)}>复制图片</Button>
        <Button size="small" onClick={() => props.onCopyText(selectedHistoryMeta.prompt)}>复制提示词</Button>
        <Button size="small" onClick={() => props.onSetBackground(selectedHistory)}>设为背景</Button>
        <Button size="small" onClick={() => downloadImage(selectedHistory)}>下载</Button>
        <Button size="small" onClick={() => {
          setSelectedHistory(undefined);
          setSelectedHistoryMeta(undefined);
        }}>关闭</Button>
      </Space>
    </div>}
    {props.imageHistory.length > 0 && <div className="image-history">
      <div className="meta">图片历史</div>
      <div className="image-history-grid">
        {props.imageHistory.map((item) => <div className="image-history-item" key={item.id}>
          {historyUrls[item.id] && <img src={historyUrls[item.id]} alt={item.prompt} onClick={() => viewHistory(item)} />}
          <div className="image-history-prompt">{item.prompt}</div>
          <Space>
            <Button size="small" onClick={() => viewHistory(item)}>查看</Button>
            <Popconfirm title="删除这张图片历史？" okText="删除" cancelText="取消" onConfirm={() => {
              if (selectedHistoryMeta?.id === item.id) {
                setSelectedHistory(undefined);
                setSelectedHistoryMeta(undefined);
              }
              props.onDeleteHistory(item.id);
            }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        </div>)}
      </div>
    </div>}
  </section>;
}
