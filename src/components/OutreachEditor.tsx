import { useState } from 'react';
import { Campaign } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface OutreachEditorProps {
  campaign: Campaign;
  onSend: (campaignId: string, subject: string, body: string) => void;
  isSending: boolean;
}

export function OutreachEditor({ campaign, onSend, isSending }: OutreachEditorProps) {
  const [subject, setSubject] = useState(campaign.subject || '');
  const [body, setBody] = useState(campaign.body || '');

  const handleSend = () => {
    onSend(campaign.id, subject, body);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outreach Draft</CardTitle>
        <CardDescription>Review, edit, and send the AI-generated outreach to {campaign.contact_name}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea 
            id="body" 
            value={body} 
            onChange={(e) => setBody(e.target.value)} 
            rows={12}
            className="font-mono text-sm"
          />
        </div>
        <Button className="w-full" onClick={handleSend} disabled={isSending}>
          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send Email
        </Button>
      </CardContent>
    </Card>
  );
}