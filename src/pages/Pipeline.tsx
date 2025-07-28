import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Campaign, CampaignStatus, ProactiveOpportunity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { CampaignColumn } from '@/components/CampaignColumn';
import { CampaignCard } from '@/components/CampaignCard';
import { createPortal } from 'react-dom';
import { ProactiveOpportunityCard } from '@/components/ProactiveOpportunityCard';

const pipelineStatuses: CampaignStatus[] = ['draft', 'contacted', 'replied', 'sourcing', 'interviewing', 'hired'];

export default function Pipeline() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [proactiveOpportunities, setProactiveOpportunities] = useState<ProactiveOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [processingOpp, setProcessingOpp] = useState<{ id: string; type: 'accept' | 'dismiss' } | null>(null);

  useEffect(() => {
    const fetchPipelineData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const campaignsPromise = supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', user.id)
          .in('status', pipelineStatuses)
          .order('created_at', { ascending: false });

        const proactiveOppsPromise = supabase
          .from('proactive_opportunities')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'reviewed');

        const [campaignsResult, proactiveOppsResult] = await Promise.all([campaignsPromise, proactiveOppsPromise]);

        if (campaignsResult.error) throw campaignsResult.error;
        setCampaigns(campaignsResult.data);

        if (proactiveOppsResult.error) throw proactiveOppsResult.error;
        setProactiveOpportunities(proactiveOppsResult.data as ProactiveOpportunity[]);

      } catch (err) {
        toast.error("Failed to fetch pipeline data", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchPipelineData();
  }, []);

  const campaignsByStatus = useMemo(() => {
    const grouped: { [key in CampaignStatus]?: Campaign[] } = {};
    pipelineStatuses.forEach(status => grouped[status] = []);
    campaigns.forEach(campaign => {
      if (grouped[campaign.status]) {
        grouped[campaign.status]!.push(campaign);
      }
    });
    return grouped;
  }, [campaigns]);

  const handleAcceptOpportunity = async (opportunityId: string) => {
    setProcessingOpp({ id: opportunityId, type: 'accept' });
    try {
      const { data, error } = await supabase.functions.invoke('accept-proactive-opportunity', {
        body: { proactiveOpportunityId: opportunityId }
      });

      if (error) throw new Error(error.message);

      setCampaigns(prev => [data.campaign, ...prev]);
      setProactiveOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));

      toast.success("Opportunity accepted and moved to your draft pipeline!");

    } catch (err) {
      toast.error("Failed to accept opportunity", { description: (err as Error).message });
    } finally {
      setProcessingOpp(null);
    }
  };

  const handleDismissOpportunity = async (opportunityId: string) => {
    setProcessingOpp({ id: opportunityId, type: 'dismiss' });
    const { error } = await supabase
      .from('proactive_opportunities')
      .update({ status: 'dismissed' })
      .eq('id', opportunityId);
    
    if (error) {
      toast.error("Failed to dismiss opportunity.");
    } else {
      setProactiveOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
      toast.info("Opportunity dismissed.");
    }
    setProcessingOpp(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Campaign") {
      setActiveCampaign(event.active.data.current.campaign);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCampaign(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id;
    const isActiveACampaign = active.data.current?.type === "Campaign";
    if (!isActiveACampaign) return;

    const activeCampaign = campaigns.find(c => c.id === activeId);
    if (!activeCampaign) return;

    const overIsAColumn = over.data.current?.type === "Column";
    if (!overIsAColumn) return;

    const newStatus = over.data.current?.status as CampaignStatus;
    if (activeCampaign.status === newStatus) return;

    setCampaigns(prev => prev.map(c => c.id === activeId ? { ...c, status: newStatus } : c));

    const { error } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', activeId);

    if (error) {
      toast.error("Failed to update campaign status.");
      setCampaigns(prev => prev.map(c => c.id === activeId ? { ...c, status: activeCampaign.status } : c));
    } else {
      toast.success(`Moved ${activeCampaign.company_name} to ${newStatus}.`);
    }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Deal Pipeline</h1>
        <p className="text-white/80 mt-1">
          Your automated deal flow. New opportunities appear on the left. Drag campaigns to update their status.
        </p>
      </header>
      <div className="flex-grow overflow-x-auto pb-4">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
            {/* Proactive Opportunities Column */}
            <div className="w-full md:w-1/4 lg:w-1/5 flex-shrink-0">
              <div className="bg-black/20 border border-white/10 rounded-lg p-2 h-full flex flex-col backdrop-blur-sm">
                <h3 className="font-semibold text-center p-2 capitalize text-primary">
                  Market Opportunities
                </h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <Skeleton className="h-40 w-full bg-white/10" />
                  ) : proactiveOpportunities.length > 0 ? (
                    proactiveOpportunities.map(opp => (
                      <ProactiveOpportunityCard
                        key={opp.id}
                        opportunity={opp}
                        onAccept={handleAcceptOpportunity}
                        onDismiss={handleDismissOpportunity}
                        isAccepting={processingOpp?.id === opp.id && processingOpp?.type === 'accept'}
                        isDismissing={processingOpp?.id === opp.id && processingOpp?.type === 'dismiss'}
                      />
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-4 h-full flex items-center justify-center">
                      <p>No new opportunities match your profile right now. Check back soon!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Campaign Columns */}
            <SortableContext items={pipelineStatuses}>
              {pipelineStatuses.map(status => (
                <CampaignColumn
                  key={status}
                  status={status}
                  campaigns={campaignsByStatus[status] || []}
                />
              ))}
            </SortableContext>
          </div>
          {createPortal(
            <DragOverlay>
              {activeCampaign && <CampaignCard campaign={activeCampaign} />}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>
    </div>
  );
}