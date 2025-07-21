import { Outlet } from "react-router-dom";
import { FloatingNav } from "./FloatingNav";
import { AnimatePresence } from "framer-motion";

const AICanvas = () => {
  return (
    <div className="min-h-screen w-full bg-background">
      <FloatingNav />
      <AnimatePresence mode="wait">
        <Outlet />
      </AnimatePresence>
    </div>
  );
};

export default AICanvas;