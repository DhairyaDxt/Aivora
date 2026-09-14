import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/aivora/AuthForm";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Aivora account" },
      {
        name: "description",
        content: "Create a Aivora account and launch an AI phone receptionist for your business.",
      },
      { property: "og:title", content: "Create your Aivora account" },
      {
        property: "og:description",
        content: "Launch an AI phone receptionist for your business in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
