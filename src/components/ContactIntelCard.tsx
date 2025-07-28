import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContactIntel } from "@/types";
import { CheckCircle, HelpCircle, User, Linkedin, Mail, Phone, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";

interface ContactIntelCardProps {
  contact: ContactIntel | undefined;
  isLoading: boolean;
  onScrape: () => void;
}

const getConfidenceIcon = (confidence: ContactIntel['email_confidence']) => {
  switch (confidence) {
    case 'Verified':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Unverified':
      return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

export function ContactIntelCard({ contact, isLoading, onScrape }: ContactIntelCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Finding Decision Maker...</CardTitle>
          <CardDescription>AI is analyzing the opportunity.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!contact) {
    return (
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">No Contact Found</CardTitle>
          <CardDescription>Coogi couldn't identify a likely decision maker automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onScrape}>
            <User className="mr-2 h-4 w-4" />
            Find Contacts
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-base">Likely Decision Maker</CardTitle>
        <CardDescription>{contact.reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-bold text-lg text-white">{contact.name}</p>
          <p className="text-primary">{contact.title}</p>
        </div>
        <div className="space-y-2 text-sm">
          {contact.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-white/90">{contact.email}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {getConfidenceIcon(contact.email_confidence)}
                <span className="ml-1.5">{contact.email_confidence || 'Unknown'}</span>
              </Badge>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-white/90">{contact.phone}</span>
            </div>
          )}
          {contact.linkedin_url && (
            <div className="flex items-center gap-3">
              <Linkedin className="h-4 w-4 text-muted-foreground" />
              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                View LinkedIn Profile
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}