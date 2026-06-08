import React from "react";

function inline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-bold text-[#16221b]">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

export default function ArticleBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`ul-${blocks.length}`} className="mb-5 list-disc space-y-1.5 pl-5 text-[#46554c]">{list}</ul>);
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (line.startsWith("### ")) { flush(); blocks.push(<h3 key={i} className="mb-2 mt-6 font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight text-[#16221b]">{inline(line.slice(4))}</h3>); }
    else if (line.startsWith("## ")) { flush(); blocks.push(<h2 key={i} className="mb-3 mt-9 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[#16221b]">{inline(line.slice(3))}</h2>); }
    else if (line.startsWith("- ")) { list.push(<li key={i}>{inline(line.slice(2))}</li>); }
    else { flush(); blocks.push(<p key={i} className="mb-5 leading-relaxed text-[#46554c]">{inline(line)}</p>); }
  });
  flush();
  return <div className="text-[17px]">{blocks}</div>;
}
