export type PipelineStatus = "none" | "target" | "intro-asked" | "meeting" | "passed";

export const PIPELINE: { key: PipelineStatus; label: string }[] = [
  { key: "target", label: "Target" },
  { key: "intro-asked", label: "Intro asked" },
  { key: "meeting", label: "Meeting" },
  { key: "passed", label: "Passed" },
];
