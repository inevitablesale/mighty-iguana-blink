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

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const sendTokenToExtension = (session: Session | null) => {
    const extensionId = localStorage.getItem('coogiExtensionId');

    if (!extensionId) {
      console.warn("Coogi Chrome Extension ID not found. Please set it on the Profile page.");
      return;
    }

    if (chrome.runtime && session) {
      console.log(`Attempting to connect to Chrome Extension with ID: ${extensionId}`);
      chrome.runtime.sendMessage(
        extensionId,
        {
          type: "SET_TOKEN",
          token: session.access_token,
          userId: session.user.id,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              `%c❌ Failed to connect to the Chrome Extension.`,
              "color: #ef4444; font-size: 14px; font-weight: bold;",
              `\nError: ${chrome.runtime.lastError.message}`,
              `\n\nTroubleshooting:`,
              `\n1. Verify the Extension ID on your Profile page is correct.`,
              `\n2. Ensure your extension's manifest.json allows connection from this app's URL.`,
              `\n3. Reload the extension from chrome://extensions after any changes.`
            );
          } else {
            console.log(
              "%c✅ Successfully connected to the Coogi Chrome Extension!",
              "color: #22c55e; font-size: 14px; font-weight: bold;"
            );
            if (response) {
              console.log("Received response from extension:", response);
            }
          }
        }
      );
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