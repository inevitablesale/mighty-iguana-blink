import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Briefcase, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Placement } from "@/types/index";
import { format } from 'date-fns';

const Placements = () => {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('placements')
      .select(`
        *,
        campaigns (
          company_name,
          role
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching placements:", error);
      toast.error("Failed to load placements.");
    } else {
      const fetchedPlacements = data as Placement[];
      setPlacements(fetchedPlacements);
      const revenue = fetchedPlacements.reduce((sum, p) => sum + (p.fee_amount || 0), 0);
      setTotalRevenue(revenue);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  const renderLoadingState = () => (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex flex-col">
      <Header title="Placements" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">From all successful placements</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Placements</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{placements.length}</div>
                  <p className="text-xs text-muted-foreground">Candidates successfully placed</p>
                </CardContent>
              </Card>
            </div>

            {placements.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {placements.map((placement) => (
                  <Card key={placement.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {placement.candidate_name}
                        <Badge variant="secondary">{placement.status}</Badge>
                      </CardTitle>
                      <CardDescription>
                        Placement at {placement.campaigns?.company_name || 'N/A'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm">
                        <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{placement.campaigns?.role || 'N/A'}</span>
                      </div>
                      {placement.start_date && (
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>Starts on {format(new Date(placement.start_date), 'PPP')}</span>
                        </div>
                      )}
                      {placement.fee_amount && (
                        <div className="flex items-center text-sm">
                          <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>Fee: ${placement.fee_amount.toLocaleString()}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Award className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">
                    No Placements Yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Mark a campaign as "Placed" to log your first success.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Placements;