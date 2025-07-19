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
            <p className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap">{campaign.body}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}