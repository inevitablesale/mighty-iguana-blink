import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SweaterIcon } from "./SweaterIcon";
import { useUserProfile } from "@/hooks/useUserProfile";

interface SearchSummaryProps {
  userQuery: string;
  aiResponse: {
    search_query: string;
    location: string;
    recruiter_specialty: string;
  };
}

export function SearchSummary({ userQuery, aiResponse }: SearchSummaryProps) {
  const { profile } = useUserProfile();

  const getInitials = () => {
    if (!profile) return "U";
    const { first_name, last_name } = profile;
    if (first_name && last_name) return `${first_name[0]}${last_name[0]}`;
    if (first_name) return first_name.substring(0, 2);
    return "U";
  };

  return (
    <div className="space-y-4 mb-8">
      {/* User's Query */}
      <div className="flex items-start gap-4 justify-end">
        <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-xl">
          <p>{userQuery}</p>
        </div>
        <Avatar>
          <AvatarFallback>{getInitials()}</AvatarFallback>
        </Avatar>
      </div>

      {/* AI's Response */}
      <div className="flex items-start gap-4">
        <Avatar>
          <AvatarFallback>
            <SweaterIcon className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="bg-muted p-4 rounded-lg max-w-xl">
          <p className="font-semibold">Great! Here's how I've interpreted your search:</p>
          <div className="mt-2 text-sm text-muted-foreground bg-background/50 p-3 rounded-md">
            Searching for <span className="font-bold text-foreground">{aiResponse.search_query}</span> in <span className="font-bold text-foreground">{aiResponse.location}</span>.
            <br />
            My understanding of your specialty is: <span className="italic">"{aiResponse.recruiter_specialty}"</span>
          </div>
        </div>
      </div>
    </div>
  );
}