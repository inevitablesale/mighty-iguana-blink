import { DashboardMetrics } from "@/components/DashboardMetrics";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRevenueChartData } from "@/hooks/useRevenueChartData";
import { RevenueChart } from "@/components/RevenueChart";
import { motion } from "framer-motion";

const AnalyticsView = () => {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: chartData, loading: chartLoading } = useRevenueChartData();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <DashboardMetrics stats={stats} loading={statsLoading} />
      <RevenueChart data={chartData} loading={chartLoading} />
    </motion.div>
  );
};

export default AnalyticsView;