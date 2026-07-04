"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const ADMIN_EMAIL = "tripp4137@gmail.com";
const NONE = "(untagged / pre-tracking)";

type Row = { source: string; users: number; proNow: number; everPro: number };
type State = "loading" | "ready" | "forbidden" | "error" | "unconfigured";

export default function AdminSignsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [scanned, setScanned] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/sign-report", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 503) return setState("unconfigured");
      if (res.status === 403) return setState("forbidden");
      if (!res.ok) return setState("error");
      const data = (await res.json()) as { rows: Row[]; scanned: number };
      setRows(data.rows ?? []);
      setScanned(data.scanned ?? 0);
      setState("ready");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
      setState("forbidden");
      return;
    }
    load();
  }, [loading, user, router, load]);

  const totals = rows.reduce(
    (a, r) => ({ users: a.users + r.users, proNow: a.proNow + r.proNow, everPro: a.everPro + r.everPro }),
    { users: 0, proNow: 0, everPro: 0 },
  );
  const conv = (p: number, u: number) => (u > 0 ? `${((p / u) * 100).toFixed(1)}%` : "—");

  return (
    <main style={{ minHeight: "100vh", background: "#0F1A13", color: "#F4F1E8", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "56px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#4FE07E", fontWeight: 700 }}>Radius · Admin</div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", margin: "6px 0 0" }}>
              Sign performance
            </h1>
            <p style={{ color: "#9fb0a2", fontSize: 15, marginTop: 6 }}>Tee-sign QR &rarr; Pro conversions, by source.</p>
          </div>
          {state === "ready" && (
            <button
              onClick={load}
              disabled={busy}
              style={{ background: "#E8B560", color: "#16221C", border: "none", borderRadius: 12, padding: "10px 18px", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>

        <div style={{ marginTop: 28 }}>
          {(state === "loading" || (loading && state !== "forbidden")) && (
            <p style={{ color: "#9fb0a2" }}>Loading…</p>
          )}

          {state === "forbidden" && (
            <div style={cardStyle}>
              <h2 style={h2Style}>Not authorized</h2>
              <p style={pStyle}>This page is restricted to the Radius admin account. You&rsquo;re signed in as {user?.email ?? "an unknown account"}.</p>
            </div>
          )}

          {state === "error" && (
            <div style={cardStyle}>
              <h2 style={h2Style}>Couldn&rsquo;t load the report</h2>
              <p style={pStyle}>Something went wrong fetching the data. Try Refresh, or check the deploy logs.</p>
              <button onClick={load} style={{ ...linkBtn }}>Try again</button>
            </div>
          )}

          {state === "unconfigured" && (
            <div style={cardStyle}>
              <h2 style={h2Style}>One-time setup needed</h2>
              <p style={pStyle}>
                The server can&rsquo;t read the totals yet because the Firebase service-account key
                isn&rsquo;t set. Add it once:
              </p>
              <ol style={{ margin: "10px 0 0 18px", color: "#c9d4cb", fontSize: 14, lineHeight: 1.6 }}>
                <li>Firebase Console &rarr; Project settings &rarr; <b>Service accounts</b> &rarr; <b>Generate new private key</b> (downloads a JSON).</li>
                <li>Vercel &rarr; radius-web &rarr; Settings &rarr; Environment Variables &rarr; add <code style={codeStyle}>FIREBASE_ADMIN_KEY</code> = the <b>entire</b> JSON file contents (Sensitive).</li>
                <li>Redeploy. Reload this page.</li>
              </ol>
            </div>
          )}

          {state === "ready" && (
            <>
              <div style={{ overflowX: "auto", border: "1px solid rgba(244,241,232,0.10)", borderRadius: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: "rgba(244,241,232,0.04)", textAlign: "left" }}>
                      <th style={thStyle}>Source</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Users</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Pro now</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Ever Pro</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Conv&nbsp;%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.source} style={{ borderTop: "1px solid rgba(244,241,232,0.07)", opacity: r.source === NONE ? 0.6 : 1 }}>
                        <td style={{ ...tdStyle, fontWeight: r.source === NONE ? 400 : 600, color: r.source === NONE ? "#9fb0a2" : "#F4F1E8" }}>{r.source}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{r.users.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#4FE07E", fontWeight: 600 }}>{r.proNow.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{r.everPro.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{r.source === NONE ? "—" : conv(r.proNow, r.users)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid rgba(244,241,232,0.16)", fontWeight: 700 }}>
                      <td style={tdStyle}>Total</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{totals.users.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#4FE07E" }}>{totals.proNow.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{totals.everPro.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{conv(totals.proNow, totals.users)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {rows.filter((r) => r.source !== NONE).length === 0 && (
                <p style={{ ...pStyle, marginTop: 16 }}>
                  No tagged sources yet — every user is in the untagged bucket. This fills in as the
                  updated apps roll out and new users install from a tagged QR.
                </p>
              )}

              <div style={{ marginTop: 20, fontSize: 13, color: "#8a958c", lineHeight: 1.7 }}>
                <p><b style={{ color: "#c9d4cb" }}>Users</b> = accounts attributed to that source · <b style={{ color: "#c9d4cb" }}>Pro now</b> = active subscription · <b style={{ color: "#c9d4cb" }}>Ever Pro</b> = ever converted.</p>
                <p>Raw <b style={{ color: "#c9d4cb" }}>scans</b> (and scans-by-city) live in Google Analytics under the <code style={codeStyle}>qr_scan</code> event.</p>
                <p>iOS QR installs bucket as <code style={codeStyle}>organic</code> (Apple can&rsquo;t pass the tag); Android carries the real source. · {scanned.toLocaleString()} user docs scanned.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = { background: "rgba(244,241,232,0.04)", border: "1px solid rgba(244,241,232,0.10)", borderRadius: 16, padding: "22px 24px" };
const h2Style: React.CSSProperties = { fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 19, margin: 0 };
const pStyle: React.CSSProperties = { color: "#c9d4cb", fontSize: 15, marginTop: 8, lineHeight: 1.6 };
const codeStyle: React.CSSProperties = { background: "rgba(79,224,126,0.12)", border: "1px solid rgba(79,224,126,0.25)", borderRadius: 5, padding: "1px 6px", fontFamily: "monospace", fontSize: 13, color: "#bfeecd" };
const linkBtn: React.CSSProperties = { marginTop: 14, background: "transparent", border: "1px solid rgba(244,241,232,0.25)", color: "#F4F1E8", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 14 };
const thStyle: React.CSSProperties = { padding: "12px 16px", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: "#9fb0a2" };
const tdStyle: React.CSSProperties = { padding: "12px 16px" };
