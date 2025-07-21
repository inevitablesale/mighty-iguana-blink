import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);

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
  }, [isExtensionInstalled]);

  const value = {
    isExtensionInstalled,
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