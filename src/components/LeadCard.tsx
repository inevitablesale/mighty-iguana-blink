import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Opportunity, Contact } from "@/types/index";
import { MoreHorizontal, Eye, Users, MessageSquare, Quote } from "lucide-react";
import { LeadAnalysisDialog } from "@/components/LeadAnalysisDialog";
import { ViewContactsDialog } from "@/components/ViewContactsDialog";

interface LeadCardProps {
  opportunity: Opportunity;
  contacts: Contact[];
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

export function LeadCard({ opportunity, contacts, onFindContacts, onGenerateCampaign, isGeneratingCampaign, generatingContactId }: LeadCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base">{opportunity.company_name}</CardTitle>
            <CardDescription>{opportunity.role}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <LeadAnalysisDialog opportunity={opportunity}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Eye className="mr-2 h-4 w-4" /> View Full Analysis
                </DropdownMenuItem>
              </LeadAnalysisDialog>
              <DropdownMenuItem onClick={() => onFindContacts(opportunity)}>
                <Users className="mr-2 h-4 w-4" /> Find Contacts
              </DropdownMenuItem>
              {contacts.length > 0 && (
                <ViewContactsDialog
                  opportunity={opportunity}
                  contacts={contacts}
                  onGenerateCampaign={onGenerateCampaign}
                  isGenerating={isGeneratingCampaign}
                  generatingContactId={generatingContactId}
                >
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({contacts.length})
                  </DropdownMenuItem>
                </ViewContactsDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Match Score</p>
          <div className="flex items-center gap-2">
            <Progress value={opportunity.match_score * 10} className="h-2 w-full" />
            <span className="text-sm font-semibold">{opportunity.match_score}/10</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2"><Quote className="h-4 w-4" /> Key Signal</p>
          <p className="text-sm text-muted-foreground italic border-l-2 pl-3">
            "{opportunity.key_signal_for_outreach}"
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">{opportunity.location}</p>
      </CardFooter>
    </Card>
  );
}