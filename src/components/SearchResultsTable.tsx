import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Opportunity } from "@/types/index";
import { SearchResultRow } from "./SearchResultRow";

interface SearchResultsTableProps {
  opportunities: Opportunity[];
}

export function SearchResultsTable({ opportunities }: SearchResultsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Company</TableHead>
            <TableHead className="w-[35%]">Role</TableHead>
            <TableHead>Match Score</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opportunity, index) => (
            <SearchResultRow
              key={`${opportunity.company_name}-${opportunity.role}-${index}`}
              opportunity={opportunity}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}