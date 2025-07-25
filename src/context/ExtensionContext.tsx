import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
  extensionStatus: string;
  extensionMessage: string;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState('disconnected');
  const [extensionMessage, setExtensionMessage] = useState('Initializing...');

  // Effect for the initial handshake
  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 20;

    const interval = setInterval(() => {
      const id = document.body.getAttribute('data-coogi-extension-id');
      if (id) {
        setIsExtensionInstalled(true);
        setExtensionId(id);
        clearInterval(interval);
        return;
      }
      
      checkCount++;
      if (checkCount >= maxChecks) {
        clearInterval(interval);
        setIsExtensionInstalled(false);
        setExtensionStatus('disconnected');
        setExtensionMessage('Extension not detected.');
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Effect for listening to status updates from the extension
  useEffect(() => {
    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { status, message } = customEvent.detail;
      setExtensionStatus(status);
      setExtensionMessage(message);

      if (status === 'error') {
        toast.error("Extension Error", {
          description: message,
          duration: 10000,
        });
      }
    };

    window.addEventListener('coogi-extension-status', handleStatusUpdate);
    return () => {
      window.removeEventListener('coogi-extension-status', handleStatusUpdate);
    };
  }, []);

  // Effect for listening to logs from the extension
  useEffect(() => {
    console.log("Coogi Web App: Attaching 'coogi-extension-log' listener.");
    const handleLog = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, args } = customEvent.detail;
      const prefix = `[Coogi Extension]`;
      switch (type) {
        case 'error':
          console.error(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'info':
          console.info(prefix, ...args);
          break;
        default:
          console.log(prefix, ...args);
      }
    };

    window.addEventListener('coogi-extension-log', handleLog);
    return () => {
      window.removeEventListener('coogi-extension-log', handleLog);
    };
  }, []);

  // Effect for sending auth token to the extension once connected
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
          console.log("Coogi Web App: Extension acknowledged token receipt.", response);
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

  const value = { isExtensionInstalled, extensionId, extensionStatus, extensionMessage };

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