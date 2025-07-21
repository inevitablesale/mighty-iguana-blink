import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Agent } from "@/types/index";

interface AgentBriefingCardProps {
  agent: Agent;
  opportunityCount: number;
  onStartReview: () => void;
}

export function AgentBriefingCard({ agent, opportunityCount, onStartReview }: AgentBriefingCardProps) {
  return (
    <Card className="coogi-gradient-bg text-primary-foreground">
      <CardHeader>
        <CardTitle>{agent.name}</CardTitle>
        <CardDescription className="text-primary-foreground/80">
          This agent has found {opportunityCount} new high-potential opportunities for your review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm italic border-l-2 border-primary-foreground/50 pl-3">
          "{agent.prompt}"
        </p>
      </CardContent>
      <CardFooter>
        <Button 
          variant="secondary" 
          onClick={onStartReview}
          className="ml-auto"
        >
          Start Briefing <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}