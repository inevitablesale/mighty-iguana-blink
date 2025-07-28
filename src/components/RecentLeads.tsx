import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity } from "@/types";
import { Badge } from "./ui/badge";

interface RecentLeadsProps {
  leads: Opportunity[];
  loading: boolean;
}

export function RecentLeads({ leads, loading }: RecentLeadsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Leads</CardTitle>
        <CardDescription>
          Your most recently discovered opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {leads.length > 0 ? leads.map(lead => (
          <div key={lead.id} className="flex items-center gap-4">
            <Avatar className="hidden h-9 w-9 sm:flex">
              <AvatarFallback>{lead.company_name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <p className="text-sm font-medium leading-none">{lead.company_name}</p>
              <p className="text-sm text-muted-foreground truncate">{lead.role}</p>
            </div>
            <div className="ml-auto font-medium">
              <Badge variant="outline">{lead.match_score}/10</Badge>
            </div>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground text-center py-8">No recent leads found. Run a playbook to get started!</p>
        )}
      </CardContent>
    </Card>
  )
}