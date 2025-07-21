import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExtensionContextType {
  isExtensionInstalled: boolean;
  extensionId: string | null;
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined);

export const ExtensionProvider = ({ children }: { children: ReactNode }) => {
  const [extensionId, setExtensionId] = useState<string | null>(null);

  useEffect(() => {
    const handleExtensionReady = (event: CustomEvent) => {
      const receivedExtensionId = event.detail?.extensionId;
      if (receivedExtensionId) {
        console.log(`Coogi Web App: Handshake received from extension ID: ${receivedExtensionId}`);
        setExtensionId(receivedExtensionId);
        // You could potentially show a toast here to confirm connection
        // import { toast } from "sonner";
        // toast.success("Coogi extension connected!");
      }
    };

    const listener = (event: Event) => handleExtensionReady(event as CustomEvent);

    window.addEventListener('coogi-extension-ready', listener);
    console.log('Coogi Web App: Listening for extension handshake.');

    // Clean up the listener when the component unmounts
    return () => {
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