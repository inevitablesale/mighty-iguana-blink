import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isExtensionReady } from '@/lib/extension-listener';

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
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(isExtensionReady());
  const [extensionId, setExtensionId] = useState<string | null>(() => {
    return document.body.getAttribute('data-coogi-extension-id');
  });
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);

  useEffect(() => {
    const handleExtensionReady = () => {
      const id = document.body.getAttribute('data-coogi-extension-id');
      if (id) {
        setIsExtensionInstalled(true);
        setExtensionId(id);
      }
    };
    
    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ExtensionStatus>;
      setExtensionStatus(customEvent.detail);
    };

    window.addEventListener('coogi-extension-ready', handleExtensionReady, { once: true });
    window.addEventListener('coogi-extension-status', handleStatusUpdate);

    // Ping the extension to get its initial status
    if (isExtensionInstalled) {
       window.dispatchEvent(new CustomEvent('coogi-app-get-status'));
    }


    return () => {
      window.removeEventListener('coogi-extension-ready', handleExtensionReady);
      window.removeEventListener('coogi-extension-status', handleStatusUpdate);
    };
  }, [isExtensionInstalled]);

  useEffect(() => {
    const sendAuthToExtension = (session: any) => {
      if (!session || !extensionId) return;
      
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