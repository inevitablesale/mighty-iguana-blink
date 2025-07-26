import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Opportunity, Contact } from "@/types/index";
import { Users, MessageSquare, Quote, Briefcase, Target, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { ViewContactsDialog } from "@/components/ViewContactsDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CompanyBriefingDialog } from "./CompanyBriefingDialog";

interface LeadCardProps {
  opportunity: Opportunity;
  contacts: Contact[];
  onFindContacts: (opportunity: Opportunity) => void;
  onGenerateCampaign: (contact: Contact) => void;
  isGeneratingCampaign: boolean;
  generatingContactId: string | null;
}

const AnalysisSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div>
    <h5 className="font-semibold text-xs mb-1 flex items-center gap-2 text-muted-foreground">
      {icon}
      {title}
    </h5>
    <div className="text-xs text-muted-foreground pl-6">{children}</div>
  </div>
);

const renderBulletedList = (text: string | null | undefined) => {
  if (!text) return <p>N/A</p>;
  return (
    <ul className="list-disc pl-4 space-y-1">
      {text.split('\\n- ').map((item, index) => item.trim() && <li key={index}>{item.replace(/^- /, '')}</li>)}
    </ul>
  );
};

export function LeadCard({ opportunity, contacts, onFindContacts, onGenerateCampaign, isGeneratingCampaign, generatingContactId }: LeadCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base">{opportunity.company_name}</CardTitle>
            <CardDescription>{opportunity.role}</CardDescription>
          </div>
           <CompanyBriefingDialog companyName={opportunity.company_name}>
              <Button variant="ghost" size="icon">
                <Briefcase className="h-4 w-4" />
                 <span className="sr-only">Company Briefing</span>
              </Button>
            </CompanyBriefingDialog>
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
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1" className="border-none">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">View Full AI Analysis</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2 border-t">
                <AnalysisSection title="Company Overview" icon={<Briefcase size={14} />}>
                  <p>{opportunity.company_overview}</p>
                </AnalysisSection>
                <AnalysisSection title="Contract Value Assessment" icon={<TrendingUp size={14} />}>
                  <p>{opportunity.contract_value_assessment}</p>
                </AnalysisSection>
                <AnalysisSection title="Hiring Urgency" icon={<AlertTriangle size={14} />}>
                  <p>{opportunity.hiring_urgency}</p>
                </AnalysisSection>
                <AnalysisSection title="Client Pain Points" icon={<Target size={14} />}>
                  {renderBulletedList(opportunity.pain_points)}
                </AnalysisSection>
                <AnalysisSection title="Recommended Recruiter Angle" icon={<Lightbulb size={14} />}>
                  <p>{opportunity.recruiter_angle}</p>
                </AnalysisSection>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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