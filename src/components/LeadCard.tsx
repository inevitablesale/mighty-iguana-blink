import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Opportunity, Contact } from "@/types/index";
import { Users, MessageSquare, Sparkles } from "lucide-react";
import { ViewContactsDialog } from "@/components/ViewContactsDialog";
import { LeadAnalysisDialog } from "./LeadAnalysisDialog";

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
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="text-base">{opportunity.company_name}</CardTitle>
        <CardDescription>{opportunity.role}</CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium">Match Score</p>
            <LeadAnalysisDialog opportunity={opportunity}>
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2">
                <Sparkles className="mr-2 h-3 w-3" />
                View AI Analysis
              </Button>
            </LeadAnalysisDialog>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={opportunity.match_score * 10} className="h-2 w-full" />
            <span className="text-sm font-semibold">{opportunity.match_score}/10</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">{opportunity.location}</p>
        <div className="flex gap-2">
          {contacts.length > 0 ? (
            <ViewContactsDialog
              opportunity={opportunity}
              contacts={contacts}
              onGenerateCampaign={onGenerateCampaign}
              isGenerating={isGeneratingCampaign}
              generatingContactId={generatingContactId}
            >
              <Button size="sm" className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({contacts.length})
              </Button>
            </ViewContactsDialog>
          ) : (
            <Button size="sm" onClick={() => onFindContacts(opportunity)} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
              <Users className="mr-2 h-4 w-4" /> Find Contacts
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}