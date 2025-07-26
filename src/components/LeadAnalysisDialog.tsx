import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Opportunity } from "@/types/index";
import { Quote, Briefcase, Target, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";

interface LeadAnalysisDialogProps {
  opportunity: Opportunity;
  children: React.ReactNode;
}

const AnalysisSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div>
    <h4 className="font-semibold mb-2 flex items-center gap-2">
      {icon}
      {title}
    </h4>
    <div className="text-sm text-muted-foreground pl-7">{children}</div>
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

export function LeadAnalysisDialog({ opportunity, children }: LeadAnalysisDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Analysis for: {opportunity.company_name}</DialogTitle>
          <DialogDescription>
            Role: {opportunity.role}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <AnalysisSection title="Key Signal for Outreach" icon={<Quote size={16} className="text-primary" />}>
                <p className="italic">"{opportunity.key_signal_for_outreach}"</p>
            </AnalysisSection>
            <Separator />
            <AnalysisSection title="Company Overview" icon={<Briefcase size={16} className="text-primary" />}>
                <p>{opportunity.company_overview}</p>
            </AnalysisSection>
            <Separator />
            <AnalysisSection title="Contract Value Assessment" icon={<TrendingUp size={16} className="text-primary" />}>
                <p>{opportunity.contract_value_assessment}</p>
            </AnalysisSection>
            <Separator />
            <AnalysisSection title="Hiring Urgency" icon={<AlertTriangle size={16} className="text-primary" />}>
                <p>{opportunity.hiring_urgency}</p>
            </AnalysisSection>
            <Separator />
            <AnalysisSection title="Client Pain Points" icon={<Target size={16} className="text-primary" />}>
                {renderBulletedList(opportunity.pain_points)}
            </AnalysisSection>
            <Separator />
            <AnalysisSection title="Recommended Recruiter Angle" icon={<Lightbulb size={16} className="text-primary" />}>
                <p>{opportunity.recruiter_angle}</p>
            </AnalysisSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}