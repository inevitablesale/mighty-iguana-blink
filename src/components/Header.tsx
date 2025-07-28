import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
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

  return (
    <header className="flex h-14 items-center gap-4 px-4 lg:h-[60px] lg:px-6 bg-black/10 backdrop-blur-sm border-b border-white/10">
      <a href="/" className="flex items-center gap-2 font-semibold text-white">
        <SweaterIcon className="h-6 w-6" />
        <span className="text-lg">{title}</span>
      </a>

      <div className="w-full flex-1">
        {/* Future elements can go here */}
      </div>

      {loading ? (
        <Skeleton className="h-10 w-10 rounded-full" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 border border-white/20">
              <Avatar>
                <AvatarImage src="" alt="User avatar" />
                <AvatarFallback className="bg-transparent text-white">{getInitials()}</AvatarFallback>
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