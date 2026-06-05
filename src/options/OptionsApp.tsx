import { useEffect, useMemo, useState } from 'react';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Layout from 'antd/es/layout';
import List from 'antd/es/list';
import Menu from 'antd/es/menu';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import type { AgentConfig } from '../shared/agentConfig';
import { AGENT_STORAGE_KEY, createAgentConfig, createDefaultAgentConfigs } from '../shared/agentConfig';
import type { ModelCapability, ModelConfig, ProviderConfig, ProviderModelInfo, WebDavConfig } from '../shared/modelConfig';
import { MODEL_CAPABILITY_LABELS, MODEL_PROVIDER_LABELS } from '../shared/modelConfig';
import { createModelConfigFromProvider, createProviderConfig } from '../shared/modelConfigUtils';
import { sendRuntimeMessage } from '../shared/runtime';
import { clearAllHistory } from '../sidepanel/historyStore';

const { Content, Sider } = Layout;
const { Text, Title } = Typography;
const capabilities = Object.keys(MODEL_CAPABILITY_LABELS) as ModelCapability[];
const defaultCapabilities: { capability: ModelCapability; label: string }[] = [
  { capability: 'text', label: '文本' },
  { capability: 'image-generation', label: '图片' },
  { capability: 'video-generation', label: '视频' }
];

const defaultWebDavConfig: WebDavConfig = {
  url: '',
  username: '',
  password: '',
  filePath: '/gy-ai-crx/model-configs.json',
  enabled: false,
  updatedAt: Date.now()
};

