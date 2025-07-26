import { useState, useMemo, useEffect } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { Campaign, CampaignStatus } from "@/types/index";
import { PipelineKanbanColumn } from "./PipelineKanbanColumn";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PipelineKanbanViewProps {
  campaigns: Campaign[];
  onStatusChange: () => void;
}

const statuses: CampaignStatus[] = ['draft', 'contacted', 'replied', 'sourcing', 'interviewing', 'hired'];

export function PipelineKanbanView({ campaigns, onStatusChange }: PipelineKanbanViewProps) {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);

  useEffect(() => {
    setLocalCampaigns(campaigns);
  }, [campaigns]);

  const columns = useMemo(() => {
    return statuses.map(status => ({
      id: status,
      title: status.charAt(0).toUpperCase() + status.slice(1),
      campaigns: localCampaigns.filter(c => c.status === status)
    }));
  }, [localCampaigns]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }
    
    const newStatus = over.id as CampaignStatus;
    const campaignId = active.id as string;

    const originalCampaign = localCampaigns.find(c => c.id === campaignId);
    if (!originalCampaign || originalCampaign.status === newStatus) return;

    // Optimistic UI update
    setLocalCampaigns(prev => 
      prev.map(c => c.id === campaignId ? { ...c, status: newStatus } : c)
    );

    const { error } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId);

    if (error) {
      toast.error("Failed to update status.");
      // Revert UI on error
      setLocalCampaigns(prev => 
        prev.map(c => c.id === campaignId ? { ...c, status: originalCampaign.status } : c)
      );
    } else {
      toast.success(`Moved to ${newStatus}.`);
      onStatusChange(); // This will re-fetch from the parent and confirm the state
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <PipelineKanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            campaigns={col.campaigns}
          />
        ))}
      </div>
    </DndContext>
  );
}