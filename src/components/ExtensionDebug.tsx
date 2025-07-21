import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useExtension } from '@/context/ExtensionContext';
import { Badge } from '@/components/ui/badge';

export const ExtensionDebug = () => {
  const { isExtensionInstalled, extensionId } = useExtension();
  const [isListenerActive, setIsListenerActive] = useState(false);

  useEffect(() => {
    const checkListener = () => {
      setIsListenerActive(true); 
    };
    const timer = setTimeout(checkListener, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleManualPing = () => {
    console.log('%cManually dispatching coogi-app-ready event...', 'color: #ff9900; font-weight: bold;');
    window.dispatchEvent(new CustomEvent('coogi-app-ready'));
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card border p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <h4 className="font-bold text-lg mb-2">Extension Debugger</h4>
      <div className="space-y-2 text-sm">
        <div>
          Listener Status: {isListenerActive ? 
            <Badge variant="secondary" className="bg-green-600 text-white">Active</Badge> : 
            <Badge variant="destructive">Inactive</Badge>
          }
        </div>
        <div>
          Extension Connection: {isExtensionInstalled ? (
            <Badge variant="secondary" className="bg-green-600 text-white">Connected</Badge>
          ) : (
            <Badge variant="destructive">Not Connected</Badge>
          )}
        </div>
        {isExtensionInstalled && (
          <p className="text-xs text-muted-foreground break-all">ID: {extensionId}</p>
        )}
      </div>
      <Button onClick={handleManualPing} size="sm" className="mt-4">
        Manual Ping
      </Button>
      <p className="text-xs text-muted-foreground mt-1">
        Click to manually send a ping to the extension.
      </p>
    </div>
  );
};