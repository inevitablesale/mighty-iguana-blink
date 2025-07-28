import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Flame, MapPin, Star, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

interface DealCardProps {
  opportunity: Opportunity;
}

const getUrgency = (urgency: string | undefined) => {
  switch (urgency) {
    case 'High':
      return { text: 'High Urgency', icon: <Flame className="h-3 w-3" />, color: 'text-red-400' };
    default:
      return { text: 'Standard Urgency', icon: <Flame className="h-3 w-3" />, color: 'text-muted-foreground' };
  }
};

export const DealCard = ({ opportunity }: DealCardProps) => {
  const [contactStatus, setContactStatus] = useState({
    text: 'Matching Hiring Manager...',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: 'text-muted-foreground'
  });

  useEffect(() => {
    const fetchContact = async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('job_title')
        .eq('opportunity_id', opportunity.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error(`Error fetching contact for opportunity ${opportunity.id}:`, error);
        // Keep the loading state on error to avoid showing incorrect info
        return;
      }

      if (data && data.length > 0 && data[0].job_title) {
        setContactStatus({
          text: `Contact Found: ${data[0].job_title}`,
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'text-green-400'
        });
      }
      // If no contact is found, the status will remain "Matching..."
    };

    const timer = setTimeout(fetchContact, 1500);
    return () => clearTimeout(timer);
  }, [opportunity.id]);

  const urgency = getUrgency(opportunity.hiring_urgency);

  return (
    <Link to={`/deal/${opportunity.id}`} className="block h-full">
      <Card className="w-full h-full bg-black/20 border-white/10 text-white backdrop-blur-sm transition-all hover:border-primary/50 cursor-pointer flex flex-col">
        <CardHeader className="p-4">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-base font-bold text-foreground">{opportunity.company_name}</CardTitle>
            <Badge variant="secondary" className="flex-shrink-0 px-2 py-1 text-xs font-bold">
              <Star className="h-3 w-3 mr-1.5 text-yellow-400" />
              {opportunity.match_score}/10 Fit
            </Badge>
          </div>
          <CardDescription className="text-sm text-primary font-medium">{opportunity.role}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow space-y-2 text-xs">
            <div className={`flex items-center gap-1.5 ${urgency.color}`}>
                {urgency.icon}
                <span>{urgency.text}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin size={12} />
                <span>{opportunity.location}</span>
            </div>
        </CardContent>
        <CardFooter className="p-3 bg-black/30 border-t border-white/20 flex justify-between items-center mt-auto">
            <div className={`flex items-center gap-1.5 text-xs ${contactStatus.color}`}>
                {contactStatus.icon}
                <span className="truncate">{contactStatus.text}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center">
              View Intel <ArrowRight className="ml-2 h-3 w-3" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};