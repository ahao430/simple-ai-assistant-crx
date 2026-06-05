import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import Button from 'antd/es/button';
import Space from 'antd/es/space';
import type { ChatMessage } from '../shared/messages';
import { CodeBlock } from './CodeBlock';

function preprocessMath(content: string): string {
  return content
    .replace(/^\\\[([\s\S]*?)\\\]\s*$/gm, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
    .replace(/^\\\(([\s\S]*?)\\\)$/gm, (_, math) => `$${math.trim()}$`)
    .replace(/^\[(?!https?:\/\/)([^\]]+)\]\s*$/gm, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
}

export function MessageList(props: {
  messages: ChatMessage[];
  isStreaming?: boolean;
  markdown?: boolean;
  onCopyText?: (text?: string) => void;
  onRegenerate?: (messageId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleMessages = props.messages.filter((message) => !message.hidden);
  const last = visibleMessages[visibleMessages.length - 1];

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [props.messages]);

  return <div className="messages" ref={containerRef}>
    {visibleMessages.map((message) => <article className={`message ${message.displayContent ? 'notice' : message.role}`} key={message.id}>
      {message.displayContent
        ? message.displayContent
        : props.isStreaming && message === last && message.role === 'assistant' && !message.content
        ? <span className="thinking">思考中...</span>
        : props.markdown && message.role === 'assistant'
        ? <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            components={{ code: ({ className, children }) => <CodeBlock className={className}>{String(children)}</CodeBlock> }}
          >{preprocessMath(message.content)}</ReactMarkdown>
        : message.content}
      {message.role === 'assistant' && message.content && <Space className="message-actions" wrap>
        {props.onCopyText && <Button size="small" onClick={() => props.onCopyText?.(message.content)}>复制</Button>}
        {props.onRegenerate && <Button size="small" onClick={() => props.onRegenerate?.(message.id)}>重试</Button>}
      </Space>}
    </article>)}
  </div>;
}
