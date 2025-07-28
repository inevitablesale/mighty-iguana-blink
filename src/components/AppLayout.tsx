import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

const AppLayout = () => {
  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;