import { useState, memo } from 'react';
import { marked } from 'marked';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaCopy } from 'react-icons/fa';

marked.setOptions({
  headerIds: false,
  breaks: true,
  gfm: true,
});

const CodeBlock = memo(({ text, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative my-2 min-h-[2rem]">
      <button
        className={`copy-button absolute top-2 right-2 p-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? '已复制' : <FaCopy />}
      </button>
      <SyntaxHighlighter
        language={language || 'text'}
        style={ghcolors}
        customStyle={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          fontSize: '0.95rem',
          lineHeight: '1.7',
          margin: '0',
          fontFamily: '"Fira Code", "Menlo", monospace',
          whiteSpace: 'pre',
          wordBreak: 'break-word',
          overflowX: 'auto',
          minHeight: '2rem',
        }}
        wrapLines={true}
        showLineNumbers={false}
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
});

function ChatMessage({ message, isLastAssistant, onStop }) {
  const normalizeMarkdown = (text) => {
    let normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const codeBlockRegex = /^```markdown\n([\s\S]*?)\n```$/;
    const match = normalized.match(codeBlockRegex);
    if (match) {
      normalized = match[1].trim();
    }

    return normalized;
  };

  const renderContent = () => {
    try {
      const normalizedContent = normalizeMarkdown(message.content);
      if (message.role === 'user') {
        return (
          <div
            className="min-h-[1.5rem]"
            dangerouslySetInnerHTML={{
              __html: normalizedContent
                .replace(/</g, '<')
                .replace(/>/g, '>')
                .replace(/\n/g, '<br>')
            }}
          />
        );
      }

      const tokens = marked.lexer(normalizedContent);
      const elements = [];

      tokens.forEach((token, index) => {
        if (token.type === 'code') {
          elements.push(
            <CodeBlock
              key={`${message.id}-code-${index}`}
              text={token.text}
              language={token.lang || 'text'}
            />
          );
        } else {
          const html = marked.parser([token]);
          elements.push(
            <div
              key={`${message.id}-text-${index}`}
              className="min-h-[1.5rem]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
      });

      return elements;
    } catch (error) {
      console.error('Markdown 解析错误:', error, '原始内容:', message.content);
      return <div className="min-h-[1.5rem]">{message.content}</div>;
    }
  };

  return (
    <div
      className={`flex ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      } mb-4 max-w-3xl mx-auto`}
    >
      <div
        className={`p-3 rounded-lg ${
          message.role === 'user'
            ? 'bg-[#B9CAD3] text-gray-800'
            : 'bg-gray-100 text-gray-800'
        } prose prose-sm max-w-full min-h-[2rem]`}
      >
        {renderContent()}
        {message.model && (
          <div className="text-xs text-gray-500 mt-1">
            模型：{message.model}
          </div>
        )}
        {isLastAssistant && (
          <button
            onClick={onStop}
            className="mt-2 px-4 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
          >
            停止
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);