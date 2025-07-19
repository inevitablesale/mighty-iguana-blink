import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Send, Award, DollarSign } from "lucide-react";
import { DashboardStats } from "@/hooks/useDashboardStats";

interface DashboardMetricsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function DashboardMetrics({ stats, loading }: DashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(stats?.totalRevenue ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">From all placements</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Placements</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalPlacements ?? 0}</div>
          <p className="text-xs text-muted-foreground">Successful placements made</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalOpportunities ?? 0}</div>
          <p className="text-xs text-muted-foreground">All opportunities found by AI</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outreach Sent</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.outreachSent ?? 0}</div>
          <p className="text-xs text-muted-foreground">Total emails sent to prospects</p>
        </CardContent>
      </Card>
    </div>
  );
}