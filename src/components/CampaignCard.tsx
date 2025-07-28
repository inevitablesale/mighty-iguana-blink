import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campaign } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate();
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking the drag handle
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      e.preventDefault();
      return;
    }
    navigate(`/deal/${campaign.opportunity_id}`);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      onClick={handleCardClick} 
      className="cursor-pointer"
    >
      <Card className="mb-2 bg-black/30 border-white/10 text-white hover:border-primary/50">
        <CardHeader className="p-3 relative">
          <button {...listeners} className="drag-handle absolute top-3 right-2 p-1 text-muted-foreground hover:text-foreground cursor-grab z-10">
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