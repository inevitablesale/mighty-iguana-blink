import { Outlet, useLocation } from "react-router-dom";
import { FloatingNav } from "./FloatingNav";
import { AnimatePresence, motion } from "framer-motion";

const AICanvas = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen w-full bg-background">
      <FloatingNav />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AICanvas;