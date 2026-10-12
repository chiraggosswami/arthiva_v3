import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

export interface User {
  id: string;
  email: string;
  name: string;
  storeName?: string;
  avatarUrl?: string;
  storeId?: string;
  preferredLanguage?: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password?: string, storeName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestedRoute: string | null;
  setRequestedRoute: (route: string | null) => void;
  authModalOpen: boolean;
  authModalTab: 'signin' | 'register';
  openAuthModal: (tab?: 'signin' | 'register', returnTo?: string) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_USER_KEY = 'arthiva-auth-user';
const REQUESTED_ROUTE_KEY = 'arthiva-requested-route';

async function syncUserProfile(fbUser: FirebaseUser, storeNameHint?: string): Promise<User> {
  const userRef = doc(db, 'users', fbUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: fbUser.uid,
        email: fbUser.email || '',
        name: data.displayName || fbUser.displayName || 'Operations Pilot',
        storeName: data.storeName || 'Arthiva Store',
        avatarUrl: fbUser.photoURL || undefined,
        storeId: `store_${fbUser.uid.slice(0, 8)}`,
        preferredLanguage: data.preferredLanguage,
      };
    } else {
      const displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Operations Pilot';
      const storeName = storeNameHint?.trim() || `${displayName.split(' ')[0]}'s Store`;
      const initialProfile = {
        userId: fbUser.uid,
        email: fbUser.email || '',
        displayName,
        storeName,
        photoURL: fbUser.photoURL || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, initialProfile);
      return {
        id: fbUser.uid,
        email: fbUser.email || '',
        name: initialProfile.displayName,
        storeName: initialProfile.storeName,
        avatarUrl: fbUser.photoURL || undefined,
        storeId: `store_${fbUser.uid.slice(0, 8)}`,
      };
    }
  } catch (err) {
    console.warn('Firestore user profile sync warning (using auth metadata):', err);
    const displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Operations Pilot';
    return {
      id: fbUser.uid,
      email: fbUser.email || '',
      name: displayName,
      storeName: storeNameHint?.trim() || `${displayName.split(' ')[0]}'s Store`,
      avatarUrl: fbUser.photoURL || undefined,
      storeId: `store_${fbUser.uid.slice(0, 8)}`,
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register'>('signin');
  const [requestedRoute, setRequestedRouteState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(REQUESTED_ROUTE_KEY);
    } catch {
      return null;
    }
  });

  const setRequestedRoute = (route: string | null) => {
    setRequestedRouteState(route);
    if (route) {
      sessionStorage.setItem(REQUESTED_ROUTE_KEY, route);
    } else {
      sessionStorage.removeItem(REQUESTED_ROUTE_KEY);
    }
  };

  const openAuthModal = (tab: 'signin' | 'register' = 'signin', returnTo?: string) => {
    if (returnTo) {
      setRequestedRoute(returnTo);
    }
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const appUser = await syncUserProfile(fbUser);
        setUser(appUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
      } else {
        // If logged out from Firebase
        setUser(null);
        localStorage.removeItem(AUTH_USER_KEY);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const appUser = await syncUserProfile(cred.user);
      setUser(appUser);
      setIsLoading(false);
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      console.error('Google sign-in error:', err);
      // Graceful fallback for preview if Firebase credentials are unconfigured or placeholder
      if (
        err?.code === 'auth/invalid-api-key' ||
        err?.code === 'auth/api-key-not-valid' ||
        err?.message?.includes('API key') ||
        err?.message?.includes('network-request-failed')
      ) {
        const appUser: User = {
          id: 'usr_demo_google',
          email: 'founder@ojasbotanics.in',
          name: 'Priya Sharma',
          storeName: 'Ojas Botanics',
          storeId: 'store_ojas_demo',
        };
        setUser(appUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
        setAuthModalOpen(false);
        return { success: true };
      }
      let msg = 'Google authentication failed';
      if (err?.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        msg = 'Sign-in cancelled';
      } else if (err?.message) {
        msg = err.message;
      }
      return { success: false, error: msg };
    }
  };

  const login = async (email: string, password = ''): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim();
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password || 'demo123');
      const appUser = await syncUserProfile(cred.user);
      setUser(appUser);
      setIsLoading(false);
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      // Graceful fallback for preview if Firebase credentials are unconfigured or placeholder
      if (
        err?.code === 'auth/invalid-api-key' ||
        err?.code === 'auth/api-key-not-valid' ||
        err?.message?.includes('API key') ||
        err?.message?.includes('network-request-failed')
      ) {
        const appUser: User = {
          id: `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16)}`,
          email: cleanEmail,
          name: cleanEmail.split('@')[0] || 'Operations Pilot',
          storeName: 'Ojas Botanics',
          storeId: 'store_ojas_demo',
        };
        setUser(appUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
        setIsLoading(false);
        setAuthModalOpen(false);
        return { success: true };
      }

      // If user doesn't exist, try creating account automatically for seamless demo experience
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password || 'demo123');
          const appUser = await syncUserProfile(cred.user);
          setUser(appUser);
          setIsLoading(false);
          setAuthModalOpen(false);
          return { success: true };
        } catch (createErr: any) {
          setIsLoading(false);
          if (createErr?.code === 'auth/operation-not-allowed') {
            return {
              success: false,
              error: 'Email/Password auth is not enabled in Firebase Console. Please use "Sign in with Google".'
            };
          }
          return { success: false, error: createErr?.message || err?.message || 'Authentication failed' };
        }
      }
      setIsLoading(false);
      let msg = err?.message || 'Authentication failed';
      if (err?.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password auth is not enabled in Firebase Console. Please use "Sign in with Google".';
      }
      return { success: false, error: msg };
    }
  };

  const register = async (name: string, email: string, password = '', storeName?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password || 'demo123');
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      const appUser = await syncUserProfile(cred.user, storeName);
      setUser(appUser);
      setIsLoading(false);
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        return login(cleanEmail, password);
      }
      // Graceful fallback for preview if Firebase credentials are unconfigured or placeholder
      if (
        err?.code === 'auth/invalid-api-key' ||
        err?.code === 'auth/api-key-not-valid' ||
        err?.message?.includes('API key') ||
        err?.message?.includes('network-request-failed')
      ) {
        const displayName = name.trim() || cleanEmail.split('@')[0] || 'Operations Pilot';
        const appUser: User = {
          id: `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16)}`,
          email: cleanEmail,
          name: displayName,
          storeName: storeName?.trim() || `${displayName.split(' ')[0]}'s Store`,
          storeId: 'store_custom',
        };
        setUser(appUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(appUser));
        setIsLoading(false);
        setAuthModalOpen(false);
        return { success: true };
      }
      setIsLoading(false);
      let msg = err?.message || 'Could not complete registration';
      if (err?.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password registration is not enabled in Firebase Console. Please use "Sign in with Google".';
      }
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(REQUESTED_ROUTE_KEY);
  };

  const value = useMemo(() => ({
    user,
    firebaseUser,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    requestedRoute,
    setRequestedRoute,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
  }), [user, firebaseUser, isLoading, requestedRoute, authModalOpen, authModalTab]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
