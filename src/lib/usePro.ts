"use client";

import { useAuth } from "@/components/AuthProvider";
import { isProEntitled } from "@/lib/account";

/**
 * The single source of truth for "is this user Pro?" on the web. Reads the entitlement carried on
 * the global profile (ProfileLite) — real subscription (isPro/proExpires, mirrored by the apps) or a
 * console comp (proOverride). Gate any Pro surface with this, e.g. `const pro = usePro();`.
 */
export function usePro(): boolean {
  const { profile } = useAuth();
  return isProEntitled(profile);
}
