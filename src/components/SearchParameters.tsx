import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SearchParametersProps {
  params: {
    role?: string | null;
    location?: string | null;
    quantity?: number | null;
    vertical?: string | null;
    keywords?: string[] | null;
  };
}

export function SearchParameters({ params }: SearchParametersProps) {
  const renderParam = (label: string, value: string | number | string[] | null | undefined) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null;
    }
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">{label}</span>
        {Array.isArray(value) ? (
          <div className="flex flex-wrap justify-end gap-1">
            {value.map((kw, i) => <Badge key={i} variant="secondary">{kw}</Badge>)}
          </div>
        ) : (
          <span className="font-semibold text-right">{value.toString()}</span>
        )}
      </div>
    );
  };

  return (
    <Card className="mt-4 bg-background/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Search Criteria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {renderParam("Role", params.role)}
        {renderParam("Location", params.location)}
        {renderParam("Quantity", params.quantity)}
        {renderParam("Vertical", params.vertical)}
        {renderParam("Keywords", params.keywords)}
      </CardContent>
    </Card>
  );
}