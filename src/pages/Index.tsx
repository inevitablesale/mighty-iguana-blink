import { Header } from "@/components/Header";
import { Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { useSearchParams } from "@/hooks/useSearchParams";

export default function Index(): JSX.Element {
  const { isInitialView, isLoading } = useSearchParams();

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {isInitialView && !isLoading && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
            <div className="flex flex-col items-center gap-2 text-center">
              <Bot className="h-12 w-12 text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Welcome to Coogi</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Your AI recruiting assistant. Use the command bar below or{" "}
                <Link to="/settings" className="underline text-primary">set your profile</Link>
                {" "}for automated searches.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}