import { useState } from 'react';
import Input from 'antd/es/input';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import List from 'antd/es/list';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { getSubmitShortcutHint, type SubmitShortcut } from '../shared/appSettings';
import { useTextareaSubmit } from './textareaSubmit';
import type { SelectGroupOption } from './ImagePanel';
import type { TextGenerationHistory } from './historyStore';

export function TextPanel(props: {
  input: string;
  setInput: (value: string) => void;
  textResult: string;
  textHistory: TextGenerationHistory[];
  isGenerating: boolean;
  submitShortcut: SubmitShortcut;
  textModelOptions: SelectGroupOption[];
  textModelId: string;
  setTextModelId: (id: string) => void;
  onSend: () => void;
  onCopyText: (text?: string) => void;
  onRegenerate: () => void;
  onDeleteHistory: (id: string) => void;
}) {
  const [form] = Form.useForm();
  const [selectedHistory, setSelectedHistory] = useState<TextGenerationHistory>();
  const { onCompositionStart, onCompositionEnd, onKeyDown } = useTextareaSubmit(props.submitShortcut);
  const hasResult = Boolean(props.textResult);

  function handleFinish() {
    if (!props.textModelId || !props.input.trim() || props.isGenerating) return;
    props.onSend();
  }

  return <section className="tab-panel text-gen-panel">
    <div className="text-input-area">
      <Form form={form} onFinish={handleFinish}>
        <Input.TextArea
          value={props.input}
          onChange={(event) => props.setInput(event.target.value)}
          onKeyDown={(event) => onKeyDown(event, form)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder="输入生成要求，AI 会生成可复制的文案..."
          autoSize={{ minRows: 3, maxRows: 5 }}
        />
        <div className="shortcut-hint">{getSubmitShortcutHint(props.submitShortcut)}</div>
        <div className="composer-row">
          <div className="composer-left" />
          <Select className="composer-model" value={props.textModelId || undefined} placeholder="模型" onChange={props.setTextModelId} options={props.textModelOptions} size="small" />
          <Button type="primary" htmlType="submit" loading={props.isGenerating} disabled={!props.textModelId || !props.input.trim()}>生成文案</Button>
        </div>
      </Form>
    </div>
    <div className="text-output-area">
      {props.isGenerating && !hasResult && <div className="image-loading">正在生成文案...</div>}
      {hasResult && <div className="text-output-content">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{props.textResult}</ReactMarkdown>
      </div>}
      {hasResult && <Space className="text-output-actions" wrap>
        <Button size="small" onClick={() => props.onCopyText(props.textResult)}>复制</Button>
        <Button size="small" disabled={props.isGenerating} onClick={props.onRegenerate}>重试</Button>
      </Space>}
      {selectedHistory && <div className="history-detail">
        <div className="meta">文案历史详情 · {new Date(selectedHistory.createdAt).toLocaleString()}</div>
        <div className="history-prompt">
          <div className="meta">用户输入</div>
          <div>{selectedHistory.prompt}</div>
        </div>
        <div className="text-output-content">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedHistory.result}</ReactMarkdown>
        </div>
        <Space wrap>
          <Button size="small" onClick={() => props.onCopyText(selectedHistory.result)}>复制文案</Button>
          <Button size="small" onClick={() => props.onCopyText(selectedHistory.prompt)}>复制提示词</Button>
          <Button size="small" onClick={() => setSelectedHistory(undefined)}>关闭</Button>
        </Space>
      </div>}
      {props.textHistory.length > 0 && <List
        className="history-list"
        size="small"
        header="文案历史"
        dataSource={props.textHistory}
        renderItem={(item) => <List.Item actions={[
          <Button key="view" size="small" onClick={() => setSelectedHistory(item)}>查看</Button>,
          <Popconfirm key="delete" title="删除这条文案历史？" okText="删除" cancelText="取消" onConfirm={() => {
            if (selectedHistory?.id === item.id) setSelectedHistory(undefined);
            props.onDeleteHistory(item.id);
          }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        ]}>
          <List.Item.Meta title={item.prompt.slice(0, 40) || '文案生成'} description={new Date(item.createdAt).toLocaleString()} />
        </List.Item>}
      />}
    </div>
  </section>;
}
