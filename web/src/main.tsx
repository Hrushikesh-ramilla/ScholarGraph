import "./index.css";
import App from "./App.tsx";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { BrowserRouter } from "react-router-dom";
import { AppAuthProvider } from "@/lib/auth";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AppAuthProvider>
      <NuqsAdapter>
        <App />
        <Toaster />
      </NuqsAdapter>
    </AppAuthProvider>
  </BrowserRouter>,
);
