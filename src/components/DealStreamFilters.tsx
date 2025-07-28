import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export interface Filters {
  urgency: string;
}

interface DealStreamFiltersProps {
  filters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  onReset: () => void;
}

const urgencyOptions = ["All", "High", "Medium", "Low"];

export function DealStreamFilters({ filters, onFilterChange, onReset }: DealStreamFiltersProps) {
  
  return (
    <div className="p-4 bg-black/20 border border-white/10 rounded-lg backdrop-blur-sm">
      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="urgency">Filter by Urgency</Label>
          <Select
            value={filters.urgency}
            onValueChange={(value) => onFilterChange({ ...filters, urgency: value })}
          >
            <SelectTrigger id="urgency" className="w-[180px]"><SelectValue placeholder="Select urgency" /></SelectTrigger>
            <SelectContent>
              {urgencyOptions.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="ghost" onClick={onReset}>Reset Filter</Button>
      </div>
    </div>
  );
}