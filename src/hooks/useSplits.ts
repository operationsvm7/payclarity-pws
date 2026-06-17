import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ─── Split Templates ──────────────────────────────────────────────────────────

export function useSplitTemplates() {
  return useQuery({
    queryKey: ["split_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("split_templates")
        .select("*, split_template_positions(*)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

type TemplateWithPositions = TablesInsert<"split_templates"> & {
  positions: Omit<TablesInsert<"split_template_positions">, "template_id">[];
};

export function useCreateSplitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ positions, ...template }: TemplateWithPositions) => {
      const { data, error } = await supabase
        .from("split_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;

      if (positions.length > 0) {
        const { error: posErr } = await supabase
          .from("split_template_positions")
          .insert(positions.map((p, i) => ({ ...p, template_id: data.id, sort_order: i })));
        if (posErr) throw posErr;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_templates"] }),
  });
}

export function useUpdateSplitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      positions,
      ...patch
    }: TablesUpdate<"split_templates"> & {
      id: string;
      positions?: Omit<TablesInsert<"split_template_positions">, "template_id">[];
    }) => {
      const { error } = await supabase
        .from("split_templates")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      if (positions !== undefined) {
        const { error: delErr } = await supabase
          .from("split_template_positions")
          .delete()
          .eq("template_id", id);
        if (delErr) throw delErr;

        if (positions.length > 0) {
          const { error: insErr } = await supabase
            .from("split_template_positions")
            .insert(positions.map((p, i) => ({ ...p, template_id: id, sort_order: i })));
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_templates"] }),
  });
}

export function useDeleteSplitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("split_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_templates"] }),
  });
}

// ─── Split Rules ──────────────────────────────────────────────────────────────

export function useSplitRules() {
  return useQuery({
    queryKey: ["split_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("split_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"split_rules">) => {
      const { data, error } = await supabase
        .from("split_rules")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_rules"] }),
  });
}

export function useUpdateSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"split_rules"> & { id: string }) => {
      const { data, error } = await supabase
        .from("split_rules")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_rules"] }),
  });
}

export function useDeleteSplitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("split_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["split_rules"] }),
  });
}

// ─── Invoice Split (set / clear) ─────────────────────────────────────────────

type ParticipantInput = {
  agent_id?: string | null;
  display_name: string;
  role: string;
  custom_role_label?: string | null;
  split_percent: number;
  commission_level?: string | null;
  notes?: string | null;
};

type SetSplitInput = {
  invoice_id: string;
  applied_rule_id?: string | null;
  applied_template_id?: string | null;
  participants: ParticipantInput[];
  audit_by: string;
  audit_action: "created" | "updated" | "rule_applied" | "template_applied" | "cleared" | "approved" | "recalculated";
  audit_message?: string;
};

export function useSetInvoiceSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoice_id,
      applied_rule_id,
      applied_template_id,
      participants,
      audit_by,
      audit_action,
      audit_message = "",
    }: SetSplitInput) => {
      // Upsert the split row
      const { data: splitRow, error: splitErr } = await supabase
        .from("invoice_splits")
        .upsert({ invoice_id, applied_rule_id, applied_template_id }, { onConflict: "invoice_id" })
        .select()
        .single();
      if (splitErr) throw splitErr;

      // Replace participants
      const { error: delErr } = await supabase
        .from("invoice_split_participants")
        .delete()
        .eq("invoice_split_id", splitRow.id);
      if (delErr) throw delErr;

      if (participants.length > 0) {
        const { error: insErr } = await supabase
          .from("invoice_split_participants")
          .insert(
            participants.map((p, i) => ({
              ...p,
              invoice_split_id: splitRow.id,
              sort_order: i,
            }))
          );
        if (insErr) throw insErr;
      }

      // Append audit entry
      const { error: auditErr } = await supabase
        .from("split_audit_entries")
        .insert({
          invoice_split_id: splitRow.id,
          by: audit_by,
          action: audit_action,
          message: audit_message,
          snapshot: participants,
        });
      if (auditErr) throw auditErr;

      return splitRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
