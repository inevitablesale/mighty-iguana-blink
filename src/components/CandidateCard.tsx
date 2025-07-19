import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Mail } from "lucide-react";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  linkedin_url: string;
  resume_summary: string;
  match_score: number;
  status: string;
}

interface CandidateCardProps {
  candidate: Candidate;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>{candidate.name}</CardTitle>
          <Badge variant="secondary">{candidate.status}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
          <div className="flex items-center gap-2">
            <Progress value={candidate.match_score} className="h-2 w-24" />
            <span>{candidate.match_score}% Match</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{candidate.resume_summary}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="icon" asChild>
          <a href={`mailto:${candidate.email}`} target="_blank" rel="noopener noreferrer">
            <Mail className="h-4 w-4" />
          </a>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
            <Linkedin className="h-4 w-4" />
          </a>
        </Button>
        <Button>Initiate Outreach</Button>
      </CardFooter>
    </Card>
  );
}