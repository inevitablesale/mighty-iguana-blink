import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

const AppLayout = () => {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <Outlet />
    </div>
  );
};

export default AppLayout;