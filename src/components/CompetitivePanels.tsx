import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, Upload, CheckCircle2, ArrowRight, ArrowLeft, Settings2 } from "lucide-react";
import { useStore, type AdjustmentKind, type Invoice } from "@/lib/commission-store";
import { fmtMoney, calcInvoice } from "@/lib/commission-calc";
import { labelFor } from "@/lib/ledger";
import { INVOICE_TEMPLATES, buildSaleAndDownload } from "@/lib/generate-invoices";
import { useT } from "@/lib/i18n";

/* ===================================================================
   ADJUSTMENT / CORRECTION CENTER
   Unified place for advances, deductions, credits, chargebacks,
   manual overrides, payment & split corrections, pending-balance fixes.
   Every entry feeds the Balance Ledger via the store.
   =================================================================== */

const KINDS: { value: AdjustmentKind; label: string; desc: string }[] = [
  { value: "advance", label: "Advance", desc: "Money paid up-front to a rep, deducted later." },
  { value: "deduction", label: "Deduction", desc: "Reduces the rep's payable balance." },
  { value: "credit", label: "Credit / bonus", desc: "Adds to the rep's payable balance." },
  { value: "chargeback", label: "Chargeback", desc: "Sale fell through, claw back commission." },
  { value: "manual_override", label: "Manual override", desc: "Discretionary upline override." },
  { value: "payment_correction", label: "Payment correction", desc: "Fix an over/under payment." },
  { value: "split_correction", label: "Split correction", desc: "Re-split commission across reps." },
  { value: "pending_balance", label: "Pending balance", desc: "Move money into pending balance." },
];

