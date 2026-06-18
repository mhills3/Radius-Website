"use client";

import Link from "next/link";
import { Fragment } from "react";

type Tagged = { id: string; name: string; username: string };

/**
 * Renders post/comment text, turning every @handle into a blue, clickable profile link
 * (/u/handle — the profile page handles unknown handles gracefully). When a tagged user
 * matches, its exact username is used for correct casing. Preserves surrounding text/whitespace.
 */
export default function MentionText({ text, tagged, className }: { text: string; tagged?: Tagged[]; className?: string }) {
  if (!text) return null;
  const byHandle = new Map((tagged ?? []).filter((u) => u.username).map((u) => [u.username.toLowerCase().replace(/^@/, ""), u]));
  const parts = text.split(/(@[A-Za-z0-9_]{2,})/g);
  return (
    <p className={className}>
      {parts.map((part, i) => {
        const m = /^@([A-Za-z0-9_]{2,})$/.exec(part);
        if (m) {
          const u = byHandle.get(m[1].toLowerCase());
          const handle = u ? u.username : m[1];
          return (
            <Link key={i} href={`/u/${handle}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#4d94fa] hover:underline">
              @{handle}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
