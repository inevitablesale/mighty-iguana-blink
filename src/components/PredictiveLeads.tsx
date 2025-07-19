import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Users } from "lucide-react";
import { PredictiveLead } from "@/hooks/usePredictiveLeads";

interface PredictiveLeadsProps {
  leads: PredictiveLead[];
}

const signalIcons: { [key in PredictiveLead['signalType']]: JSX.Element } = {
  funding: <TrendingUp className="h-4 w-4 text-green-500" />,
  expansion: <Users className="h-4 w-4 text-blue-500" />,
  hiring_trend: <Zap className="h-4 w-4 text-yellow-500" />,
};

export function PredictiveLeads({ leads }: PredictiveLeadsProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold tracking-tight">Proactive Leads</h3>
        <p className="text-sm text-muted-foreground">
          Based on your agents' specialties, here are some companies that might be hiring soon.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leads.map((lead, index) => (
          <Card key={index}>
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
            <CardContent>
              <p className="text-sm font-medium mb-2">Predicted Roles:</p>
              <div className="flex flex-wrap gap-2">
                {lead.predictedRoles.map((role, i) => (
                  <Badge key={i} variant="secondary">{role}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}