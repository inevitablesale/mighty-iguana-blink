import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campaign } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, DollarSign } from "lucide-react";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campaign.id, data: { type: "Campaign", campaign } });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="mb-2 bg-black/30 border-white/10 text-white">
        <CardHeader className="p-3 relative">
          <button {...listeners} className="absolute top-3 right-2 p-1 text-muted-foreground hover:text-foreground cursor-grab">
            <GripVertical size={16} />
          </button>
          <CardTitle className="text-sm font-medium pr-6">{campaign.company_name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-xs text-muted-foreground">{campaign.role}</p>
          <p className="text-xs mt-2">{campaign.contact_name}</p>
          {campaign.opportunities?.contract_value_assessment && (
            <div className="flex items-center text-xs mt-2 text-green-400 font-semibold">
              <DollarSign size={12} className="mr-1" />
              <span>{campaign.opportunities.contract_value_assessment}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}