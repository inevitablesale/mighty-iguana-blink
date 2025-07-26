import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2, MoreHorizontal, Award, Edit, FileText, CheckSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EditCampaignDialog } from "@/components/EditCampaignDialog";
import { CreatePlacementDialog } from "@/components/CreatePlacementDialog";
import { ViewCampaignEmailDialog } from "@/components/ViewCampaignEmailDialog";
import { GenerateProposalDialog } from "@/components/GenerateProposalDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Campaign, CampaignStatus } from "@/types/index";

const Pipeline = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load campaign drafts.");
    } else {
      setCampaigns(data as Campaign[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (campaignId: string) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) {
      toast.error('Failed to delete campaign.');
      console.error('Error deleting campaign:', error);
    } else {
      toast.success('Campaign deleted.');
      fetchCampaigns();
    }
  };

  const handleUpdateStatus = async (campaignId: string, status: CampaignStatus) => {
    const { error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      toast.error(`Failed to update status.`);
    } else {
      fetchCampaigns();
      toast.success(`Campaign status updated to "${status}".`);
    }
  };

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

  const statusOptions: { value: CampaignStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'replied', label: 'Replied' },
    { value: 'sourcing', label: 'Sourcing' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'hired', label: 'Hired' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className="flex flex-col">
      <Header title="Pipeline" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Outreach Pipeline</CardTitle>
            <CardDescription>Manage your outreach campaigns and track their status from draft to placement.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : campaigns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.company_name}</TableCell>
                      <TableCell>{campaign.role}</TableCell>
                      <TableCell>
                        <div className="font-medium">{campaign.contact_name || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">{campaign.contact_email || "N/A"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(campaign.status)}
                          className={`${campaign.status === 'interviewing' ? 'bg-accent text-accent-foreground' : ''} ${campaign.status === 'hired' ? 'bg-green-600 text-white' : ''}`}
                        >
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <ViewCampaignEmailDialog campaign={campaign}>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <FileText className="mr-2 h-4 w-4" />
                                View Email
                              </DropdownMenuItem>
                            </ViewCampaignEmailDialog>
                            {campaign.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(campaign.id, 'contacted')}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Send Email
                                </DropdownMenuItem>
                                <EditCampaignDialog campaign={campaign} onCampaignUpdated={fetchCampaigns}>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Draft
                                  </DropdownMenuItem>
                                </EditCampaignDialog>
                              </>
                            )}
                             {['replied', 'sourcing', 'interviewing'].includes(campaign.status) && (
                              <GenerateProposalDialog campaign={campaign} onProposalCreated={fetchCampaigns}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Generate Proposal
                                </DropdownMenuItem>
                              </GenerateProposalDialog>
                            )}
                            {['replied', 'sourcing', 'interviewing'].includes(campaign.status) && (
                              <CreatePlacementDialog campaign={campaign} onPlacementCreated={fetchCampaigns}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Award className="mr-2 h-4 w-4" />
                                  Mark as Hired
                                </DropdownMenuItem>
                              </CreatePlacementDialog>
                            )}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <CheckSquare className="mr-2 h-4 w-4" />
                                <span>Update Status</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  {statusOptions.map(option => (
                                    <DropdownMenuItem key={option.value} onClick={() => handleUpdateStatus(campaign.id, option.value)}>
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
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(campaign.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Campaigns Yet</h3>
                  <p className="text-sm text-muted-foreground">Draft an email from the Leads page to start a campaign.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Pipeline;