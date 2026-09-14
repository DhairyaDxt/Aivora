import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { buyNumber, claimFreeNumber, searchNumbers, syncAssistant } from "@/lib/voice.functions";
import { VoiceConfig } from "../VoiceBuilder";

type SearchResult = {
  number: string;
  friendly: string;
  locality: string;
  region: string;
  monthlyCostCents: number;
  perMinuteCostCents: number;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface PhoneTabProps {
  serviceId: string;
  config: Partial<VoiceConfig>;
  onChange: (updates: Partial<VoiceConfig>) => void;
  onAssigned: () => void;
}

export function PhoneTab({ serviceId, config, onChange, onAssigned }: PhoneTabProps) {
  const { data: org } = useOrg();
  const queryClient = useQueryClient();
  const claim = useServerFn(claimFreeNumber);
  const search = useServerFn(searchNumbers);
  const buy = useServerFn(buyNumber);
  const sync = useServerFn(syncAssistant);
  const [claiming, setClaiming] = useState(false);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const areaCodeValid = /^\d{3}$/.test(areaCode);

  // The dialable number lives on the phone_numbers row - voice_agent_configs
  // only stores Vapi's internal record id, which is not something to show.
  const assignedNumberQuery = useQuery({
    queryKey: ["assigned-phone-number", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("number, provider")
        .eq("assigned_service_id", serviceId)
        .eq("status", "active")
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const assignNumber = (assigned: { number: string; vapi_number_id: string | null }) => {
    setNumber(assigned.number);
    onChange({ vapi_phone_number_id: assigned.vapi_number_id ?? null });
    void queryClient.invalidateQueries({ queryKey: ["assigned-phone-number", serviceId] });
    onAssigned();
  };

  const findNumber = async () => {
    if (!org) {
      toast.error("Finish business onboarding before claiming a number.");
      return;
    }
    if (!areaCodeValid) {
      toast.error("Enter a valid 3-digit US area code.");
      return;
    }
    setResults(null);
    setClaiming(true);
    try {
      const assigned = await claim({ data: { orgId: org.id, serviceId, areaCode } });
      await sync({ data: { serviceId } });
      assignNumber(assigned);
      toast.success(`Free number assigned: ${assigned.number}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("buy a number instead")) {
        toast.error(message || "Could not claim a free number.");
        setClaiming(false);
        return;
      }
    }
    setClaiming(false);

    setSearching(true);
    try {
      const found = await search({
        data: { orgId: org.id, country: org.country ?? "US", areaCode },
      });
      setResults(found);
      if (found.length === 0) {
        toast.error(`No numbers found for area code ${areaCode}.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not search for numbers.");
    } finally {
      setSearching(false);
    }
  };

  const purchaseNumber = async (result: SearchResult) => {
    if (!org) return;
    const monthly = formatCents(result.monthlyCostCents);
    const perMinute = formatCents(result.perMinuteCostCents);
    if (!window.confirm(`Buy ${result.number} for ${monthly}/mo + ${perMinute}/min?`)) return;

    setBuyingNumber(result.number);
    try {
      const purchased = await buy({
        data: {
          orgId: org.id,
          serviceId,
          phoneNumber: result.number,
          monthlyCostCents: result.monthlyCostCents,
          perMinuteCostCents: result.perMinuteCostCents,
          country: org.country ?? "US",
        },
      });
      await sync({ data: { serviceId } });
      assignNumber(purchased);
      setResults(null);
      toast.success(`Number purchased: ${purchased.number}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not buy that number.");
    } finally {
      setBuyingNumber(null);
    }
  };

  const assigned = number ?? assignedNumberQuery.data?.number ?? null;
  const provider = assignedNumberQuery.data?.provider ?? null;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Phone number</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter a US area code to claim a free Vapi number there, or see priced Twilio numbers once
          the free tier is used up.
        </p>
      </div>
      {assigned ? (
        <div className="flex items-center gap-4 rounded-xl border p-6">
          <CheckCircle className="size-8 text-status-live" />
          <div>
            <p className="text-sm text-muted-foreground">
              Assigned number
              {provider === "vapi_free"
                ? " · free trial number"
                : provider === "twilio"
                  ? " · Twilio"
                  : ""}
            </p>
            <p className="text-lg font-semibold">{assigned}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Call this number to reach your receptionist once it's live.
            </p>
          </div>
        </div>
      ) : assignedNumberQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking your number…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center space-y-4 rounded-xl border-2 border-dashed p-10 text-center">
            <Phone className="size-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Find a number by area code</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Limited to five free numbers across this local environment — after that we'll show
                priced Twilio numbers for the same area code.
              </p>
            </div>
            <div className="w-full max-w-[160px] space-y-1.5 text-left">
              <Label htmlFor="area-code">US area code</Label>
              <Input
                id="area-code"
                inputMode="numeric"
                maxLength={3}
                placeholder="e.g. 415"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <Button
              onClick={findNumber}
              disabled={claiming || searching || !config.vapi_assistant_id || !areaCodeValid}
            >
              {claiming || searching ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {claiming ? "Claiming..." : searching ? "Searching..." : "Find number"}
            </Button>
            {!config.vapi_assistant_id ? (
              <p className="text-xs text-status-testing">Save and sync the receptionist first.</p>
            ) : null}
          </div>

          {results && results.length > 0 ? (
            <div className="space-y-2 rounded-xl border p-4">
              <p className="text-sm font-medium">
                Free numbers for {areaCode} are used up — buy one instead:
              </p>
              {results.map((r) => (
                <div
                  key={r.number}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{r.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.locality ? `${r.locality}, ` : ""}
                      {r.region}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {formatCents(r.monthlyCostCents)}/mo + {formatCents(r.perMinuteCostCents)}
                      /min
                    </p>
                    <Button
                      size="sm"
                      onClick={() => purchaseNumber(r)}
                      disabled={buyingNumber !== null}
                    >
                      {buyingNumber === r.number ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Buy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
