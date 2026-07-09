import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, FileDown, Sparkles } from "lucide-react";
import { useStore, type Invoice } from "@/lib/commission-store";
import {
  calcInvoice,
  calcPayouts,
  fmtMoney,
} from "@/lib/commission-calc";
import {
  buildAllWallets,
  type AgentWallet,
  type LedgerEntry,
} from "@/lib/ledger";
import { INDUSTRY_TEMPLATES } from "@/lib/templates";
import {
  buildAgentCommissionPDF,
  buildSaleInvoicePDF,
  buildSaleAndDownload,
} from "@/lib/generate-invoices";

/* ---------- Shared SectionCard (duplicated lightweight) ---------- */
function Section({
  title,
  desc,
  children,
  action,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
      {msg}
    </div>
  );
}

/* ========== WALLET PANEL ========== */
export function WalletPanel() {
  const s = useStore();
  const isAdmin = s.role !== "rep";
  const myAgentId = !isAdmin ? s.activeAgentId : null;
  const wallets = useMemo(
    () =>
      buildAllWallets(
        s.agents,
        s.invoices,
        s.financeCompanies,
        s.personalTiers,
        s.overrides,
        s.payments,
        s.disputes,
        s.adjustments
      ),
    [s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides, s.payments, s.disputes, s.adjustments]
  );
  const visibleWallets = isAdmin ? wallets : wallets.filter((w) => w.agent.id === myAgentId);
  const [selected, setSelected] = useState<string>("");

  const current = visibleWallets.find((w) => w.agent.id === selected) || visibleWallets[0];

  if (!visibleWallets.length) {
    return (
      <Section title="Commission Wallet" desc="Per-salesperson portal showing earned, paid, pending, advances, tax reserve and history.">
        <Empty msg={isAdmin ? "Add a salesperson and an invoice to see their wallet." : "No wallet data for your account yet."} />
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title={isAdmin ? "Commission Wallet" : "My Commission Wallet"}
        desc="Earned, paid, pending balance, advances, tax reserve and upcoming payout."
        action={
          isAdmin ? (
            <div className="w-full sm:w-64">
              <Select value={current?.agent.id} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {visibleWallets.map((w) => (
                    <SelectItem key={w.agent.id} value={w.agent.id}>
                      {w.agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null
        }
      >
        {current && <WalletDetail wallet={current} canRecordPayment={isAdmin} />}
      </Section>
    </div>
  );
}

function WalletDetail({ wallet, canRecordPayment = true }: { wallet: AgentWallet; canRecordPayment?: boolean }) {
  const s = useStore();
  const cur = s.company.currency;
  const p = wallet.payout;

  const [pay, setPay] = useState({ amount: 0, method: "Bank transfer", reference: "", notes: "" });
  const recordPayment = () => {
    if (!pay.amount || pay.amount <= 0) return toast.error("Enter an amount");
    s.addPayment({
      agentId: wallet.agent.id,
      date: new Date().toISOString().slice(0, 10),
      amount: pay.amount,
      method: pay.method,
      reference: pay.reference,
      notes: pay.notes,
    });
    setPay({ amount: 0, method: "Bank transfer", reference: "", notes: "" });
    toast.success("Payment recorded");
  };

  const downloadCommissionPDF = () => {
    const doc = buildAgentCommissionPDF(p, s.company, s.invoiceDate, s.periodLabel);
    doc.save(`commission_${wallet.agent.name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total earned" value={fmtMoney(wallet.totalEarned, cur)} accent />
        <Stat label="Total paid" value={fmtMoney(wallet.totalPaid, cur)} />
        <Stat label="Pending balance" value={fmtMoney(wallet.pendingBalance, cur)} accent />
        <Stat label="Upcoming payout" value={s.nextPayoutDate} />
        <Stat label="Open advances" value={fmtMoney(wallet.openAdvance, cur)} />
        <Stat label="Suggested tax reserve" value={fmtMoney(wallet.taxReserve, cur)} />
        <Stat label="Personal commission" value={fmtMoney(p.personalCommission, cur)} />
        <Stat label="Override total" value={fmtMoney(p.overrideTotal, cur)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Invoice history
            </h3>
            <Button size="sm" variant="outline" onClick={downloadCommissionPDF}>
              <FileDown className="w-4 h-4 mr-2" />Commission PDF
            </Button>
          </div>
          {p.invoices.length === 0 ? (
            <Empty msg="No invoices yet." />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-1">#</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {p.invoices.map((c) => (
                  <tr key={c.invoice.id} className="border-t border-border/60">
                    <td className="py-1 font-mono text-xs">{c.invoice.number}</td>
                    <td className="font-mono text-xs">{c.invoice.date}</td>
                    <td>{c.invoice.customerName || "—"}</td>
                    <td className="text-right font-mono">{fmtMoney(c.profit, cur)}</td>
                    <td className="text-right">
                      <Badge variant={c.invoice.paid ? "default" : "outline"}>
                        {c.invoice.paid ? "paid" : c.invoice.status}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => buildSaleAndDownload(c, s.company, wallet.agent.name)}
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Override history</h3>
          {p.downline.length === 0 ? (
            <Empty msg="No downline overrides." />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-1">Agent</th>
                  <th>Level</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Override</th>
                </tr>
              </thead>
              <tbody>
                {p.downline.map((d, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-1">{d.agent.name}</td>
                    <td>L{d.level}</td>
                    <td className="text-right font-mono">{fmtMoney(d.profit, cur)}</td>
                    <td className="text-right font-mono">{(d.rate * 100).toFixed(2)}%</td>
                    <td className="text-right font-mono">{fmtMoney(d.override, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Balance ledger</h3>
        <LedgerTable entries={wallet.ledger} cur={cur} />
        <div className="mt-3 text-sm flex justify-between border-t pt-3">
          <span className="text-muted-foreground">Current pending balance</span>
          <span className="font-mono font-bold">{fmtMoney(wallet.pendingBalance, cur)}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Payments received</h3>
        {canRecordPayment && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={pay.amount}
              onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Input value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Reference</Label>
            <Input
              value={pay.reference}
              onChange={(e) => setPay({ ...pay, reference: e.target.value })}
            />
          </div>
          <div className="md:col-span-1">
            <Label className="text-xs">Notes</Label>
            <Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={recordPayment} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Record
            </Button>
          </div>
        </div>
        )}
        {wallet.payments.length === 0 ? (
          <Empty msg="No payments yet." />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="py-1">Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wallet.payments.map((py) => (
                <tr key={py.id} className="border-t border-border/60">
                  <td className="py-1 font-mono text-xs">{py.date}</td>
                  <td>{py.method}</td>
                  <td className="text-muted-foreground">{py.reference || "—"}</td>
                  <td className="text-right font-mono">{fmtMoney(py.amount, cur)}</td>
                  <td className="text-right">
                    {canRecordPayment && (
                      <Button variant="ghost" size="icon" onClick={() => s.removePayment(py.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold mt-1 ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function LedgerTable({ entries, cur }: { entries: LedgerEntry[]; cur: string }) {
  if (entries.length === 0) return <Empty msg="No ledger activity yet." />;
  return (
    <div className="overflow-x-auto max-h-96">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground uppercase sticky top-0 bg-background">
          <tr>
            <th className="py-1">Date</th>
            <th>Type</th>
            <th>Description</th>
            <th className="text-right">Earned</th>
            <th className="text-right">Out / withheld</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="py-1 font-mono text-xs">{e.date}</td>
              <td>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {e.type.replace("_", " ")}
                </Badge>
              </td>
              <td className="text-muted-foreground">{e.description}</td>
              <td className="text-right font-mono">
                {e.debit ? fmtMoney(e.debit, cur) : "—"}
              </td>
              <td className="text-right font-mono">
                {e.credit ? fmtMoney(e.credit, cur) : "—"}
              </td>
              <td className="text-right font-mono font-semibold">
                {fmtMoney(e.balance, cur)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========== EXPLAIN DIALOG ========== */
export function ExplainDialog({
  invoiceId,
  open,
  onClose,
}: {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const s = useStore();
  const lang = s.language;
  const inv = s.invoices.find((x) => x.id === invoiceId);
  if (!inv) return null;
  const c = calcInvoice(inv, s.financeCompanies);
  const ag = s.agents.find((a) => a.id === inv.agentId) || null;
  const payouts = calcPayouts(s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides);
  const payout = payouts.find((p) => p.agent.id === inv.agentId) || null;
  const isEs = lang === "es";
  const cur = s.company.currency;
  const m = (n: number) => fmtMoney(n, cur);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  const repName = ag?.name || (isEs ? "Vendedor" : "Salesperson");
  const dealerFeeVal = inv.dealerFee != null ? inv.dealerFee : c.financeCo?.dealerFee ?? 0;
  const ccpfVal = inv.saleType === "credit_card" ? inv.salesAmount * (inv.ccpfPercent ?? 0.035) : 0;
  const adminFeeVal = inv.salesAmount * (inv.adminFeePercent || 0);
  const effectiveRate = payout ? (inv.commissionPercentOverride ?? payout.personalRate) : null;
  const reservePct = inv.taxReservePercent ?? ag?.taxReservePercent ?? 0;
  const reserveAmt = payout ? payout.taxReserveSuggested : 0;
  const finalAmt = payout ? payout.finalPayable : null;

  const bullets: string[] = [];
  if (isEs) {
    bullets.push(`Vendiste a ${inv.customerName || "cliente"} por ${m(inv.salesAmount)}.`);
    if (inv.productCost) bullets.push(`El costo del producto fue ${m(inv.productCost)}.`);
    bullets.push(`${c.financeCo?.name || "La financiera"} aprobó el ${pct(inv.approvalPercent)} de la venta → ${m(c.approvalAmount)}.`);
    if (inv.discount) bullets.push(`Se aplicó un descuento de ${m(inv.discount)}.`);
    if (c.financeCo && inv.saleType === "finance") bullets.push(`Comisión de ${c.financeCo.name}: ${m(c.financeCo.defaultFee * inv.salesAmount)} + admin fee ${m(c.financeCo.adminFee)}.`);
    if (dealerFeeVal > 0) bullets.push(`Dealer Fee del banco financiero: ${m(dealerFeeVal)}.`);
    if (ccpfVal > 0) bullets.push(`Cargo por procesamiento de tarjeta (CCPF al ${pct(inv.ccpfPercent ?? 0.035)}): ${m(ccpfVal)}.`);
    if (adminFeeVal > 0) bullets.push(`Admin Fee al ${pct(inv.adminFeePercent || 0)}: ${m(adminFeeVal)}.`);
    if (inv.charges.length) inv.charges.forEach((ch) => bullets.push(`Cargo adicional — ${ch.label || "cargo"}: ${m(ch.amount)}.`));
    if (inv.credits.length) inv.credits.forEach((cr) => bullets.push(`Crédito agregado — ${cr.label || "crédito"}: ${m(cr.amount)}.`));
    bullets.push(`El profit final fue ${m(c.profit)}.`);
  } else {
    bullets.push(`You sold to ${inv.customerName || "customer"} for ${m(inv.salesAmount)}.`);
    if (inv.productCost) bullets.push(`Product cost was ${m(inv.productCost)}.`);
    bullets.push(`${c.financeCo?.name || "Lender"} approved ${pct(inv.approvalPercent)} of the sale → ${m(c.approvalAmount)}.`);
    if (inv.discount) bullets.push(`A discount of ${m(inv.discount)} was applied.`);
    if (c.financeCo && inv.saleType === "finance") bullets.push(`${c.financeCo.name} fee: ${m(c.financeCo.defaultFee * inv.salesAmount)} + admin fee ${m(c.financeCo.adminFee)}.`);
    if (dealerFeeVal > 0) bullets.push(`Finance Bank Dealer Fee: ${m(dealerFeeVal)}.`);
    if (ccpfVal > 0) bullets.push(`Credit Card Processing Fee (${pct(inv.ccpfPercent ?? 0.035)}): ${m(ccpfVal)}.`);
    if (adminFeeVal > 0) bullets.push(`Admin Fee at ${pct(inv.adminFeePercent || 0)}: ${m(adminFeeVal)}.`);
    if (inv.charges.length) inv.charges.forEach((ch) => bullets.push(`Extra charge — ${ch.label || "charge"}: ${m(ch.amount)}.`));
    if (inv.credits.length) inv.credits.forEach((cr) => bullets.push(`Credit added — ${cr.label || "credit"}: ${m(cr.amount)}.`));
    bullets.push(`Final profit was ${m(c.profit)}.`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEs ? "Resumen de comisión" : "Commission Summary"} · {inv.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Greeting */}
          <p className="text-sm font-medium">
            {isEs
              ? `Hola ${repName}, aquí está el resumen de cómo calculamos tu comisión.`
              : `Hi ${repName}, here's how we calculated your commission.`}
          </p>

          {/* Bullet breakdown */}
          <ul className="space-y-1.5 text-sm">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent mt-0.5 shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* Commission summary box */}
          {payout && effectiveRate !== null && (
            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
              <p>
                {isEs
                  ? `Como tu posición es ${inv.commissionLevel || ag?.level || "—"} (${pct(effectiveRate)}), tu comisión personal fue:`
                  : `As your position is ${inv.commissionLevel || ag?.level || "—"} (${pct(effectiveRate)}), your personal commission was:`}
                {" "}<span className="font-bold text-accent">{m(payout.personalCommission)}</span>
              </p>
              {payout.overrideTotal > 0 && (
                <p>
                  {isEs ? "Override de tu downline:" : "Downline override:"}{" "}
                  <span className="font-semibold">{m(payout.overrideTotal)}</span>
                </p>
              )}
              {inv.advanceApplied ? (
                <p>
                  {isEs ? "Se descontó un advance de:" : "Advance deducted:"}{" "}
                  <span className="font-semibold text-destructive">− {m(inv.advanceApplied)}</span>
                </p>
              ) : null}
              {reservePct > 0 && (
                <p>
                  {isEs
                    ? `Como tienes configurada una reserva del ${pct(reservePct)}, recomendamos apartar:`
                    : `With a ${pct(reservePct)} tax reserve configured, we suggest setting aside:`}
                  {" "}<span className="font-semibold">{m(reserveAmt)}</span>
                </p>
              )}
              <div className="border-t border-border pt-2">
                <p className="font-semibold">
                  {isEs ? "Tu pago estimado sería:" : "Your estimated payout:"}{" "}
                  <span className="text-accent">{m(finalAmt ?? 0)}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isEs ? "Cerrar" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========== APPROVAL REQUEST WORKFLOW ========== */

const KIND_LABEL: Record<string, string> = {
  correction: "Correction",
  dispute: "Dispute",
  adjustment: "Adjustment",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  needs_info: "Needs info",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
};

const STATUS_ORDER = [
  "submitted",
  "under_review",
  "needs_info",
  "approved",
  "rejected",
  "resolved",
] as const;

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

function statusVariant(st: string): "default" | "destructive" | "outline" | "secondary" {
  if (st === "approved" || st === "resolved") return "default";
  if (st === "rejected") return "destructive";
  if (st === "needs_info" || st === "under_review") return "secondary";
  return "outline";
}

function priorityVariant(p: string): "default" | "destructive" | "outline" | "secondary" {
  if (p === "high") return "destructive";
  if (p === "low") return "outline";
  return "secondary";
}

const FIELD_OPTIONS: { value: keyof Invoice | ""; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "salesAmount", label: "Sales amount" },
  { value: "productCost", label: "Product cost" },
  { value: "approvalPercent", label: "Approval %" },
  { value: "discount", label: "Discount" },
  { value: "customerName", label: "Customer name" },
];

export function DisputeDialog({
  invoiceId,
  open,
  onClose,
}: {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const s = useStore();
  const inv = s.invoices.find((x) => x.id === invoiceId);
  const [kind, setKind] = useState<"correction" | "dispute" | "adjustment">("correction");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [field, setField] = useState<string>("");
  const [toValue, setToValue] = useState("");
  if (!inv) return null;

  const submit = () => {
    if (!reason.trim()) return toast.error("Reason is required");
    const fieldKey = field && field !== "__none" ? field : "";
    const requestedChange =
      fieldKey && toValue.trim()
        ? {
            field: fieldKey,
            fromValue: String((inv as any)[fieldKey] ?? ""),
            toValue: toValue.trim(),
          }
        : null;
    s.addDispute({
      invoiceId: inv.id,
      agentId: inv.agentId,
      reason: reason.trim(),
      notes,
      kind,
      priority,
      requestedChange,
    });
    toast.success("Approval request submitted");
    setReason("");
    setNotes("");
    setField("");
    setToValue("");
    setKind("correction");
    setPriority("normal");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New approval request — {inv.number}</DialogTitle>
          <DialogDescription>
            Submit a correction, dispute or adjustment for admin review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="dispute">Dispute</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong sales amount"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Suggested change — field</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "none"} value={o.value || "__none"}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New value</Label>
              <Input
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
                disabled={!field || field === "__none"}
                placeholder={
                  field && field !== "__none"
                    ? `Current: ${String((inv as any)[field] ?? "")}`
                    : "Pick a field first"
                }
              />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context, customer feedback, references…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestTimeline({ events, agents }: { events: any[]; agents: { id: string; name: string }[] }) {
  if (!events?.length) return null;
  return (
    <div className="mt-3 border-t pt-3 space-y-1.5">
      {events.map((ev, i) => (
        <div key={i} className="text-xs text-muted-foreground flex gap-2">
          <span className="font-mono shrink-0">{ev.at.slice(0, 16).replace("T", " ")}</span>
          <Badge variant="outline" className="h-5 px-1.5 capitalize">{ev.actor}</Badge>
          <span className="font-medium text-foreground/80">{ev.type.replace("_", " ")}</span>
          {ev.message && <span className="italic">— {ev.message}</span>}
        </div>
      ))}
    </div>
  );
}

function RepRequestsPanel() {
  const s = useStore();
  const myAgentId = s.activeAgentId;
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const visible = s.disputes
    .filter((d) => d.agentId === myAgentId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (visible.length === 0) {
    return (
      <Section title="My approval requests" desc="Track the status of requests you've submitted.">
        <Empty msg="No requests yet. Submit one from any invoice via the 💬 icon." />
      </Section>
    );
  }
  return (
    <Section title="My approval requests" desc="Track the status of requests you've submitted.">
      <div className="space-y-3">
        {visible.map((d) => {
          const inv = s.invoices.find((x) => x.id === d.invoiceId);
          return (
            <Card key={d.id} className="p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-xs">{inv?.number || "—"}</span>
                <Badge variant={statusVariant(d.status)}>{STATUS_LABEL[d.status]}</Badge>
                <Badge variant={priorityVariant(d.priority)}>{PRIORITY_LABEL[d.priority]}</Badge>
                <Badge variant="outline">{KIND_LABEL[d.kind]}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {d.createdAt.slice(0, 10)}
                </span>
              </div>
              <div className="font-medium">{d.reason}</div>
              {d.notes && <p className="text-sm text-muted-foreground mt-1">{d.notes}</p>}
              {d.requestedChange && (
                <p className="text-xs mt-1">
                  <span className="text-muted-foreground">Suggested change:</span>{" "}
                  <span className="font-mono">{d.requestedChange.field}</span>{" "}
                  <span className="text-muted-foreground">{d.requestedChange.fromValue}</span>{" "}
                  → <span className="font-medium">{d.requestedChange.toValue}</span>
                </p>
              )}
              {d.adminNotes && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Admin notes: {d.adminNotes}
                </p>
              )}
              {d.status === "needs_info" && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Reply to admin…"
                    value={replyDraft[d.id] ?? ""}
                    onChange={(e) =>
                      setReplyDraft((p) => ({ ...p, [d.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const msg = (replyDraft[d.id] ?? "").trim();
                      if (!msg) return;
                      s.replyToRequest(d.id, "rep", msg);
                      setReplyDraft((p) => ({ ...p, [d.id]: "" }));
                      toast.success("Reply sent");
                    }}
                  >
                    Send
                  </Button>
                </div>
              )}
              <RequestTimeline events={d.events} agents={s.agents} />
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function ApprovalsQueuePanel() {
  const s = useStore();
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [adminMsg, setAdminMsg] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: s.disputes.length,
      active: 0,
    };
    STATUS_ORDER.forEach((st) => (c[st] = 0));
    for (const d of s.disputes) {
      c[d.status] = (c[d.status] || 0) + 1;
      if (d.status === "submitted" || d.status === "under_review" || d.status === "needs_info") {
        c.active++;
      }
    }
    return c;
  }, [s.disputes]);

  const filtered = useMemo(() => {
    let list = s.disputes.slice();
    if (filter === "active") {
      list = list.filter(
        (d) =>
          d.status === "submitted" ||
          d.status === "under_review" ||
          d.status === "needs_info"
      );
    } else if (filter !== "all") {
      list = list.filter((d) => d.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => {
        const inv = s.invoices.find((x) => x.id === d.invoiceId);
        const ag = s.agents.find((a) => a.id === d.agentId);
        return (
          inv?.number?.toLowerCase().includes(q) ||
          ag?.name?.toLowerCase().includes(q) ||
          d.reason.toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a, b) => {
      const pr = { high: 0, normal: 1, low: 2 };
      const dp = pr[a.priority] - pr[b.priority];
      if (dp !== 0) return dp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [s.disputes, s.invoices, s.agents, filter, search]);

  const chips: { value: string; label: string }[] = [
    { value: "active", label: `Active (${counts.active})` },
    { value: "submitted", label: `Submitted (${counts.submitted})` },
    { value: "under_review", label: `Under review (${counts.under_review})` },
    { value: "needs_info", label: `Needs info (${counts.needs_info})` },
    { value: "approved", label: `Approved (${counts.approved})` },
    { value: "rejected", label: `Rejected (${counts.rejected})` },
    { value: "resolved", label: `Resolved (${counts.resolved})` },
    { value: "all", label: `All (${counts.all})` },
  ];

  return (
    <Section
      title="Approval queue"
      desc="Review, claim and resolve requests submitted by reps."
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {chips.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={filter === c.value ? "default" : "outline"}
            onClick={() => setFilter(c.value)}
          >
            {c.label}
          </Button>
        ))}
        <div className="w-full sm:w-64 sm:ml-auto mt-2 sm:mt-0">
          <Input
            placeholder="Search invoice, agent, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty msg="No requests match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const inv = s.invoices.find((x) => x.id === d.invoiceId);
            const ag = s.agents.find((a) => a.id === d.agentId);
            const assignee = s.agents.find((a) => a.id === d.assignedAdminId);
            const ageDays = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(d.createdAt).getTime()) / 86400000
              )
            );
            const isOpen =
              d.status === "submitted" ||
              d.status === "under_review" ||
              d.status === "needs_info";
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs">{inv?.number || "—"}</span>
                      <Badge variant={statusVariant(d.status)}>{STATUS_LABEL[d.status]}</Badge>
                      <Badge variant={priorityVariant(d.priority)}>
                        {PRIORITY_LABEL[d.priority]}
                      </Badge>
                      <Badge variant="outline">{KIND_LABEL[d.kind]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {ag?.name || "—"} · {ageDays}d old
                        {assignee && <> · 👤 {assignee.name}</>}
                      </span>
                    </div>
                    <div className="font-medium">{d.reason}</div>
                    {d.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{d.notes}</p>
                    )}
                    {d.requestedChange && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Suggested change:</span>{" "}
                        <span className="font-mono">{d.requestedChange.field}</span>{" "}
                        <span className="text-muted-foreground">
                          {d.requestedChange.fromValue}
                        </span>{" "}
                        → <span className="font-medium">{d.requestedChange.toValue}</span>
                        {inv && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-2 py-0"
                            onClick={() => {
                              const f = d.requestedChange!.field as keyof Invoice;
                              const num = ["salesAmount", "productCost", "approvalPercent", "discount"];
                              const v: any = num.includes(f as string)
                                ? Number(d.requestedChange!.toValue)
                                : d.requestedChange!.toValue;
                              if (num.includes(f as string) && Number.isNaN(v)) {
                                toast.error("Suggested value is not numeric");
                                return;
                              }
                              s.updateInvoice(inv.id, { [f]: v } as any);
                              toast.success("Suggested change applied to invoice");
                            }}
                          >
                            Apply
                          </Button>
                        )}
                      </p>
                    )}
                    <Textarea
                      className="mt-2"
                      placeholder="Admin notes (visible to rep)…"
                      rows={2}
                      value={d.adminNotes}
                      onChange={(e) =>
                        s.updateDispute(d.id, { adminNotes: e.target.value })
                      }
                    />
                    {d.status === "needs_info" && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="Message to rep (will appear in timeline)…"
                          value={adminMsg[d.id] ?? ""}
                          onChange={(e) =>
                            setAdminMsg((p) => ({ ...p, [d.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const msg = (adminMsg[d.id] ?? "").trim();
                            if (!msg) return;
                            s.replyToRequest(d.id, "admin", msg);
                            setAdminMsg((p) => ({ ...p, [d.id]: "" }));
                          }}
                        >
                          Send
                        </Button>
                      </div>
                    )}
                    <RequestTimeline events={d.events} agents={s.agents} />
                  </div>
                  <div className="flex flex-col gap-2 w-44 shrink-0">
                    {d.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          s.claimRequest(d.id, s.activeAgentId);
                          toast.success("Claimed");
                        }}
                      >
                        Claim
                      </Button>
                    )}
                    {isOpen && d.status !== "needs_info" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          s.setRequestStatus(
                            d.id,
                            "needs_info",
                            "admin",
                            "More info requested"
                          );
                          toast("Marked as needs info");
                        }}
                      >
                        Request info
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        s.setRequestStatus(d.id, "approved", "admin", d.adminNotes || "");
                        toast.success("Approved");
                      }}
                      disabled={d.status === "approved"}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        s.setRequestStatus(d.id, "rejected", "admin", d.adminNotes || "");
                        toast("Rejected");
                      }}
                      disabled={d.status === "rejected"}
                    >
                      Reject
                    </Button>
                    {(d.status === "approved" || d.status === "rejected") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          s.setRequestStatus(d.id, "resolved", "admin", "Closed");
                          toast.success("Resolved");
                        }}
                      >
                        Mark resolved
                      </Button>
                    )}
                    {inv && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const c = calcInvoice(inv, s.financeCompanies);
                          const doc = buildSaleInvoicePDF(c, s.company, ag?.name || "—");
                          doc.save(`${inv.number}_recalculated.pdf`);
                          toast.success("PDF regenerated");
                        }}
                      >
                        <FileDown className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => s.removeDispute(d.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function DisputesPanel() {
  const s = useStore();
  return s.role === "admin" ? <ApprovalsQueuePanel /> : <RepRequestsPanel />;
}

/* ========== SIMULATOR ========== */
export function SimulatorPanel() {
  const s = useStore();
  const cur = s.company.currency;
  const [form, setForm] = useState({
    salesAmount: 10000,
    productCost: 4000,
    financeCompanyId: "none",
    approvalPercent: 1,
    deductions: 0,
    credits: 0,
    level: 0, // 0 = personal commission; >=1 = override at that level
    taxReservePercent: 0.22,
    extraCharges: 0,
  });
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveForm, setSaveForm] = useState({ agentId: "", customerName: "" });

  const fc = s.financeCompanies.find((f) => f.id === form.financeCompanyId) || null;
  const approval = form.salesAmount * form.approvalPercent;
  const financeCharges = fc
    ? fc.dealerFee + fc.adminFee + fc.defaultFee * form.salesAmount
    : 0;
  const totalCharges = financeCharges + form.extraCharges;
  const grand = approval - totalCharges + form.credits;
  const profit = grand - form.productCost - form.deductions;

  let rate = 0;
  let label = "Personal commission";
  if (form.level === 0) {
    const tiers = [...s.personalTiers].sort((a, b) => a.minVolume - b.minVolume);
    for (const t of tiers) if (profit >= t.minVolume) rate = t.rate;
    label = `Personal commission (tier @ ${(rate * 100).toFixed(2)}%)`;
  } else {
    rate = s.overrides.find((o) => o.level === form.level)?.rate ?? 0;
    label = `L${form.level} override @ ${(rate * 100).toFixed(2)}%`;
  }
  const commission = Math.max(0, profit) * rate;
  const taxReserve = Math.max(0, commission) * form.taxReservePercent;
  const net = commission - taxReserve;

  const handleSaveAsInvoice = () => {
    s.addInvoice({
      date: new Date().toISOString().slice(0, 10),
      status: "draft",
      agentId: saveForm.agentId || "",
      financeCompanyId: form.financeCompanyId === "none" ? null : form.financeCompanyId,
      customerName: saveForm.customerName || "—",
      customerNotes: "",
      salesAmount: form.salesAmount,
      productCost: form.productCost,
      approvalPercent: form.approvalPercent,
      discount: 0,
      charges: form.extraCharges > 0 ? [{ label: "Extra charges", amount: form.extraCharges }] : [],
      credits: form.credits > 0 ? [{ label: "Credits", amount: form.credits }] : [],
      advanceApplied: 0,
      specialDeductions: form.deductions,
      taxReservePercent: form.taxReservePercent,
      paid: false,
      saleType: form.financeCompanyId !== "none" ? "finance" : undefined,
    });
    setSaveDialog(false);
    setSaveForm({ agentId: "", customerName: "" });
    toast.success("Draft invoice created — complete it in the Invoices tab.");
  };

  return (
    <>
      <Section
        title="Payout Simulator"
        desc="Estimate your commission before closing a sale. No data is saved until you convert to invoice."
        action={
          <Button
            size="sm"
            className="bg-gradient-primary text-white hover:opacity-90 gap-1.5"
            onClick={() => setSaveDialog(true)}
          >
            <Plus className="w-4 h-4" /> Save as Invoice
          </Button>
        }
      >
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Sales amount</Label>
                <Input
                  type="number"
                  value={form.salesAmount}
                  onChange={(e) => setForm({ ...form, salesAmount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Product cost</Label>
                <Input
                  type="number"
                  value={form.productCost}
                  onChange={(e) => setForm({ ...form, productCost: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Finance company</Label>
                <Select
                  value={form.financeCompanyId}
                  onValueChange={(v) => setForm({ ...form, financeCompanyId: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {s.financeCompanies.filter((f) => f.active).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Approval %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={(form.approvalPercent * 100).toFixed(2)}
                  onChange={(e) => setForm({ ...form, approvalPercent: Number(e.target.value) / 100 })}
                />
              </div>
              <div>
                <Label>Commission level</Label>
                <Select
                  value={String(form.level)}
                  onValueChange={(v) => setForm({ ...form, level: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Personal (own sale)</SelectItem>
                    {s.overrides.slice().sort((a, b) => a.level - b.level).map((o) => (
                      <SelectItem key={o.level} value={String(o.level)}>
                        L{o.level} downline override
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Extra charges</Label>
                <Input
                  type="number"
                  value={form.extraCharges}
                  onChange={(e) => setForm({ ...form, extraCharges: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Deductions</Label>
                <Input
                  type="number"
                  value={form.deductions}
                  onChange={(e) => setForm({ ...form, deductions: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Credits</Label>
                <Input
                  type="number"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tax reserve %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={(form.taxReservePercent * 100).toFixed(2)}
                  onChange={(e) => setForm({ ...form, taxReservePercent: Number(e.target.value) / 100 })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Estimate
            </h3>
            <div className="space-y-1 text-sm">
              <Row k="Approval amount" v={fmtMoney(approval, cur)} />
              <Row k="Finance / extra charges" v={`- ${fmtMoney(totalCharges, cur)}`} />
              <Row k="Credits" v={`+ ${fmtMoney(form.credits, cur)}`} />
              <Row k="Grand total" v={fmtMoney(grand, cur)} bold />
              <Row k="Product cost" v={`- ${fmtMoney(form.productCost, cur)}`} />
              <Row k="Deductions" v={`- ${fmtMoney(form.deductions, cur)}`} />
              <Row k="Profit (commission base)" v={fmtMoney(profit, cur)} bold />
              <div className="border-t my-2" />
              <Row k={label} v={fmtMoney(commission, cur)} accent bold />
              <Row k="Tax reserve" v={`- ${fmtMoney(taxReserve, cur)}`} />
              <Row k="Estimated take-home" v={fmtMoney(net, cur)} accent bold />
            </div>
            <p className="text-xs text-muted-foreground mt-4 italic">
              Estimate only. Final payout depends on team performance, downline activity and actual approval.
            </p>
          </Card>
        </div>
      </Section>

      {/* Save as Invoice dialog */}
      <Dialog open={saveDialog} onOpenChange={(o) => { if (!o) setSaveDialog(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Invoice Draft</DialogTitle>
            <DialogDescription>
              Creates a draft invoice with your simulator values. You can complete it in the Invoices tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Sales rep (optional)</Label>
              <Select value={saveForm.agentId || "none"} onValueChange={(v) => setSaveForm({ ...saveForm, agentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {s.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer name (optional)</Label>
              <Input
                value={saveForm.customerName}
                onChange={(e) => setSaveForm({ ...saveForm, customerName: e.target.value })}
                placeholder="Customer name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAsInvoice} className="bg-gradient-primary text-white hover:opacity-90">
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  k,
  v,
  bold,
  accent,
}: {
  k: string;
  v: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${accent ? "text-accent" : ""}`}>{v}</span>
    </div>
  );
}

/* ========== TEMPLATES ========== */
const INDUSTRY_ICONS: Record<string, string> = {
  "water":            "💧",
  "solar":            "☀️",
  "roofing":          "🏠",
  "hvac":             "❄️",
  "alarm":            "🔔",
  "home-improvement": "🔨",
  "real-estate":      "🏡",
  "life-insurance":   "🛡️",
  "dealer":           "🚗",
};

export function TemplatesPanel() {
  const s = useStore();
  const apply = (id: string) => {
    const t = INDUSTRY_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (
      !confirm(
        `Apply "${t.name}" kit? This will replace your tiers and overrides${
          t.finance ? " and add a finance company" : ""
        }.`
      )
    )
      return;
    s.applyTemplate(t);
    toast.success(`${t.name} kit applied`);
  };
  return (
    <Section
      title="Industry Launch Kits"
      desc="One-click presets for common commission models. Apply a kit to instantly configure tiers, overrides, and finance settings for your industry."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {INDUSTRY_TEMPLATES.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0 select-none">
                  {INDUSTRY_ICONS[t.id] ?? "🏢"}
                </div>
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </div>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => apply(t.id)}>
                Apply
              </Button>
            </div>
            <div className="mt-3 text-xs grid grid-cols-3 gap-2 text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Tiers</span>
                <ul className="mt-1">
                  {t.tiers.map((tt, i) => (
                    <li key={i} className="font-mono">
                      ≥{tt.minVolume} → {(tt.rate * 100).toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-semibold text-foreground">Overrides</span>
                <ul className="mt-1">
                  {t.overrides.map((o) => (
                    <li key={o.level} className="font-mono">
                      L{o.level} → {(o.rate * 100).toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-semibold text-foreground">Finance</span>
                <div className="mt-1">{t.finance ? t.finance.name : "—"}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ========== PAYOUT CALENDAR ========== */
export function CalendarPanel() {
  const s = useStore();
  const isAdmin = s.role !== "rep";
  const myAgentId = !isAdmin ? s.activeAgentId : null;
  const cur = s.company.currency;
  const payouts = useMemo(
    () => calcPayouts(s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides),
    [s.agents, s.invoices, s.financeCompanies, s.personalTiers, s.overrides]
  );

  const visibleInvoices = isAdmin
    ? s.invoices
    : s.invoices.filter((i) => i.agentId === myAgentId);
  const visiblePayouts = isAdmin
    ? payouts
    : payouts.filter((p) => p.agent.id === myAgentId);

  // group invoices by their date
  const byDate = new Map<string, Invoice[]>();
  for (const inv of visibleInvoices) {
    if (!byDate.has(inv.date)) byDate.set(inv.date, []);
    byDate.get(inv.date)!.push(inv);
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = visibleInvoices.filter((i) => i.date >= today && !i.paid);
  const past = visibleInvoices.filter((i) => i.date < today || i.paid);

  const totalPending = upcoming.reduce((acc, i) => {
    const c = calcInvoice(i, s.financeCompanies);
    return acc + Math.max(0, c.profit);
  }, 0);
  const totalPaid = past
    .filter((i) => i.paid)
    .reduce((acc, i) => acc + calcInvoice(i, s.financeCompanies).profit, 0);
  const totalPayout = visiblePayouts.reduce((a, p) => a + p.finalPayable, 0);

  return (
    <Section
      title={isAdmin ? "Payout Calendar" : "My upcoming payouts"}
      desc={isAdmin ? "Upcoming and past invoices grouped by date, with totals for the upcoming payout." : "Only your own invoices and payouts are shown."}
      action={
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Next payout date</Label>
            <Input
              type="date"
              value={s.nextPayoutDate}
              onChange={(e) => s.setNextPayoutDate(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Next payout" value={s.nextPayoutDate} />
        <Stat label="Pending profit" value={fmtMoney(totalPending, cur)} accent />
        <Stat label="Paid profit" value={fmtMoney(totalPaid, cur)} />
        <Stat label="Period payout total" value={fmtMoney(totalPayout, cur)} accent />
      </div>

      {byDate.size === 0 ? (
        <Empty msg="No invoices yet." />
      ) : (
        <div className="space-y-3">
          {[...byDate.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, list]) => {
              const dayProfit = list.reduce(
                (acc, i) => acc + calcInvoice(i, s.financeCompanies).profit,
                0
              );
              const allPaid = list.every((i) => i.paid);
              const anyApproved = list.some((i) => i.status === "pending" || i.paid);
              return (
                <Card key={date} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm">{date}</div>
                      <Badge variant={allPaid ? "default" : anyApproved ? "secondary" : "outline"}>
                        {allPaid ? "all paid" : anyApproved ? "approved" : "pending"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {list.length} invoice(s)
                      </span>
                    </div>
                    <div className="font-mono font-semibold">{fmtMoney(dayProfit, cur)}</div>
                  </div>
                  <div className="overflow-x-auto"><table className="w-full text-xs">
                    <tbody>
                      {list.map((i) => {
                        const ag = s.agents.find((a) => a.id === i.agentId);
                        const c = calcInvoice(i, s.financeCompanies);
                        return (
                          <tr key={i.id} className="border-t border-border/40">
                            <td className="py-1 font-mono">{i.number}</td>
                            <td>{i.customerName || "—"}</td>
                            <td>{ag?.name || "—"}</td>
                            <td>
                              <Badge variant="outline" className="text-[10px]">
                                {i.paid ? "paid" : i.status}
                              </Badge>
                            </td>
                            <td className="text-right font-mono">
                              {fmtMoney(c.profit, cur)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                </Card>
              );
            })}
        </div>
      )}
    </Section>
  );
}
