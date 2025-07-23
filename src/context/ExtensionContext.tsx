import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionStatus {
  status: 'idle' | 'active' | 'cooldown' | 'error' | 'disconnected';
  message: string;
}

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
  extensionStatus: ExtensionStatus | null;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);

  // Effect for the initial handshake
  useEffect(() => {
    const handleExtensionReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ extensionId: string }>;
      const id = customEvent.detail?.extensionId;
      if (id) {
        console.log(`Coogi Web App: Handshake successful! Extension ID: ${id}`);
        setIsExtensionInstalled(true);
        setExtensionId(id);
      }
    };

    // Listen for the one-time handshake event from the extension.
    window.addEventListener('coogi-extension-ready', handleExtensionReady, { once: true });

    // Set a timeout to determine if the extension is not installed.
    const timeoutId = setTimeout(() => {
      if (!extensionId) { // Check against state which is updated in handleExtensionReady
        console.log("Coogi Web App: Handshake timeout. Extension not detected.");
        setIsExtensionInstalled(false);
      }
    }, 2000); // 2-second timeout

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('coogi-extension-ready', handleExtensionReady);
    };
  }, [extensionId]); // Dependency on extensionId ensures we don't run timeout logic unnecessarily

  // Effect for listening to status updates from the extension
  useEffect(() => {
    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ExtensionStatus>;
      setExtensionStatus(customEvent.detail);
    };
    window.addEventListener('coogi-extension-status', handleStatusUpdate);
    return () => window.removeEventListener('coogi-extension-status', handleStatusUpdate);
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

  const value = { isExtensionInstalled, extensionId, extensionStatus };

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