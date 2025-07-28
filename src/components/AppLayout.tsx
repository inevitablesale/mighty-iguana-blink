import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";

const AppLayout = () => {
  return (
    <div className="flex flex-col min-h-screen w-full coogi-gradient-bg">
      <Header title="Coogi AI" />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;