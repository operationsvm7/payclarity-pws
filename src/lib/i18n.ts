import { useStore } from "./commission-store";

export type Lang = "es" | "en";

type Dict = Record<string, { es: string; en: string }>;

const D: Dict = {
  app_title: { es: "PayClarity", en: "PayClarity" },
  app_subtitle: {
    es: "Comisiones claras. Pagos simples. Control total.",
    en: "Clear commissions. Simple payouts. Total control.",
  },

  // Navigation groups
  nav_dashboard: { es: "Dashboard", en: "Dashboard" },
  nav_invoices: { es: "Invoices", en: "Invoices" },
  nav_team: { es: "Equipo", en: "Team" },
  nav_compensation: { es: "Compensación", en: "Compensation" },
  nav_payouts: { es: "Pagos", en: "Payouts" },
  nav_reports: { es: "Reportes", en: "Reports" },
  nav_settings: { es: "Ajustes", en: "Settings" },

  // Quick actions
  qa_create_invoice: { es: "+ Crear nuevo invoice", en: "+ Create New Invoice" },
  qa_add_rep: { es: "Agregar vendedor", en: "Add Sales Rep" },
  qa_setup_plan: { es: "Configurar plan", en: "Setup Commission Plan" },
  qa_test_pdf: { es: "Generar PDF de prueba", en: "Generate Test PDF" },
  qa_load_demo: { es: "Cargar datos demo", en: "Load Demo Data" },
  qa_quick_actions: { es: "Acciones rápidas", en: "Quick actions" },
  demo_loaded: { es: "Datos de demostración cargados", en: "Demo data loaded" },
  role_admin: { es: "Admin", en: "Admin" },
  role_rep: { es: "Vendedor", en: "Sales rep" },
  role_accountant: { es: "Contador", en: "Accountant" },
  select_rep: { es: "Selecciona vendedor", en: "Select rep" },
  stat_salespeople: { es: "Vendedores", en: "Salespeople" },
  stat_sales_total: { es: "Ventas totales", en: "Sales total" },
  stat_payout: { es: "A pagar", en: "Payout" },

  tab_dashboard: { es: "Dashboard", en: "Dashboard" },
  tab_invoices: { es: "Invoices", en: "Invoices" },
  tab_my_invoices: { es: "Mis invoices", en: "My invoices" },
  tab_wallet: { es: "Cartera", en: "Wallet" },
  tab_my_wallet: { es: "Mi cartera", en: "My wallet" },
  tab_simulator: { es: "Simulador", en: "Simulator" },
  tab_calendar: { es: "Calendario", en: "Calendar" },
  tab_my_payouts: { es: "Mis pagos", en: "My payouts" },
  tab_approvals: { es: "Aprobaciones", en: "Approvals" },
  tab_my_requests: { es: "Mis solicitudes", en: "My requests" },
  tab_templates: { es: "Plantillas", en: "Templates" },
  tab_team: { es: "Equipo de ventas", en: "Sales team" },
  tab_finance: { es: "Financieras", en: "Finance Co." },
  tab_plan: { es: "Plan", en: "Plan" },
  tab_company: { es: "Compañía", en: "Company" },
  tab_payouts: { es: "Pagos", en: "Payouts" },
  tab_reports: { es: "Reportes", en: "Reports" },
  tab_year_end: { es: "Cierre 1099", en: "Year-End 1099" },

  no_rep_title: { es: "Ningún vendedor seleccionado", en: "No salesperson selected" },
  no_rep_msg: {
    es: "Un admin debe agregarte al equipo antes de que ingreses como vendedor.",
    en: "An admin must add you to the sales team before you can sign in as a rep.",
  },

  // Dashboard
  dash_overview: { es: "Resumen general", en: "Overview" },
  dash_kpi_sales: { es: "Ventas", en: "Sales" },
  dash_kpi_profit: { es: "Profit", en: "Profit" },
  dash_kpi_commissions: { es: "Comisiones", en: "Commissions" },
  dash_kpi_overrides: { es: "Overrides", en: "Overrides" },
  dash_kpi_pending: { es: "Pendiente", en: "Pending" },
  dash_kpi_paid: { es: "Pagado", en: "Paid" },
  dash_kpi_tax_reserve: { es: "Reserva tax sugerida", en: "Suggested tax reserve" },
  dash_kpi_open_requests: { es: "Solicitudes abiertas", en: "Open requests" },
  dash_top_reps: { es: "Top vendedores", en: "Top reps" },
  dash_recent_invoices: { es: "Invoices recientes", en: "Recent invoices" },
  dash_no_invoices: { es: "Aún no hay invoices.", en: "No invoices yet." },

  // Reports
  reports_title: { es: "Reportes y exportaciones", en: "Reports & exports" },
  reports_desc: {
    es: "Descarga reportes en CSV para tu contador o ERP.",
    en: "Download CSV reports for your accountant or ERP.",
  },
  reports_commissions_by_rep: { es: "Comisiones por vendedor", en: "Commissions by rep" },
  reports_invoices: { es: "Invoices", en: "Invoices" },
  reports_overrides: { es: "Overrides", en: "Overrides" },
  reports_payments: { es: "Pagos realizados", en: "Payments" },
  reports_ledger: { es: "Ledger consolidado", en: "Consolidated ledger" },
  reports_taxes: { es: "Reserva de impuestos", en: "Tax reserve" },
  download_csv: { es: "Descargar CSV", en: "Download CSV" },

  // Year-end 1099
  ye_title: { es: "Centro de Cierre 1099", en: "Year-End 1099 Center" },
  ye_desc: {
    es: "Organiza pagos anuales por contractor, revisa estatus W-9 y exporta para tu contador. No es asesoría fiscal.",
    en: "Organize annual contractor payments, review W-9 status and export for your CPA. Not tax advice.",
  },
  ye_select_year: { es: "Año fiscal", en: "Tax year" },
  ye_contractor: { es: "Contractor", en: "Contractor" },
  ye_w9: { es: "W-9", en: "W-9" },
  ye_total_paid: { es: "Total pagado", en: "Total paid" },
  ye_advances_paid: { es: "Advances pagados", en: "Advances paid" },
  ye_advance_deductions: { es: "Deduc. advances", en: "Advance deductions" },
  ye_pending: { es: "Pendiente", en: "Pending" },
  ye_reportable: { es: "Reportable", en: "Reportable" },
  ye_status: { es: "Estado", en: "Status" },
  ye_warning_threshold: {
    es: "Atención: contractor sobre el umbral de $600 sin W-9 vigente.",
    en: "Warning: contractor over $600 threshold without a valid W-9.",
  },
  ye_export_csv: { es: "Exportar CSV anual", en: "Export annual CSV" },
  ye_summary_pdf: { es: "Resumen PDF", en: "Summary PDF" },
  ye_not_tax_advice: {
    es: "Esta información no constituye asesoría fiscal. Consulta a tu CPA.",
    en: "This information is not tax advice. Consult your CPA.",
  },

  // Agent extras
  agent_w9_status: { es: "Estatus W-9", en: "W-9 status" },
  agent_w9_missing: { es: "Falta", en: "Missing" },
  agent_w9_pending: { es: "Pendiente", en: "Pending" },
  agent_w9_valid: { es: "Vigente", en: "Valid" },
  agent_state: { es: "Estado", en: "State" },
  agent_payment_method: { es: "Método de pago", en: "Payment method" },
  agent_tax_reserve_percent: { es: "% Reserva impuestos", en: "Tax reserve %" },

  language: { es: "Idioma", en: "Language" },
  spanish: { es: "Español", en: "Spanish" },
  english: { es: "Inglés", en: "English" },

  // Setup wizard
  wiz_title: { es: "Asistente de configuración", en: "Setup wizard" },
  wiz_step: { es: "Paso", en: "Step" },
  wiz_of: { es: "de", en: "of" },
  wiz_next: { es: "Siguiente", en: "Next" },
  wiz_back: { es: "Atrás", en: "Back" },
  wiz_cancel: { es: "Cancelar", en: "Cancel" },
  wiz_finish: { es: "Finalizar", en: "Finish" },
  wiz_resume: { es: "Reanudar", en: "Resume" },
  wiz_step_company: { es: "Perfil de la compañía", en: "Company Profile" },
  wiz_step_branding: { es: "Marca y plantilla de invoice", en: "Branding & Invoice Template" },
  wiz_step_team: { es: "Equipo de ventas", en: "Sales Team" },
  wiz_step_plan: { es: "Plan de compensación", en: "Compensation Plan" },
  wiz_step_finance: { es: "Financieras", en: "Finance Companies" },
  wiz_step_splits: { es: "Splits y overrides", en: "Splits & Overrides" },
  wiz_step_advances: { es: "Reglas de advances / balance pendiente", en: "Advances / Pending Balance Rules" },
  wiz_step_test: { es: "Generar invoice de prueba", en: "Generate Test Invoice" },
  wiz_template_pick: { es: "Plantilla de PDF", en: "Invoice PDF template" },
  wiz_generate_test: { es: "Generar PDF de prueba", en: "Generate test PDF" },
  wiz_ready: { es: "Listo para usar", en: "Ready to go" },

  // Live preview
  preview_title: { es: "Vista previa de comisión", en: "Commission preview" },
  preview_personal: { es: "Comisión personal", en: "Personal commission" },
  preview_splits: { es: "Splits", en: "Splits" },
  preview_overrides: { es: "Overrides", en: "Overrides" },
  preview_advance: { es: "Advance aplicado", en: "Advance applied" },
  preview_deductions: { es: "Deducciones", en: "Deductions" },
  preview_net: { es: "Neto a pagar", en: "Net payable" },
  preview_reserve: { es: "Reserva impuestos", en: "Tax reserve" },
  preview_final: { es: "Pago final", en: "Final payable" },
};

export function t(key: keyof typeof D, lang: Lang): string {
  const e = D[key];
  return e ? e[lang] : String(key);
}

export function useT() {
  const lang = useStore((s) => s.language);
  return (key: keyof typeof D) => t(key, lang);
}
