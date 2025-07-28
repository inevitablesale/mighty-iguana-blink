import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Linkedin } from "lucide-react";
import { TalentPoolProfile } from "@/types";

interface TalentProfileCardProps {
  profile: TalentPoolProfile;
}

export function TalentProfileCard({ profile }: TalentProfileCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle>{profile.name}</CardTitle>
          <CardDescription>{profile.title}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex justify-end">
        {profile.linkedin_url && (
          <Button asChild variant="outline" size="sm">
            <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
              <Linkedin className="mr-2 h-4 w-4" />
              View on LinkedIn
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}