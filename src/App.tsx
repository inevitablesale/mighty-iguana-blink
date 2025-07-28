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
import ContractFinder from "./pages/ContractFinder";
import Campaigns from "./pages/Campaigns";
import Opportunities from "./pages/Opportunities";
import CommunityBounties from "./pages/CommunityBounties";
import Deal from "./pages/Deal";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

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
    return <div className="coogi-gradient-bg min-h-screen" />;
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
                <Route index element={<ContractFinder />} />
                <Route path="c/:conversationId" element={<ContractFinder />} />
                <Route path="community-bounties" element={<CommunityBounties />} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="opportunities" element={<Opportunities />} />
                <Route path="deal/:opportunityId" element={<Deal />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ExtensionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;