export function AdjustmentsPanel() {
  const s = useStore();
  const isAdmin = s.role === "admin";
  const [form, setForm] = useState({
    agentId: "",
    invoiceId: "",
    kind: "advance" as AdjustmentKind,
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Only admins can post adjustments. Reps can request corrections from the Approvals tab.
        </p>
      </Card>
    );
  }

  const submit = () => {
    if (!form.agentId) return toast.error("Pick a salesperson");
    if (!form.amount || form.amount <= 0) return toast.error("Amount must be positive");
    s.addAdjustment({
      agentId: form.agentId,
      invoiceId: form.invoiceId || null,
      kind: form.kind,
      amount: Number(form.amount),
      date: form.date,
      note: form.note.trim(),
      createdBy: "admin",
    });
    toast.success("Adjustment recorded");
    setForm({ ...form, amount: 0, note: "", invoiceId: "" });
  };

  const recent = s.adjustments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Card className="p-6 shadow-card space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> Adjustment & Correction Center
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          One place for every advance, deduction, credit, chargeback, manual override and payment
          correction. Every entry is logged in each rep's Balance Ledger.
        </p>
      </div>

      <div className="grid md:grid-cols-6 gap-3 p-4 bg-muted/40 rounded-lg">
        <div className="md:col-span-2">
          <Label>Salesperson</Label>
          <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {s.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Type</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as AdjustmentKind })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            {KINDS.find((k) => k.value === form.kind)?.desc}
          </p>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" step="0.01" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>

        <div className="md:col-span-3">
          <Label>Related invoice (optional)</Label>
          <Select value={form.invoiceId || "none"} onValueChange={(v) => setForm({ ...form, invoiceId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {s.invoices
                .filter((i) => !form.agentId || i.agentId === form.agentId)
                .map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.number} · {i.customerName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3">
          <Label>Note</Label>
          <Input value={form.note} placeholder="e.g. Q1 advance, customer cancelled, payroll correction…"
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <div className="md:col-span-6">
          <Button onClick={submit}><Plus className="w-4 h-4 mr-2" />Post adjustment</Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Recent adjustments</h3>
        {recent.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
            No adjustments yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2">Date</th><th>Salesperson</th><th>Type</th>
                  <th className="text-right">Amount</th><th>Invoice</th><th>Note</th><th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => {
                  const ag = s.agents.find((x) => x.id === a.agentId);
                  const inv = a.invoiceId ? s.invoices.find((x) => x.id === a.invoiceId) : null;
                  return (
                    <tr key={a.id} className="border-t border-border/60">
                      <td className="py-2 font-mono text-xs">{a.date}</td>
                      <td>{ag?.name ?? "—"}</td>
                      <td>{labelFor(a.kind)}</td>
                      <td className="text-right font-mono">{fmtMoney(a.amount, s.company.currency)}</td>
                      <td className="font-mono text-xs">{inv?.number ?? "—"}</td>
                      <td className="text-muted-foreground">{a.note}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => s.removeAdjustment(a.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ===================================================================
   CSV INVOICE IMPORT
   Accepted columns (header row required, case-insensitive):
   date, customer, salesperson, sales_amount, product_cost,
   approval_percent, finance_company, discount, advance, deduction
   =================================================================== */

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let val = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { val += '"'; i++; }
      else if (ch === '"') { q = false; }
      else { val += ch; }
    } else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(val); val = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (val.length || cur.length) { cur.push(val); rows.push(cur); cur = []; val = ""; }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else val += ch;
  }
  if (val.length || cur.length) { cur.push(val); rows.push(cur); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

export function CsvImportPanel() {
  const s = useStore();
  const isAdmin = s.role === "admin";
  const [preview, setPreview] = useState<Omit<Invoice, "id" | "number">[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Only admins can import invoices.</p>
      </Card>
    );
  }

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    const errs: string[] = [];
    const out: Omit<Invoice, "id" | "number">[] = [];
    const agentByName = new Map(s.agents.map((a) => [a.name.toLowerCase(), a]));
    const financeByName = new Map(s.financeCompanies.map((f) => [f.name.toLowerCase(), f]));

    rows.forEach((r, idx) => {
      const agName = (r.salesperson || r.agent || "").toLowerCase();
      const ag = agentByName.get(agName);
      if (!ag) {
        errs.push(`Row ${idx + 2}: salesperson "${r.salesperson || r.agent}" not found.`);
        return;
      }
      const fcName = (r.finance_company || r.finance || "").toLowerCase();
      const fc = fcName ? financeByName.get(fcName) : null;

      out.push({
        date: r.date || new Date().toISOString().slice(0, 10),
        status: "draft",
        agentId: ag.id,
        financeCompanyId: fc?.id ?? null,
        customerName: r.customer || r.customer_name || "",
        customerNotes: r.notes || "",
        salesAmount: Number(r.sales_amount || r.sales || 0),
        productCost: Number(r.product_cost || r.cost || 0),
        approvalPercent: Number(r.approval_percent || 100) / 100,
        discount: Number(r.discount || 0),
        charges: [],
        credits: [],
        advanceApplied: Number(r.advance || 0),
        specialDeductions: Number(r.deduction || 0),
        taxReservePercent: Number(r.tax_reserve_percent || 20) / 100,
        paid: false,
      });
    });

    setErrors(errs);
    setPreview(out);
    if (out.length) toast.success(`${out.length} invoice(s) ready to import`);
    else toast.error("No valid rows found");
  };

  const confirm = () => {
    if (!preview.length) return;
    const n = s.importInvoices(preview);
    toast.success(`Imported ${n} invoice(s)`);
    setPreview([]);
    setErrors([]);
  };

  const downloadTemplate = () => {
    const csv =
      "date,customer,salesperson,sales_amount,product_cost,approval_percent,finance_company,discount,advance,deduction\n" +
      "2025-01-15,John Smith,Jane Doe,12500,7000,100,,0,0,0\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "invoices-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6 shadow-card space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="w-5 h-5" /> Import invoices from CSV
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          No CRM required. Upload a CSV and we'll create invoices in bulk.
          Required columns: <code className="text-xs">date, customer, salesperson, sales_amount, product_cost</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={downloadTemplate}>Download CSV template</Button>
        <label className="inline-flex">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
          />
          <span className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4 mr-2" /> Choose CSV
          </span>
        </label>
        {preview.length > 0 && (
          <Button onClick={confirm}>Import {preview.length} invoice(s)</Button>
        )}
      </div>

      {errors.length > 0 && (
        <div className="text-xs text-destructive space-y-1">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}

      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <tr><th className="py-2">Date</th><th>Customer</th><th>Salesperson</th>
                <th className="text-right">Sales</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {preview.map((p, i) => {
                const ag = s.agents.find((a) => a.id === p.agentId);
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-2 font-mono text-xs">{p.date}</td>
                    <td>{p.customerName}</td>
                    <td>{ag?.name}</td>
                    <td className="text-right font-mono">{fmtMoney(p.salesAmount, s.company.currency)}</td>
                    <td className="text-right font-mono">{fmtMoney(p.productCost, s.company.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ===================================================================
   SETUP WIZARD
   Guided 8-step onboarding. Each step writes through to the store so
   the user's selections immediately apply to the real workflow.
   Progress (current step, completed steps, completed flag) is persisted.
   =================================================================== */


export function SetupWizard({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const t = useT();
  const [step, setStep] = useState(0);
  const [agentDraft, setAgentDraft] = useState({ name: "", email: "" });
  const [financeDraft, setFinanceDraft] = useState({
    name: "", defaultFee: 0.05, dealerFee: 0, adminFee: 0,
  });

  const steps = ["Company", "Team", "Finance Companies"];

  const goTo = (n: number) => setStep(n);
  const next = () => goTo(Math.min(steps.length - 1, step + 1));
  const back = () => goTo(Math.max(0, step - 1));

  const finish = () => {
    s.completeWizard();
    toast.success("Setup complete! You're ready to go.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-xl p-6 shadow-elegant max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Quick Setup</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>

        <div className="h-1 bg-muted rounded mb-5 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {step === 0 && (
          <div className="grid gap-3">
            <div><Label>Company name</Label>
              <Input value={s.company.name} onChange={(e) => s.setCompany({ name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Currency</Label>
                <Select value={s.company.currency} onValueChange={(v) => s.setCompany({ currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD","EUR","GBP","CAD","AUD","MXN","BRL"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Invoice prefix</Label>
                <Input value={s.company.invoicePrefix} onChange={(e) => s.setCompany({ invoicePrefix: e.target.value })} />
              </div>
            </div>
            <div><Label>Billing email</Label>
              <Input value={s.company.email} onChange={(e) => s.setCompany({ email: e.target.value })} />
            </div>
            <div><Label>Address</Label>
              <Input value={s.company.address} onChange={(e) => s.setCompany({ address: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add salespeople. Reps are saved instantly and used by every invoice.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label>
                <Input value={agentDraft.name} onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })} />
              </div>
              <div><Label>Email</Label>
                <Input value={agentDraft.email} onChange={(e) => setAgentDraft({ ...agentDraft, email: e.target.value })} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              if (!agentDraft.name.trim()) return toast.error("Name required");
              s.addAgent({ name: agentDraft.name.trim(), email: agentDraft.email.trim(), sponsorId: null });
              setAgentDraft({ name: "", email: "" });
              toast.success("Added");
            }}><Plus className="w-3 h-3 mr-2" />Add salesperson</Button>
            {s.agents.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Added: {s.agents.map((a) => a.name).join(", ")}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add finance companies (lenders). Each is selectable on every invoice.
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2"><Label>Name</Label>
                <Input value={financeDraft.name} onChange={(e) => setFinanceDraft({ ...financeDraft, name: e.target.value })} placeholder="Goodleap" />
              </div>
              <div><Label>Fee %</Label>
                <Input type="number" step="0.1" value={financeDraft.defaultFee * 100}
                  onChange={(e) => setFinanceDraft({ ...financeDraft, defaultFee: Number(e.target.value) / 100 })} />
              </div>
              <div><Label>Dealer fee</Label>
                <Input type="number" value={financeDraft.dealerFee}
                  onChange={(e) => setFinanceDraft({ ...financeDraft, dealerFee: Number(e.target.value) })} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              if (!financeDraft.name.trim()) return toast.error("Name required");
              s.addFinanceCo({ ...financeDraft, usesApprovalDiscount: false, active: true, notes: "" });
              setFinanceDraft({ name: "", defaultFee: 0.05, dealerFee: 0, adminFee: 0 });
              toast.success("Added");
            }}><Plus className="w-3 h-3 mr-2" />Add finance company</Button>
            {s.financeCompanies.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Added: {s.financeCompanies.map((f) => f.name).join(", ")}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={onClose}>Skip setup</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={back}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>}
            {step < steps.length - 1
              ? <Button onClick={next}>Next<ArrowRight className="w-4 h-4 ml-1" /></Button>
              : <Button onClick={finish}>Finish</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* small unused-export shim to silence textarea import in some bundlers */
export const _ = Textarea;

