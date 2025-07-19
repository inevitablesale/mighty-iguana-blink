import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, TrendingUp, Users, Check, Sparkles } from "lucide-react";
import { PredictiveLead } from "@/types/index";

interface PredictiveLeadsProps {
  leads: PredictiveLead[];
  onInvestigate: (lead: PredictiveLead) => void;
  investigatingLead: PredictiveLead | null;
  investigatedLeads: string[];
}

const signalIcons: { [key in PredictiveLead['signalType']]: JSX.Element } = {
  funding: <TrendingUp className="h-4 w-4 text-green-500" />,
  expansion: <Users className="h-4 w-4 text-blue-500" />,
  hiring_trend: <Zap className="h-4 w-4 text-yellow-500" />,
};

export function PredictiveLeads({ leads, onInvestigate, investigatingLead, investigatedLeads }: PredictiveLeadsProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold tracking-tight">Proactive Leads</h3>
        <p className="text-sm text-muted-foreground">
          Based on your agents' specialties, here are some companies that might be hiring soon.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leads.map((lead, index) => {
          const isInvestigating = investigatingLead?.companyName === lead.companyName;
          const hasBeenInvestigated = investigatedLeads.includes(lead.companyName);

          return (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {lead.companyName}
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground capitalize">
                    {signalIcons[lead.signalType]}
                    {lead.signalType.replace('_', ' ')}
                  </span>
                </CardTitle>
                <CardDescription>Signal Strength: {lead.signalStrength}/10</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm font-medium mb-2">Predicted Roles:</p>
                <div className="flex flex-wrap gap-2">
                  {lead.predictedRoles.map((role, i) => (
                    <Badge key={i} variant="secondary">{role}</Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                {hasBeenInvestigated ? (
                  <Button disabled variant="secondary" className="w-full">
                    <Check className="mr-2 h-4 w-4" />
                    Opportunity Created
                  </Button>
                ) : (
                  <Button 
                    onClick={() => onInvestigate(lead)} 
                    disabled={isInvestigating || !!investigatingLead}
                    className="w-full coogi-gradient-bg text-primary-foreground hover:opacity-90"
                  >
                    {isInvestigating ? "Investigating..." : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Investigate Lead
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}