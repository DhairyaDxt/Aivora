import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/aivora/AuthForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Aivora" },
      { name: "description", content: "Sign in to Aivora to manage your AI voice receptionist." },
      { property: "og:title", content: "Sign in — Aivora" },
      { property: "og:description", content: "Sign in to manage your AI voice receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
