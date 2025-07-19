import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Bell } from "lucide-react";

const Campaigns = () => {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">Campaigns</h1>
          </div>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
              <Bell className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-2xl font-bold tracking-tight">
                Outreach Campaigns
              </h3>
              <p className="text-sm text-muted-foreground">
                AI-generated outreach drafts will appear here for your review.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Campaigns;