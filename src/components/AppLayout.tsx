import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

const AppLayout = () => {
  return (
    <div className="flex min-h-screen w-full coogi-gradient-bg text-white">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;