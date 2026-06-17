import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ─── Finance Companies ───────────────────────────────────────────────────────

export function useFinanceCompanies() {
  return useQuery({
    queryKey: ["finance_companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFinanceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"finance_companies">) => {
      const { data, error } = await supabase
        .from("finance_companies")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_companies"] }),
  });
}

export function useUpdateFinanceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"finance_companies"> & { id: string }) => {
      const { data, error } = await supabase
        .from("finance_companies")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_companies"] }),
  });
}

export function useDeleteFinanceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_companies"] }),
  });
}

// ─── Products ────────────────────────────────────────────────────────────────

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"products">) => {
      const { data, error } = await supabase
        .from("products")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"products"> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// ─── Compensation Positions ──────────────────────────────────────────────────

export function useCompensationPositions() {
  return useQuery({
    queryKey: ["compensation_positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compensation_positions")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCompensationPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"compensation_positions">) => {
      const { data, error } = await supabase
        .from("compensation_positions")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compensation_positions"] }),
  });
}

export function useUpdateCompensationPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"compensation_positions"> & { id: string }) => {
      const { data, error } = await supabase
        .from("compensation_positions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compensation_positions"] }),
  });
}

export function useDeleteCompensationPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compensation_positions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compensation_positions"] }),
  });
}

// ─── Commission Tiers ─────────────────────────────────────────────────────────

export function useCommissionTiers() {
  return useQuery({
    queryKey: ["commission_tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_tiers")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useReplaceCommissionTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      companyId,
      tiers,
    }: {
      companyId: string;
      tiers: { min_volume: number; rate: number; sort_order: number }[];
    }) => {
      const { error: delError } = await supabase
        .from("commission_tiers")
        .delete()
        .eq("company_id", companyId);
      if (delError) throw delError;

      if (tiers.length === 0) return [];

      const { data, error } = await supabase
        .from("commission_tiers")
        .insert(tiers.map((t) => ({ ...t, company_id: companyId })))
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission_tiers"] }),
  });
}

// ─── Override Levels ──────────────────────────────────────────────────────────

export function useOverrideLevels() {
  return useQuery({
    queryKey: ["override_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("override_levels")
        .select("*")
        .order("level");
      if (error) throw error;
      return data;
    },
  });
}

export function useReplaceOverrideLevels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      companyId,
      levels,
    }: {
      companyId: string;
      levels: { level: number; rate: number }[];
    }) => {
      const { error: delError } = await supabase
        .from("override_levels")
        .delete()
        .eq("company_id", companyId);
      if (delError) throw delError;

      if (levels.length === 0) return [];

      const { data, error } = await supabase
        .from("override_levels")
        .insert(levels.map((l) => ({ ...l, company_id: companyId })))
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["override_levels"] }),
  });
}

// ─── Tax Reserve by State ─────────────────────────────────────────────────────

export function useTaxReserveByState() {
  return useQuery({
    queryKey: ["tax_reserve_by_state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_reserve_by_state")
        .select("*")
        .order("state_code");
      if (error) throw error;
      return data;
    },
  });
}

export function useReplaceStateTaxRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      companyId,
      rates,
    }: {
      companyId: string;
      rates: { state_code: string; rate: number }[];
    }) => {
      const { error: delError } = await supabase
        .from("tax_reserve_by_state")
        .delete()
        .eq("company_id", companyId);
      if (delError) throw delError;

      if (rates.length === 0) return [];

      const { data, error } = await supabase
        .from("tax_reserve_by_state")
        .insert(rates.map((r) => ({ ...r, company_id: companyId })))
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax_reserve_by_state"] }),
  });
}
