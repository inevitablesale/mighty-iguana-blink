import { Header } from "@/components/Header";

const Proposals = () => {
  return (
    <div className="flex flex-col h-full">
      <Header title="Proposals" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold md:text-2xl">Proposals</h1>
        </div>
        <div
          className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Proposal data will be displayed here.
            </h3>
            <p className="text-sm text-muted-foreground">
              Proposals are generated from the chat interface.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Proposals;