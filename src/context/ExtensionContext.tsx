import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isExtensionReady } from '@/lib/extension-listener';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  // Initialize state by immediately checking if the early listener already caught the event.
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(isExtensionReady());

  useEffect(() => {
    // This effect handles the unlikely case where the extension might load *after* the initial check.
    // If it's already installed, we don't need this listener.
    if (isExtensionInstalled) {
      return;
    }

    const handleLateExtensionReady = () => {
      console.log("Coogi App: Late listener caught 'coogi-extension-ready'.");
      setIsExtensionInstalled(true);
    };

    window.addEventListener('coogi-extension-ready', handleLateExtensionReady, { once: true });

    return () => {
      window.removeEventListener('coogi-extension-ready', handleLateExtensionReady);
    };
  }, [isExtensionInstalled]);

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
      console.log("Coogi Web App: Extension is installed, attempting to send token.");
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          sendAuthToExtension(session);
        } else {
          console.log("Coogi Web App: No active session to send to extension.");
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') {
          sendAuthToExtension(session);
        }
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