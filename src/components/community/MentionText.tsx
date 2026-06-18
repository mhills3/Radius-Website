"use client";

import Link from "next/link";
import { Fragment } from "react";

type Tagged = { id: string; name: string; username: string };

/**
 * Renders post/comment text, turning @mentions of tagged users into blue, clickable
 * profile links. Only handles that match a tagged user become links (so we never link a
 * stray @token to a non-existent profile). Preserves the surrounding text + whitespace.
 */
export default function MentionText({ text, tagged, className }: { text: string; tagged?: Tagged[]; className?: string }) {
  if (!text) return null;
  const byHandle = new Map((tagged ?? []).filter((u) => u.username).map((u) => [u.username.toLowerCase().replace(/^@/, ""), u]));
  const parts = byHandle.size > 0 ? text.split(/(@[A-Za-z0-9_]+)/g) : [text];
  return (
    <p className={className}>
      {parts.map((part, i) => {
        const m = /^@([A-Za-z0-9_]+)$/.exec(part);
        const u = m ? byHandle.get(m[1].toLowerCase()) : undefined;
        if (u) {
          return (
            <Link key={i} href={`/u/${u.username}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#4d94fa] hover:underline">
              @{u.username}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
