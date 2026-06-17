import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNotifications() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime: re-fetch when a new notification is inserted or updated
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, readBy }: { id: string; readBy: string }) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_by: readBy })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (readBy: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true, read_by: readBy })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      company_id,
      kind,
      title,
      message = "",
      audience = "admin",
      invoice_id,
      dispute_id,
    }: {
      company_id: string;
      kind: "dispute_submitted" | "dispute_replied" | "dispute_status" | "dispute_claimed" | "split_changed" | "pdf_regenerated" | "info";
      title: string;
      message?: string;
      audience?: string;
      invoice_id?: string | null;
      dispute_id?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("create_notification", {
        p_company_id: company_id,
        p_kind: kind,
        p_title: title,
        p_message: message,
        p_audience: audience,
        p_invoice_id: invoice_id ?? null,
        p_dispute_id: dispute_id ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
