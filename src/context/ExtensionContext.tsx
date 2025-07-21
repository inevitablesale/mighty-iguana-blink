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

    // 1. Define the function that will handle the extension's response
    const handleExtensionReady = (event: CustomEvent) => {
      const receivedExtensionId = event.detail?.extensionId;
      if (receivedExtensionId) {
        console.log(`Coogi Web App: Handshake received from extension ID: ${receivedExtensionId}`);
        setExtensionId(receivedExtensionId);
        // Once connected, stop pinging and remove listeners
        clearInterval(pingInterval);
        clearTimeout(timeout);
        window.removeEventListener('coogi-extension-ready', listener);
      }
    };

    // 2. Add the listener for the extension's response
    const listener = (event: Event) => handleExtensionReady(event as CustomEvent);
    window.addEventListener('coogi-extension-ready', listener);
    console.log('Coogi Web App: Listening for extension handshake.');

    // 3. Ping the extension every 500ms to let it know the app is ready
    pingInterval = setInterval(() => {
      console.log('Coogi Web App: Pinging extension...');
      window.dispatchEvent(new CustomEvent('coogi-app-ready'));
    }, 500);

    // 4. Stop trying after 5 seconds if there's no response
    timeout = setTimeout(() => {
      clearInterval(pingInterval);
    }, 5000);

    // 5. Clean up everything when the component unmounts
    return () => {
      clearInterval(pingInterval);
      clearTimeout(timeout);
      window.removeEventListener('coogi-extension-ready', listener);
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