import {
  Enrollment,
  InvoiceSchedule,
  PaymentReminder,
  Program,
  ReminderLevel,
  StudentAdmission,
} from '../types';

/**
 * Service de recouvrement : balance âgée des créances et préparation des relances.
 * Tous les montants restent des entiers FCFA.
 */

export type AgingBucketId = 'non_echu' | 'j0_30' | 'j31_60' | 'j61_90' | 'j90_plus';

export const AGING_BUCKETS: { id: AgingBucketId; label: string; short: string }[] = [
  { id: 'non_echu', label: 'Non échu', short: 'Non échu' },
  { id: 'j0_30', label: '1 à 30 jours de retard', short: '1–30 j' },
  { id: 'j31_60', label: '31 à 60 jours de retard', short: '31–60 j' },
  { id: 'j61_90', label: '61 à 90 jours de retard', short: '61–90 j' },
  { id: 'j90_plus', label: 'Plus de 90 jours de retard', short: '> 90 j' },
];

const DAY_MS = 86_400_000;

export function daysOverdue(dueDate: string, today: string): number {
  const diff = Math.floor((Date.parse(today) - Date.parse(dueDate)) / DAY_MS);
  return diff > 0 ? diff : 0;
}

export function bucketFor(days: number): AgingBucketId {
  if (days <= 0) return 'non_echu';
  if (days <= 30) return 'j0_30';
  if (days <= 60) return 'j31_60';
  if (days <= 90) return 'j61_90';
  return 'j90_plus';
}

export type RiskLevel = 'faible' | 'moyen' | 'eleve' | 'critique';

export interface DebtorSummary {
  student: StudentAdmission;
  program?: Program;
  unpaidInvoices: InvoiceSchedule[];
  totalDue: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  oldestDueDate: string;
  buckets: Record<AgingBucketId, number>;
  lastReminder?: PaymentReminder;
  reminderCount: number;
  risk: RiskLevel;
  suggestedLevel: ReminderLevel;
}

function riskFor(maxDays: number, overdueAmount: number): RiskLevel {
  if (maxDays > 90 || overdueAmount >= 500_000) return 'critique';
  if (maxDays > 60) return 'eleve';
  if (maxDays > 0) return 'moyen';
  return 'faible';
}

/**
 * Escalade progressive : on ne met jamais en demeure une famille qui n'a reçu
 * aucune relance préalable (bonne pratique de recouvrement amiable).
 */
function suggestedLevelFor(maxDays: number, reminderCount: number): ReminderLevel {
  if (reminderCount === 0) return maxDays > 90 ? 'ferme' : 'courtoise';
  if (reminderCount >= 2 && maxDays > 30) return 'mise_en_demeure';
  return 'ferme';
}

export function emptyBuckets(): Record<AgingBucketId, number> {
  return { non_echu: 0, j0_30: 0, j31_60: 0, j61_90: 0, j90_plus: 0 };
}

export function buildDebtors(params: {
  students: StudentAdmission[];
  invoices: InvoiceSchedule[];
  enrollments: Enrollment[];
  programs: Program[];
  reminders: PaymentReminder[];
  today: string;
}): DebtorSummary[] {
  const { students, invoices, enrollments, programs, reminders, today } = params;
  const byStudent = new Map<string, InvoiceSchedule[]>();
  for (const inv of invoices) {
    if (inv.balanceDue <= 0) continue;
    const list = byStudent.get(inv.studentId) || [];
    list.push(inv);
    byStudent.set(inv.studentId, list);
  }

  const result: DebtorSummary[] = [];
  for (const [studentId, list] of byStudent) {
    const student = students.find((s) => s.id === studentId);
    if (!student) continue;
    const sorted = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const buckets = emptyBuckets();
    let overdueAmount = 0;
    let maxDays = 0;
    for (const inv of sorted) {
      const d = daysOverdue(inv.dueDate, today);
      buckets[bucketFor(d)] += inv.balanceDue;
      if (d > 0) overdueAmount += inv.balanceDue;
      if (d > maxDays) maxDays = d;
    }
    const studentReminders = reminders
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const enrollment = enrollments.find((e) => e.id === sorted[0].enrollmentId);
    result.push({
      student,
      program: programs.find((p) => p.id === enrollment?.programId),
      unpaidInvoices: sorted,
      totalDue: sorted.reduce((sum, i) => sum + i.balanceDue, 0),
      overdueAmount,
      maxDaysOverdue: maxDays,
      oldestDueDate: sorted[0].dueDate,
      buckets,
      lastReminder: studentReminders[0],
      reminderCount: studentReminders.length,
      risk: riskFor(maxDays, overdueAmount),
      suggestedLevel: suggestedLevelFor(maxDays, studentReminders.length),
    });
  }

  return result.sort((a, b) => b.overdueAmount - a.overdueAmount || b.totalDue - a.totalDue);
}

