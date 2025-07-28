import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "./ui/input";
import { Calendar, Send, Sparkles } from "lucide-react";

interface SmartOutreachAssistantProps {
  // In a real implementation, we'd pass the opportunity to generate a real pitch
}

export function SmartOutreachAssistant() {
  const [tone, setTone] = useState("direct");
  const [subject, setSubject] = useState("Following up on your Senior Engineer role");
  const [body, setBody] = useState(
    "Hi [Contact Name],\n\nSaw you're hiring for a Senior Engineer. Given the role has been open for a bit, finding the right fit can be tough.\n\nMy firm specializes in placing top-tier engineers in high-growth tech companies, and I have a few candidates who could be a great match.\n\nWorth a quick chat next week?\n\nBest,\n[Your Name]"
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Tone</Label>
        <ToggleGroup type="single" value={tone} onValueChange={(value) => value && setTone(value)} className="mt-1">
          <ToggleGroupItem value="direct" aria-label="Direct tone">Direct</ToggleGroupItem>
          <ToggleGroupItem value="friendly" aria-label="Friendly tone">Friendly</ToggleGroupItem>
          <ToggleGroupItem value="case-study" aria-label="Case study tone">Case Study</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
      </div>
      <div className="flex justify-between items-center gap-2">
        <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> Add Booking Link</Button>
        <Button><Send className="mr-2 h-4 w-4" /> Send Outreach</Button>
      </div>
    </div>
  );
}