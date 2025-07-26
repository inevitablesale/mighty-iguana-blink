import { Home, Target, Briefcase, Bot, Award, FileText } from "lucide-react";
import { NavLink } from "react-router-dom";
import { SweaterIcon } from "./SweaterIcon";
import { useExtension } from "@/context/ExtensionContext";
import { ExtensionStatusIndicator } from "./ExtensionStatusIndicator";

export function Sidebar(): JSX.Element {
  const getLinkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-all"
      : "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-white/10 hover:text-sidebar-foreground";

  const { extensionStatus, extensionMessage } = useExtension();

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
            <NavLink to="/leads" className={getLinkClassName}>
              <Target className="h-4 w-4" />
              Leads
            </NavLink>
            <NavLink to="/campaigns" className={getLinkClassName}>
              <Briefcase className="h-4 w-4" />
              Campaigns
            </NavLink>
            <NavLink to="/playbooks" className={getLinkClassName}>
              <Bot className="h-4 w-4" />
              Playbooks
            </NavLink>
            <NavLink to="/placements" className={getLinkClassName}>
              <Award className="h-4 w-4" />
              Placements
            </NavLink>
            <NavLink to="/proposals" className={getLinkClassName}>
              <FileText className="h-4 w-4" />
              Proposals
            </NavLink>
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-sidebar-border space-y-2">
          <h4 className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">Extension Status</h4>
          <div className="text-sidebar-foreground/80">
            <ExtensionStatusIndicator status={extensionStatus} message={extensionMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}