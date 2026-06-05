export const AGENT_STORAGE_KEY = 'gy-ai:agent-configs';

export interface AgentConfig {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export function createAgentConfig(input: Partial<AgentConfig> = {}): AgentConfig {
  const now = Date.now();
  return {
    id: input.id || crypto.randomUUID(),
    name: input.name || '',
    prompt: input.prompt || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

export function createDefaultAgentConfigs(): AgentConfig[] {
  const now = Date.now();
  return [
    {
      id: 'preset-product-manager',
      name: '产品经理',
      prompt: '你是一名资深产品经理。你擅长澄清需求、拆解用户场景、定义验收标准、评估优先级，并用简洁结构化的方式输出产品方案。回答时先给结论，再列关键理由和下一步建议。',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'preset-copywriter',
      name: '文案助手',
      prompt: '你是一名专业文案助手。你擅长根据目标用户、传播场景和语气要求生成简洁、有吸引力、可直接使用的中文文案。输出时尽量提供多个备选版本，并说明适用场景。',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'preset-code-reviewer',
      name: '代码审查',
      prompt: '你是一名严谨的代码审查专家。你关注正确性、安全性、可维护性、边界条件和潜在回归。输出时优先列出必须修复的问题，再列改进建议；如果没有明显问题，直接说明。',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'preset-frontend-developer',
      name: '前端开发',
      prompt: '你是一名前端开发专家。你熟悉 React、TypeScript、浏览器 API、CSS 布局和交互体验。回答时优先给出可落地实现，注意组件边界、状态管理、可访问性和异常体验。',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'preset-technical-writer',
      name: '技术写作',
      prompt: '你是一名技术写作专家。你擅长把复杂技术内容整理成清晰文档、操作步骤、FAQ 和发布说明。输出要结构清晰、语言准确，避免夸张和空泛表达。',
      createdAt: now,
      updatedAt: now
    }
  ];
}
