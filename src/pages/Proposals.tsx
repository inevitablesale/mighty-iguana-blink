import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Proposal, ProposalStatus } from "@/types/index";
import { format } from 'date-fns';

const Proposals = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('proposals')
      .select(`*, campaigns (company_name, role)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching proposals:", error);
      toast.error("Failed to load proposals.");
    } else {
      setProposals(data as Proposal[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const getStatusBadgeVariant = (status: ProposalStatus) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'sent': return 'secondary';
      case 'rejected': return 'destructive';
      case 'archived': return 'outline';
      case 'draft':
      default:
        return 'secondary';
    }
  };

  const renderLoadingState = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title="Proposals" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Proposals</CardTitle>
            <CardDescription>Manage your generated proposals and track their status.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              renderLoadingState()
            ) : proposals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">{proposal.campaigns?.company_name || 'N/A'}</TableCell>
                      <TableCell>{proposal.campaigns?.role || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(proposal.status)}
                          className={`${proposal.status === 'accepted' ? 'bg-green-600 text-white' : ''}`}
                        >
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(proposal.created_at), 'PPP')}</TableCell>
                      <TableCell className="text-right">
                        {/* Actions Dropdown will go here in the next step */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">
                    No Proposals Yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Proposals will appear here once they are generated from a campaign.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Proposals;