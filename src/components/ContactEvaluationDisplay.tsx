import { ContactEvaluation } from '@/types';
import { ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContactEvaluationDisplayProps {
  evaluation: ContactEvaluation;
}

const statusConfig = {
  'Good Match': {
    icon: <ThumbsUp className="h-4 w-4 text-green-600" />,
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
  },
  'Potential Fit': {
    icon: <HelpCircle className="h-4 w-4 text-yellow-600" />,
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  'Not a Match': {
    icon: <ThumbsDown className="h-4 w-4 text-red-600" />,
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
};

export function ContactEvaluationDisplay({ evaluation }: ContactEvaluationDisplayProps) {
  const config = statusConfig[evaluation.status] || statusConfig['Potential Fit'];

  return (
    <div className="mt-3 p-3 bg-muted/70 rounded-md border">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className={config.badgeClass}>
          {config.icon}
          <span className="ml-1.5 font-semibold">{evaluation.status}</span>
        </Badge>
        <div className="text-sm font-bold text-primary">{evaluation.score}/10</div>
      </div>
      <p className="text-sm text-muted-foreground">{evaluation.reasoning}</p>
    </div>
  );
}