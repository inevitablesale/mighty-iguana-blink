import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Campaign, CampaignStatus } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { CampaignColumn } from '@/components/CampaignColumn';
import { CampaignCard } from '@/components/CampaignCard';
import { createPortal } from 'react-dom';

const pipelineStatuses: CampaignStatus[] = ['draft', 'contacted', 'replied', 'sourcing', 'interviewing', 'hired'];

export default function Pipeline() {
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
          .select('*')
          .eq('user_id', user.id)
          .in('status', pipelineStatuses)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCampaigns(data);
      } catch (err) {
        toast.error("Failed to fetch campaigns", { description: (err as Error).message });
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

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }));

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
    const overId = over.id;

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

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex gap-4">
        {pipelineStatuses.map(s => <Skeleton key={s} className="h-[80vh] w-1/5" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-60px)] flex flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Campaign Pipeline</h1>
        <p className="text-white/80 mt-1">
          Manage your active deals by dragging and dropping them between stages.
        </p>
      </header>
      <div className="flex-grow overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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