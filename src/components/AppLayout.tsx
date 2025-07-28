import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

const AppLayout = () => {
  return (
    <div className="coogi-gradient-bg flex min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;