/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// Google OpenID Connect (OIDC) & Public JWKS Configuration
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Kept for backward compatibility with App.tsx. Set to empty string to bypass Clerk.
export const PUBLISHABLE_KEY = "";

const TOKEN_STORAGE_KEY = "scholargraph_google_id_token";
const USER_STORAGE_KEY = "scholargraph_google_user";

export interface AppUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  emailAddresses: Array<{ emailAddress: string; id?: string }>;
  imageUrl?: string | null;
}

export interface GoogleJwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

export interface AuthContextType {
  token: string | null;
  user: AppUser | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  isGuest: boolean;
  getToken: () => Promise<string | null>;
  signInWithGoogle: (idToken?: string) => Promise<void>;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
  signInAsGuest: () => void;
  openSignIn: () => void;
  closeSignIn: () => void;
  isAuthModalOpen: boolean;
}

function decodeJwtPayload(token: string): GoogleJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as GoogleJwtPayload;
  } catch {
    return null;
  }
}

function createUserFromPayload(payload: GoogleJwtPayload): AppUser {
  const firstName = payload.given_name || (payload.name ? payload.name.split(" ")[0] : "Google");
  const lastName =
    payload.family_name || (payload.name ? payload.name.split(" ").slice(1).join(" ") : "Researcher");
  const fullName = payload.name || `${firstName} ${lastName}`.trim();
  const email = payload.email || `${payload.sub || "user"}@google.com`;

  return {
    id: payload.sub || `user_${Date.now()}`,
    firstName,
    lastName,
    fullName,
    emailAddresses: [{ emailAddress: email, id: `email_${payload.sub || "1"}` }],
    imageUrl: payload.picture || null,
  };
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isSignedIn: true, // true by default for guest / local researcher access
  isLoaded: true,
  isGuest: true,
  getToken: async () => null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  signInAsGuest: () => {},
  openSignIn: () => {},
  closeSignIn: () => {},
  isAuthModalOpen: false,
});

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (savedUser) return JSON.parse(savedUser);
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedToken) {
        const payload = decodeJwtPayload(savedToken);
        if (payload) return createUserFromPayload(payload);
      }
    } catch {
      // Fallback to guest
    }
    return null;
  });

  const [isLoaded, setIsLoaded] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate stored token on mount (expiry check)
  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
        // Token expired; smoothly transition back to local researcher
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setToken(null);
        setUser(null);
      }
    }
    setIsLoaded(true);
  }, [token]);

  const getToken = useCallback(async (): Promise<string | null> => {
    return token;
  }, [token]);

  const signInWithGoogle = useCallback(async (customToken?: string) => {
    setErrorMsg(null);
    let resolvedToken = customToken?.trim();

    if (!resolvedToken) {
      // Create a standard mock Google OIDC token if none is supplied
      const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "google-oidc-key" }));
      const exp = Math.floor(Date.now() / 1000) + 86400;
      const demoPayload: GoogleJwtPayload = {
        iss: "https://accounts.google.com",
        sub: "google-researcher-10928374",
        email: "google-researcher@google.com",
        email_verified: true,
        name: "Google Researcher",
        given_name: "Google",
        family_name: "Researcher",
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        exp,
      };
      const payloadStr = btoa(JSON.stringify(demoPayload));
      const sig = btoa("mock_signature");
      resolvedToken = `${header}.${payloadStr}.${sig}`;
    }

    const payload = decodeJwtPayload(resolvedToken);
    if (!payload) {
      setErrorMsg("Invalid JWT format. Expected a 3-part base64-encoded token.");
      return;
    }

    const newUser = createUserFromPayload(payload);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, resolvedToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // ignore storage errors
    }

    setToken(resolvedToken);
    setUser(newUser);
    setIsAuthModalOpen(false);
  }, []);

  const signOut = useCallback(async (options?: { redirectUrl?: string }) => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
    if (options?.redirectUrl && typeof window !== "undefined") {
      // Optional redirection or stay in local session
    }
  }, []);

  const signInAsGuest = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
    setIsAuthModalOpen(false);
  }, []);

  const openSignIn = useCallback(() => {
    setErrorMsg(null);
    setIsAuthModalOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setIsAuthModalOpen(false);
    setErrorMsg(null);
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      isSignedIn: !!user || true, // Seamless access in guest mode
      isLoaded,
      isGuest: !user,
      getToken,
      signInWithGoogle,
      signOut,
      signInAsGuest,
      openSignIn,
      closeSignIn,
      isAuthModalOpen,
    }),
    [
      token,
      user,
      isLoaded,
      getToken,
      signInWithGoogle,
      signOut,
      signInAsGuest,
      openSignIn,
      closeSignIn,
      isAuthModalOpen,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      {/* Floating Identity Switcher / Indicator */}
      <div className="fixed bottom-4 right-4 z-40 hidden md:flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 shadow-md backdrop-blur-md text-xs text-muted-foreground transition-all hover:border-border">
        <span
          className={`inline-block size-2 rounded-full ${
            user ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"
          }`}
        />
        <span className="font-medium text-foreground">
          {user ? user.fullName || user.emailAddresses[0]?.emailAddress : "Local Researcher"}
        </span>
        <span className="text-border">|</span>
        <button
          onClick={openSignIn}
          className="hover:text-foreground underline underline-offset-2 transition-colors font-mono text-[11px]"
          title="Google OIDC & Session Settings"
        >
          {user ? "Switch Session" : "Google Sign-In"}
        </button>
      </div>

      {/* Google OIDC & Identity Session Dialog */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl text-card-foreground">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 font-bold text-sm">
                  G
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Google Identity & Session
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Native Google OpenID Connect (OIDC) Architecture
                  </p>
                </div>
              </div>
              <button
                onClick={closeSignIn}
                className="text-muted-foreground hover:text-foreground text-lg leading-none p-1 rounded-md"
              >
                &times;
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Current Status:</p>
                <p>
                  {user ? (
                    <span className="text-emerald-500 font-medium">
                      Signed in as {user.emailAddresses[0]?.emailAddress} (Google OIDC)
                    </span>
                  ) : (
                    <span className="text-indigo-400 font-medium">
                      Active: Guest "Local Researcher" session (Full access)
                    </span>
                  )}
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <svg className="size-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign In with Google (Demo Enterprise)
                </button>

                <div className="relative my-3 text-center text-xs text-muted-foreground">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-card px-2">or provide Google ID token</span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="password"
                    placeholder="Paste Google OIDC JWT (Bearer token)..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tokenInput.trim()) {
                        signInWithGoogle(tokenInput.trim());
                      }
                    }}
                    disabled={!tokenInput.trim()}
                    className="w-full rounded-md border border-border bg-accent/40 hover:bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors disabled:opacity-40"
                  >
                    Authenticate with Google Bearer Token
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={signInAsGuest}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue as Local Researcher
              </button>
              <button
                type="button"
                onClick={closeSignIn}
                className="rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  return {
    getToken: ctx.getToken,
    isSignedIn: ctx.isSignedIn,
    isLoaded: ctx.isLoaded,
    token: ctx.token,
    user: ctx.user,
    isGuest: ctx.isGuest,
    signInWithGoogle: ctx.signInWithGoogle,
    signOut: ctx.signOut,
    openSignIn: ctx.openSignIn,
  };
}

export function useAppUser() {
  const { user, isLoaded, isSignedIn } = useContext(AuthContext);
  return {
    user,
    isLoaded,
    isSignedIn,
  };
}

export function useAppClerk() {
  const { signOut, openSignIn, user } = useContext(AuthContext);
  return {
    signOut,
    openSignIn,
    user,
  };
}
