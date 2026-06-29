import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

export default function FormattedMessage({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 className="markdown-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
          p: ({ children }) => <p className="markdown-p">{children}</p>,
          ul: ({ children }) => <ul className="markdown-list list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="markdown-list list-decimal">{children}</ol>,
          li: ({ children }) => <li className="markdown-li">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="markdown-quote">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="message-table-wrap">
              <table className="message-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="markdown-link">
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={`${className} markdown-code-block`}>{children}</code>
            ) : (
              <code className="markdown-code-inline">{children}</code>
            ),
          hr: () => <hr className="markdown-rule" />,
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
