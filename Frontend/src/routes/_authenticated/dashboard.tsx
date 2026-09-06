import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, useVoiceService } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PhoneCall, LayoutGrid, BookOpen, Plug, ListMusic, LogOut, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: org, isLoading } = useOrg();
  const { data: service } = useVoiceService(org?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && !org) navigate({ to: "/onboarding" });
  }, [isLoading, org, navigate]);

  const nav = [
    { to: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
    { to: "/dashboard/knowledge-base", label: "Knowledge base", icon: BookOpen },
    { to: "/dashboard/calls", label: "Calls", icon: ListMusic },
    { to: "/dashboard/usage", label: "Usage", icon: BarChart3 },
    { to: "/dashboard/connections", label: "Connections", icon: Plug },
  ] as const;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
          <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-foreground" />
            </span>
            <span className="font-semibold">biz.pilot</span>
          </Link>

          <nav className="space-y-0.5">
            {nav.map((item) => {
              const active =
                "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 border-l-2 px-3 py-2 text-sm tracking-tight transition-colors",
                    active
                      ? "border-l-foreground bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "border-l-transparent text-muted-foreground hover:border-l-border hover:bg-sidebar-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            {service ? (
              <Link
                to="/dashboard/voice/$serviceId"
                params={{ serviceId: service.id }}
                className={cn(
                  "flex items-center gap-3 border-l-2 px-3 py-2 text-sm tracking-tight transition-colors",
                  pathname.includes("/voice/")
                    ? "border-l-foreground bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "border-l-transparent text-muted-foreground hover:border-l-border hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                <PhoneCall className="size-4" />
                Voice receptionist
              </Link>
            ) : null}
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
