import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types/index";
import { Briefcase, Target, TrendingUp, AlertTriangle, Lightbulb, MessageSquare } from "lucide-react";

interface OpportunityAnalysisDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
}

const Section = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div>
    <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
      {icon}
      {title}
    </h4>
    <div className="text-sm text-muted-foreground pl-8">{children}</div>
  </div>
);

const renderBulletedList = (text: string) => {
  if (!text) return null;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {text.split('\\n- ').map((item, index) => item.trim() && <li key={index}>{item.replace(/^- /, '')}</li>)}
    </ul>
  );
};

export function OpportunityAnalysisDialog({ opportunity, children }: OpportunityAnalysisDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{opportunity.companyName} - {opportunity.role}</DialogTitle>
          <DialogDescription>
            {opportunity.location}
            <Badge variant="outline" className="ml-2">Match Score: {opportunity.matchScore}/10</Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <Section title="Company Overview" icon={<Briefcase size={16} />}>
            <p>{opportunity.company_overview}</p>
          </Section>
          <Separator />
          <Section title="Contract Value Assessment" icon={<TrendingUp size={16} />}>
            <p>{opportunity.contract_value_assessment}</p>
          </Section>
          <Separator />
          <Section title="Hiring Urgency" icon={<AlertTriangle size={16} />}>
            <p>{opportunity.hiring_urgency}</p>
          </Section>
          <Separator />
          <Section title="Client Pain Points" icon={<Target size={16} />}>
            {renderBulletedList(opportunity.pain_points)}
          </Section>
          <Separator />
          <Section title="Recommended Recruiter Angle" icon={<Lightbulb size={16} />}>
            <p>{opportunity.recruiter_angle}</p>
          </Section>
          <Separator />
          <Section title="Key Signal for Outreach" icon={<MessageSquare size={16} />}>
            <p className="italic">"{opportunity.key_signal_for_outreach}"</p>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}