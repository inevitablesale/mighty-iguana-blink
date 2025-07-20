import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Opportunities from "./pages/Opportunities";
import Campaigns from "./pages/Campaigns";
import Agents from "./pages/Agents";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Placements from "./pages/Placements";
import Proposals from "./pages/Proposals";

const queryClient = new QueryClient();

const EXTENSION_ID = "ciipcogdfckdandnbekcngfigogpmomo";

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const sendTokenToExtension = (session: Session | null) => {
    if (chrome.runtime && EXTENSION_ID) {
      if (session) {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          {
            type: "SET_TOKEN",
            token: session.access_token,
            userId: session.user.id,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "Could not connect to the extension. Ensure it's installed, enabled, and the app's URL is in manifest.json.",
                chrome.runtime.lastError.message
              );
            } else if (response?.success) {
              console.log(
                "%c✅ Successfully connected to the Coogi Chrome Extension!",
                "color: #22c55e; font-size: 14px; font-weight: bold;"
              );
            } else {
              console.warn("Extension responded with an error:", response?.message);
            }
          }
        );
      }
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      sendTokenToExtension(session);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      sendTokenToExtension(session);
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
              <Route path="opportunities" element={<Opportunities />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="agents" element={<Agents />} />
              <Route path="profile" element={<Profile />} />
              <Route path="placements" element={<Placements />} />
              <Route path="proposals" element={<Proposals />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;