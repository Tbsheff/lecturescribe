import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotesView from "./pages/NotesView";
import HowToUse from "./pages/HowToUse";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PageEditor from "./components/notes/pageEditor";

// Lazy-loaded components
const MigrationPage = lazy(() => import("./pages/MigrationPage"));
const FolderView = lazy(() => import("./pages/FolderView"));

// Create a new query client
const queryClient = new QueryClient();

const App = () => {
  // Check if we're in Tempo environment
  const isTempo = import.meta.env.VITE_TEMPO === "true";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/notes/:noteId" element={<NotesView />} />
              <Route path="/how-to-use" element={<HowToUse />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/audio-summary" element={<Index />} />
              <Route path="/page-editor" element={<PageEditor />} />
              <Route path="/migrate"
                element={
                  <Suspense fallback={<div>Loading...</div>}>
                    <MigrationPage />
                  </Suspense>
                }
              />
              <Route
                path="/folders"
                element={
                  <Suspense fallback={<div>Loading...</div>}>
                    <FolderView />
                  </Suspense>
                }
              />
              {/* Add this before the catchall route */}
              {isTempo && <Route path="/tempobook/*" element={<></>} />}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
