import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";
import { useExtension } from "@/context/ExtensionContext";
import { ExtensionLogViewer } from "./ExtensionLogViewer";

export function ExtensionLogDialog() {
  const { logs } = useExtension();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <ScrollText className="h-4 w-4" />
          <span className="sr-only">View Activity Log</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chrome Extension Activity Log</DialogTitle>
          <DialogDescription>
            Live feed of actions performed by the Coogi browser extension. Newest entries are at the top.
          </DialogDescription>
        </DialogHeader>
        <ExtensionLogViewer logs={logs} />
      </DialogContent>
    </Dialog>
  );
}