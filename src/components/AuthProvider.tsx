"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getProfileLite, type ProfileLite } from "@/lib/account";

type AuthCtx = {
  user: User | null;
  profile: ProfileLite | null;
  loading: boolean;         // auth state resolving
  profileLoading: boolean;  // profile doc still fetching (separate async step after auth resolves)
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  // The profile doc loads AFTER auth resolves. Guards that key off profile (e.g. staff) must wait for
  // this too — otherwise there's a window where loading===false but profile===null, which reads as
  // "not staff" and wrongly flashes the gate / redirects.
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setProfileLoading(true);
        getProfileLite(u.uid).then(setProfile).catch(() => setProfile(null)).finally(() => setProfileLoading(false));
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, signOut: () => fbSignOut(auth) }}>
      {children}
    </AuthContext.Provider>
  );
}
