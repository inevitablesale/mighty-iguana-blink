import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings, Bot, Briefcase, Flame, LayoutGrid } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SweaterIcon } from "./SweaterIcon";
import { useExtension } from "@/context/ExtensionContext";
import { ExtensionStatusIndicator } from "./ExtensionStatusIndicator";
import { ExtensionLogDialog } from "./ExtensionLogDialog";
import { ProfileDialog } from "./ProfileDialog";

export function Sidebar() {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();
  const { extensionStatus, extensionMessage } = useExtension();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getInitials = () => {
    if (!profile) return "U";
    const { first_name, last_name } = profile;
    if (first_name && last_name) return `${first_name[0]}${last_name[0]}`;
    if (first_name) return first_name.substring(0, 2);
    return "U";
  };

  return (
    <div className="hidden border-r border-white/10 bg-black/20 p-4 md:flex md:flex-col md:w-72 backdrop-blur-sm">
      <div className="flex h-14 items-center mb-4">
        <a href="/" className="flex items-center gap-2 font-semibold text-white">
          <SweaterIcon className="h-6 w-6" />
          <span className="text-lg">Coogi AI</span>
        </a>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto">
        <nav className="space-y-1">
          <Button variant="ghost" className="w-full justify-start text-base" onClick={() => navigate('/')}>
            <LayoutGrid className="mr-3 h-5 w-5" />
            Deal Stream
          </Button>
          <Button variant="ghost" className="w-full justify-start text-base" onClick={() => navigate('/pipeline')}>
            <Briefcase className="mr-3 h-5 w-5" />
            Pipeline
          </Button>
          <Button variant="ghost" className="w-full justify-start text-base" onClick={() => navigate('/agents')}>
            <Bot className="mr-3 h-5 w-5" />
            Agents
          </Button>
          <Button variant="ghost" className="w-full justify-start text-base" onClick={() => navigate('/market')}>
            <Flame className="mr-3 h-5 w-5" />
            Market Intel
          </Button>
        </nav>
        <div>
          <h3 className="text-xs font-semibold uppercase text-sidebar-foreground/70 mb-2 px-3">Extension Status</h3>
          <div className="flex items-center gap-2 px-3">
            <ExtensionStatusIndicator status={extensionStatus} message={extensionMessage} />
            <ExtensionLogDialog />
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start items-center gap-3 p-2 h-auto text-left">
              {loading ? (
                <Skeleton className="h-10 w-10 rounded-full" />
              ) : (
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" alt="User avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground">{getInitials()}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col">
                {loading ? (
                  <>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{profile?.first_name} {profile?.last_name}</span>
                    <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                  </>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><ProfileDialog /></DropdownMenuItem>
            <DropdownMenuItem disabled><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Logout</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}