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
import { CompanyBriefing, NewsItem } from "@/types/index";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface CompanyBriefingDialogProps {
  companyName: string;
  children: React.ReactNode;
}

export function CompanyBriefingDialog({ companyName, children }: CompanyBriefingDialogProps) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState<CompanyBriefing | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !briefing) {
      setLoading(true);
      const toastId = toast.loading(`Generating briefing for ${companyName}...`);
      try {
        const { data, error } = await supabase.functions.invoke('generate-company-briefing', {
          body: { companyName },
        });

        if (error) throw new Error(error.message);

        setBriefing(data.briefing);
        toast.success("Briefing generated successfully!", { id: toastId });
      } catch (e) {
        const err = e as Error;
        console.error("Error generating briefing:", err);
        toast.error(err.message, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
  };

  const renderNewsList = (newsItems: NewsItem[]) => {
    if (!newsItems || newsItems.length === 0) {
      return <p>No recent significant news found in the last 6 months.</p>;
    }
    return (
      <ul className="space-y-3">
        {newsItems.map((item, index) => (
          <li key={index}>
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.source} &bull; {item.date}</p>
          </li>
        ))}
      </ul>
    );
  };

  const renderBulletedList = (text: string) => {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {text.split('\\n- ').map((item, index) => item.trim() && <li key={index}>{item.replace(/^- /, '')}</li>)}
      </ul>
    );
  };

  const renderTechStack = (text: string) => {
    return (
      <div className="flex flex-wrap gap-2">
        {text.split(',').map((item, index) => <Badge key={index} variant="secondary">{item.trim()}</Badge>)}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Company Briefing: {companyName}</DialogTitle>
          <DialogDescription>
            An AI-generated overview to help you prepare for outreach.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-full" />
            <Separator />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-full" />
            <Separator />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : briefing ? (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div>
              <h4 className="font-semibold mb-2 text-primary">Overview</h4>
              <p className="text-sm text-muted-foreground">{briefing.overview}</p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 text-primary">Recent News</h4>
              <div className="text-sm text-muted-foreground">{renderNewsList(briefing.recentNews)}</div>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 text-primary">Key Personnel</h4>
              <div className="text-sm text-muted-foreground">{renderBulletedList(briefing.keyPersonnel)}</div>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 text-primary">Potential Tech Stack</h4>
              {renderTechStack(briefing.techStack)}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 text-primary">Hiring Analysis</h4>
              <p className="text-sm text-muted-foreground">{briefing.hiringAnalysis}</p>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground">Could not generate briefing.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}