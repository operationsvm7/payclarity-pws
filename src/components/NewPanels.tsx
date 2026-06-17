import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/commission-store";
import { calcInvoice, calcPayouts, fmtMoney } from "@/lib/commission-calc";
import { buildAllWallets } from "@/lib/ledger";
import { useT } from "@/lib/i18n";

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((c) => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* -------------------- DASHBOARD -------------------- */
export function DashboardPanel() {
  const t = useT();
  const s = useStore();
  const cur = s.company.currency;

  const totals = useMemo(() => {
    let sales = 0, profit = 0;
    for (const inv of s.invoices) {
      const c = calcInvoice(inv, s.financeCompanies);
      sales += Number(inv.salesAmount || 0);
      profit += c.profit;
    }
    const payouts = calcPayouts(s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides);
    const commissions = payouts.reduce((a, p) => a + p.personalCommission, 0);
    const overridesTotal = payouts.reduce((a, p) => a + p.overrideTotal, 0);
    const tax = payouts.reduce((a, p) => a + p.taxReserveSuggested, 0);
    const paid = s.payments.reduce((a, p) => a + p.amount, 0);
    const pending = Math.max(0, commissions + overridesTotal - paid);
    const openReq = s.disputes.filter((d) => d.status === "submitted" || d.status === "needs_info" || d.status === "under_review").length;
    return { sales, profit, commissions, overridesTotal, tax, paid, pending, openReq, payouts };
  }, [s.invoices, s.agents, s.financeCompanies, s.personalTiers, s.overrides, s.payments, s.disputes]);

  const topReps = [...totals.payouts]
    .sort((a, b) => (b.personalCommission + b.overrideTotal) - (a.personalCommission + a.overrideTotal))
    .slice(0, 5);

  const recent = [...s.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-card">
        <h2 className="text-lg font-semibold mb-4">{t("dash_overview")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("dash_kpi_sales")} value={fmtMoney(totals.sales, cur)} />
          <Kpi label={t("dash_kpi_profit")} value={fmtMoney(totals.profit, cur)} />
          <Kpi label={t("dash_kpi_commissions")} value={fmtMoney(totals.commissions, cur)} />
          <Kpi label={t("dash_kpi_overrides")} value={fmtMoney(totals.overridesTotal, cur)} />
          <Kpi label={t("dash_kpi_paid")} value={fmtMoney(totals.paid, cur)} />
          <Kpi label={t("dash_kpi_pending")} value={fmtMoney(totals.pending, cur)} accent />
          <Kpi label={t("dash_kpi_tax_reserve")} value={fmtMoney(totals.tax, cur)} />
          <Kpi label={t("dash_kpi_open_requests")} value={String(totals.openReq)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 shadow-card">
          <h3 className="font-semibold mb-3">{t("dash_top_reps")}</h3>
          {topReps.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topReps.map((p) => (
                  <tr key={p.agent.id} className="border-t border-border/60">
                    <td className="py-2">{p.agent.name}</td>
                    <td className="text-right font-mono">{fmtMoney(p.personalCommission + p.overrideTotal, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-6 shadow-card">
          <h3 className="font-semibold mb-3">{t("dash_recent_invoices")}</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash_no_invoices")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recent.map((inv) => {
                  const c = calcInvoice(inv, s.financeCompanies);
                  return (
                    <tr key={inv.id} className="border-t border-border/60">
                      <td className="py-2 font-mono text-xs">{inv.number}</td>
                      <td className="text-xs text-muted-foreground">{inv.customerName || "—"}</td>
                      <td className="text-right font-mono">{fmtMoney(c.profit, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-4 rounded-lg bg-muted/40 border border-border/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono font-semibold mt-1 ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

/* -------------------- REPORTS -------------------- */
export function ReportsPanel() {
  const t = useT();
  const s = useStore();
  const cur = s.company.currency;

  const payouts = useMemo(
    () => calcPayouts(s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides),
    [s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides]
  );
  const wallets = useMemo(
    () => buildAllWallets(s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides, s.payments, s.disputes, s.adjustments),
    [s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides, s.payments, s.disputes]
  );

  const exportCommissions = () => {
    const rows: (string | number)[][] = [["Salesperson", "Email", "Personal commission", "Overrides", "Advances", "Tax reserve", "Final"]];
    for (const p of payouts) {
      rows.push([p.agent.name, p.agent.email, p.personalCommission.toFixed(2), p.overrideTotal.toFixed(2), p.advanceApplied.toFixed(2), p.taxReserveSuggested.toFixed(2), p.finalPayable.toFixed(2)]);
    }
    downloadCSV("commissions_by_rep.csv", rows);
  };

  const exportInvoices = () => {
    const rows: (string | number)[][] = [["Number", "Date", "Customer", "Salesperson", "Status", "Sales", "Cost", "Profit", "Paid"]];
    for (const inv of s.invoices) {
      const c = calcInvoice(inv, s.financeCompanies);
      const ag = s.agents.find((a) => a.id === inv.agentId);
      rows.push([inv.number, inv.date, inv.customerName, ag?.name ?? "", inv.status, inv.salesAmount, inv.productCost, c.profit.toFixed(2), inv.paid ? "yes" : "no"]);
    }
    downloadCSV("invoices.csv", rows);
  };

  const exportOverrides = () => {
    const rows: (string | number)[][] = [["Upline", "Downline", "Level", "Override"]];
    for (const p of payouts) {
      for (const d of p.downline) rows.push([p.agent.name, d.agent.name, d.level, d.override.toFixed(2)]);
    }
    downloadCSV("overrides.csv", rows);
  };

  const exportPayments = () => {
    const rows: (string | number)[][] = [["Date", "Salesperson", "Amount", "Method", "Reference", "Notes"]];
    for (const p of s.payments) {
      const ag = s.agents.find((a) => a.id === p.agentId);
      rows.push([p.date, ag?.name ?? "", p.amount.toFixed(2), p.method, p.reference, p.notes]);
    }
    downloadCSV("payments.csv", rows);
  };

  const exportLedger = () => {
    const rows: (string | number)[][] = [["Salesperson", "Date", "Type", "Description", "Debit", "Credit", "Balance"]];
    for (const w of wallets) {
      for (const e of w.ledger) {
        rows.push([w.agent.name, e.date, e.type, e.description, e.debit.toFixed(2), e.credit.toFixed(2), e.balance.toFixed(2)]);
      }
    }
    downloadCSV("ledger.csv", rows);
  };

  const exportTaxes = () => {
    const rows: (string | number)[][] = [["Salesperson", "State", "Tax reserve %", "Suggested reserve"]];
    for (const p of payouts) {
      rows.push([p.agent.name, p.agent.state ?? "", ((p.agent.taxReservePercent ?? 0.2) * 100).toFixed(2) + "%", p.taxReserveSuggested.toFixed(2)]);
    }
    downloadCSV("tax_reserve.csv", rows);
  };

  const Item = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20">
      <span className="text-sm">{label}</span>
      <Button size="sm" variant="outline" onClick={onClick}><FileDown className="w-4 h-4 mr-2" />{t("download_csv")}</Button>
    </div>
  );

  return (
    <Card className="p-6 shadow-card">
      <h2 className="text-lg font-semibold">{t("reports_title")}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">{t("reports_desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Item label={t("reports_commissions_by_rep")} onClick={exportCommissions} />
        <Item label={t("reports_invoices")} onClick={exportInvoices} />
        <Item label={t("reports_overrides")} onClick={exportOverrides} />
        <Item label={t("reports_payments")} onClick={exportPayments} />
        <Item label={t("reports_ledger")} onClick={exportLedger} />
        <Item label={t("reports_taxes")} onClick={exportTaxes} />
      </div>
      <p className="text-xs text-muted-foreground mt-4">Currency: {cur}</p>
    </Card>
  );
}

/* -------------------- YEAR-END 1099 -------------------- */
export function YearEnd1099Panel() {
  const t = useT();
  const s = useStore();
  const cur = s.company.currency;
  const isAdminOrAcc = s.role === "admin" || s.role === "accountant";

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const inv of s.invoices) ys.add(new Date(inv.date).getFullYear());
    for (const p of s.payments) ys.add(new Date(p.date).getFullYear());
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [s.invoices, s.payments]);

  const [year, setYear] = useState(years[0]);

  const data = useMemo(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const invoicesY = s.invoices.filter((i) => i.date >= start && i.date <= end);
    const paymentsY = s.payments.filter((p) => p.date >= start && p.date <= end);
    const payouts = calcPayouts(s.agents, invoicesY, s.financeCompanies, s.personalTiers, s.overrides);

    return s.agents.map((a) => {
      const p = payouts.find((x) => x.agent.id === a.id);
      const paid = paymentsY.filter((x) => x.agentId === a.id).reduce((sum, x) => sum + x.amount, 0);
      const advancesPaid = invoicesY
        .filter((i) => i.agentId === a.id)
        .reduce((sum, i) => sum + (Number(i.advanceApplied) || 0), 0);
      const earned = p ? p.personalCommission + p.overrideTotal : 0;
      const pending = Math.max(0, earned - paid);
      const reportable = paid;
      const overThreshold = reportable >= 600;
      const w9 = a.w9Status ?? "missing";
      const warn = overThreshold && w9 !== "valid";
      return { agent: a, paid, pending, earned, advancesPaid, reportable, w9, warn };
    });
  }, [s.agents, s.invoices, s.payments, s.financeCompanies, s.personalTiers, s.overrides, year]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Year", "Contractor", "Email", "State", "W-9", "Total earned", "Total paid", "Advances paid", "Pending", "Reportable"],
    ];
    for (const r of data) {
      rows.push([
        year, r.agent.name, r.agent.email, r.agent.state ?? "", r.w9,
        r.earned.toFixed(2), r.paid.toFixed(2), r.advancesPaid.toFixed(2), r.pending.toFixed(2), r.reportable.toFixed(2),
      ]);
    }
    downloadCSV(`year_end_1099_${year}.csv`, rows);
  };

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{t("ye_title")}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("ye_desc")}</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">{t("ye_select_year")}</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdminOrAcc && (
            <Button onClick={exportCsv} variant="outline"><FileDown className="w-4 h-4 mr-2" />{t("ye_export_csv")}</Button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-2">{t("ye_contractor")}</th>
                <th>{t("ye_w9")}</th>
                <th className="text-right">{t("ye_total_paid")}</th>
                <th className="text-right">{t("ye_advances_paid")}</th>
                <th className="text-right">{t("ye_pending")}</th>
                <th className="text-right">{t("ye_reportable")}</th>
                <th>{t("ye_status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.agent.id} className="border-t border-border/60">
                  <td className="py-2">
                    <div className="font-medium">{r.agent.name}</div>
                    <div className="text-xs text-muted-foreground">{r.agent.email || "—"} · {r.agent.state || "—"}</div>
                  </td>
                  <td>
                    <span className={`text-xs uppercase tracking-wider px-2 py-1 rounded ${
                      r.w9 === "valid" ? "bg-emerald-500/10 text-emerald-600" :
                      r.w9 === "pending" ? "bg-amber-500/10 text-amber-600" :
                      "bg-destructive/10 text-destructive"
                    }`}>{r.w9}</span>
                  </td>
                  <td className="text-right font-mono">{fmtMoney(r.paid, cur)}</td>
                  <td className="text-right font-mono">{fmtMoney(r.advancesPaid, cur)}</td>
                  <td className="text-right font-mono">{fmtMoney(r.pending, cur)}</td>
                  <td className="text-right font-mono font-semibold">{fmtMoney(r.reportable, cur)}</td>
                  <td>
                    {r.warn ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t("ye_warning_threshold")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic mt-4">{t("ye_not_tax_advice")}</p>
    </Card>
  );
}

/* -------------------- Tax reserve by state editor (inline component) -------------------- */
export function TaxReserveByStateEditor() {
  const { taxReserveByState, setTaxReserveByState } = useStore();
  const entries = Object.entries(taxReserveByState);
  const [stateCode, setStateCode] = useState("");
  const [pct, setPct] = useState(20);

  const add = () => {
    if (!stateCode.trim()) return;
    setTaxReserveByState({ ...taxReserveByState, [stateCode.toUpperCase().trim()]: pct / 100 });
    setStateCode("");
  };
  const remove = (k: string) => {
    const next = { ...taxReserveByState };
    delete next[k];
    setTaxReserveByState(next);
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 mb-3">
        <Input placeholder="State (e.g. CA)" value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
        <Input type="number" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        <Button onClick={add}>+</Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No state-level rates set.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between text-sm border-t border-border/40 py-1">
              <span className="font-mono">{k}</span>
              <span className="font-mono">{(v * 100).toFixed(2)}%</span>
              <button className="text-xs text-destructive" onClick={() => remove(k)}>remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
