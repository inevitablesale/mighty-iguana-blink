import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [extensionId, setExtensionId] = useState<string | null>(null);

  // Effect for the initial handshake
  useEffect(() => {
    console.log("Coogi Web App: Starting check for extension flag...");
    let checkCount = 0;
    const maxChecks = 20; // 20 checks over 2 seconds

    const interval = setInterval(() => {
      const id = document.body.getAttribute('data-coogi-extension-id');
      if (id) {
        console.log(`Coogi Web App: Extension detected! ID: ${id}`);
        setIsExtensionInstalled(true);
        setExtensionId(id);
        clearInterval(interval);
        return;
      }
      
      checkCount++;
      if (checkCount >= maxChecks) {
        clearInterval(interval);
        console.log("Coogi Web App: Check finished. Extension not detected.");
        setIsExtensionInstalled(false);
      }
    }, 100); // Check every 100ms

    return () => clearInterval(interval);
  }, []);

  // Effect for sending auth token to the extension once connected
  useEffect(() => {
    const sendAuthToExtension = (session: any) => {
      if (!session || !extensionId) return;
      
      console.log("Coogi Web App: Sending auth token to extension.");
      chrome.runtime.sendMessage(extensionId, {
        type: "SET_TOKEN",
        token: session.access_token,
        userId: session.user.id,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Coogi Web App: Error sending token:", chrome.runtime.lastError.message);
          toast.error("Could not connect to extension. Please reload the page.");
        } else {
          console.log("Coogi Web App: Extension acknowledged token receipt.", response);
          toast.success("Extension connected to your session.");
        }
      });
    };

    if (extensionId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) sendAuthToExtension(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
          sendAuthToExtension(session);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [extensionId]);

  const value = { isExtensionInstalled, extensionId };

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