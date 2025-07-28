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
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Mail, Phone, Users } from "lucide-react";
import { Badge } from "./ui/badge";

interface DeepScrapeDialogProps {
  companyName: string;
  children: React.ReactNode;
}

interface ScrapeResult {
  url: string;
  emails: string[];
  phoneNumbers: string[];
  socialMedia: { platform: string; url: string; }[];
}

export function DeepScrapeDialog({ companyName, children }: DeepScrapeDialogProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ScrapeResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !results) {
      setLoading(true);
      const toastId = toast.loading(`Performing deep web scrape for ${companyName}...`);
      try {
        const { data, error } = await supabase.functions.invoke('run-deep-web-scrape', {
          body: { companyName },
        });

        if (error) throw new Error(error.message);
        
        setResults(data.results);
        toast.success("Scrape complete!", { id: toastId });
      } catch (e) {
        const err = e as Error;
        console.error("Error during deep scrape:", err);
        toast.error(err.message, { id: toastId });
      } finally {
        setLoading(false);
      }
    }
  };

  const renderSection = (title: string, icon: React.ReactNode, items: (string | { url: string })[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div>
        <h4 className="font-semibold mb-2 flex items-center gap-2">{icon} {title}</h4>
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <Badge key={index} variant="secondary">{typeof item === 'string' ? item : item.url}</Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deep Scrape Results: {companyName}</DialogTitle>
          <DialogDescription>
            Contact information found on the company's website.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            {results.map((result, i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Globe size={16} /> {result.url}</h3>
                {renderSection("Emails", <Mail size={14}/>, result.emails)}
                {renderSection("Phone Numbers", <Phone size={14}/>, result.phoneNumbers)}
                {renderSection("Social Media", <Users size={14}/>, result.socialMedia)}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground">No contact information found.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}