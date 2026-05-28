import { supabase } from "@/lib/supabase";

export async function getWbTotalSupply(): Promise<number> {
  const { data, error } = await supabase().rpc("fn_wb_total_supply");
  if (error) throw new Error(`getWbTotalSupply failed: ${error.message}`);
  return Number(data ?? 0);
}

export async function getDau(days = 1): Promise<number> {
  const { data, error } = await supabase().rpc("fn_wb_dau", { p_days: days });
  if (error) throw new Error(`getDau failed: ${error.message}`);
  return Number(data ?? 0);
}

export type SupplyPoint = { day: string; supplyCents: number };

export async function getSupplySeries(days = 90): Promise<SupplyPoint[]> {
  const { data, error } = await supabase().rpc("fn_wb_supply_series", { p_days: days });
  if (error) throw new Error(`getSupplySeries failed: ${error.message}`);
  return ((data as { day: string; supply_cents: number }[]) ?? []).map((r) => ({
    day: r.day,
    supplyCents: Number(r.supply_cents),
  }));
}
