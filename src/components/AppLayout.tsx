import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

const AppLayout = () => {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <main className="flex flex-1 flex-col bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;