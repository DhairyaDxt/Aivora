import { createFileRoute } from "@tanstack/react-router";
import { VoiceBuilder } from "@/components/voice/VoiceBuilder";

export const Route = createFileRoute("/_authenticated/dashboard/voice/$serviceId")({
  component: VoiceBuilder,
});
