import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/providers/theme-provider";
import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotesView from "./pages/NotesView";
import HowToUse from "./pages/HowToUse";
import Settings from "./pages/Settings";
import EditorPage from "./pages/EditorPage";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/admin";

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
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<AdminPanelLayout><Auth /></AdminPanelLayout>} />
                <Route path="/" element={<AdminPanelLayout><Index /></AdminPanelLayout>} />
                <Route path="/notes/:noteId" element={<AdminPanelLayout><NotesView /></AdminPanelLayout>} />
                <Route path="/how-to-use" element={<AdminPanelLayout><HowToUse /></AdminPanelLayout>} />
                <Route path="/settings" element={<AdminPanelLayout><Settings /></AdminPanelLayout>} />
                <Route path="/audio-summary" element={<AdminPanelLayout><Index /></AdminPanelLayout>} />
                <Route path="/editor" element={<AdminPanelLayout><EditorPage /></AdminPanelLayout>} />
                <Route path="/admin" element={<AdminPanelLayout><AdminPage /></AdminPanelLayout>} />
                <Route
                  path="/migrate"
                  element={
                    <AdminPanelLayout>
                      <Suspense fallback={<div>Loading...</div>}>
                        <MigrationPage />
                      </Suspense>
                    </AdminPanelLayout>
                  }
                />
                <Route
                  path="/folders"
                  element={
                    <AdminPanelLayout>
                      <Suspense fallback={<div>Loading...</div>}>
                        <FolderView />
                      </Suspense>
                    </AdminPanelLayout>
                  }
                />
                {/* Add this before the catchall route */}
                {isTempo && <Route path="/tempobook/*" element={<></>} />}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
