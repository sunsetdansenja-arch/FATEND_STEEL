import { Project } from '../types';

/**
 * Format number to Indonesian Rupiah with dot thousand separator
 * Example: 1500000 -> "Rp 1.500.000"
 */
export function formatIDR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rp 0';
  }
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

/**
 * Clean string to number
 */
export function parseIDR(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format standard readable Indonesian date
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format date time
 */
export function formatDateTime(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Generate unique id
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Calculate comprehensive financials for a project
 */
export function calculateProjectFinance(project: Project) {
  const totalPaidIn = (project.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const materialsCost = (project.usedMaterials || []).reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const wagesCost = (project.wages || []).reduce((sum, w) => sum + (w.totalWage || 0), 0);
  const wagesPaid = (project.wages || []).reduce((sum, w) => sum + (w.paidAmount || 0), 0);
  const otherExpensesCost = (project.otherExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalExpense = materialsCost + wagesCost + otherExpensesCost;
  const estimatedProfit = (project.contractValue || 0) - totalExpense;
  const remainingBill = Math.max(0, (project.contractValue || 0) - totalPaidIn);
  const unpaidWages = Math.max(0, wagesCost - wagesPaid);
  const profitMargin = project.contractValue > 0 ? (estimatedProfit / project.contractValue) * 100 : 0;

  return {
    contractValue: project.contractValue || 0,
    totalPaidIn,
    materialsCost,
    wagesCost,
    wagesPaid,
    unpaidWages,
    otherExpensesCost,
    totalExpense,
    estimatedProfit,
    profitMargin,
    remainingBill,
  };
}
