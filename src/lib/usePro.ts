"use client";

import { useAuth } from "@/components/AuthProvider";
import { isProEntitled } from "@/lib/account";

/**
 * KILL SWITCH. Keep this false until the iOS + Android apps are confirmed mirroring the real
 * subscription (isPro/proExpires) to each user's Firestore doc. While false, usePro() returns true
 * for everyone so NOTHING is gated — this prevents locking real paying subscribers (whose entitlement
 * the web can't see yet) out of features that used to be free on the web. Flip to true once the apps
 * ship the mirror, and desktop gating goes live everywhere usePro() is used.
 */
export const PRO_GATING_ENABLED = false;

/**
 * The single source of truth for "is this user Pro?" on the web. Reads the entitlement carried on
 * the global profile (ProfileLite) — real subscription (isPro/proExpires, mirrored by the apps) or a
 * console comp (proOverride). Gate any Pro surface with this, e.g. `const pro = usePro();`.
 */
export function usePro(): boolean {
  const { profile } = useAuth();
  if (!PRO_GATING_ENABLED) return true; // gating disabled → treat everyone as Pro (nothing locked)
  return isProEntitled(profile);
}
