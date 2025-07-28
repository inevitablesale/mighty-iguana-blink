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
import { Linkedin, Mail, ChevronDown, Loader2 } from "lucide-react";
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
  children: React.ReactNode;
}

export function ViewContactsDialog({ 
  companyName, 
  opportunities, 
  contacts, 
  onGenerateCampaign, 
  isGenerating, 
  generatingContactId,
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

  const getEmailStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'verified':
        return <Badge variant="default" className="bg-green-600 text-white">Verified</Badge>;
      case 'not_found':
        return <Badge variant="destructive">Not Found</Badge>;
      case 'error_no_linkedin_url':
      case 'error_no_name':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Pending'}</Badge>;
    }
  };

  const renderEmailInfo = (contact: Contact) => {
    if (contact.email) {
      return (
        <div className="text-right">
          <p className="text-sm font-medium text-foreground truncate" title={contact.email}>{contact.email}</p>
          {getEmailStatusBadge(contact.email_status)}
        </div>
      );
    }

    switch (contact.email_status) {
      case 'not_found':
        return <Badge variant="destructive">Not Found</Badge>;
      case 'error_no_linkedin_url':
      case 'error_no_name':
        return <Badge variant="destructive">Data Error</Badge>;
      default:
        // This covers null, undefined, or any other status, indicating it's in progress
        return (
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Searching...</span>
          </div>
        );
    }
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

                    {renderEmailInfo(contact)}

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