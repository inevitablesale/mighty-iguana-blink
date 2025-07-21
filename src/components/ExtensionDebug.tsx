import React from 'react';
import { Button } from '@/components/ui/button';
import { useExtension } from '@/context/ExtensionContext';

export const ExtensionDebug = () => {
  const { isExtensionInstalled, extensionId } = useExtension();

  const handleManualHandshake = () => {
    const fakeExtensionId = 'manual-debug-id-12345';
    console.log('Manually dispatching coogi-extension-ready event...');
    const event = new CustomEvent('coogi-extension-ready', {
      detail: { extensionId: fakeExtensionId },
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card border p-4 rounded-lg shadow-lg z-50">
      <h4 className="font-bold text-lg mb-2">Extension Debugger</h4>
      <p className="text-sm mb-2">
        Status: {isExtensionInstalled ? (
          <span className="text-green-600 font-semibold">Connected</span>
        ) : (
          <span className="text-red-600 font-semibold">Not Connected</span>
        )}
      </p>
      {isExtensionInstalled && (
        <p className="text-xs text-muted-foreground mb-2">ID: {extensionId}</p>
      )}
      <Button onClick={handleManualHandshake} size="sm">
        Fake Handshake
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Click to simulate a handshake from the extension.
      </p>
    </div>
  );
};