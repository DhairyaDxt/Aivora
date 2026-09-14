import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useVoiceService, useWhatsappService, useWebsiteService } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AivoraLogo } from "@/components/brand/AivoraLogo";
import {
  PhoneCall,
  LayoutGrid,
  BookOpen,
  Plug,
  ListMusic,
  LogOut,
  BarChart3,
  MessageCircle,
  Globe,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: org, isLoading } = useOrg();
  const { data: service } = useVoiceService(org?.id);
  const { data: waService } = useWhatsappService(org?.id);
  const { data: webService } = useWebsiteService(org?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && !org) navigate({ to: "/onboarding" });
  }, [isLoading, org, navigate]);

  const nav = [
    { to: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
    { to: "/dashboard/analytics", label: "Analytics", icon: Activity },
    { to: "/dashboard/knowledge-base", label: "Knowledge base", icon: BookOpen },
    { to: "/dashboard/calls", label: "Calls", icon: ListMusic },
    { to: "/dashboard/usage", label: "Usage", icon: BarChart3 },
    { to: "/dashboard/connections", label: "Connections", icon: Plug },
  ] as const;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm tracking-tight transition-all",
      active
        ? "bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-to)] font-medium text-white shadow-[0_4px_16px_-4px_var(--glow)]"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-sidebar px-4 py-6 md:flex">
          <AivoraLogo to="/dashboard" className="mb-8 px-2" />

          <nav className="space-y-1">
            {nav.map((item) => {
              const active =
                "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className={linkClass(active)}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <p className="px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
              Channels
            </p>

            {service ? (
              <Link
                to="/dashboard/voice/$serviceId"
                params={{ serviceId: service.id }}
                className={linkClass(pathname.includes("/voice/"))}
              >
                <PhoneCall className="size-4" />
                Voice receptionist
              </Link>
            ) : null}

            {waService ? (
              <Link
                to="/dashboard/whatsapp/$serviceId"
                params={{ serviceId: waService.id }}
                className={linkClass(pathname.includes("/whatsapp/"))}
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </Link>
            ) : null}

            <Link
              to={webService ? "/dashboard/website/$serviceId" : "/dashboard/website/new"}
              {...(webService ? { params: { serviceId: webService.id } } : {})}
              className={linkClass(pathname.includes("/website"))}
            >
              <Globe className="size-4" />
              Website
            </Link>
          </nav>

          <div className="mt-auto space-y-3 px-2">
            <p className="label-tag truncate">{org?.name ?? ""}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={signOut}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
