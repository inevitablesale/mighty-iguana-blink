import { FeedContact } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { User, Linkedin } from "lucide-react";
import { Button } from "./ui/button";

interface ContactListCardProps {
  contacts: FeedContact[];
}

export function ContactListCard({ contacts }: ContactListCardProps) {
  return (
    <div className="space-y-2">
      {contacts.map((contact, index) => (
        <Card key={index} className="bg-black/20 border-white/10">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="truncate">
                <p className="font-semibold text-white truncate">{contact.name}</p>
                <p className="text-sm text-muted-foreground truncate">{contact.job_title}</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="icon">
              <a href={contact.linkedin_profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                <Linkedin className="h-5 w-5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}