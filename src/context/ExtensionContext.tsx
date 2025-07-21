import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [extensionId, setExtensionId] = useState<string | null>(null);

  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    const handleExtensionReady = (event: CustomEvent) => {
      const receivedExtensionId = event.detail?.extensionId;
      if (receivedExtensionId) {
        console.log(`%cCoogi Web App: Handshake SUCCESS! Received ID: ${receivedExtensionId}`, 'color: #00ff00; font-weight: bold;');
        setExtensionId(receivedExtensionId);
        clearInterval(pingInterval);
        clearTimeout(timeout);
        window.removeEventListener('coogi-extension-ready', listener);
      }
    };

    const listener = (event: Event) => handleExtensionReady(event as CustomEvent);
    window.addEventListener('coogi-extension-ready', listener);
    console.log('Coogi Web App: Listening for extension handshake.');

    console.log('Coogi Web App: Setting up ping interval...');
    pingInterval = setInterval(() => {
      console.log('Coogi Web App: Pinging extension with coogi-app-ready event.');
      window.dispatchEvent(new CustomEvent('coogi-app-ready'));
    }, 1000); // Increased interval to 1s to reduce log spam

    timeout = setTimeout(() => {
      clearInterval(pingInterval);
      console.log('Coogi Web App: Ping timeout. No response from extension.');
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(timeout);
      window.removeEventListener('coogi-extension-ready', listener);
      console.log('Coogi Web App: Cleaned up extension listeners and timers.');
    };
  }, []);

  const value = {
    isExtensionInstalled: !!extensionId,
    extensionId,
  };

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