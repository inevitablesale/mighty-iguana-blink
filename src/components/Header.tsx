import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, User, Menu, Home, Target, Bell, Users, Award, FileText } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SweaterIcon } from "./SweaterIcon";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getInitials = () => {
    if (!profile) return "U";
    const { first_name, last_name } = profile;
    if (first_name && last_name) {
      return `${first_name[0]}${last_name[0]}`;
    }
    if (first_name) {
      return first_name.substring(0, 2);
    }
    return "U";
  };

  const getMobileLinkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "flex items-center gap-4 rounded-xl bg-muted px-3 py-2 text-primary"
      : "flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground";

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col">
            <nav className="grid gap-2 text-lg font-medium">
              <NavLink
                to="/"
                className="mb-4 flex items-center gap-2 text-lg font-semibold"
              >
                <SweaterIcon className="h-6 w-6 text-primary" />
                <span>Coogi</span>
              </NavLink>
              <NavLink to="/" end className={getMobileLinkClassName}>
                <Home className="h-5 w-5" />
                Dashboard
              </NavLink>
              <NavLink to="/opportunities" className={getMobileLinkClassName}>
                <Target className="h-5 w-5" />
                Opportunities
              </NavLink>
              <NavLink to="/campaigns" className={getMobileLinkClassName}>
                <Bell className="h-5 w-5" />
                Campaigns
              </NavLink>
              <NavLink to="/agents" className={getMobileLinkClassName}>
                <Users className="h-5 w-5" />
                Agents
              </NavLink>
              <NavLink to="/placements" className={getMobileLinkClassName}>
                <Award className="h-5 w-5" />
                Placements
              </NavLink>
              <NavLink to="/proposals" className={getMobileLinkClassName}>
                <FileText className="h-5 w-5" />
                Proposals
              </NavLink>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold md:text-2xl">{title}</h1>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-10 rounded-full" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src="" alt="User avatar" />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}