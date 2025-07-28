import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export interface Filters {
  roleType: string;
  dealSignals: string[];
  companySignals: string[];
  urgency: string;
}

interface DealStreamFiltersProps {
  filters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  onReset: () => void;
}

const roleTypes = ["All", "Leadership", "Sales", "Tech"];
const dealSignalOptions = ["Strategic Hire"];
const companySignalOptions = ["No TA Team", "Recent Funding"];
const urgencyOptions = ["All", "Immediate", "Standard", "Slow Mover"];

export function DealStreamFilters({ filters, onFilterChange, onReset }: DealStreamFiltersProps) {
  
  const handleCheckboxChange = (category: 'dealSignals' | 'companySignals', value: string, checked: boolean) => {
    const currentValues = filters[category];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    onFilterChange({ ...filters, [category]: newValues });
  };

  return (
    <div className="p-4 bg-black/20 border border-white/10 rounded-lg backdrop-blur-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="role-type">Role Type</Label>
          <Select
            value={filters.roleType}
            onValueChange={(value) => onFilterChange({ ...filters, roleType: value })}
          >
            <SelectTrigger id="role-type"><SelectValue placeholder="Select role type" /></SelectTrigger>
            <SelectContent>
              {roleTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="urgency">Urgency</Label>
          <Select
            value={filters.urgency}
            onValueChange={(value) => onFilterChange({ ...filters, urgency: value })}
          >
            <SelectTrigger id="urgency"><SelectValue placeholder="Select urgency" /></SelectTrigger>
            <SelectContent>
              {urgencyOptions.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Deal & Company Signals</Label>
          <div className="space-y-2 pt-2">
            {dealSignalOptions.map(signal => (
              <div key={signal} className="flex items-center space-x-2">
                <Checkbox
                  id={`deal-${signal}`}
                  checked={filters.dealSignals.includes(signal)}
                  onCheckedChange={(checked) => handleCheckboxChange('dealSignals', signal, !!checked)}
                />
                <Label htmlFor={`deal-${signal}`} className="font-normal">{signal}</Label>
              </div>
            ))}
             {companySignalOptions.map(signal => (
              <div key={signal} className="flex items-center space-x-2">
                <Checkbox
                  id={`company-${signal}`}
                  checked={filters.companySignals.includes(signal)}
                  onCheckedChange={(checked) => handleCheckboxChange('companySignals', signal, !!checked)}
                />
                <Label htmlFor={`company-${signal}`} className="font-normal">{signal}</Label>
              </div>
            ))}
          </div>
        </div>
        
        <Button variant="ghost" onClick={onReset} className="w-full sm:w-auto justify-self-end">Reset Filters</Button>
      </div>
    </div>
  );
}