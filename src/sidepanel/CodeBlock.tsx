import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import Button from 'antd/es/button';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

export function CodeBlock({ className, children }: { className?: string; children: string }) {
  const language = className?.replace('language-', '') || '';
  const code = String(children).replace(/\n$/, '');

  // inline code
  if (!className) return <code className="inline-code">{code}</code>;

  if (language === 'mermaid') return <RenderErrorBoundary language="mermaid"><MermaidBlock code={code} /></RenderErrorBoundary>;
  if (language === 'plantuml') return <PlantUMLBlock code={code} />;

  return <CodeHighlight language={language} code={code} />;
}

function CodeHighlight({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return <div className="code-block">
    <div className="code-header">
      <span className="code-lang">{language || 'text'}</span>
      <Button size="small" type="text" onClick={handleCopy}>{copied ? '已复制' : '复制'}</Button>
    </div>
    <SyntaxHighlighter language={language || 'text'} style={oneLight} customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', fontSize: 13 }}>
      {code}
    </SyntaxHighlighter>
  </div>;
}

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let active = true;
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setError('');
    container.innerHTML = '';

    mermaid.render(id, code).then(({ svg }) => {
      if (!active) return;
      container.innerHTML = svg;
    }).catch((err: unknown) => {
      if (!active) return;
      container.innerHTML = '';
      setError(formatRenderError(err));
    }).finally(() => removeLeakedMermaidNode(id, container));

    return () => {
      active = false;
      container.innerHTML = '';
      removeLeakedMermaidNode(id, container);
    };
  }, [code]);

  return <div className="code-block mermaid-code-block">
    <div className="code-header">
      <span className="code-lang">mermaid</span>
    </div>
    {error && <pre className="code-error">Mermaid 渲染失败: {error}</pre>}
    <div className="mermaid-block" ref={ref} hidden={!!error} />
  </div>;
}

class RenderErrorBoundary extends Component<{ language: string; children: ReactNode }, { error: string }> {
  state = { error: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: formatRenderError(error) };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {}

  render() {
    if (this.state.error) {
      return <div className="code-block">
        <div className="code-header">
          <span className="code-lang">{this.props.language}</span>
        </div>
        <pre className="code-error">{this.props.language} 渲染失败: {this.state.error}</pre>
      </div>;
    }

    return this.props.children;
  }
}

function removeLeakedMermaidNode(id: string, container: HTMLElement) {
  const node = document.getElementById(id);
  if (node && node.parentElement !== container) node.remove();
}

function formatRenderError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function PlantUMLBlock({ code }: { code: string }) {
  const encoded = plantUMLEncode(code);
  const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;

  return <div className="plantuml-block">
    <img src={url} alt="PlantUML diagram" style={{ maxWidth: '100%' }} />
  </div>;
}

function plantUMLEncode(text: string): string {
  let data = unescape(encodeURIComponent(text));
  data = Array.from(new TextEncoder().encode(data)).map((b) => String.fromCharCode(b)).join('');
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const a = data.charCodeAt(i);
    const b = i + 1 < data.length ? data.charCodeAt(i + 1) : 0;
    const c = i + 2 < data.length ? data.charCodeAt(i + 2) : 0;
    result += encode6(a >> 2);
    result += encode6(((a & 3) << 4) | (b >> 4));
    result += encode6(i + 1 < data.length ? ((b & 15) << 2) | (c >> 6) : 64);
    result += encode6(i + 2 < data.length ? c & 63 : 64);
  }
  return result;
}

function encode6(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  if (b === 26) return '-';
  if (b === 27) return '_';
  return String.fromCharCode(0);
}
