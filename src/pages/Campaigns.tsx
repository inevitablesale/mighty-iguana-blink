import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Copy, Trash2, Send, MoreHorizontal, Award } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EditCampaignDialog } from "@/components/EditCampaignDialog";
import { CreatePlacementDialog } from "@/components/CreatePlacementDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Campaign, CampaignStatus } from "@/types/index";

const Campaigns = () => {
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDelete = async (campaignId: string) => {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete draft.");
    } else {
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      toast.info("Draft deleted.");
    }
  };

  const handleUpdateStatus = async (campaignId: string, status: CampaignStatus) => {
    const { error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      console.error(`Error updating status to ${status}:`, error);
      toast.error(`Failed to update status.`);
    } else {
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status } : c));
      toast.success(`Campaign status updated to "${status}".`);
    }
  };

  const getStatusBadgeVariant = (status: CampaignStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'sent': return 'default';
      case 'placed': return 'default';
      case 'replied': return 'secondary';
      case 'meeting': return 'destructive'; // Using destructive for accent color
      case 'closed': return 'outline';
      case 'draft':
      default:
        return 'secondary';
    }
  };

  const renderLoadingState = () => (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header title="Campaigns" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader className="coogi-gradient-bg rounded-t-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-primary-foreground">To: {campaign.company_name}</CardTitle>
                      <CardDescription className="text-primary-foreground/80">Re: {campaign.role}</CardDescription>
                    </div>
                    <Badge 
                      variant={getStatusBadgeVariant(campaign.status)}
                      className={`${campaign.status === 'meeting' ? 'bg-accent text-accent-foreground' : ''} ${campaign.status === 'placed' ? 'bg-green-600 text-white' : ''}`}
                    >
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Subject</h4>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(campaign.subject)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm p-3 bg-muted rounded-md">{campaign.subject}</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Body</h4>
                       <Button variant="ghost" size="icon" onClick={() => handleCopy(campaign.body)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap">{campaign.body}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleDelete(campaign.id)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                  
                  {campaign.status === 'draft' && (
                    <EditCampaignDialog campaign={campaign} onCampaignUpdated={fetchCampaigns} />
                  )}

                  {['replied', 'meeting'].includes(campaign.status) && (
                    <CreatePlacementDialog campaign={campaign} onPlacementCreated={fetchCampaigns} />
                  )}

                  {campaign.status === 'draft' ? (
                    <Button onClick={() => handleUpdateStatus(campaign.id, 'sent')} className="coogi-gradient-bg text-primary-foreground hover:opacity-90">
                      <Send className="mr-2 h-4 w-4" />
                      Send Outreach
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={campaign.status === 'placed'}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Update Status</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdateStatus(campaign.id, 'replied')} disabled={campaign.status === 'replied'}>
                          Replied
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateStatus(campaign.id, 'meeting')} disabled={campaign.status === 'meeting'}>
                          Meeting Scheduled
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateStatus(campaign.id, 'closed')} disabled={campaign.status === 'closed'}>
                          Closed
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdateStatus(campaign.id, 'draft')}>
                          Revert to Draft
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
              <Bell className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">
                No Campaign Drafts Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Approve an outreach from the dashboard to generate your first draft.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Campaigns;