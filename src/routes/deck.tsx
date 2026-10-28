import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Maximize, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const SLIDE_COUNT = 11;
const SLIDE_KEY = "raise-deck-slide";
const slideSrc = (i: number) => `/deck/slide-${String(i + 1).padStart(2, "0")}.jpg`;

export const Route = createFileRoute("/deck")({
  head: () => ({ meta: [{ title: "Raise · Pitch deck" }] }),
  component: DeckPage,
});

// The current slide is remembered so "Live demo" → product → "Pitch deck" lands back on it.
function readSlide(): number {
  try {
    const n = Number(window.localStorage.getItem(SLIDE_KEY));
    return Number.isInteger(n) && n >= 0 && n < SLIDE_COUNT ? n : 0;
  } catch {
    return 0;
  }
}

function DeckPage() {
  const [slide, setSlide] = useState(0);

  useEffect(() => setSlide(readSlide()), []);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, next));
    setSlide(clamped);
    try {
      window.localStorage.setItem(SLIDE_KEY, String(clamped));
    } catch {
      // Storage can be blocked; navigation still works, it just won't be remembered.
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(slide + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(slide - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(SLIDE_COUNT - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, go]);

  useEffect(() => {
    [slide - 1, slide + 1].forEach((i) => {
      if (i >= 0 && i < SLIDE_COUNT) new Image().src = slideSrc(i);
    });
  }, [slide]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <div className="flex h-dvh flex-col bg-[#14101f] text-white">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        <img
          src={slideSrc(slide)}
          alt={`Slide ${slide + 1} of ${SLIDE_COUNT}`}
          className="max-h-full max-w-full cursor-pointer select-none object-contain"
          onClick={() => go(slide + 1)}
          draggable={false}
        />
      </div>
      <div className="flex items-center justify-between gap-3 py-2 pl-4 pr-48 text-sm">
        <a href="/" className="font-pixel text-base leading-none text-white/80 hover:text-white">
          Raise
        </a>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => go(slide - 1)}
            aria-label="Previous slide"
            disabled={slide === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="w-14 text-center tabular-nums text-white/70">
            {slide + 1} / {SLIDE_COUNT}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => go(slide + 1)}
            aria-label="Next slide"
            disabled={slide === SLIDE_COUNT - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={fullscreen} aria-label="Full screen">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" asChild>
          <a href="/">
            <Play className="h-4 w-4" /> Live demo
          </a>
        </Button>
      </div>
    </div>
  );
}
