import { SortableContext } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Campaign } from "@/types/index";
import { PipelineKanbanCard } from "./PipelineKanbanCard";
import { useMemo } from "react";

interface PipelineKanbanColumnProps {
  id: string;
  title: string;
  campaigns: Campaign[];
}

export function PipelineKanbanColumn({ id, title, campaigns }: PipelineKanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  return (
    <div ref={setNodeRef} className="w-72 flex-shrink-0">
      <div className="flex flex-col h-full bg-muted/50 rounded-lg p-2">
        <h3 className="font-semibold text-sm p-2 mb-2">{title} ({campaigns.length})</h3>
        <div className="flex-grow overflow-y-auto pr-1">
          <SortableContext items={campaignIds}>
            {campaigns.map(campaign => (
              <PipelineKanbanCard key={campaign.id} campaign={campaign} />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}