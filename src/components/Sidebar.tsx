import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Home,
  LineChart,
  Package,
  Package2,
  ShoppingCart,
  Users,
  Award,
  FileText,
  Mail,
  Search,
  Settings,
  LayoutGrid,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useExtension } from "@/context/ExtensionContext";
import { ExtensionStatusIndicator } from "./ExtensionStatusIndicator";
import { ExtensionLogDialog } from "./ExtensionLogDialog";
import { SweaterIcon } from "./SweaterIcon";

const navLinks = [
  { to: "/", icon: <LayoutGrid className="h-5 w-5" />, text: "Dashboard" },
  { to: "/opportunities", icon: <Search className="h-5 w-5" />, text: "Opportunities" },
  { to: "/campaigns", icon: <Mail className="h-5 w-5" />, text: "Campaigns" },
  { to: "/proposals", icon: <FileText className="h-5 w-5" />, text: "Proposals" },
  { to: "/placements", icon: <Award className="h-5 w-5" />, text: "Placements" },
  { to: "/profile", icon: <Settings className="h-5 w-5" />, text: "Settings" },
];

export function Sidebar() {
  const { extensionStatus, extensionMessage } = useExtension();
  const navigate = useNavigate();

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <SweaterIcon className="h-6 w-6 text-primary" />
            <span className="">Coogi</span>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                    isActive ? "bg-muted text-primary" : "text-muted-foreground"
                  }`
                }
              >
                {link.icon}
                {link.text}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">EXTENSION STATUS</p>
            <ExtensionLogDialog />
          </div>
          <ExtensionStatusIndicator status={extensionStatus} message={extensionMessage} />
        </div>
      </div>
    </div>
  );
}