/** Formatage FCFA avec espaces simples (lisible dans un SMS / WhatsApp / PDF). */
export function plainFCFA(amount: number): string {
  return `${Math.round(amount || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

export function formatDateFR(iso: string): string {
  const [y, m, d] = iso.substring(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function buildReminderMessage(params: {
  debtor: DebtorSummary;
  level: ReminderLevel;
  establishmentName: string;
  establishmentPhone: string;
  addressee: 'etudiant' | 'tuteur';
}): string {
  const { debtor, level, establishmentName, establishmentPhone, addressee } = params;
  const s = debtor.student;
  const fullName = `${s.firstName} ${s.lastName}`;
  const greeting =
    addressee === 'tuteur' && s.parentName ? `Bonjour ${s.parentName},` : `Bonjour ${s.firstName},`;
  const subject =
    addressee === 'tuteur' ? `la scolarité de ${fullName} (matricule ${s.matricule})` : `votre scolarité (matricule ${s.matricule})`;
  const lines = debtor.unpaidInvoices
    .slice(0, 5)
    .map((i) => `• ${i.title} – échéance ${formatDateFR(i.dueDate)} : ${plainFCFA(i.balanceDue)}`)
    .join('\n');
  const more = debtor.unpaidInvoices.length > 5 ? `\n• … et ${debtor.unpaidInvoices.length - 5} autre(s) échéance(s)` : '';
  const total = plainFCFA(debtor.totalDue);
  const pay = 'Règlement possible par Wave, Orange Money, virement ou à la caisse.';

  if (level === 'courtoise') {
    return `${greeting}\n\nSauf erreur de notre part, le solde de ${subject} présente un reste à payer de ${total} :\n${lines}${more}\n\n${pay}\nSi le règlement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nService Comptabilité – ${establishmentName}\n${establishmentPhone}`;
  }
  if (level === 'ferme') {
    return `${greeting}\n\nMalgré notre précédent rappel, nous constatons que ${subject} présente toujours un impayé de ${total}, dont ${plainFCFA(debtor.overdueAmount)} échus depuis ${debtor.maxDaysOverdue} jours :\n${lines}${more}\n\nNous vous prions de régulariser cette situation sous 7 jours. ${pay}\nPour convenir d un échéancier, contactez-nous au ${establishmentPhone}.\n\nService Comptabilité – ${establishmentName}`;
  }
  return `${greeting}\n\nMISE EN DEMEURE\n\nEn l absence de règlement malgré nos relances, nous vous mettons en demeure de régler sous 8 jours la somme de ${total} due au titre de ${subject} :\n${lines}${more}\n\nÀ défaut, l établissement se réserve le droit de suspendre l accès aux cours, aux examens et la délivrance des relevés de notes et attestations, conformément au règlement intérieur.\n\n${pay}\nLa Direction – ${establishmentName}\n${establishmentPhone}`;
}

/** Normalise un numéro sénégalais pour wa.me / sms: (ex. "+221 77 123 45 67" → "221771234567"). */
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 9 && /^[37]/.test(digits)) return `221${digits}`;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function smsLink(phone: string, message: string): string {
  return `sms:+${normalizePhone(phone)}?body=${encodeURIComponent(message)}`;
}

export function mailtoLink(email: string, subject: string, message: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
