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
import { Linkedin, Mail, ChevronDown, Loader2, Eye, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "./ui/badge";

interface ViewContactsDialogProps {
  companyName: string;
  opportunities: Opportunity[];
  contacts: Contact[];
  onGenerateCampaign: (contact: Contact) => void;
  isGenerating: boolean;
  generatingContactId: string | null;
  onRevealContact: (contactId: string) => void;
  revealedContactIds: Set<string>;
  children: React.ReactNode;
}

export function ViewContactsDialog({ 
  companyName, 
  opportunities, 
  contacts, 
  onGenerateCampaign, 
  isGenerating, 
  generatingContactId,
  onRevealContact,
  revealedContactIds,
  children 
}: ViewContactsDialogProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleDraftClick = (contact: Contact, opportunity: Opportunity) => {
    const campaignContact = { ...contact, opportunity_id: opportunity.id };
    onGenerateCampaign(campaignContact);
  };

  const renderContactActions = (contact: Contact) => {
    const isRevealed = revealedContactIds.has(contact.id);

    if (!isRevealed) {
      return (
        <Button size="sm" variant="outline" onClick={() => onRevealContact(contact.id)}>
          <Eye className="mr-2 h-4 w-4" />
          Reveal Contact Info
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            disabled={(isGenerating && generatingContactId === contact.id) || !contact.email}
            className="coogi-gradient-bg text-primary-foreground hover:opacity-90"
          >
            <Mail className="mr-2 h-4 w-4" />
            {isGenerating && generatingContactId === contact.id ? 'Drafting...' : 'Draft'}
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
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Key Contacts for {companyName}</DialogTitle>
          <DialogDescription>
            Reveal contact information and draft personalized outreach emails.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4 py-4">
          {contacts.length > 0 ? (
            <ul className="space-y-3">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{contact.job_title}</p>
                      {revealedContactIds.has(contact.id) && (
                         <div className="mt-1 space-y-1">
                            {contact.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm text-muted-foreground truncate" title={contact.email}>{contact.email}</span>
                                    <Badge variant="default" className="bg-green-600 text-white">Verified</Badge>
                                </div>
                            )}
                            {contact.phone_number && (
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm text-muted-foreground truncate" title={contact.phone_number}>{contact.phone_number}</span>
                                </div>
                            )}
                         </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {contact.linkedin_profile_url && (
                      <Button asChild variant="outline" size="icon">
                        <a href={contact.linkedin_profile_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4" />
                          <span className="sr-only">LinkedIn Profile</span>
                        </a>
                      </Button>
                    )}
                    {renderContactActions(contact)}
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