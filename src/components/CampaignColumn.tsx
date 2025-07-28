import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { Campaign, CampaignStatus } from "@/types";
import { CampaignCard } from "./CampaignCard";
import { useMemo } from "react";
import { CSS } from "@dnd-kit/utilities";

interface CampaignColumnProps {
  status: CampaignStatus;
  campaigns: Campaign[];
}

export function CampaignColumn({ status, campaigns }: CampaignColumnProps) {
  const campaignsIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);

  const { setNodeRef, transform, transition } = useSortable({
    id: status,
    data: {
      type: "Column",
      status,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full md:w-1/4 lg:w-1/5 flex-shrink-0"
    >
      <div className="bg-black/20 border border-white/10 rounded-lg p-2 h-full flex flex-col backdrop-blur-sm">
        <h3 className="font-semibold text-center p-2 capitalize text-muted-foreground">
          {status.replace('_', ' ')}
        </h3>
        <div className="flex-grow overflow-y-auto">
          <SortableContext items={campaignsIds}>
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}