import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isExtensionReady } from '@/lib/extension-listener';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(isExtensionReady());
  const [extensionId, setExtensionId] = useState<string | null>(() => {
    // Attempt to get the ID immediately on component initialization
    return document.body.getAttribute('data-coogi-extension-id');
  });

  useEffect(() => {
    // This effect handles the case where the extension loads after the initial check.
    if (isExtensionInstalled && extensionId) {
      return;
    }

    const handleExtensionReady = () => {
      console.log("Coogi App: Context listener caught 'coogi-extension-ready'.");
      const id = document.body.getAttribute('data-coogi-extension-id');
      if (id) {
        setIsExtensionInstalled(true);
        setExtensionId(id);
      } else {
        console.error("Coogi App: Extension ready event fired, but ID not found in DOM.");
      }
    };

    // If the ID wasn't available on init, listen for the event
    window.addEventListener('coogi-extension-ready', handleExtensionReady, { once: true });

    return () => {
      window.removeEventListener('coogi-extension-ready', handleExtensionReady);
    };
  }, [isExtensionInstalled, extensionId]);

  // This effect sends the auth token once the extensionId is known
  useEffect(() => {
    const sendAuthToExtension = (session: any) => {
      if (!session || !extensionId) return;
      
      console.log(`Coogi Web App: Sending auth token to extension ID: ${extensionId}.`);
      chrome.runtime.sendMessage(extensionId, {
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

    if (extensionId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) sendAuthToExtension(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') sendAuthToExtension(session);
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