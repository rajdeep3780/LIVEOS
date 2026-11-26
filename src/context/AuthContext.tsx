import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  setFirebaseTokenResolver,
  setInMemoryAuthToken,
} from '../services/api.ts';
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateUserProfile,
} from '../services/authService.ts';
import type { User } from '../types/lifeos.ts';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileName: (displayName: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFirebaseTokenResolver(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      return await current.getIdToken();
    });

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (fbUser) {
        try {
          setInMemoryAuthToken(null);
          const profile = await fetchCurrentUser();
          if (active) setUser(profile);
        } catch {
          if (active) setUser(null);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        // Check HttpOnly session cookie for email/password sessions
        try {
          const profile = await fetchCurrentUser();
          if (active) setUser(profile);
        } catch {
          if (active) setUser(null);
        } finally {
          if (active) setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const profile = await loginUser({ email, password });
    setUser(profile);
  }, []);

  const registerWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      const profile = await registerUser({ displayName, email, password });
      setUser(profile);
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    setInMemoryAuthToken(null);
    await signInWithPopup(auth, googleAuthProvider);
    const profile = await fetchCurrentUser();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      await logoutUser();
      setUser(null);
    }
  }, []);

  const updateProfileName = useCallback(async (displayName: string) => {
    const updated = await updateUserProfile(displayName);
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await fetchCurrentUser();
    setUser(profile);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        updateProfileName,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