export function OptionsApp() {
  const [activeMenu, setActiveMenu] = useState('models');
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [providerDraft, setProviderDraft] = useState<ProviderConfig>(() => createProviderConfig({ name: 'OpenAI' }));
  const [modelDraft, setModelDraft] = useState<ModelConfig>();
  const [providerModels, setProviderModels] = useState<ProviderModelInfo[]>([]);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>(defaultWebDavConfig);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentDraft, setAgentDraft] = useState<AgentConfig>(() => createAgentConfig());
  const [status, setStatus] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    loadAll();
  }, []);

  const sortedModels = useMemo(() => [...models].sort((a, b) => b.updatedAt - a.updatedAt), [models]);
  const selectedProvider = providers.find((item) => item.id === modelDraft?.providerConfigId);
  const sortedAgents = useMemo(() => [...agents].sort((a, b) => b.updatedAt - a.updatedAt), [agents]);

  async function loadAll() {
    const providerResponse = await sendRuntimeMessage<{ ok: true; providers: ProviderConfig[] }>({ type: 'providers:list' });
    const modelResponse = await sendRuntimeMessage<{ ok: true; models: ModelConfig[] }>({ type: 'models:list' });
    const webDavResponse = await sendRuntimeMessage<{ ok: true; webDavConfig: WebDavConfig }>({ type: 'webdav:get-config' });
    const agentResult = await chrome.storage.local.get(AGENT_STORAGE_KEY);
    const savedAgents = (agentResult as Record<string, AgentConfig[]>)[AGENT_STORAGE_KEY];
    const nextAgents = savedAgents ?? createDefaultAgentConfigs();
    if (!savedAgents) await chrome.storage.local.set({ [AGENT_STORAGE_KEY]: nextAgents });
    setProviders(providerResponse.providers);
    setModels(modelResponse.models);
    setWebDavConfig(webDavResponse.webDavConfig);
    setAgents(nextAgents.filter((item) => item.name && item.prompt));
  }

  async function saveProvider() {
    if (!providerDraft.name.trim() || !providerDraft.baseURL.trim() || !providerDraft.apiKey.trim()) {
      messageApi.warning('请填写供应商名称、Base URL 和令牌');
      return;
    }

    await sendRuntimeMessage({ type: 'providers:save', config: { ...providerDraft, updatedAt: Date.now() } });
    setProviderDraft(createProviderConfig({ name: 'OpenAI' }));
    messageApi.success('已保存供应商配置');
    await loadAll();
  }

  async function toggleProvider(provider: ProviderConfig, enabled: boolean) {
    await sendRuntimeMessage({ type: 'providers:save', config: { ...provider, enabled, updatedAt: Date.now() } });
    messageApi.success(enabled ? '已启用供应商' : '已禁用供应商');
    await loadAll();
  }

  async function removeProvider(id: string) {
    await sendRuntimeMessage({ type: 'providers:delete', id });
    messageApi.success('已删除供应商配置');
    await loadAll();
  }

  function startAddModel(provider: ProviderConfig) {
    setProviderModels([]);
    setModelDraft(createModelConfigFromProvider(provider));
  }

  async function fetchProviderModels(provider: ProviderConfig) {
    try {
      const response = await sendRuntimeMessage<{ ok: true; providerModels: ProviderModelInfo[] }>({ type: 'providers:list-models', id: provider.id });
      setProviderModels(response.providerModels);
      messageApi.success(`已获取 ${response.providerModels.length} 个模型`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setProviderModels([]);
      messageApi.warning(`${errorMessage}，可手动输入模型 ID`);
    }
  }

  async function saveModel() {
    if (!modelDraft || !selectedProvider) return;
    if (!modelDraft.name.trim() || !modelDraft.model.trim()) {
      messageApi.warning('请填写模型显示名称和模型 ID');
      return;
    }

    await sendRuntimeMessage({ type: 'models:save', config: { ...modelDraft, updatedAt: Date.now() } });
    setModelDraft(undefined);
    setProviderModels([]);
    messageApi.success('已保存模型配置');
    await loadAll();
  }

  async function setDefaultModel(model: ModelConfig, capability: ModelCapability, checked: boolean) {
    await sendRuntimeMessage({ type: 'models:save', config: { ...model, defaultFor: { ...model.defaultFor, [capability]: checked }, updatedAt: Date.now() } });
    messageApi.success(checked ? '已设置默认模型' : '已取消默认模型');
    await loadAll();
  }

  async function removeModel(id: string) {
    await sendRuntimeMessage({ type: 'models:delete', id });
    messageApi.success('已删除模型配置');
    await loadAll();
  }

  async function saveWebDav() {
    await sendRuntimeMessage({ type: 'webdav:save-config', config: { ...webDavConfig, enabled: true, updatedAt: Date.now() } });
    setStatus('已保存 WebDAV 配置');
    messageApi.success('已保存 WebDAV 配置');
    await loadAll();
  }

  async function testWebDav() {
    try {
      await saveWebDav();
      const response = await sendRuntimeMessage<{ ok: true; message: string }>({ type: 'webdav:test' });
      setStatus(response.message);
      messageApi.success(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function backupModels() {
    try {
      await saveWebDav();
      const response = await sendRuntimeMessage<{ ok: true; message: string }>({ type: 'webdav:backup-models' });
      setStatus(response.message);
      messageApi.success(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function restoreModels() {
    Modal.confirm({
      title: '确认从 WebDAV 恢复？',
      content: '恢复会覆盖当前本地模型和 Agents 配置。',
      okText: '确认恢复',
      cancelText: '取消',
      async onOk() {
        await saveWebDav();
        const response = await sendRuntimeMessage<{ ok: true; message: string }>({ type: 'webdav:restore-models' });
        setStatus(response.message);
        messageApi.success(response.message);
        await loadAll();
      }
    });
  }

  async function saveAgent() {
    if (!agentDraft.name.trim() || !agentDraft.prompt.trim()) {
      messageApi.warning('请填写 Agent 名称和角色预设提示词');
      return;
    }

    const nextAgent = { ...agentDraft, updatedAt: Date.now() };
    const nextAgents = [nextAgent, ...agents.filter((item) => item.id !== nextAgent.id)];
    await chrome.storage.local.set({ [AGENT_STORAGE_KEY]: nextAgents });
    setAgentDraft(createAgentConfig());
    messageApi.success('已保存 Agent');
    await loadAll();
  }

  async function removeAgent(id: string) {
    const nextAgents = agents.filter((item) => item.id !== id);
    await chrome.storage.local.set({ [AGENT_STORAGE_KEY]: nextAgents });
    if (agentDraft.id === id) setAgentDraft(createAgentConfig());
    messageApi.success('已删除 Agent');
    await loadAll();
  }

  function clearLocalHistoryCache() {
    Modal.confirm({
      title: '清除本地历史缓存？',
      content: '会清除所有会话历史、文案生成历史、图片生成历史和图片缓存，不影响模型配置和 Agents 配置。',
      okText: '清除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        await clearAllHistory();
        messageApi.success('已清除本地历史缓存');
      }
    });
  }

  function updateModelCapability(capability: ModelCapability, checked: boolean) {
    if (!modelDraft) return;
    setModelDraft({
      ...modelDraft,
      capabilities: checked ? [...modelDraft.capabilities, capability] : modelDraft.capabilities.filter((item) => item !== capability)
    });
  }

  function updateModelDefault(capability: ModelCapability, checked: boolean) {
    if (!modelDraft) return;
    setModelDraft({ ...modelDraft, defaultFor: { ...modelDraft.defaultFor, [capability]: checked } });
  }

  function renderAgentsPanel() {
    return <Space direction="vertical" size={16} className="full-width">
      <div>
        <Title level={2}>Agents 管理</Title>
        <Text type="secondary">创建聊天角色，聊天时选择角色会开启新对话，并把角色预设提示词作为隐藏上下文带入。</Text>
      </div>
      <Card title={agents.some((item) => item.id === agentDraft.id) ? '编辑 Agent' : '创建 Agent'}>
        <Form layout="vertical">
          <Form.Item label="Agent 名称" required>
            <Input value={agentDraft.name} onChange={(event) => setAgentDraft({ ...agentDraft, name: event.target.value })} placeholder="如 产品经理 / 文案助手 / 代码审查" />
          </Form.Item>
          <Form.Item label="角色预设提示词" required>
            <Input.TextArea
              value={agentDraft.prompt}
              onChange={(event) => setAgentDraft({ ...agentDraft, prompt: event.target.value })}
              placeholder="描述角色、语气、工作方式和限制。系统会要求该角色在新对话开始时主动打招呼。"
              autoSize={{ minRows: 6, maxRows: 12 }}
            />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={saveAgent}>保存 Agent</Button>
            <Button onClick={() => setAgentDraft(createAgentConfig())}>清空</Button>
          </Space>
        </Form>
      </Card>
      <Card title="Agent 列表">
        <List
          dataSource={sortedAgents}
          locale={{ emptyText: '还没有 Agent' }}
          renderItem={(agent) => <List.Item actions={[
            <Button key="edit" onClick={() => setAgentDraft(agent)}>编辑</Button>,
            <Button key="delete" danger onClick={() => removeAgent(agent.id)}>删除</Button>
          ]}>
            <List.Item.Meta title={agent.name} description={agent.prompt.slice(0, 120)} />
          </List.Item>}
        />
      </Card>
    </Space>;
  }

  return <Layout className="options-shell">
    {contextHolder}
    <Sider width={220} theme="light" className="options-sider">
      <div className="brand">简洁AI助手</div>
      <Menu
        mode="inline"
        selectedKeys={[activeMenu]}
        onClick={({ key }) => setActiveMenu(key)}
        items={[
          { key: 'models', label: '模型配置' },
          { key: 'agents', label: 'Agents 管理' },
          { key: 'webdav', label: 'WebDAV 备份' }
        ]}
      />
    </Sider>
    <Content className="options-content">
      {activeMenu === 'models' ? <Space direction="vertical" size={16} className="full-width">
        <div>
          <Title level={2}>模型配置</Title>
          <Text type="secondary">先配置供应商 Base URL 和令牌，再为该供应商添加多个自定义模型或获取模型列表。</Text>
        </div>

        <Card title="供应商配置">
          <Form layout="vertical">
            <div className="form-grid">
              <Form.Item label="供应商名称" required>
                <Input value={providerDraft.name} onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })} placeholder="如 OpenAI / 公司网关" />
              </Form.Item>
              <Form.Item label="Provider" required>
                <Select value={providerDraft.provider} onChange={(value) => setProviderDraft({ ...providerDraft, provider: value })} options={Object.entries(MODEL_PROVIDER_LABELS).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item label="Base URL" required>
                <Input value={providerDraft.baseURL} onChange={(event) => setProviderDraft({ ...providerDraft, baseURL: event.target.value })} placeholder="https://api.openai.com/v1" />
              </Form.Item>
              <Form.Item label="令牌" required>
                <Input.Password value={providerDraft.apiKey} onChange={(event) => setProviderDraft({ ...providerDraft, apiKey: event.target.value })} />
              </Form.Item>
              <Form.Item label="启用">
                <Switch checked={providerDraft.enabled} onChange={(checked) => setProviderDraft({ ...providerDraft, enabled: checked })} />
              </Form.Item>
            </div>
            <Space>
              <Button type="primary" onClick={saveProvider}>保存供应商</Button>
              <Button onClick={() => setProviderDraft(createProviderConfig({ name: 'OpenAI' }))}>清空</Button>
            </Space>
          </Form>
        </Card>

        <Card title="供应商列表">
          <List
            dataSource={providers}
            locale={{ emptyText: '还没有供应商配置' }}
            renderItem={(provider) => <List.Item actions={[
              <Switch key="enabled" checked={provider.enabled} checkedChildren="启用" unCheckedChildren="禁用" onChange={(checked) => toggleProvider(provider, checked)} />,
              <Button key="models" onClick={() => fetchProviderModels(provider)}>获取模型列表</Button>,
              <Button key="add" type="primary" onClick={() => startAddModel(provider)}>添加模型</Button>,
              <Button key="edit" onClick={() => setProviderDraft(provider)}>编辑</Button>,
              <Button key="delete" danger onClick={() => removeProvider(provider.id)}>删除</Button>
            ]}>
              <List.Item.Meta title={<Space>{provider.name}{!provider.enabled && <Tag>已禁用</Tag>}</Space>} description={`${MODEL_PROVIDER_LABELS[provider.provider]} · ${provider.baseURL}`} />
            </List.Item>}
          />
        </Card>

        {modelDraft && selectedProvider && <Card title={`${selectedProvider.name} · ${models.some((item) => item.id === modelDraft.id) ? '编辑模型' : '添加模型'}`}>
          <Form layout="vertical">
            <div className="form-grid">
              <Form.Item label="模型 ID" required>
                <Select
                  showSearch
                  mode="tags"
                  maxCount={1}
                  value={modelDraft.model ? [modelDraft.model] : []}
                  placeholder="输入或选择模型 ID"
                  onChange={(values) => {
                    const value = values.at(-1) || '';
                    setModelDraft({ ...modelDraft, model: value, name: modelDraft.name || value });
                  }}
                  options={providerModels.map((item) => ({ value: item.id, label: item.name }))}
                />
              </Form.Item>
              <Form.Item label="显示名称" required>
                <Input value={modelDraft.name} onChange={(event) => setModelDraft({ ...modelDraft, name: event.target.value })} placeholder="如 GPT-4.1 / gpt-image-2" />
              </Form.Item>
            </div>
            <Form.Item label="能力">
              <Checkbox.Group value={modelDraft.capabilities} onChange={(values) => setModelDraft({ ...modelDraft, capabilities: values as ModelCapability[] })} options={capabilities.map((capability) => ({ label: MODEL_CAPABILITY_LABELS[capability], value: capability }))} />
            </Form.Item>
            <Form.Item label="设为默认">
              <Space wrap>
                {capabilities.map((capability) => <Checkbox key={capability} checked={Boolean(modelDraft.defaultFor?.[capability])} onChange={(event) => updateModelDefault(capability, event.target.checked)}>{MODEL_CAPABILITY_LABELS[capability]}</Checkbox>)}
              </Space>
            </Form.Item>
            <Form.Item label="启用">
              <Switch checked={modelDraft.enabled} onChange={(checked) => setModelDraft({ ...modelDraft, enabled: checked })} />
            </Form.Item>
            <Space>
              <Button type="primary" onClick={saveModel}>保存模型</Button>
              <Button onClick={() => setModelDraft(undefined)}>取消</Button>
            </Space>
          </Form>
        </Card>}

        <Card title="模型列表">
          <List
            dataSource={sortedModels}
            locale={{ emptyText: '还没有模型配置' }}
            renderItem={(model) => <List.Item actions={[
              <Button key="edit" onClick={() => setModelDraft(model)}>编辑</Button>,
              <Button key="delete" danger onClick={() => removeModel(model.id)}>删除</Button>
            ]}>
              <List.Item.Meta
                title={<Space>{model.name}{!model.enabled && <Tag>已禁用</Tag>}{defaultCapabilities.filter((item) => model.defaultFor?.[item.capability]).map((item) => <Tag color="orange" key={item.capability}>默认{item.label}</Tag>)}</Space>}
                description={<Space direction="vertical" size={4}>
                  <Text type="secondary">{model.providerName || MODEL_PROVIDER_LABELS[model.provider]} · {model.model}</Text>
                  <Space wrap>{model.capabilities.map((capability) => <Tag color="blue" key={capability}>{MODEL_CAPABILITY_LABELS[capability]}</Tag>)}</Space>
                  <Space wrap>{defaultCapabilities.filter((item) => model.capabilities.includes(item.capability)).map((item) => <Button size="small" key={item.capability} type={model.defaultFor?.[item.capability] ? 'primary' : 'default'} onClick={() => setDefaultModel(model, item.capability, !model.defaultFor?.[item.capability])}>{model.defaultFor?.[item.capability] ? `取消默认${item.label}` : `设默认${item.label}`}</Button>)}</Space>
                </Space>}
              />
            </List.Item>}
          />
        </Card>
      </Space> : activeMenu === 'agents' ? renderAgentsPanel() : <Space direction="vertical" size={16} className="full-width">
        <div>
          <Title level={2}>WebDAV 备份</Title>
          <Text type="secondary">手动备份和恢复模型和 Agents 配置。备份文件会包含 API Key，请确认 WebDAV 服务可信且账号安全。</Text>
        </div>
        <Card>
          <Form layout="vertical">
            <div className="form-grid">
              <Form.Item label="WebDAV 地址">
                <Input value={webDavConfig.url} onChange={(event) => setWebDavConfig({ ...webDavConfig, url: event.target.value })} placeholder="https://example.com/dav" />
              </Form.Item>
              <Form.Item label="备份文件路径">
                <Input value={webDavConfig.filePath} onChange={(event) => setWebDavConfig({ ...webDavConfig, filePath: event.target.value })} placeholder="/gy-ai-crx/model-configs.json" />
              </Form.Item>
              <Form.Item label="用户名">
                <Input value={webDavConfig.username} onChange={(event) => setWebDavConfig({ ...webDavConfig, username: event.target.value })} />
              </Form.Item>
              <Form.Item label="密码">
                <Input.Password value={webDavConfig.password} onChange={(event) => setWebDavConfig({ ...webDavConfig, password: event.target.value })} />
              </Form.Item>
            </div>
            <Space wrap>
              <Button onClick={saveWebDav}>保存 WebDAV 配置</Button>
              <Button onClick={testWebDav}>测试连接</Button>
              <Button type="primary" onClick={backupModels}>立即备份</Button>
              <Button danger onClick={restoreModels}>从备份恢复</Button>
            </Space>
            {status && <div className="status-text">{status}</div>}
          </Form>
        </Card>
        <Card title="本地历史缓存">
          <Space direction="vertical">
            <Text type="secondary">清除会话历史、文案生成历史、图片生成历史和图片缓存，不影响模型配置、Agents 配置和 WebDAV 配置。</Text>
            <Button danger onClick={clearLocalHistoryCache}>清除 IndexedDB 缓存</Button>
          </Space>
        </Card>
      </Space>}
    </Content>
  </Layout>;
}
