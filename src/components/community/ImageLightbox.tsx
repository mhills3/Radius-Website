"use client";

import { useEffect } from "react";

/** Click-to-enlarge for post photos: image pops above the page, any click or Escape dismisses. */
export default function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[120] grid cursor-zoom-out place-items-center bg-black/85 p-6 backdrop-blur-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-[88vh] max-w-[min(92vw,1100px)] rounded-2xl object-contain shadow-2xl" />
    </div>
  );
}
