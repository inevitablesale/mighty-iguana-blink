import { Bell, Home, Target, Users, Award } from "lucide-react";
import { NavLink } from "react-router-dom";
import { SweaterIcon } from "./SweaterIcon";

export function Sidebar(): JSX.Element {
  const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-all"
      : "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-white/10 hover:text-sidebar-foreground";

  return (
    <div className="hidden border-r border-sidebar-border text-sidebar-foreground md:block sidebar-gradient">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <SweaterIcon className="h-6 w-6 text-primary" />
            <span className="text-lg">Coogi</span>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <NavLink to="/" end className={getLinkClassName}>
              <Home className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink to="/opportunities" className={getLinkClassName}>
              <Target className="h-4 w-4" />
              Opportunities
            </NavLink>
            <NavLink to="/campaigns" className={getLinkClassName}>
              <Bell className="h-4 w-4" />
              Campaigns
            </NavLink>
            <NavLink to="/agents" className={getLinkClassName}>
              <Users className="h-4 w-4" />
              Agents
            </NavLink>
            <NavLink to="/placements" className={getLinkClassName}>
              <Award className="h-4 w-4" />
              Placements
            </NavLink>
          </nav>
        </div>
      </div>
    </div>
  );
}