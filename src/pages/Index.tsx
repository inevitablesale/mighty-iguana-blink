import { Header } from "@/components/Header";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";
import { useRecentLeads } from "@/hooks/useRecentLeads";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Index() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: chartData, loading: chartLoading } = useRevenueChartData();
  const { leads, loading: leadsLoading } = useRecentLeads();

  return (
    <div className="flex flex-col h-screen">
      <Header title="Dashboard" />
      <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-6">
        <DashboardMetrics stats={stats} loading={statsLoading} />
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <div className="lg:col-span-4">
             <RevenueChart data={chartData} loading={chartLoading} />
          </div>
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Recent Leads</CardTitle>
                <CardDescription>Your 5 most recently discovered leads.</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map(lead => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.company_name}</TableCell>
                          <TableCell>{lead.role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                 <Button asChild className="mt-4 w-full">
                  <Link to="/leads">View All Leads</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}