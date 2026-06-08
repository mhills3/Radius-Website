"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getProfileLite, type ProfileLite } from "@/lib/account";

type AuthCtx = {
  user: User | null;
  profile: ProfileLite | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        getProfileLite(u.uid).then(setProfile).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: () => fbSignOut(auth) }}>
      {children}
    </AuthContext.Provider>
  );
}
