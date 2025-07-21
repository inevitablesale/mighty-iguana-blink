import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);

  useEffect(() => {
    let pingInterval: number;
    let timeoutId: number;

    const handleExtensionReady = () => {
      console.log('%cCoogi Web App: Handshake SUCCESS! Extension is ready.', 'color: #00ff00; font-weight: bold;');
      cleanup();
      setIsExtensionInstalled(true);
    };

    const cleanup = () => {
      clearInterval(pingInterval);
      clearTimeout(timeoutId);
      window.removeEventListener('coogi-extension-ready', handleExtensionReady);
    };

    // Listen for the extension's response
    window.addEventListener('coogi-extension-ready', handleExtensionReady, { once: true });

    // Start pinging the extension
    pingInterval = window.setInterval(() => {
      console.log("Coogi Web App: Pinging extension with 'coogi-app-ready'...");
      window.dispatchEvent(new CustomEvent('coogi-app-ready'));
    }, 500);

    // Stop trying after 3 seconds
    timeoutId = window.setTimeout(() => {
      if (!isExtensionInstalled) {
        console.log("Coogi Web App: Handshake timeout. Extension not detected.");
        cleanup();
        setIsExtensionInstalled(false);
      }
    }, 3000);

    return cleanup;
  }, [isExtensionInstalled]); // Re-run if state changes, though it shouldn't

  // This effect sends the auth token when the extension is ready and user is logged in
  useEffect(() => {
    const sendAuthToExtension = (session: any) => {
      if (!session || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
      
      console.log("Coogi Web App: Sending auth token to extension.");
      chrome.runtime.sendMessage({
        type: "SET_TOKEN",
        token: session.access_token,
        userId: session.user.id,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Coogi Web App: Error sending token:", chrome.runtime.lastError.message);
        } else {
          console.log("Coogi Web App: Extension confirmed token receipt.", response);
          toast.success("Extension connected to your session.");
        }
      });
    };

    if (isExtensionInstalled) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) sendAuthToExtension(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') sendAuthToExtension(session);
      });

      return () => subscription.unsubscribe();
    }
  }, [isExtensionInstalled]);

  const value = { isExtensionInstalled };

  return (
    <ExtensionContext.Provider value={value}>
      {children}
    </ExtensionContext.Provider>
  );
};

export const useExtension = () => {
  const context = useContext(ExtensionContext);
  if (context === undefined) {
    throw new Error('useExtension must be used within an ExtensionProvider');
  }
  return context;
};