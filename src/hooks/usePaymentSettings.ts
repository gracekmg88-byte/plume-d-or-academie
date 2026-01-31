import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PaymentSettings {
  payment_mobile_number: string;
  payment_mobile_name: string;
  payment_bank_name: string;
  payment_bank_account: string;
  payment_bank_beneficiary: string;
  payment_whatsapp: string;
  payment_amount: string;
}

const defaultSettings: PaymentSettings = {
  payment_mobile_number: "+243 998 102 000",
  payment_mobile_name: "Kot Gracia",
  payment_bank_name: "Equity BCDC",
  payment_bank_account: "500005286303929",
  payment_bank_beneficiary: "KOT MUNON GRÂCE",
  payment_whatsapp: "+243998102000",
  payment_amount: "5",
};

export function usePaymentSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .eq("category", "payment");

      if (error) {
        console.error("Error fetching payment settings:", error);
        return defaultSettings;
      }

      const settingsMap = { ...defaultSettings };
      data.forEach((item) => {
        if (item.key in settingsMap) {
          settingsMap[item.key as keyof PaymentSettings] = item.value;
        }
      });

      return settingsMap;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value })
        .eq("key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la mise à jour: " + error.message);
    },
  });

  const updateAllSettings = useMutation({
    mutationFn: async (newSettings: Partial<PaymentSettings>) => {
      const updates = Object.entries(newSettings).map(([key, value]) =>
        supabase
          .from("site_settings")
          .update({ value })
          .eq("key", key)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error("Erreur lors de la mise à jour des paramètres");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      toast.success("Paramètres de paiement mis à jour");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  return {
    settings: settings || defaultSettings,
    isLoading,
    updateSetting,
    updateAllSettings,
  };
}
