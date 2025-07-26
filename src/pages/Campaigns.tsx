import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Campaign, CampaignStatus } from "@/types/index";
import { CampaignCard } from "@/components/CampaignCard";
import { Bell } from "lucide-react";

const filterStatuses: (CampaignStatus | 'all')[] = ['all', 'draft', 'contacted', 'replied', 'interviewing', 'hired'];

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CampaignStatus | 'all'>('all');

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
      toast.error("Failed to load campaigns.");
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

  const filteredCampaigns = useMemo(() => {
    if (activeFilter === 'all') {
      return campaigns;
    }
    return campaigns.filter(c => c.status === activeFilter);
  }, [campaigns, activeFilter]);

  return (
    <div className="flex flex-col">
      <Header title="Campaigns" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Outreach Campaigns</h1>
            <p className="text-muted-foreground">Manage your outreach and track progress from draft to placement.</p>
          </div>
          <div className="flex items-center gap-2">
            {filterStatuses.map(status => (
              <Button
                key={status}
                variant={activeFilter === status ? "default" : "outline"}
                onClick={() => setActiveFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onCampaignUpdated={fetchCampaigns}
                onDelete={handleDelete}
                onUpdateStatus={handleUpdateStatus}
                onPlacementCreated={fetchCampaigns}
                onProposalCreated={fetchCampaigns}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24 mt-8">
            <div className="flex flex-col items-center gap-1 text-center">
              <Bell className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">No Campaigns Found</h3>
              <p className="text-sm text-muted-foreground">
                {activeFilter === 'all' 
                  ? "Draft an email from the Leads page to start a campaign."
                  : `No campaigns with the status "${activeFilter}".`}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Campaigns;