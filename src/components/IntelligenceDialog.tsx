import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Opportunity } from "@/types/index";
import { OpportunityAnalysisContent } from "./OpportunityAnalysisContent";
import { CompanyBriefingContent } from "./CompanyBriefingContent";

interface IntelligenceDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
}

export function IntelligenceDialog({ opportunity, children }: IntelligenceDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Intelligence Briefing: {opportunity.companyName}</DialogTitle>
          <DialogDescription>
            AI-generated analysis for the {opportunity.role} role.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="opportunity" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="opportunity">Opportunity Analysis</TabsTrigger>
            <TabsTrigger value="company">Company Briefing</TabsTrigger>
          </TabsList>
          <TabsContent value="opportunity">
            <OpportunityAnalysisContent opportunity={opportunity} />
          </TabsContent>
          <TabsContent value="company">
            <CompanyBriefingContent companyName={opportunity.companyName} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}