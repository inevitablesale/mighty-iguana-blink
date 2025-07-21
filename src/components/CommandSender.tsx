/// <reference types="chrome" />
import React from 'react';
import { Button } from '@/components/ui/button';
import { useExtension } from '@/context/ExtensionContext';
import { toast } from 'sonner';

export const CommandSender = () => {
  const { isExtensionInstalled, extensionId } = useExtension();

  const handleSendCommand = () => {
    if (!isExtensionInstalled || !extensionId) {
      toast.error("Extension is not connected. Cannot send command.");
      return;
    }

    const message = {
      command: "TEST_COMMAND",
      data: { text: "Hello from the web app!" },
    };

    console.log("Coogi Web App: Sending command to extension...", { message });
    toast.info("Sending test command to extension...");

    chrome.runtime.sendMessage(extensionId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Coogi Web App: Error sending message:", chrome.runtime.lastError.message);
        toast.error(`Error sending message: ${chrome.runtime.lastError.message}`);
      } else {
        console.log("Coogi Web App: Message sent successfully, response:", response);
        toast.success("Extension received the command!");
      }
    });
  };

  return (
    <div className="p-4 border-t">
      <h3 className="font-bold mb-2">Extension Command Test</h3>
      <Button onClick={handleSendCommand} disabled={!isExtensionInstalled}>
        Send Test Command
      </Button>
      {!isExtensionInstalled && <p className="text-xs text-muted-foreground mt-2">Extension not detected. Make sure it's installed and enabled.</p>}
    </div>
  );
};