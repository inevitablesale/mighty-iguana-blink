import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ExtensionProvider } from "./context/ExtensionContext";

import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Leads from "./pages/Leads";
import Campaigns from "./pages/Campaigns";
import Playbooks from "./pages/Playbooks";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Placements from "./pages/Placements";
import Proposals from "./pages/Proposals";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    getSession();

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ExtensionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
              <Route 
                path="/" 
                element={session ? <AppLayout /> : <Navigate to="/login" />}
              >
                <Route index element={<Index />} />
                <Route path="leads" element={<Leads />} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="playbooks" element={<Playbooks />} />
                <Route path="profile" element={<Profile />} />
                <Route path="placements" element={<Placements />} />
                <Route path="proposals" element={<Proposals />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ExtensionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;