import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeedbackControlProps {
  contentId: string;
  contentType: string;
  userId: string;
}

export function FeedbackControl({ contentId, contentType, userId }: FeedbackControlProps) {
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchFeedback = async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('rating')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .maybeSingle(); // Use maybeSingle to gracefully handle 0 or 1 results

      if (error) {
        console.error("Error fetching feedback", error);
      } else if (data) {
        setFeedback(data.rating as 'good' | 'bad');
      }
    };
    fetchFeedback();
  }, [contentId, contentType, userId]);

  const handleFeedback = async (rating: 'good' | 'bad') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const originalFeedback = feedback;
    setFeedback(rating);

    const { error } = await supabase.from('feedback').upsert({
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      rating: rating,
    }, { onConflict: 'user_id, content_id, content_type' });

    if (error) {
      toast.error('Failed to submit feedback.');
      setFeedback(originalFeedback);
    } else {
      toast.success('Thank you for your feedback!');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", feedback === 'good' && 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300')}
        onClick={() => handleFeedback('good')}
        disabled={isSubmitting}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", feedback === 'bad' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300')}
        onClick={() => handleFeedback('bad')}
        disabled={isSubmitting}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}