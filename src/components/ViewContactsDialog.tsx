import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Contact, Opportunity } from "@/types/index";
import { Linkedin, Mail, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ViewContactsDialogProps {
  companyName: string;
  opportunities: Opportunity[];
  contacts: Contact[];
  onGenerateCampaign: (contact: Contact) => void;
  isGenerating: boolean;
  generatingContactId: string | null;
  children: React.ReactNode;
}

export function ViewContactsDialog({ companyName, opportunities, contacts, onGenerateCampaign, isGenerating, generatingContactId, children }: ViewContactsDialogProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleDraftClick = (contact: Contact, opportunity: Opportunity) => {
    const campaignContact = { ...contact, opportunity_id: opportunity.id };
    onGenerateCampaign(campaignContact);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Key Contacts for {companyName}</DialogTitle>
          <DialogDescription>
            Select a contact and a role to draft a personalized outreach email.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          {contacts.length > 0 ? (
            <ul className="space-y-4">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.linkedin_profile_url && (
                      <Button asChild variant="outline" size="icon">
                        <a href={contact.linkedin_profile_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4" />
                          <span className="sr-only">LinkedIn Profile</span>
                        </a>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          size="sm" 
                          disabled={isGenerating && generatingContactId === contact.id}
                          className="coogi-gradient-bg text-primary-foreground hover:opacity-90"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {isGenerating && generatingContactId === contact.id ? 'Drafting...' : 'Draft Email'}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {opportunities.map(opp => (
                          <DropdownMenuItem key={opp.id} onClick={() => handleDraftClick(contact, opp)} disabled={isGenerating}>
                            For: {opp.role}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts found for this company yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}