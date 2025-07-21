import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Bell, Users, Award, FileText, LineChart, X, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/", end: true, icon: <Home className="h-5 w-5" />, label: "Command Center" },
  { to: "/campaigns", icon: <Bell className="h-5 w-5" />, label: "Campaigns" },
  { to: "/agents", icon: <Users className="h-5 w-5" />, label: "Agents" },
  { to: "/placements", icon: <Award className="h-5 w-5" />, label: "Placements" },
  { to: "/proposals", icon: <FileText className="h-5 w-5" />, label: "Proposals" },
  { to: "/analytics", icon: <LineChart className="h-5 w-5" />, label: "Analytics" },
];

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const orbVariants = {
    closed: { scale: 1, rotate: 0 },
    open: { scale: 1.1, rotate: 180 },
  };

  const menuVariants = {
    closed: { opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } },
    open: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.3,
        staggerChildren: 0.05,
        delayChildren: 0.1,
      } 
    },
  };

  const itemVariants = {
    closed: { opacity: 0, y: -10 },
    open: { opacity: 1, y: 0 },
  };

  const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg coogi-gradient-bg text-primary-foreground"
        >
          <Menu />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed top-0 left-0 h-full w-64 bg-background p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <nav className="flex flex-col gap-2 pt-12">
                  {navItems.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.end} className={getLinkClassName} onClick={() => setIsOpen(false)}>
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </nav>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div
      className="fixed top-5 left-1/2 z-50 -translate-x-1/2"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <motion.div
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-card shadow-lg coogi-gradient-bg text-primary-foreground"
        variants={orbVariants}
        animate={isOpen ? "open" : "closed"}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <AnimatePresence>
          {isOpen ? <X key="x" /> : <Menu key="menu" />}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.nav
            className="absolute top-full mt-3 w-64 origin-top rounded-lg border bg-background/80 p-2 shadow-xl backdrop-blur-md"
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            {navItems.map((item) => (
              <motion.div key={item.to} variants={itemVariants}>
                <NavLink to={item.to} end={item.end} className={getLinkClassName}>
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}