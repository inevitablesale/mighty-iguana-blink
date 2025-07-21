import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Target, Bot, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Agent } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { OpportunityCard } from "@/components/OpportunityCard";
import { AgentBriefingCard } from "@/components/AgentBriefingCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ViewMode = 'agent-list' | 'review';

const Opportunities = () => {
  const [opportunitiesByAgent, setOpportunitiesByAgent] = useState<Map<string, Opportunity[]>>(new Map());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [processedOppIds, setProcessedOppIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('agent-list');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [opportunitiesForReview, setOpportunitiesForReview] = useState<Opportunity[]>([]);
  const [currentOppIndex, setCurrentOppIndex] = useState(0);

  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, campaignsRes, agentsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('opportunity_id').eq('user_id', user.id),
      supabase.from('agents').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || agentsRes.error) {
      toast.error("Failed to load data.");
    } else {
      const campaigns = campaignsRes.data || [];
      const processedIds = new Set(campaigns.map(c => c.opportunity_id).filter(id => id));
      setProcessedOppIds(processedIds);

      const allOpps = oppsRes.data.map((o: any) => ({
        id: o.id, agent_id: o.agent_id, companyName: o.company_name, role: o.role, location: o.location || 'N/A',
        matchScore: o.match_score || 0, company_overview: o.company_overview || 'N/A',
        contract_value_assessment: o.contract_value_assessment || 'N/A', hiring_urgency: o.hiring_urgency || 'N/A',
        pain_points: o.pain_points || 'N/A', recruiter_angle: o.recruiter_angle || 'N/A',
        key_signal_for_outreach: o.key_signal_for_outreach || 'N/A',
      }));

      const unapprovedOpps = allOpps.filter(opp => !processedIds.has(opp.id));

      const groupedOpps = new Map<string, Opportunity[]>();
      unapprovedOpps.forEach(opp => {
        if (opp.agent_id) {
          const agentOpps = groupedOpps.get(opp.agent_id) || [];
          agentOpps.push(opp);
          agentOpps.sort((a, b) => b.matchScore - a.matchScore);
          groupedOpps.set(opp.agent_id, agentOpps);
        }
      });
      
      setAgents(agentsRes.data || []);
      setOpportunitiesByAgent(groupedOpps);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartReview = (agent: Agent) => {
    const opps = opportunitiesByAgent.get(agent.id) || [];
    if (opps.length > 0) {
      setSelectedAgent(agent);
      setOpportunitiesForReview(opps);
      setCurrentOppIndex(0);
      setViewMode('review');
    }
  };

  const handleNext = () => {
    if (currentOppIndex < opportunitiesForReview.length - 1) {
      setCurrentOppIndex(prev => prev + 1);
    } else {
      toast.success(`Briefing from ${selectedAgent?.name} complete!`);
      setViewMode('agent-list');
      fetchData(); // Refresh data to remove the reviewed agent from the list
    }
  };

  const handleApprove = async (opportunity: Opportunity) => {
    setApprovingId(opportunity.id);
    const toastId = toast.loading("Generating outreach draft...");
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: opportunity.id },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in Campaigns.",
        action: { label: "View Campaigns", onClick: () => navigate('/campaigns') },
      });
      handleNext();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const agentsWithOpps = agents.filter(agent => (opportunitiesByAgent.get(agent.id)?.length || 0) > 0);

  const renderAgentList = () => (
    <>
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : agentsWithOpps.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agentsWithOpps.map(agent => (
            <AgentBriefingCard
              key={agent.id}
              agent={agent}
              opportunityCount={opportunitiesByAgent.get(agent.id)?.length || 0}
              onStartReview={handleStartReview}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full min-h-[60vh]">
          <div className="flex flex-col items-center gap-1 text-center">
            <Target className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-2xl font-bold tracking-tight">All Opportunities Reviewed</h3>
            <p className="text-sm text-muted-foreground">Run an agent to find new opportunities or check your Campaigns page.</p>
          </div>
        </div>
      )}
    </>
  );

  const renderReviewView = () => {
    const currentOpp = opportunitiesForReview[currentOppIndex];
    const progress = ((currentOppIndex + 1) / opportunitiesForReview.length) * 100;

    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button variant="ghost" onClick={() => setViewMode('agent-list')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agent List
          </Button>
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Briefing from: {selectedAgent?.name}</h2>
                <p className="text-sm text-muted-foreground">Reviewing opportunity {currentOppIndex + 1} of {opportunitiesForReview.length}</p>
              </div>
            </div>
            <Progress value={progress} className="mt-3 h-2" />
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <OpportunityCard
              key={currentOpp.id}
              opportunity={currentOpp}
              onApproveOutreach={handleApprove}
              isApproved={processedOppIds.has(currentOpp.id)}
              isApproving={approvingId === currentOpp.id}
              onDismiss={handleNext}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Header title="Opportunities" />
      <main className="flex flex-1 flex-col gap-8 p-4 lg:p-6">
        {viewMode === 'agent-list' ? renderAgentList() : renderReviewView()}
      </main>
    </div>
  );
};

export default Opportunities;