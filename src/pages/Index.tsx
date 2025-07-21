import { Header } from "@/components/Header";
import { useDashboardBriefings } from "@/hooks/useDashboardBriefings";
import { Skeleton } from "@/components/ui/skeleton";
import { AIBriefingView } from "@/components/AIBriefingView";
import { AllClearView } from "@/components/AllClearView";

export default function Index() {
  const { briefings, loading: briefingsLoading, refresh: refreshBriefings } = useDashboardBriefings();

  const renderContent = () => {
    if (briefingsLoading) {
      return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (briefings.length > 0) {
      return <AIBriefingView briefings={briefings} onBriefingComplete={refreshBriefings} />;
    }

    return <AllClearView />;
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Command Center" />
      <main className="flex-1 flex items-center justify-center p-4 lg:p-6">
        {renderContent()}
      </main>
    </div>
  );
}