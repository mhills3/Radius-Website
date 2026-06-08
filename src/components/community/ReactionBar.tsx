"use client";

export default function ReactionBar({ count, myReaction, onReact }: { count: number; reactions?: Record<string, number>; myReaction?: string; onReact: (type: string) => void }) {
  const liked = !!myReaction;
  return (
    <button
      onClick={() => onReact("like")}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${liked ? "text-[#f0584f]" : "text-[var(--sage)] hover:bg-white/[0.05] hover:text-[var(--cream)]"}`}
    >
      <svg viewBox="0 0 24 24" fill={liked ? "#f0584f" : "none"} stroke={liked ? "#f0584f" : "currentColor"} strokeWidth="2" className="h-[18px] w-[18px] transition-transform active:scale-90">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {count > 0 ? count : ""}
    </button>
  );
}
