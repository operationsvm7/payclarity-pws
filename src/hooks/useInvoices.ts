import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          invoice_line_items(*),
          invoice_splits(
            *,
            invoice_split_participants(*),
            split_audit_entries(*)
          ),
          invoice_pdf_records(*)
        `)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          invoice_line_items(*),
          invoice_splits(
            *,
            invoice_split_participants(*),
            split_audit_entries(*)
          ),
          invoice_pdf_records(*)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

type LineItemInput = {
  kind: "charge" | "credit";
  label: string;
  amount: number;
  sort_order?: number;
};

type CreateInvoiceInput = {
  company_id: string;
  agent_id: string;
  date: string;
  finance_company_id?: string | null;
  customer_name?: string;
  customer_notes?: string;
  sales_amount?: number;
  product_cost?: number;
  approval_percent?: number;
  discount?: number;
  sale_type?: string | null;
  ccpf_percent?: number;
  admin_fee_percent?: number;
  dealer_fee?: number | null;
  commission_level?: string;
  commission_base?: "profit" | "product_cost";
  commission_percent_override?: number | null;
  tax_reserve_percent?: number;
  status?: "draft" | "pending" | "paid" | "on_hold";
  line_items?: LineItemInput[];
};

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ line_items = [], ...invoice }: CreateInvoiceInput) => {
      const { data, error } = await supabase.rpc("create_invoice", {
        p_invoice: invoice as Record<string, unknown>,
        p_line_items: line_items as unknown[],
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      line_items,
      ...patch
    }: TablesUpdate<"invoices"> & { id: string; line_items?: LineItemInput[] }) => {
      const { error } = await supabase
        .from("invoices")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      if (line_items !== undefined) {
        const { error: delErr } = await supabase
          .from("invoice_line_items")
          .delete()
          .eq("invoice_id", id);
        if (delErr) throw delErr;

        if (line_items.length > 0) {
          const { error: insErr } = await supabase
            .from("invoice_line_items")
            .insert(line_items.map((li, i) => ({ ...li, invoice_id: id, sort_order: i })));
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
