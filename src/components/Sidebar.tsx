import { Bell, Briefcase, Home, Settings, Target } from "lucide-react";

export function Sidebar() {
  return (
    <div className="hidden border-r border-sidebar-border text-sidebar-foreground md:block sidebar-gradient">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <Briefcase className="h-6 w-6 text-primary" />
            <span className="text-lg">Contract Engine</span>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-all"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <Target className="h-4 w-4" />
              Opportunities
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <Bell className="h-4 w-4" />
              Campaigns
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}