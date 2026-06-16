import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, Plus, Sparkles, ShieldCheck, History, FileText, Download } from "lucide-react";
import {
  useStore,
  type SplitParticipant,
  type SplitParticipantRole,
  type SplitTemplate,
  type SplitRule,
  type InvoiceSplit,
  type SaleType,
} from "@/lib/commission-store";
import { calcInvoice, fmtMoney } from "@/lib/commission-calc";
import { buildSaleInvoicePDF, makeBrandingSnapshot } from "@/lib/generate-invoices";

const ROLE_LABELS: Record<SplitParticipantRole, string> = {
  sales_rep: "Sales Rep",
  setter: "Setter",
  closer: "Closer",
  manager: "Manager",
  dealer: "Dealer",
  upline: "Upline",
  installer: "Installer",
  partner: "Partner",
  override_recipient: "Override Recipient",
  custom: "Custom",
};

const ROLES = Object.keys(ROLE_LABELS) as SplitParticipantRole[];

export function roleLabel(r: SplitParticipantRole, custom?: string): string {
  if (r === "custom" && custom) return custom;
  return ROLE_LABELS[r];
}

/* ---------- Helpers ---------- */

export function totalSplitPercent(participants: SplitParticipant[]): number {
  return participants.reduce((s, p) => s + (Number(p.splitPercent) || 0), 0);
}

export function isSplitValid(participants: SplitParticipant[]): boolean {
  if (participants.length === 0) return false;
  const total = totalSplitPercent(participants);
  return Math.abs(total - 1) < 0.0001;
}

function pKey(p: SplitParticipant): string {
  return [
    p.agentId ?? "",
    (p.displayName || "").trim().toLowerCase(),
    p.role,
    p.customRoleLabel ?? "",
  ].join("|");
}

export function splitsEqual(
  a: SplitParticipant[] | null | undefined,
  b: SplitParticipant[] | null | undefined
): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  const sa = [...aa].sort((x, y) => pKey(x).localeCompare(pKey(y)));
  const sb = [...bb].sort((x, y) => pKey(x).localeCompare(pKey(y)));
  return sa.every(
    (x, i) =>
      pKey(x) === pKey(sb[i]) &&
      Math.abs((x.splitPercent || 0) - (sb[i].splitPercent || 0)) < 0.0001
  );
}

type SplitDiffRow = {
  key: string;
  label: string;
  role: string;
  prevPct: number | null;
  nextPct: number | null;
  change: "added" | "removed" | "changed" | "unchanged";
};

export function diffSplits(
  prev: SplitParticipant[] | null | undefined,
  next: SplitParticipant[] | null | undefined
): SplitDiffRow[] {
  const map = new Map<string, SplitDiffRow>();
  for (const p of prev ?? []) {
    const k = pKey(p);
    map.set(k, {
      key: k,
      label: p.displayName || "—",
      role: p.role === "custom" ? p.customRoleLabel || "Custom" : ROLE_LABELS[p.role],
      prevPct: p.splitPercent,
      nextPct: null,
      change: "removed",
    });
  }
  for (const p of next ?? []) {
    const k = pKey(p);
    const existing = map.get(k);
    if (existing) {
      existing.nextPct = p.splitPercent;
      existing.change =
        Math.abs((existing.prevPct ?? 0) - p.splitPercent) < 0.0001
          ? "unchanged"
          : "changed";
    } else {
      map.set(k, {
        key: k,
        label: p.displayName || "—",
        role: p.role === "custom" ? p.customRoleLabel || "Custom" : ROLE_LABELS[p.role],
        prevPct: null,
        nextPct: p.splitPercent,
        change: "added",
      });
    }
  }
  return [...map.values()];
}

/* ---------- Top-level Splits admin panel ---------- */

