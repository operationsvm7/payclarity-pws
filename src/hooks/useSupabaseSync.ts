import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/commission-store";
import { supabase } from "@/integrations/supabase/client";
import {
  isUuid,
  adaptCompany, companyToRow,
  adaptAgent, agentToRow,
  adaptFinanceCo, financeCoToRow,
  adaptInvoice, invoiceCoreToRow,
  adaptPayment, paymentToRow,
  adaptAdjustment, adjustmentToRow,
  adaptDispute, disputeToRow,
  adaptNotification, notificationToRow,
  adaptPersonalTier, adaptOverrideLevel,
} from "@/lib/adapters";

export function useSupabaseSync() {
  const { profile } = useAuth();
  const companyId = profile?.company_id ?? null;
  const startedLoad = useRef(false);
  const loadComplete = useRef(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── LOAD: Fetch all company data from Supabase and hydrate the Zustand store
  useEffect(() => {
    if (!companyId || startedLoad.current) return;
    startedLoad.current = true;

    async function loadData() {
      const [
        { data: company },
        { data: agents },
        { data: fcs },
        { data: invoices },
        { data: payments },
        { data: adjustments },
        { data: disputes },
        { data: notifications },
        { data: tiers },
        { data: overrideLevels },
      ] = await Promise.all([
        supabase.from("companies").select("*").single(),
        supabase.from("agents").select("*").order("name"),
        supabase.from("finance_companies").select("*"),
        supabase
          .from("invoices")
          .select("*, invoice_line_items(*), invoice_splits(*, invoice_split_participants(*))")
          .order("date", { ascending: false }),
        supabase.from("payments").select("*"),
        supabase.from("adjustments").select("*"),
        supabase.from("disputes").select("*, dispute_events(*)"),
        supabase.from("notifications").select("*").order("at", { ascending: false }),
        supabase.from("commission_tiers").select("*").order("sort_order"),
        supabase.from("override_levels").select("*").order("level"),
      ]);

      const update: Record<string, any> = {
        agents: (agents ?? []).map(adaptAgent),
        financeCompanies: (fcs ?? []).map(adaptFinanceCo),
        invoices: (invoices ?? []).map(adaptInvoice),
        payments: (payments ?? []).map(adaptPayment),
        adjustments: (adjustments ?? []).map(adaptAdjustment),
        disputes: (disputes ?? []).map(adaptDispute),
        notifications: (notifications ?? []).map(adaptNotification),
      };

      if (company) {
        update.company = { ...useStore.getState().company, ...adaptCompany(company) };
      }
      if (tiers && tiers.length > 0) {
        update.personalTiers = tiers.map(adaptPersonalTier);
      }
      if (overrideLevels && overrideLevels.length > 0) {
        update.overrides = overrideLevels.map(adaptOverrideLevel);
      }

      useStore.setState(update);
      loadComplete.current = true;
      setDataLoaded(true);
    }

    loadData().catch((err) => {
      console.error("useSupabaseSync load error:", err);
      // Even on error, mark as loaded so the UI isn't stuck waiting
      loadComplete.current = true;
      setDataLoaded(true);
    });
  }, [companyId]);

  // ── SYNC: Watch Zustand store changes and persist to Supabase ────────────
  useEffect(() => {
    if (!companyId) return;

    let prev = useStore.getState();

    const unsub = useStore.subscribe((next) => {
      if (!loadComplete.current) {
        prev = next;
        return;
      }

      syncItems(
        prev.agents, next.agents,
        (a) => supabase.from("agents").upsert(agentToRow(a, companyId), { onConflict: "id" }),
        (a) => supabase.from("agents").delete().eq("id", a.id),
      );

      syncItems(
        prev.financeCompanies, next.financeCompanies,
        (f) => supabase.from("finance_companies").upsert(financeCoToRow(f, companyId), { onConflict: "id" }),
        (f) => supabase.from("finance_companies").delete().eq("id", f.id),
      );

      syncItems(
        prev.invoices, next.invoices,
        async (inv) => {
          const { error } = await supabase
            .from("invoices")
            .upsert(invoiceCoreToRow(inv, companyId), { onConflict: "id" });
          if (error) { console.error("sync:invoice", error); return; }
          // Sync line items (delete + re-insert)
          await supabase.from("invoice_line_items").delete().eq("invoice_id", inv.id);
          const lineItems = [
            ...inv.charges.map((c, i) => ({
              invoice_id: inv.id, company_id: companyId,
              type: "charge", label: c.label, amount: c.amount, sort_order: i,
            })),
            ...inv.credits.map((c, i) => ({
              invoice_id: inv.id, company_id: companyId,
              type: "credit", label: c.label, amount: c.amount, sort_order: i,
            })),
          ];
          if (lineItems.length > 0) {
            await supabase.from("invoice_line_items").insert(lineItems);
          }
        },
        (inv) => supabase.from("invoices").delete().eq("id", inv.id),
      );

      syncItems(
        prev.payments, next.payments,
        (p) => supabase.from("payments").upsert(paymentToRow(p, companyId), { onConflict: "id" }),
        (p) => supabase.from("payments").delete().eq("id", p.id),
      );

      syncItems(
        prev.adjustments, next.adjustments,
        (a) => supabase.from("adjustments").upsert(adjustmentToRow(a, companyId), { onConflict: "id" }),
        (a) => supabase.from("adjustments").delete().eq("id", a.id),
      );

      syncItems(
        prev.disputes, next.disputes,
        (d) => supabase.from("disputes").upsert(disputeToRow(d, companyId), { onConflict: "id" }),
        (d) => supabase.from("disputes").delete().eq("id", d.id),
      );

      syncItems(
        prev.notifications, next.notifications,
        (n) => supabase.from("notifications").upsert(notificationToRow(n, companyId), { onConflict: "id" }),
        (n) => supabase.from("notifications").delete().eq("id", n.id),
      );

      // Sync company settings on change (admin-only via RLS)
      if (prev.company !== next.company) {
        supabase
          .from("companies")
          .update(companyToRow(next.company, companyId))
          .eq("id", companyId)
          .then(({ error }) => { if (error) console.error("sync:company", error); });
      }

      prev = next;
    });

    return unsub;
  }, [companyId]);

  return { dataLoaded };
}

function syncItems<T extends { id: string }>(
  prev: T[],
  next: T[],
  upsert: (item: T) => Promise<any> | any,
  remove: (item: T) => Promise<any> | any,
) {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextMap = new Map(next.map((x) => [x.id, x]));

  for (const item of next) {
    if (!isUuid(item.id)) continue;
    const prevItem = prevMap.get(item.id);
    if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
      Promise.resolve(upsert(item))
        .then((res: any) => { if (res?.error) console.error("sync upsert:", res.error); })
        .catch(console.error);
    }
  }

  for (const item of prev) {
    if (!isUuid(item.id)) continue;
    if (!nextMap.has(item.id)) {
      Promise.resolve(remove(item))
        .then((res: any) => { if (res?.error) console.error("sync delete:", res.error); })
        .catch(console.error);
    }
  }
}
