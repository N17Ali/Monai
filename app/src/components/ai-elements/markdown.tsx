import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown-body space-y-3", className)}>
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <a className="text-primary underline underline-offset-4" href={href} rel="noreferrer" target="_blank">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-base font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[15px] font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 ps-5">{children}</ol>,
          ul: ({ children }) => <ul className="list-disc space-y-1 ps-5">{children}</ul>,
          pre: ({ children }) => (
            <pre className="markdown-pre" dir="ltr">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-border bg-surface-muted px-3 py-1.5">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
