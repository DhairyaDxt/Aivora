import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/bizpilot/AuthForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — BizPilot" },
      { name: "description", content: "Sign in to BizPilot to manage your AI voice receptionist." },
      { property: "og:title", content: "Sign in — BizPilot" },
      { property: "og:description", content: "Sign in to manage your AI voice receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
