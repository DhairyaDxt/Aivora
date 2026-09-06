// This route is superseded by the goLive server function in src/lib/voice.functions.ts.
// Kept as a placeholder to avoid route-tree regeneration issues.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice/go-live")({
  component: () => null,
});
