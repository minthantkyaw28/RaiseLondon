import { createFileRoute } from "@tanstack/react-router";

const DECK_URL = "/raise-deck.pdf";

export const Route = createFileRoute("/deck")({
  head: () => ({ meta: [{ title: "Raise · Pitch deck" }] }),
  component: DeckPage,
});

function DeckPage() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <a href="/" className="font-pixel text-lg leading-none">
          Raise
        </a>
        <a
          href={DECK_URL}
          download="Raise Presentation.pdf"
          className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-accent"
        >
          Download PDF
        </a>
      </header>
      <iframe title="Raise pitch deck" src={DECK_URL} className="w-full flex-1 border-0" />
    </div>
  );
}