export function SplitsPanel() {
  const s = useStore();
  return (
    <div className="space-y-6">
      <SplitTemplatesEditor />
      <SplitRulesEditor />
      <Card className="p-6 shadow-card">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2 className="text-lg font-semibold">Invoices with split commissions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              All invoices that currently have a split applied. Open the invoice to edit
              participants.
            </p>
          </div>
        </div>
        <SplitInvoicesList />
        <p className="text-xs text-muted-foreground mt-4">
          {s.invoices.filter((i) => i.split && i.split.participants.length > 0).length} of{" "}
          {s.invoices.length} invoices have a split.
        </p>
      </Card>
    </div>
  );
}

function SplitInvoicesList() {
  const s = useStore();
  const rows = s.invoices.filter((i) => i.split && i.split.participants.length > 0);
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
        No invoices with a split yet.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2">Invoice</th>
            <th>Customer</th>
            <th>Participants</th>
            <th>Total %</th>
            <th>Rule applied</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const split = inv.split!;
            const total = totalSplitPercent(split.participants);
            const valid = isSplitValid(split.participants);
            const rule = s.splitRules.find((r) => r.id === split.appliedRuleId);
            const tpl = s.splitTemplates.find((t) => t.id === split.appliedTemplateId);
            return (
              <tr key={inv.id} className="border-t border-border/60">
                <td className="py-2 font-mono text-xs">{inv.number}</td>
                <td>{inv.customerName}</td>
                <td className="text-xs">
                  {split.participants
                    .map((p) => `${p.displayName || "—"} (${roleLabel(p.role, p.customRoleLabel)})`)
                    .join(", ")}
                </td>
                <td className={valid ? "text-emerald-500" : "text-destructive"}>
                  {(total * 100).toFixed(1)}%
                </td>
                <td className="text-xs">
                  {rule ? `Rule: ${rule.name}` : tpl ? `Tpl: ${tpl.name}` : "Manual"}
                </td>
                <td>
                  {split.approvedAt ? (
                    <span className="text-xs text-emerald-500">Approved</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Templates editor ---------- */

function SplitTemplatesEditor() {
  const s = useStore();
  const [draftName, setDraftName] = useState("");

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Split templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable split presets such as 50/50, 60/40, 70/30 closer/setter, or custom.
            Splits must always sum to 100%.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="New template name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-56"
          />
          <Button
            size="sm"
            onClick={() => {
              if (!draftName.trim()) return toast.error("Template name required");
              s.addSplitTemplate({
                name: draftName.trim(),
                description: "",
                positions: [
                  { role: "sales_rep", splitPercent: 1 },
                ],
              });
              setDraftName("");
              toast.success("Template added");
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {s.splitTemplates.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} />
        ))}
      </div>
    </Card>
  );
}

function TemplateCard({ tpl }: { tpl: SplitTemplate }) {
  const s = useStore();
  const total = tpl.positions.reduce((a, p) => a + p.splitPercent, 0);
  const valid = Math.abs(total - 1) < 0.0001 && tpl.positions.length > 0;

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={tpl.name}
          onChange={(e) => s.updateSplitTemplate(tpl.id, { name: e.target.value })}
          className="font-semibold"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => s.removeSplitTemplate(tpl.id)}
          title="Remove template"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <Textarea
        placeholder="Description (optional)"
        value={tpl.description}
        onChange={(e) => s.updateSplitTemplate(tpl.id, { description: e.target.value })}
        rows={2}
      />
      <div className="space-y-2">
        {tpl.positions.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Role</Label>
              <Select
                value={p.role}
                onValueChange={(v: SplitParticipantRole) => {
                  const next = [...tpl.positions];
                  next[i] = { ...next[i], role: v };
                  s.updateSplitTemplate(tpl.id, { positions: next });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Percent</Label>
              <Input
                type="number"
                step="0.1"
                value={(p.splitPercent * 100).toFixed(2)}
                onChange={(e) => {
                  const next = [...tpl.positions];
                  next[i] = { ...next[i], splitPercent: Number(e.target.value) / 100 };
                  s.updateSplitTemplate(tpl.id, { positions: next });
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const next = tpl.positions.filter((_, j) => j !== i);
                s.updateSplitTemplate(tpl.id, { positions: next });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            s.updateSplitTemplate(tpl.id, {
              positions: [...tpl.positions, { role: "partner", splitPercent: 0 }],
            })
          }
        >
          <Plus className="w-4 h-4 mr-1" />
          Add position
        </Button>
        <span
          className={`text-xs font-mono ${valid ? "text-emerald-500" : "text-destructive"}`}
        >
          Total {(total * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ---------- Rules editor ---------- */

function SplitRulesEditor() {
  const s = useStore();
  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Automatic split rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            When you click <span className="font-semibold">Apply rules</span> on an invoice,
            the highest-priority active rule whose criteria all match will apply its template.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            s.addSplitRule({
              name: "New rule",
              priority: 10,
              active: true,
              criteria: {},
              templateId: s.splitTemplates[0]?.id ?? "",
            })
          }
        >
          <Plus className="w-4 h-4 mr-1" />
          Add rule
        </Button>
      </div>

      {s.splitRules.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
          No rules yet. Add one to auto-apply splits based on finance company, deal type, rep
          role and more.
        </p>
      ) : (
        <div className="space-y-3">
          {[...s.splitRules]
            .sort((a, b) => b.priority - a.priority)
            .map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
        </div>
      )}
    </Card>
  );
}

function RuleRow({ rule }: { rule: SplitRule }) {
  const s = useStore();
  const c = rule.criteria;
  const update = (patch: Partial<SplitRule>) => s.updateSplitRule(rule.id, patch);
  const updateCriteria = (patch: Partial<SplitRule["criteria"]>) =>
    update({ criteria: { ...c, ...patch } });

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Rule name</Label>
          <Input value={rule.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div className="w-24">
          <Label className="text-xs">Priority</Label>
          <Input
            type="number"
            value={rule.priority}
            onChange={(e) => update({ priority: Number(e.target.value) })}
          />
        </div>
        <div className="w-56">
          <Label className="text-xs">Template</Label>
          <Select value={rule.templateId} onValueChange={(v) => update({ templateId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a template…" />
            </SelectTrigger>
            <SelectContent>
              {s.splitTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={rule.active} onCheckedChange={(v) => update({ active: v })} />
          <span className="text-xs">Active</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => s.removeSplitRule(rule.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Finance company</Label>
          <Select
            value={c.financeCompanyId ?? "any"}
            onValueChange={(v) => updateCriteria({ financeCompanyId: v === "any" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">— Any —</SelectItem>
              {s.financeCompanies.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sales rep level</Label>
          <Input
            placeholder="e.g. Junior Rep"
            value={c.repLevel ?? ""}
            onChange={(e) =>
              updateCriteria({ repLevel: e.target.value || undefined })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Commission level (on invoice)</Label>
          <Input
            placeholder="e.g. Manager"
            value={c.commissionLevel ?? ""}
            onChange={(e) =>
              updateCriteria({ commissionLevel: e.target.value || undefined })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Manager / upline</Label>
          <Select
            value={c.managerAgentId ?? "any"}
            onValueChange={(v) =>
              updateCriteria({ managerAgentId: v === "any" ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">— Any —</SelectItem>
              {s.agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Deal type</Label>
          <Select
            value={c.dealType ?? "any"}
            onValueChange={(v) =>
              updateCriteria({ dealType: v === "any" ? undefined : (v as SaleType) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">— Any —</SelectItem>
              <SelectItem value="credit_card">Credit card</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="wire">Wire</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/* ---------- Per-invoice editor dialog ---------- */

export function SplitEditorDialog({
  invoiceId,
  open,
  onClose,
}: {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const s = useStore();
  const inv = invoiceId ? s.invoices.find((i) => i.id === invoiceId) ?? null : null;

  const initial = useMemo<SplitParticipant[]>(() => {
    if (!inv) return [];
    if (inv.split && inv.split.participants.length > 0) return inv.split.participants;
    const ag = s.agents.find((a) => a.id === inv.agentId);
    return [
      {
        id: cryptoId(),
        agentId: inv.agentId,
        displayName: ag?.name ?? "Primary rep",
        role: "sales_rep",
        splitPercent: 1,
        commissionLevel: ag?.level,
      },
    ];
  }, [inv, s.agents]);

  const [participants, setParticipants] = useState<SplitParticipant[]>(initial);
  const [regenPrompt, setRegenPrompt] = useState(false);

  // Reset when opening a different invoice
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  if (invoiceId !== lastInvoice) {
    setLastInvoice(invoiceId);
    setParticipants(initial);
  }

  if (!inv) return null;
  const calc = calcInvoice(inv, s.financeCompanies);
  const personalRate =
    inv.commissionPercentOverride ??
    s.agents.find((a) => a.id === inv.agentId)?.commissionPercent ??
    0;
  const pool = Math.max(0, calc.commissionableBase) * personalRate;
  const total = totalSplitPercent(participants);
  const valid = isSplitValid(participants);
  const split = inv.split ?? null;

  const updateP = (idx: number, patch: Partial<SplitParticipant>) => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const wasApproved = !!split?.approvedAt;
  const previousParticipants = split?.participants ?? null;
  const splitChanged = !splitsEqual(previousParticipants, participants);

  const currentUser = s.role === "rep"
    ? s.agents.find((a) => a.id === s.activeAgentId)?.name ?? "Rep"
    : s.currentUserName || "Admin";

  const regeneratePdf = (reason: "split_changed" | "manual_regeneration" | "approval") => {
    const fresh = useStore.getState().invoices.find((i) => i.id === inv.id);
    if (!fresh) return;
    const calc = calcInvoice(fresh, s.financeCompanies);
    const ag = s.agents.find((a) => a.id === fresh.agentId);
    const doc = buildSaleInvoicePDF(calc, s.company, ag?.name ?? "—");
    const fileName = `${fresh.number}_${(fresh.customerName || "invoice").replace(/\s+/g, "_")}_v${(fresh.pdfHistory?.length ?? 0) + 1}.pdf`;
    doc.save(fileName);
    s.appendInvoicePdfRecord(fresh.id, {
      at: new Date().toISOString(),
      by: currentUser,
      reason,
      fileName,
      splitSnapshot: fresh.split?.participants ?? null,
      brandingSnapshot: makeBrandingSnapshot(s.company),
    });
    toast.success(`PDF regenerated and stored in invoice history (${fileName}).`);
  };

  const downloadHistoricalPdf = (record: typeof inv.pdfHistory extends (infer T)[] | undefined ? T : never) => {
    // Reconstruct an invoice variant with the historical split + branding snapshots
    const historicalInvoice = {
      ...inv,
      brandingSnapshot: record.brandingSnapshot,
      split: record.splitSnapshot
        ? {
            participants: record.splitSnapshot,
            appliedRuleId: null,
            appliedTemplateId: null,
            approvedAt: record.at,
            approvedBy: record.by,
            history: [],
          }
        : null,
    };
    const c = calcInvoice(historicalInvoice, s.financeCompanies);
    const ag = s.agents.find((a) => a.id === inv.agentId);
    const doc = buildSaleInvoicePDF(c, s.company, ag?.name ?? "—");
    doc.save(record.fileName);
    toast.success(`Downloaded ${record.fileName}`);
  };

  const save = (approve: boolean) => {
    if (!valid) {
      toast.error(`Splits must total 100% (currently ${(total * 100).toFixed(2)}%).`);
      return;
    }
    const next: InvoiceSplit = {
      participants,
      appliedRuleId: split?.appliedRuleId ?? null,
      appliedTemplateId: split?.appliedTemplateId ?? null,
      approvedAt: approve ? new Date().toISOString() : split?.approvedAt ?? null,
      approvedBy: approve ? currentUser : split?.approvedBy ?? null,
      history: split?.history ?? [],
    };
    s.setInvoiceSplit(inv.id, next, {
      by: currentUser,
      action: approve ? "approved" : split ? "updated" : "created",
      message: approve
        ? "Approved split."
        : split
          ? "Updated participants."
          : "Created split.",
    });

    // Only prompt to regenerate when the approved split actually changed.
    if (wasApproved && !approve && splitChanged) {
      setRegenPrompt(true);
      return;
    }
    toast.success(
      approve
        ? "Split approved. PDF will regenerate next time."
        : "Split saved."
    );
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Split commission · Invoice {inv.number}</DialogTitle>
          <DialogDescription>
            Distribute the main commission pool across participants. Splits must total 100%
            before the invoice can be approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <Stat label="Commission base" value={fmtMoney(calc.commissionableBase, s.company.currency)} />
          <Stat label="Personal rate" value={`${(personalRate * 100).toFixed(2)}%`} />
          <Stat label="Pool to split" value={fmtMoney(pool, s.company.currency)} accent />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick apply:</span>
          {s.splitTemplates.map((tpl) => (
            <Button
              key={tpl.id}
              variant="outline"
              size="sm"
              onClick={() => {
                const ag = s.agents.find((a) => a.id === inv.agentId);
                setParticipants(
                  tpl.positions.map((pos, i) => ({
                    id: cryptoId(),
                    agentId: i === 0 ? inv.agentId : null,
                    displayName: i === 0 ? ag?.name ?? "Primary rep" : "",
                    role: pos.role,
                    customRoleLabel: pos.customRoleLabel,
                    splitPercent: pos.splitPercent,
                    commissionLevel: i === 0 ? ag?.level : undefined,
                  }))
                );
              }}
            >
              {tpl.name}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const id = s.applySplitRules(inv.id, "admin");
              if (id) {
                const updated = useStore.getState().invoices.find((x) => x.id === inv.id);
                setParticipants(updated?.split?.participants ?? participants);
                toast.success("Matching rule applied.");
              } else {
                toast.info("No matching rule for this invoice.");
              }
            }}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Apply rules
          </Button>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {participants.map((p, i) => (
            <div
              key={p.id}
              className="grid grid-cols-12 gap-2 items-end border border-border rounded-md p-3"
            >
              <div className="col-span-3">
                <Label className="text-xs">User</Label>
                <Select
                  value={p.agentId ?? "external"}
                  onValueChange={(v) => {
                    if (v === "external") {
                      updateP(i, { agentId: null });
                    } else {
                      const ag = s.agents.find((a) => a.id === v);
                      updateP(i, {
                        agentId: v,
                        displayName: ag?.name ?? p.displayName,
                        commissionLevel: ag?.level,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">— External / non-rep —</SelectItem>
                    {s.agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Display name</Label>
                <Input
                  value={p.displayName}
                  onChange={(e) => updateP(i, { displayName: e.target.value })}
                  placeholder="Required for external"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Role</Label>
                <Select
                  value={p.role}
                  onValueChange={(v: SplitParticipantRole) => updateP(i, { role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {p.role === "custom" && (
                  <Input
                    className="mt-1"
                    placeholder="Custom role label"
                    value={p.customRoleLabel ?? ""}
                    onChange={(e) =>
                      updateP(i, { customRoleLabel: e.target.value })
                    }
                  />
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Split %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={(p.splitPercent * 100).toFixed(2)}
                  onChange={(e) =>
                    updateP(i, { splitPercent: Number(e.target.value) / 100 })
                  }
                />
              </div>
              <div className="col-span-1 text-right text-xs font-mono">
                {fmtMoney(pool * p.splitPercent, s.company.currency)}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setParticipants((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setParticipants((prev) => [
                ...prev,
                {
                  id: cryptoId(),
                  agentId: null,
                  displayName: "",
                  role: "partner",
                  splitPercent: 0,
                },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Add participant
          </Button>
          <div
            className={`font-mono ${valid ? "text-emerald-500" : "text-destructive"}`}
          >
            Total {(total * 100).toFixed(2)}%{" "}
            {valid ? "✓" : "(must equal 100%)"}
          </div>
        </div>

        {split?.history && split.history.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
              <History className="w-3.5 h-3.5" /> Audit log
            </div>
            <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {split.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i}>
                    <span className="font-mono text-muted-foreground">
                      {h.at.slice(0, 16).replace("T", " ")}
                    </span>{" "}
                    · <span className="font-semibold">{h.action}</span> by {h.by} —{" "}
                    {h.message}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {inv.pdfHistory && inv.pdfHistory.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
              <FileText className="w-3.5 h-3.5" /> PDF history ({inv.pdfHistory.length})
            </div>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {inv.pdfHistory
                .slice()
                .reverse()
                .map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {r.at.slice(0, 16).replace("T", " ")}
                    </span>
                    <span>·</span>
                    <span className="font-semibold">{r.reason.replace(/_/g, " ")}</span>
                    <span>by {r.by}</span>
                    <span className="truncate flex-1">— {r.fileName}</span>
                    {r.splitSnapshot && r.splitSnapshot.length > 0 && (
                      <span className="text-muted-foreground">
                        ({r.splitSnapshot.length}p)
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => downloadHistoricalPdf(r)}
                      title="Download this version"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {split && (
            <Button
              variant="outline"
              onClick={() => {
                s.setInvoiceSplit(inv.id, null, {
                  by: currentUser,
                  action: "cleared",
                  message: "Split cleared.",
                });
                toast.success("Split removed.");
                onClose();
              }}
            >
              Clear split
            </Button>
          )}
          {wasApproved && (
            <Button
              variant="outline"
              onClick={() => regeneratePdf("manual_regeneration")}
            >
              <FileText className="w-4 h-4 mr-1" />
              Regenerate PDF
            </Button>
          )}
          <Button variant="secondary" onClick={() => save(false)} disabled={!valid}>
            Save
          </Button>
          <Button onClick={() => save(true)} disabled={!valid}>
            <ShieldCheck className="w-4 h-4 mr-1" />
            Save & approve
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={regenPrompt} onOpenChange={setRegenPrompt}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate invoice PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              This split was already approved and the participants/percentages changed.
              Review the differences below, then choose to regenerate a new versioned PDF
              or skip.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="border rounded-md overflow-hidden text-xs">
            <div className="grid grid-cols-12 bg-muted/50 px-2 py-1 font-semibold">
              <div className="col-span-4">Participant</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2 text-right">Previous</div>
              <div className="col-span-2 text-right">New</div>
              <div className="col-span-2 text-right">Change</div>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y">
              {diffSplits(previousParticipants, participants).map((row) => (
                <div
                  key={row.key}
                  className={`grid grid-cols-12 px-2 py-1 ${
                    row.change === "added"
                      ? "bg-emerald-500/10"
                      : row.change === "removed"
                        ? "bg-destructive/10"
                        : row.change === "changed"
                          ? "bg-amber-500/10"
                          : ""
                  }`}
                >
                  <div className="col-span-4 truncate">{row.label}</div>
                  <div className="col-span-2 truncate">{row.role}</div>
                  <div className="col-span-2 text-right font-mono">
                    {row.prevPct === null ? "—" : `${(row.prevPct * 100).toFixed(2)}%`}
                  </div>
                  <div className="col-span-2 text-right font-mono">
                    {row.nextPct === null ? "—" : `${(row.nextPct * 100).toFixed(2)}%`}
                  </div>
                  <div className="col-span-2 text-right uppercase tracking-wider text-[10px]">
                    {row.change}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRegenPrompt(false);
                toast.info("Split saved. PDF was NOT regenerated — it is now out of sync.");
                onClose();
              }}
            >
              Skip
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                regeneratePdf("split_changed");
                setRegenPrompt(false);
                onClose();
              }}
            >
              Regenerate now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`font-mono font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}
