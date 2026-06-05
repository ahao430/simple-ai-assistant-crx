import { useState } from 'react';
import Input from 'antd/es/input';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Upload from 'antd/es/upload';
import type { UploadFile } from 'antd/es/upload/interface';
import type { AgentConfig } from '../shared/agentConfig';
import type { ChatMessage } from '../shared/messages';
import { MessageList } from './MessageList';
import { useTextareaSubmit } from './textareaSubmit';
import type { SelectGroupOption } from './ImagePanel';
import type { ChatSessionHistory } from './historyStore';

export function ChatPanel(props: {
  messages: ChatMessage[];
  chatSessions: ChatSessionHistory[];
  currentChatSessionId: string;
  agents: AgentConfig[];
  currentAgentName?: string;
  input: string;
  setInput: (value: string) => void;
  chatImages: string[];
  onChatImageFiles: (files: File[]) => void;
  textModelOptions: SelectGroupOption[];
  textModelId: string;
  setTextModelId: (id: string) => void;
  isStreaming: boolean;
  status: string;
  onSend: () => void;
  onReadArticle: () => void;
  onCopyText: (text?: string) => void;
  onRegenerate: (messageId: string) => void;
  onNewChatSession: (agent?: AgentConfig) => void;
  onSelectChatSession: (id: string) => void;
  onDeleteChatSession: (id: string) => void;
}) {
  const [form] = Form.useForm();
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const { onCompositionStart, onCompositionEnd, onKeyDown } = useTextareaSubmit();
  const uploadFiles: UploadFile[] = props.chatImages.map((url, index) => ({
    uid: `${index}`,
    name: `图片 ${index + 1}`,
    status: 'done',
    url
  }));

  function handleFinish() {
    if (!props.textModelId || !props.input.trim()) return;
    props.onSend();
  }

  function confirmNewSession() {
    props.onNewChatSession(props.agents.find((agent) => agent.id === selectedAgentId));
    setNewSessionOpen(false);
    setSelectedAgentId('');
  }

  return <section className="tab-panel chat-panel">
    <div className="chat-toolbar">
      <Space>
        <Button size="small" onClick={() => setNewSessionOpen(true)}>新会话</Button>
        <Select
          className="chat-session-select"
          size="small"
          value={props.currentChatSessionId || undefined}
          placeholder="会话列表"
          onChange={props.onSelectChatSession}
          options={props.chatSessions.map((session) => ({ value: session.id, label: session.agentName ? `${session.title} · ${session.agentName}` : session.title, title: session.agentPrompt || session.title }))}
        />
      </Space>
      {props.currentChatSessionId && <Popconfirm title="删除当前会话？" okText="删除" cancelText="取消" onConfirm={() => props.onDeleteChatSession(props.currentChatSessionId)}>
        <Button size="small" type="text" danger>删除会话</Button>
      </Popconfirm>}
    </div>
    <MessageList messages={props.messages} markdown isStreaming={props.isStreaming} onCopyText={props.onCopyText} onRegenerate={props.onRegenerate} />
    <Form form={form} className="composer" onFinish={handleFinish}>
      <div className="composer-top">
        <Button className="read-article-bubble" size="small" onClick={props.onReadArticle} disabled={!props.textModelId || props.isStreaming}>阅读本文信息</Button>
        {props.currentAgentName && <div className="composer-agent-badge">{props.currentAgentName}</div>}
      </div>
      <Input.TextArea
        value={props.input}
        onChange={(event) => props.setInput(event.target.value)}
        onKeyDown={(event) => onKeyDown(event, form)}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        placeholder="输入消息，支持 Markdown / LaTeX..."
        autoSize={{ minRows: 3, maxRows: 6 }}
      />
      <div className="composer-bottom">
        <Upload
          className="composer-upload"
          listType="picture-card"
          multiple
          fileList={uploadFiles}
          beforeUpload={(_file, fileList) => {
            props.onChatImageFiles(fileList);
            return false;
          }}
          showUploadList={{ showPreviewIcon: false }}
          accept="image/*"
        >
          传图
        </Upload>
        <div className="composer-right">
          <Select className="composer-model" value={props.textModelId || undefined} placeholder="模型" onChange={props.setTextModelId} options={props.textModelOptions} size="small" />
          <Button className="composer-send" type="primary" htmlType="submit" disabled={!props.textModelId || !props.input.trim()}>发送</Button>
        </div>
      </div>
    </Form>
    <Modal title="新会话" open={newSessionOpen} okText="开始" cancelText="取消" onOk={confirmNewSession} onCancel={() => setNewSessionOpen(false)}>
      <Select
        className="new-session-agent-select"
        value={selectedAgentId}
        onChange={setSelectedAgentId}
        options={[{ value: '', label: '不选择角色' }, ...props.agents.map((agent) => ({ value: agent.id, label: agent.name }))]}
      />
    </Modal>
  </section>;
}
