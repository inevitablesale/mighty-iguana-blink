import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export interface ChartDataPoint {
  name: string;
  revenue: number;
}

export function useRevenueChartData() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData([]);
        return;
      }

      const { data: placements, error } = await supabase
        .from('placements')
        .select('start_date, fee_amount')
        .eq('user_id', user.id)
        .not('start_date', 'is', null)
        .not('fee_amount', 'is', null)
        .order('start_date', { ascending: true });

      if (error) throw error;

      const monthlyRevenue = placements.reduce((acc, placement) => {
        const month = format(parseISO(placement.start_date!), 'MMM');
        acc[month] = (acc[month] || 0) + placement.fee_amount!;
        return acc;
      }, {} as Record<string, number>);

      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const chartData = Object.keys(monthlyRevenue)
        .map(month => ({
          name: month,
          revenue: monthlyRevenue[month],
        }))
        .sort((a, b) => monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name));

      setData(chartData);

    } catch (error) {
      console.error("Error fetching chart data:", error);
      toast.error("Failed to load revenue chart data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  return { data, loading, refresh: fetchChartData };
}