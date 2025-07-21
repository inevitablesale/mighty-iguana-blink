import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Mic } from "lucide-react"

interface ConversationModeToggleProps {
  isConversationMode: boolean;
  onToggle: (isChecked: boolean) => void;
}

export function ConversationModeToggle({ isConversationMode, onToggle }: ConversationModeToggleProps) {
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 flex items-center space-x-2 rounded-full border bg-background/80 p-2 px-3 shadow-lg backdrop-blur-md">
      <Mic className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="conversation-mode" className="text-sm font-medium">
        Conversation Mode
      </Label>
      <Switch
        id="conversation-mode"
        checked={isConversationMode}
        onCheckedChange={onToggle}
      />
    </div>
  )
}