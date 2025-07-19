import { useState, useEffect, useCallback } from "react";
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
import { Target, FileSearch, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, OpportunityPotential } from "@/types/index";
import { CompanyBriefingDialog } from "@/components/CompanyBriefingDialog";
import { useNavigate } from "react-router-dom";

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, campaignsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('opportunity_id').eq('user_id', user.id)
    ]);

    if (oppsRes.error) {
      toast.error("Failed to load opportunities.");
    } else {
      const formattedOpps = oppsRes.data.map((o: any) => ({
        id: o.id, companyName: o.company_name, role: o.role, location: o.location || 'N/A',
        potential: (o.potential as OpportunityPotential) || 'Low', hiringUrgency: (o.hiring_urgency as OpportunityPotential) || 'Low',
        matchScore: o.match_score || 0, keySignal: o.key_signal || 'N/A',
      }));
      setOpportunities(formattedOpps);
    }

    if (campaignsRes.data) {
      setProcessedOppIds(new Set(campaignsRes.data.map(c => c.opportunity_id).filter(id => id)));
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (opportunityId: string) => {
    setApprovingId(opportunityId);
    const toastId = toast.loading("Generating outreach draft...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in Campaigns.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
      fetchData(); // Refresh data to update button state
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const getBadgeVariant = (value: string) => {
    switch (value) {
      case "High": return "destructive";
      case "Medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>
        ) : opportunities.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>All Opportunities</CardTitle>
              <CardDescription>A log of all opportunities discovered by your AI agents. Approve them to create outreach campaigns.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.companyName}</TableCell>
                      <TableCell>{opp.role}</TableCell>
                      <TableCell>{opp.matchScore}/10</TableCell>
                      <TableCell className="text-right space-x-2">
                        <CompanyBriefingDialog companyName={opp.companyName}>
                          <Button variant="outline" size="sm"><FileSearch className="mr-2 h-4 w-4" />Research</Button>
                        </CompanyBriefingDialog>
                        {processedOppIds.has(opp.id) ? (
                          <Button size="sm" disabled><Check className="mr-2 h-4 w-4" />Drafted</Button>
                        ) : (
                          <Button size="sm" onClick={() => handleApprove(opp.id)} disabled={approvingId === opp.id} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                            {approvingId === opp.id ? 'Approving...' : 'Approve'}
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
              <h3 className="text-2xl font-bold tracking-tight">No Opportunities Found Yet</h3>
              <p className="text-sm text-muted-foreground">Run an agent from the Agents page to find your first opportunity.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Opportunities;