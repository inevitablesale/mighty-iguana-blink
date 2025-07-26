import { Campaign, CampaignStatus } from "@/types/index";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Trash2, Send, FileText, Award, CheckSquare } from "lucide-react";

import { EditCampaignDialog } from "./EditCampaignDialog";
import { ViewCampaignEmailDialog } from "./ViewCampaignEmailDialog";
import { GenerateProposalDialog } from "./GenerateProposalDialog";
import { CreatePlacementDialog } from "./CreatePlacementDialog";

interface CampaignCardProps {
  campaign: Campaign;
  onCampaignUpdated: () => void;
  onDelete: (campaignId: string) => void;
  onUpdateStatus: (campaignId: string, status: CampaignStatus) => void;
  onPlacementCreated: () => void;
  onProposalCreated: () => void;
}

const statusOptions: { value: CampaignStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'replied', label: 'Replied' },
    { value: 'sourcing', label: 'Sourcing' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'hired', label: 'Hired' },
    { value: 'archived', label: 'Archived' },
];

const getStatusBadgeVariant = (status: CampaignStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'contacted': return 'default';
      case 'hired': return 'default';
      case 'replied': return 'secondary';
      case 'interviewing': return 'secondary';
      case 'sourcing': return 'secondary';
      case 'archived': return 'destructive';
      case 'draft':
      default:
        return 'outline';
    }
};

export function CampaignCard({ campaign, onCampaignUpdated, onDelete, onUpdateStatus, onPlacementCreated, onProposalCreated }: CampaignCardProps) {
  
  const renderPrimaryActions = () => {
    switch (campaign.status) {
      case 'draft':
        return (
          <>
            <EditCampaignDialog campaign={campaign} onCampaignUpdated={onCampaignUpdated}>
              <Button size="sm" variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
            </EditCampaignDialog>
            <Button size="sm" onClick={() => onUpdateStatus(campaign.id, 'contacted')} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
              <Send className="mr-2 h-4 w-4" /> Mark as Sent
            </Button>
          </>
        );
      case 'replied':
      case 'sourcing':
      case 'interviewing':
        return (
          <>
            <GenerateProposalDialog campaign={campaign} onProposalCreated={onProposalCreated}>
              <Button size="sm" variant="outline"><FileText className="mr-2 h-4 w-4" /> Proposal</Button>
            </GenerateProposalDialog>
            <CreatePlacementDialog campaign={campaign} onPlacementCreated={onPlacementCreated}>
              <Button size="sm" className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                <Award className="mr-2 h-4 w-4" /> Mark as Hired
              </Button>
            </CreatePlacementDialog>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{campaign.company_name}</CardTitle>
          <CardDescription>{campaign.role}</CardDescription>
        </div>
        <Badge 
          variant={getStatusBadgeVariant(campaign.status)}
          className={`${campaign.status === 'interviewing' ? 'bg-accent text-accent-foreground' : ''} ${campaign.status === 'hired' ? 'bg-green-600 text-white' : ''}`}
        >
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Contact: <span className="font-medium text-foreground">{campaign.contact_name || "N/A"}</span>
        </p>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex gap-2">
          {renderPrimaryActions()}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <ViewCampaignEmailDialog campaign={campaign}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <FileText className="mr-2 h-4 w-4" /> View Email
              </DropdownMenuItem>
            </ViewCampaignEmailDialog>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CheckSquare className="mr-2 h-4 w-4" /> Update Status
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {statusOptions.map(option => (
                    <DropdownMenuItem key={option.value} onClick={() => onUpdateStatus(campaign.id, option.value)}>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(campaign.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}