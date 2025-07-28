import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Campaign } from "@/types/index";

interface ViewCampaignEmailDialogProps {
  campaign: Campaign;
  children: React.ReactNode;
}

export function ViewCampaignEmailDialog({ campaign, children }: ViewCampaignEmailDialogProps) {
  const renderBodyWithHighlights = (body: string) => {
    if (!body) return null;
    const parts = body.split(/<mark>|<\/mark>/g);
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index} className="bg-yellow-200/80 dark:bg-yellow-700/80 rounded px-1 py-0.5">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Email to: {campaign.company_name}</DialogTitle>
          <DialogDescription>Role: {campaign.role}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <h4 className="font-semibold mb-1">Subject</h4>
            <p className="text-sm p-3 bg-muted rounded-md">{campaign.subject}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Body</h4>
            <div className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap leading-relaxed">
              {renderBodyWithHighlights(campaign.body)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}