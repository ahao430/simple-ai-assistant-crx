import { useEffect, useRef, useState } from 'react';
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

  if (language === 'mermaid') return <MermaidBlock code={code} />;
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
    if (!ref.current) return;
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [code]);

  if (error) return <pre className="code-error">Mermaid 渲染失败: {error}</pre>;
  return <div className="mermaid-block" ref={ref} />;
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
