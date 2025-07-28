import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Campaign, CampaignStatus } from '@/types';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { CampaignColumn } from '@/components/CampaignColumn';
import { CampaignCard } from '@/components/CampaignCard';
import { createPortal } from 'react-dom';

const pipelineStatuses: CampaignStatus[] = ['draft', 'contacted', 'replied', 'sourcing', 'interviewing', 'hired'];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const { data, error } = await supabase
          .from('campaigns')
          .select('*, opportunities(contract_value_assessment)')
          .eq('user_id', user.id)
          .in('status', pipelineStatuses)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCampaigns(data as Campaign[]);

      } catch (err) {
        toast.error("Failed to fetch campaign data", { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
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
        <h1 className="text-3xl font-bold text-white">AI Campaigns</h1>
        <p className="text-white/80 mt-1">
          Manage your AI-driven outreach campaigns. Drag cards to update their status.
        </p>
      </header>
      <div className="flex-grow overflow-x-auto pb-4">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
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