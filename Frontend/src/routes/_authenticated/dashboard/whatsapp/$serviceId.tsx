import { createFileRoute } from "@tanstack/react-router";
import { WhatsappBuilder } from "@/components/whatsapp/WhatsappBuilder";

export const Route = createFileRoute("/_authenticated/dashboard/whatsapp/$serviceId")({
  component: WhatsappBuilder,
});
