import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Campaign, CampaignStatus } from "@/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CampaignsTableProps {
  campaigns: Campaign[];
}

const statusColors: Record<CampaignStatus, string> = {
  draft: "bg-gray-500",
  contacted: "bg-blue-500",
  replied: "bg-green-500",
  sourcing: "bg-yellow-600 text-white",
  interviewing: "bg-purple-500",
  hired: "bg-pink-500",
  archived: "bg-gray-700",
};

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10">
            <TableHead className="text-white">Company</TableHead>
            <TableHead className="text-white">Role</TableHead>
            <TableHead className="text-white">Contact</TableHead>
            <TableHead className="text-white">Status</TableHead>
            <TableHead className="text-white text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id} className="border-white/10">
              <TableCell className="font-medium text-white">{campaign.company_name}</TableCell>
              <TableCell className="text-white/80">{campaign.role}</TableCell>
              <TableCell className="text-white/80">{campaign.contact_name}</TableCell>
              <TableCell>
                <Badge className={cn("text-white", statusColors[campaign.status])}>
                  {campaign.status}
                </Badge>
              </TableCell>
              <TableCell className="text-white/80 text-right">
                {format(new Date(campaign.created_at), "MMM d, yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}