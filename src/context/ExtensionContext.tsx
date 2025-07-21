import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);

  // This effect handles the initial handshake to detect the extension
  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    const handleExtensionReady = () => {
      console.log('%cCoogi Web App: Handshake SUCCESS! Extension is ready.', 'color: #00ff00; font-weight: bold;');
      setIsExtensionInstalled(true);
      clearInterval(pingInterval);
      clearTimeout(timeout);
      window.removeEventListener('coogi-extension-ready', listener);
    };

    const listener = () => handleExtensionReady();
    window.addEventListener('coogi-extension-ready', listener);
    console.log('Coogi Web App: Listening for extension handshake.');

    pingInterval = setInterval(() => {
      window.dispatchEvent(new CustomEvent('coogi-app-ready'));
    }, 1000);

    timeout = setTimeout(() => {
      clearInterval(pingInterval);
      if (!isExtensionInstalled) {
        console.log('Coogi Web App: Ping timeout. No response from extension.');
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(timeout);
      window.removeEventListener('coogi-extension-ready', listener);
    };
  }, []); // Run only once on mount

  // This effect sends the auth token when the extension is ready and user is logged in
  useEffect(() => {
    const sendAuthToExtension = (session: any) => {
      if (!session) return;
      console.log("Coogi Web App: Sending auth token to extension.");
      chrome.runtime.sendMessage({
        type: "SET_TOKEN",
        token: session.access_token,
        userId: session.user.id,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Coogi Web App: Error sending token:", chrome.runtime.lastError.message);
          toast.error("Could not connect to extension's authenticated session.");
        } else {
          console.log("Coogi Web App: Extension confirmed token receipt.", response);
          toast.success("Extension connected to your session.");
        }
      });
    };

    if (isExtensionInstalled) {
      // Send token immediately if session already exists
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          sendAuthToExtension(session);
        }
      });

      // And listen for future sign-ins
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') {
          sendAuthToExtension(session);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
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