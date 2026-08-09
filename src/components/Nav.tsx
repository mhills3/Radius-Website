"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";
import NotificationBell from "@/components/NotificationBell";

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/courses", label: "Courses" },
  { href: "/community", label: "Community" },
  { href: "/subscription", label: "Subscription" },
];

function AppleIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13ZM14.6 4.59c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45Z" /></svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.6 2.4 13 12 3.6 21.6c-.3-.2-.5-.6-.5-1V3.4c0-.4.2-.8.5-1ZM14.2 13.2l2.6 2.6-9.7 5.5 7.1-8.1ZM17.9 9.4l2.7 1.5c.6.4.6 1.3 0 1.7l-2.8 1.6-2.8-2.8 2.9-2ZM7.1 2.4l9.7 5.5-2.6 2.6L7.1 2.4Z" /></svg>;
}

export default function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { user, profile, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [appMenu, setAppMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const hidden = pathname === "/login";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setAppMenu(false);
    setUserMenu(false);
  }, [pathname]);

  // marketing pages with a dark photo/illustration hero — nav overlays the hero. While still at the
  // very top it's FULLY transparent (cream logo/text sit right on the photo); once you scroll it
  // settles into the cream frosted bar. Transparent-at-top is truly transparent (no white tint), so
  // there's no first-paint "whiteout" — that earlier bug came from a translucent-white at-top bg.
  const darkHeroPage = isHome || pathname === "/features" || pathname === "/story" || pathname === "/creators" || pathname === "/subscription";
  // Courses index + individual course pages are dark with a photo hero: the nav overlays the hero and
  // settles into a DARK frosted bar on scroll (unlike marketing pages, which settle into the cream bar).
  // The state/city/mine/new course sub-pages are still light, so they keep the default nav.
  const coursesHero = pathname === "/courses" || (pathname.startsWith("/courses/") && !/^\/courses\/(state|city|mine|new)(\/|$)/.test(pathname));
  const darkPage = pathname === "/dashboard" || pathname === "/bag" || pathname === "/notifications" || pathname === "/community" || pathname === "/courses/mine" || pathname === "/courses/new" || pathname.startsWith("/u/") || pathname.startsWith("/leagues"); // app surfaces are dark
  const atHeroTop = (darkHeroPage || coursesHero) && !scrolled;
  const onDark = darkPage || coursesHero || atHeroTop; // cream text/logo when over the dark hero photo or on dark app surfaces
  const onDarkSettle = darkPage || (coursesHero && scrolled); // dark frosted bar

  const wrap = darkHeroPage || coursesHero ? "fixed" : "sticky"; // dark-hero pages overlay the nav so it sits ON the hero
  const shell = onDarkSettle
    ? "border-b border-[rgba(244,241,232,0.08)] bg-[rgba(20,27,22,0.88)] backdrop-blur-[14px]"
    : atHeroTop
    ? "bg-transparent"
    : "border-b border-black/[0.06] bg-[#faf8f3]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#faf8f3]/70";
  const shadow = scrolled ? (onDarkSettle ? "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]" : "shadow-[0_8px_30px_-14px_rgba(0,0,0,0.18)]") : "";

  const logoColor = onDark ? "text-[var(--cream)]" : "text-[#16221b]";

  // Active-aware nav pill styling — premium "you are here" indicator.
  const navPill = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/")) || (href === "/leagues" && pathname.startsWith("/leagues"));
    if (darkPage) {
      // Reference topbar: 13.5px links, cream-60, active = cream with a 2px gold underline on the bar edge.
      const base = "relative px-3.5 py-2 font-[family-name:var(--font-heading)] text-[13.5px] font-semibold transition-colors";
      return `${base} ${active
        ? "text-[var(--cream)] after:absolute after:inset-x-3.5 after:top-[calc(100%+14px)] after:h-[2px] after:bg-[#E8B560] after:content-['']"
        : "text-[rgba(244,241,232,0.60)] hover:text-[var(--cream)]"}`;
    }
    const base = "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors";
    if (onDark) return `${base} ${active ? "bg-white/[0.12] text-[var(--cream)]" : "text-[rgba(245,237,225,0.72)] hover:bg-white/[0.06] hover:text-white"}`;
    return `${base} ${active ? "bg-[#16221b]/[0.08] text-[#16221b]" : "text-[#3c4a42] hover:bg-black/[0.05] hover:text-[#16221b]"}`;
  };

  // Logged in: Dashboard + My Bag lead (your stuff), then explore. No Subscription/Learn.
  const links = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/bag", label: "My Bag" },
        { href: "/leagues", label: "Events" },
        { href: "/community", label: "Community" },
        { href: "/courses", label: "Courses" },
      ]
    : NAV_LINKS;

  if (hidden) return null;

  return (
    <nav className={`${wrap} inset-x-0 top-0 z-50 ${shell} ${shadow} transition-all duration-300`}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        <Link href="/" aria-label="Radius home" className="flex items-center transition-opacity hover:opacity-80">
          <Logo className={`h-8 w-[114px] ${logoColor}`} />
        </Link>

        {/* ---- Desktop ---- */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${navPill(l.href)} ${l.href === "/leagues" ? "inline-flex items-center gap-1.5" : ""}`}>
              {l.label}
              {l.href === "/leagues" && <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#141B16]">Beta</span>}
            </Link>
          ))}
          {user ? (
            <div className="ml-2 flex items-center gap-1">
            <NotificationBell onDark={onDark} />
            <div className="relative">
              <button onClick={() => setUserMenu((v) => !v)} className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors ${onDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"} ${userMenu ? (onDark ? "bg-white/[0.06]" : "bg-black/[0.04]") : ""}`} aria-haspopup="true" aria-expanded={userMenu}>
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-2 ring-[var(--gold)]/40">
                  {profile?.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
                  ) : (
                    (profile?.name || user.email || "?").charAt(0).toUpperCase()
                  )}
                </span>
                <svg className={`h-3.5 w-3.5 transition-transform ${userMenu ? "rotate-180" : ""} ${onDark ? "text-[var(--sage)]" : "text-[#6b7a70]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-deep)] text-sm font-bold text-[var(--cream)]">
                        {profile?.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
                        ) : ((profile?.name || "?").charAt(0).toUpperCase())}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[var(--cream)]">{profile?.name || "Your account"}</div>
                        {profile?.username && <div className="truncate text-xs text-[var(--sage-dim)]">@{profile.username}</div>}
                      </div>
                    </div>
                    <Link href="/dashboard" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>Dashboard</Link>
                    <Link href="/bag" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 7V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2M4 7h16l-1 14H5L4 7z" /></svg>My Bag</Link>
                    {profile?.writer && (
                      <Link href="/stories/mine" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--gold)] transition-colors hover:bg-white/[0.05]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>Write a story</Link>
                    )}
                    <button onClick={() => { signOut(); setUserMenu(false); }} className="flex w-full items-center gap-2.5 border-t border-white/[0.07] px-4 py-3 text-left text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>Sign out</button>
                  </div>
                </>
              )}
            </div>
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link href="/login" className={navPill("/login")}>Log in</Link>
              <div className="relative">
                <button
                  onClick={() => setAppMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-5 py-2.5 text-xs font-bold tracking-wide text-[#16221b] shadow-[0_4px_14px_-4px_rgba(246,193,101,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"
                  aria-expanded={appMenu}
                  aria-haspopup="true"
                >
                  Join Free
                  <svg className={`h-3.5 w-3.5 transition-transform ${appMenu ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {appMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAppMenu(false)} />
                    <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]">
                      <a href={APP_STORE} target="_blank" rel="noopener" className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-[#16221b] transition-colors hover:bg-black/[0.04]"><AppleIcon /> App Store</a>
                      <a href={GOOGLE_PLAY} target="_blank" rel="noopener" className="flex items-center gap-3 border-t border-black/5 px-4 py-3.5 text-sm font-semibold text-[#16221b] transition-colors hover:bg-black/[0.04]"><PlayIcon /> Google Play</a>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- Mobile hamburger ---- */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className={`md:hidden ${onDark ? "text-[var(--cream)]" : "text-[#16221b]"}`}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
          </svg>
        </button>
      </div>

      {/* ---- Mobile menu panel ---- */}
      {mobileOpen && (
        <div className="md:hidden">
          <div className="fixed inset-0 top-[72px] z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 top-full z-50 border-b border-black/10 bg-[#faf8f3] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]">
            <div className="mx-auto max-w-7xl px-6 py-4">
              <div className="flex flex-col">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 border-b border-black/5 py-3.5 text-base font-semibold text-[#16221b]"
                  >
                    {l.label}
                    {l.href === "/leagues" && <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#141B16]">Beta</span>}
                  </Link>
                ))}
                {/* Login is desktop-only — no Log in entry in the mobile menu. */}
              </div>
              {user ? (
                <button onClick={() => { signOut(); setMobileOpen(false); }} className="mt-4 w-full rounded-full bg-[var(--gold)] py-3 text-sm font-bold text-[#16221b]">
                  Sign out
                </button>
              ) : (
                <div className="mt-4 flex flex-col gap-3 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a7a3a]">Get the app</span>
                  <div className="flex gap-3">
                    <a href={APP_STORE} target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-[#16221b]"><AppleIcon /> App Store</a>
                    <a href={GOOGLE_PLAY} target="_blank" rel="noopener" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-[#16221b]"><PlayIcon /> Google Play</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
