import { Bot } from "lucide-react";
import { Link } from "react-router-dom";

export function AllClearView() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-6 h-full">
      <div className="flex flex-col items-center gap-2 text-center">
        <Bot className="h-12 w-12 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">All Systems Nominal</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          All opportunities have been reviewed. Your agents are actively monitoring for new leads.
          You can manage your agents on the <Link to="/agents" className="underline text-primary">Agents page</Link>.
        </p>
      </div>
    </div>
  );
}