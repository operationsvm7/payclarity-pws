# PayClarity Demo-Ready Plan

This is a large multi-area change. I'll group it into 6 focused work packages and ship them in order so each can be verified before moving on.

## 1. Demo data visible by default
- On first load (no persisted state), auto-seed `loadDemoData()` so dashboard, invoices, top sellers, wallet, ledger, payouts, and reports are populated.
- Expand `loadDemoData` in `src/lib/commission-store.ts` to include:
  - Company: "Pasteur Water System Demo" (replace "Your Company Ltd." placeholder; show "Your company branding will appear here." when user wipes branding).
  - 3+ sales reps with sponsor hierarchy (for overrides).
  - 3+ recent invoices with varied dates, splits, advances, deductions, statuses (paid / pending / submitted).
  - Wallet entries, ledger transactions, scheduled payouts.
- "Load Demo Data" button re-seeds (with confirm) and shows the toast we already have.

## 2. Language consistency (EN default, full ES toggle)
- Audit `CommissionTool.tsx`, `CompetitivePanels.tsx` (wizard), `NewPanels.tsx`, `ExtraPanels.tsx`, `SplitsPanel.tsx`, `NotificationsBell.tsx`, `InvoiceTimelineDialog.tsx` for hardcoded strings.
- Move every user-facing label/button/menu/wizard step into `i18n.ts` with `es`/`en` entries.
- Default language = `en` for new users (already the case if we set it). No mixed strings unless user actively switched.

## 3. Setup Wizard rebuild + persistence + workflow wiring
- 8 steps exactly: Company Profile → Branding & Invoice Template → Sales Team → Compensation Plan → Finance Companies → Splits & Overrides → Advances / Pending Balance Rules → Generate Test Invoice.
- Each step writes through to the real store slices (no shadow state), so changes apply to the live workflow.
- Persist `wizard.currentStep`, `wizard.completedSteps`, `wizard.completed` in the store (already zustand+localStorage) so refresh resumes where you left off.
- Final step "Generate Test Invoice" creates a real invoice from current branding + plan + splits + deductions and opens the PDF preview.

## 4. PDF template selection
- In Settings → Branding, add a template picker (templates already exist in `src/lib/templates.ts`) plus PDF options (logo, color, footer note).
- Persist `selectedTemplateId` + `pdfSettings` in the store.
- `generate-invoices.ts` reads the selected template + settings for both "Generate Test PDF" and the final invoice PDF.
- Quick Action "Generate Test PDF" uses demo invoice + chosen template/branding.

## 5. Live Commission Calculation Preview on Create Invoice
- New `<CommissionPreview>` panel inside the Create Invoice flow, recomputing on every field change via `calcInvoice` + `calcPayouts`.
- Shows: sales amount, approval, charges total, credits total, discount, grand total, product cost, **net profit**, commissionable base, personal commission, **splits breakdown**, **overrides breakdown**, **advance applied**, special deductions, net payable, tax reserve, final payable.
- Updates before PDF generation so the user sees the numbers first.

## 6. Polish
- Replace any remaining "Your Company Ltd." literals with branded company name or the placeholder string.
- Dashboard "Top sellers" and "Recent invoices" cards show seeded data immediately.
- Verify build passes; sanity-check preview.

## Out of scope (this turn)
- Backend persistence (everything stays in the existing localStorage zustand store).
- Real notifications cross-tab work beyond what's already shipped.

## Order of execution
1, 2, 3, 4, 5, 6 in sequence — each can be verified independently. If you want me to drop or defer any package (e.g., skip the wizard rebuild and keep the current one), say which.
