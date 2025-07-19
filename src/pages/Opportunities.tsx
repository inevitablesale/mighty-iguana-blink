import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Check, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, OpportunityPotential } from "@/types/index";

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: oppsData, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
        toast.error("Failed to load opportunities.");
      } else {
        const formattedOpps = oppsData.map((o: any) => ({
          id: o.id,
          companyName: o.company_name,
          role: o.role,
          location: o.location || 'N/A',
          potential: (o.potential as OpportunityPotential) || 'Low',
          hiringUrgency: (o.hiring_urgency as OpportunityPotential) || 'Low',
          matchScore: o.match_score || 0,
          keySignal: o.key_signal || 'N/A',
        }));
        setOpportunities(formattedOpps);
      }

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('opportunity_id')
        .eq('user_id', user.id);
      
      if (campaignsError) {
        console.error("Error fetching campaigns:", campaignsError);
      } else {
        setApprovedIds(campaignsData.map(c => c.opportunity_id));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleApproveOutreach = async (opportunity: Opportunity) => {
    const toastId = toast.loading(`Drafting outreach for ${opportunity.companyName}...`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('prompt')
        .eq('user_id', user.id);
      
      if (agentsError) throw agentsError;

      const recruiterSpecialty = agents.map(a => a.prompt).join(', ');

      const { data, error } = await supabase.functions.invoke('generate-outreach', {
        body: { opportunity, recruiterSpecialty },
      });

      if (error) throw new Error(error.message);

      const { draft, companyName, role } = data;
      const { error: insertError } = await supabase.from('campaigns').insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        company_name: companyName,
        role,
        subject: draft.subject,
        body: draft.body,
      });

      if (insertError) throw new Error(insertError.message);

      setApprovedIds(prev => [...prev, opportunity.id]);

      toast.success(`Draft created for ${opportunity.companyName}!`, {
        id: toastId,
        description: "You can now review the draft in the Campaigns tab.",
        action: {
          label: "View Drafts",
          onClick: () => navigate('/campaigns'),
        },
      });
    } catch (e) {
      const error = e as Error;
      console.error("Error generating outreach:", error);
      toast.error(error.message, { id: toastId });
    }
  };

  const getBadgeVariant = (value: string) => {
    switch (value) {
      case "High": return "destructive";
      case "Medium": return "secondary";
      default: return "outline";
    }
  };

  const renderLoadingState = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : opportunities.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>All Opportunities</CardTitle>
              <CardDescription>Review and approve AI-generated opportunities to create outreach campaigns.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Potential</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.companyName}</TableCell>
                      <TableCell>{opp.role}</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(opp.hiringUrgency)}>{opp.hiringUrgency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(opp.potential)}>{opp.potential}</Badge>
                      </TableCell>
                      <TableCell>{opp.matchScore}/10</TableCell>
                      <TableCell className="text-right">
                        {approvedIds.includes(opp.id) ? (
                          <Button disabled variant="secondary">
                            <Check className="mr-2 h-4 w-4" />
                            Drafted
                          </Button>
                        ) : (
                          <Button onClick={() => handleApproveOutreach(opp)} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                            <Zap className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
              <Target className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">
                No Opportunities Found Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Use the dashboard to find your first opportunity.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Opportunities;