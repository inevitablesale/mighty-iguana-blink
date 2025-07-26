import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Campaign } from "@/types/index";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface PipelineKanbanCardProps {
  campaign: Campaign;
}

export function PipelineKanbanCard({ campaign }: PipelineKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: campaign.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="mb-4 bg-card hover:shadow-md transition-shadow">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-sm font-semibold">{campaign.company_name}</CardTitle>
              <CardDescription className="text-xs">{campaign.role}</CardDescription>
            </div>
            <div {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
              <GripVertical size={16} />
            </div>
          </div>
        </CardHeader>
        <CardFooter className="p-4 pt-0">
           <p className="text-xs text-muted-foreground">Contact: {campaign.contact_name || 'N/A'}</p>
        </CardFooter>
      </Card>
    </div>
  );
}