import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Send } from "lucide-react";
import { DashboardStats } from "@/hooks/useDashboardStats";

interface CampaignPipelineProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function CampaignPipeline({ stats, loading }: CampaignPipelineProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Pipeline</CardTitle>
          <CardDescription>A visual overview of your outreach status.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Pipeline</CardTitle>
        <CardDescription>A visual overview of your outreach status.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-muted/50 border">
          <Edit className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-3xl font-bold">{stats?.outreachDrafted ?? 0}</p>
          <p className="text-sm text-muted-foreground">Drafts</p>
        </div>
        <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-muted/50 border">
          <Send className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-3xl font-bold">{stats?.outreachSent ?? 0}</p>
          <p className="text-sm text-muted-foreground">Sent</p>
        </div>
      </CardContent>
    </Card>
  );
}