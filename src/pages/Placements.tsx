import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Building, Briefcase, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Placement } from "@/types/index";
import { format } from 'date-fns';

const Placements = () => {
  const [placements, setPlacements] = useState<Placement[]>([]);
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
      setPlacements(data as Placement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  const renderLoadingState = () => (
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
  );

  return (
    <div className="flex flex-col">
      <Header title="Placements" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {loading ? (
          renderLoadingState()
        ) : placements.length > 0 ? (
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
      </main>
    </div>
  );
};

export default Placements;