"use client";

import { useEffect, useState } from "react";
import { getBrandMentions, setMentionStatus, type BrandMention } from "@/lib/brandMentions";
import { QueuePage, SectionLabel, Card, Tag, Spinner, Empty, LoadError, Segmented, fmtAgo } from "./QueueShell";

const SOURCE_ICON: Record<string, string> = { reddit: "👽", news: "📰" };

function MentionRow({ m, onStatus }: { m: BrandMention; onStatus: (id: string, s: BrandMention["status"]) => void }) {
  const [busy, setBusy] = useState(false);
  const flip = async (s: BrandMention["status"]) => {
    setBusy(true);
    try { await setMentionStatus(m.id, s); onStatus(m.id, s); } catch { /* stays as-is; retry is a click away */ }
    setBusy(false);
  };
  return (
    <Card dim={m.status !== "new"}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 text-xl">{SOURCE_ICON[m.source] || "🌐"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold text-[var(--cream)] hover:text-[var(--gold)]">
              {m.title || m.snippet?.slice(0, 90) || m.url}
            </a>
            {m.confidence === "low" && <Tag tone="neutral">maybe</Tag>}
            {m.status === "dismissed" && <Tag tone="neutral">dismissed</Tag>}
          </div>
          <div className="mt-1 text-[13px] text-[var(--sage-dim)]">
            {[m.venue || m.source, m.author && `by ${m.author}`, m.createdAt && fmtAgo(m.createdAt), m.matchedTerm && `matched “${m.matchedTerm}”`].filter(Boolean).join(" · ")}
          </div>
          {m.snippet && m.title && <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-[var(--text-body)]">{m.snippet}</p>}
        </div>
        {m.status === "new" && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => flip("seen")} disabled={busy} className="rounded-full bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold text-[var(--cream)] transition-colors hover:bg-white/[0.12] disabled:opacity-50">Seen</button>
            <button onClick={() => flip("dismissed")} disabled={busy} className="rounded-full px-3 py-1.5 text-[13px] text-[var(--sage-dim)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">Not us</button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MentionsQueue() {
  const [mentions, setMentions] = useState<BrandMention[] | null>(null);
  const [tab, setTab] = useState<"new" | "all">("new");
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getBrandMentions().then(setMentions).catch(() => { setLoadErr(true); setMentions([]); });
  }, []);

  const onStatus = (id: string, status: BrandMention["status"]) =>
    setMentions((ms) => (ms || []).map((m) => (m.id === id ? { ...m, status } : m)));

  const all = mentions || [];
  const fresh = all.filter((m) => m.status === "new");
  const freshHigh = fresh.filter((m) => m.confidence === "high");
  const freshLow = fresh.filter((m) => m.confidence === "low");
  const shown = tab === "new" ? fresh : all;

  return (
    <QueuePage
      title="Brand Mentions"
      blurb={<>Radius spotted in the wild — Reddit and the news/blog net, swept every 2 hours. <b>Seen</b> clears the badge; <b>Not us</b> buries a false positive. “Maybe” rows said <i>radius</i> without clear brand context — worth a skim, never counted in the badge.</>}
    >
      {mentions === null ? <Spinner /> : loadErr ? <LoadError /> : (
        <>
          <div className="mt-8"><Segmented value={tab} onChange={setTab} options={[{ k: "new", label: "New", n: fresh.length }, { k: "all", label: "All", n: all.length }]} /></div>
          {shown.length === 0 ? (
            <Empty emoji="🔭" title={tab === "new" ? "Nothing new out there" : "No mentions collected yet"} sub={tab === "new" ? "The sweep runs every 2 hours." : "Rows appear as soon as the sweep finds the first mention."} />
          ) : tab === "new" ? (
            <div className="mt-8 space-y-4">
              {freshHigh.length > 0 && <SectionLabel>{freshHigh.length} mention{freshHigh.length === 1 ? "" : "s"}</SectionLabel>}
              {freshHigh.map((m) => <MentionRow key={m.id} m={m} onStatus={onStatus} />)}
              {freshLow.length > 0 && <SectionLabel className="pt-6">{freshLow.length} maybe — “radius” without clear brand context</SectionLabel>}
              {freshLow.map((m) => <MentionRow key={m.id} m={m} onStatus={onStatus} />)}
            </div>
          ) : (
            <div className="mt-8 space-y-4">{shown.map((m) => <MentionRow key={m.id} m={m} onStatus={onStatus} />)}</div>
          )}
        </>
      )}
    </QueuePage>
  );
}
