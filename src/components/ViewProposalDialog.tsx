import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Proposal } from "@/types/index";
import ReactMarkdown from 'react-markdown';

interface ViewProposalDialogProps {
  proposal: Proposal;
  children: React.ReactNode;
}

export function ViewProposalDialog({ proposal, children }: ViewProposalDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Proposal for: {proposal.campaigns?.company_name}</DialogTitle>
          <DialogDescription>Role: {proposal.campaigns?.role}</DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto rounded-md border bg-muted p-4">
          <ReactMarkdown>{proposal.generated_body || "No content available."}</ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}