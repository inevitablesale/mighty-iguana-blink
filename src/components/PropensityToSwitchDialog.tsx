import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PropensityToSwitchAnalysis } from "@/types/index";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";

interface PropensityToSwitchDialogProps {
  opportunityId: string;
  companyName: string;
  children: React.ReactNode;
}

export function PropensityToSwitchDialog({ opportunityId, companyName, children }: PropensityToSwitchDialogProps) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<PropensityToSwitchAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !analysis) {
      setLoading(true);
      const toastId = toast.loading(`Analyzing hiring urgency for ${companyName}...`);
      try {
        const { data, error } = await supabase.functions.invoke('analyze-propensity-to-switch', {
          body: { opportunityId },
        });

        if (error) throw new Error(error.message);

        setAnalysis(data.analysis);
        toast.success("Analysis complete!", { id: toastId });
      } catch (e) {
        const err = e as Error;
        console.error("Error analyzing propensity to switch:", err);
        toast.error(err.message, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
  };

  const renderSignalList = (signals: string[], positive: boolean) => {
    if (!signals || signals.length === 0) {
      return <p className="text-sm text-muted-foreground">No specific signals identified.</p>;
    }
    return (
      <ul className="space-y-2">
        {signals.map((signal, index) => (
          <li key={index} className="flex items-start gap-2">
            {positive ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />}
            <span className="text-sm text-muted-foreground">{signal}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Propensity Analysis: {companyName}</DialogTitle>
          <DialogDescription>
            AI-powered assessment of hiring urgency and team motivation.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : analysis ? (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="text-center bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Motivation Score</p>
              <p className="text-5xl font-bold text-primary">{analysis.score}/10</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600"><TrendingUp size={16} /> Positive Signals</h4>
              {renderSignalList(analysis.positive_signals, true)}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-600"><TrendingDown size={16} /> Negative Signals</h4>
              {renderSignalList(analysis.negative_signals, false)}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground">Could not generate analysis.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}