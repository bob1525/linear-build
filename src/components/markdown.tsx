import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeHref(href: string | undefined) {
  if (!href) return undefined;
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") return href;
  } catch {
    return undefined;
  }
  return undefined;
}

const components: Components = {
  a: ({ href, children }) => {
    const safe = safeHref(href);
    const external = safe?.startsWith("http");
    return (
      <a href={safe} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
        {children}
      </a>
    );
  },
};

export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
