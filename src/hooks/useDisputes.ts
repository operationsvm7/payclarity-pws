import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export function useDisputes() {
  return useQuery({
    queryKey: ["disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*, dispute_events(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

type SubmitDisputeInput = {
  company_id: string;
  invoice_id: string | null;
  agent_id: string;
  reason: string;
  notes?: string;
  kind?: "correction" | "dispute" | "adjustment";
  priority?: "low" | "normal" | "high";
  requested_change?: Record<string, unknown> | null;
};

export function useSubmitDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      company_id,
      invoice_id,
      agent_id,
      reason,
      notes = "",
      kind = "correction",
      priority = "normal",
      requested_change = null,
    }: SubmitDisputeInput) => {
      const { data, error } = await supabase.rpc("submit_dispute", {
        p_company_id: company_id,
        p_invoice_id: invoice_id,
        p_agent_id: agent_id,
        p_reason: reason,
        p_notes: notes,
        p_kind: kind,
        p_priority: priority,
        p_requested_change: requested_change,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useUpdateDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"disputes"> & { id: string }) => {
      const { data, error } = await supabase
        .from("disputes")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useUpdateDisputeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dispute_id,
      status,
      actor,
      message = "",
    }: {
      dispute_id: string;
      status: "submitted" | "under_review" | "needs_info" | "approved" | "rejected" | "resolved";
      actor: "rep" | "admin" | "system";
      message?: string;
    }) => {
      const { error } = await supabase.rpc("update_dispute_status", {
        p_dispute_id: dispute_id,
        p_status: status,
        p_actor: actor,
        p_message: message,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useAppendDisputeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dispute_id,
      actor,
      type,
      message = "",
    }: {
      dispute_id: string;
      actor: "rep" | "admin" | "system";
      type: "submitted" | "claimed" | "needs_info" | "rep_reply" | "approved" | "rejected" | "resolved" | "note" | "reopened";
      message?: string;
    }) => {
      const { error } = await supabase
        .from("dispute_events")
        .insert({ dispute_id, actor, type, message });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });
}
