import { createContext, useContext, ReactNode } from "react";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";

export const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

interface AuthContextType {
  getToken: () => Promise<string | null>;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({
  getToken: async () => null,
  isSignedIn: true,
});

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/sign-in">
        {children}
      </ClerkProvider>
    );
  }

  return (
    <AuthContext.Provider value={{ getToken: async () => null, isSignedIn: true }}>
      {children}
    </AuthContext.Provider>
  );
}

function useMockAuth(): AuthContextType {
  return useContext(AuthContext);
}

function useRealClerkAuth(): AuthContextType {
  const { getToken, isSignedIn } = useClerkAuth();
  return {
    getToken,
    isSignedIn: !!isSignedIn,
  };
}

export const useAppAuth = PUBLISHABLE_KEY ? useRealClerkAuth : useMockAuth;
