import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { formatFCFA } from '../services/currency';

export type AlertSeverity = 'critique' | 'attention' | 'info';

export interface AppAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  view: string; // vue cible au clic
  roles: UserRole[];
}

const DAY_MS = 86_400_000;

/**
 * Centre d'alertes opérationnelles : calcule à partir des données chargées les
 * points qui demandent une action (impayés, caisse, prêts, notes, agréments…),
 * filtrés selon le rôle actif.
 */
export function useAlerts(): AppAlert[] {
  const { invoices, cashSession, bookLoans, grades, attendance, programs, reminders, expenses } = useApp();
  const { activeRole } = useAuth();

  return useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const alerts: AppAlert[] = [];

    // Impayés échus
    const overdue = invoices.filter((i) => i.balanceDue > 0 && i.dueDate < today);
    if (overdue.length > 0) {
      const amount = overdue.reduce((s, i) => s + i.balanceDue, 0);
      const students = new Set(overdue.map((i) => i.studentId)).size;
      const old90 = overdue.filter((i) => Date.parse(today) - Date.parse(i.dueDate) > 90 * DAY_MS).length;
      alerts.push({
        id: 'overdue_invoices',
        severity: old90 > 0 ? 'critique' : 'attention',
        title: `${overdue.length} échéance(s) impayée(s) en retard`,
        description: `${formatFCFA(amount)} dus par ${students} étudiant(s)${old90 > 0 ? `, dont ${old90} à plus de 90 jours` : ''}.`,
        view: 'recovery',
        roles: ['admin', 'dg', 'comptable', 'scolarite', 'caissier'],
      });
    }

    // Promesses de paiement non tenues
    const broken = reminders.filter(
      (r) => r.promiseDate && r.promiseDate < today && invoices.some((i) => i.studentId === r.studentId && i.balanceDue > 0)
    );
    if (broken.length > 0) {
      alerts.push({
        id: 'broken_promises',
        severity: 'attention',
        title: `${broken.length} promesse(s) de paiement dépassée(s)`,
        description: 'Des familles n ont pas réglé à la date promise : relance de niveau supérieur recommandée.',
        view: 'recovery',
        roles: ['admin', 'dg', 'comptable', 'scolarite', 'caissier'],
      });
    }

    // Caisse ouverte depuis plus de 24 h
    if (cashSession?.status === 'ouverte' && cashSession.openedAt) {
      const openedMs = Date.parse(cashSession.openedAt.replace(' ', 'T'));
      const hours = Math.floor((Date.now() - openedMs) / 3_600_000);
      if (Number.isFinite(hours) && hours >= 24) {
        alerts.push({
          id: 'cash_open_long',
          severity: hours >= 72 ? 'critique' : 'attention',
          title: `Caisse ${cashSession.sessionNumber} non clôturée`,
          description: `Ouverte depuis ${Math.floor(hours / 24)} jour(s) : clôture et comptage quotidiens recommandés.`,
          view: 'cash',
          roles: ['admin', 'dg', 'comptable', 'caissier'],
        });
      }
    }

    // Dettes fournisseurs échues
    const vendorDue = expenses.filter(
      (e) => (e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne') && e.dueDate < today
    );
    if (vendorDue.length > 0) {
      alerts.push({
        id: 'vendor_due',
        severity: 'attention',
        title: `${vendorDue.length} facture(s) fournisseur échue(s)`,
        description: `${formatFCFA(vendorDue.reduce((s, e) => s + (e.amount - e.paidAmount), 0))} à décaisser.`,
        view: 'expenses',
        roles: ['admin', 'dg', 'comptable'],
      });
    }

    // Prêts de bibliothèque en retard
    const lateLoans = bookLoans.filter(
      (l) => l.status === 'en_retard' || ((l.status === 'en_cours' || l.status === 'prolonge') && l.dueDate < today)
    );
    if (lateLoans.length > 0) {
      alerts.push({
        id: 'late_loans',
        severity: 'info',
        title: `${lateLoans.length} ouvrage(s) non restitué(s) à temps`,
        description: 'Prêts de bibliothèque dont la date de retour est dépassée.',
        view: 'library',
        roles: ['admin', 'dg', 'scolarite', 'pedagogie'],
      });
    }

    // Notes en brouillon à valider
    const drafts = grades.filter((g) => g.status === 'brouillon');
    if (drafts.length > 0) {
      alerts.push({
        id: 'draft_grades',
        severity: 'info',
        title: `${drafts.length} note(s) en attente de validation`,
        description: 'Validez puis publiez les notes pour les rendre visibles aux étudiants.',
        view: 'grades',
        roles: ['admin', 'dg', 'pedagogie'],
      });
    }

    // Feuilles de présence non signées
    const unsigned = attendance.filter((a) => a.status === 'brouillon' && a.date < today);
    if (unsigned.length > 0) {
      alerts.push({
        id: 'unsigned_attendance',
        severity: 'info',
        title: `${unsigned.length} feuille(s) d émargement non signée(s)`,
        description: 'Séances passées dont la feuille de présence est restée en brouillon.',
        view: 'attendance',
        roles: ['admin', 'dg', 'pedagogie', 'enseignant'],
      });
    }

    // Agréments de filières expirés ou proches de l'expiration
    const soon = new Date(Date.now() + 90 * DAY_MS).toISOString().split('T')[0];
    const expiring = programs.filter((p) => p.accreditationValidUntil && p.accreditationValidUntil <= soon);
    if (expiring.length > 0) {
      const expired = expiring.filter((p) => p.accreditationValidUntil < today);
      alerts.push({
        id: 'accreditation',
        severity: expired.length > 0 ? 'critique' : 'attention',
        title:
          expired.length > 0
            ? `${expired.length} agrément(s) de filière expiré(s)`
            : `${expiring.length} agrément(s) expirent sous 90 jours`,
        description: expiring.map((p) => `${p.code} (${p.accreditationValidUntil})`).join(', '),
        view: 'pedagogy',
        roles: ['admin', 'dg', 'pedagogie'],
      });
    }

    const order: Record<AlertSeverity, number> = { critique: 0, attention: 1, info: 2 };
    return alerts.filter((a) => a.roles.includes(activeRole)).sort((a, b) => order[a.severity] - order[b.severity]);
  }, [invoices, cashSession, bookLoans, grades, attendance, programs, reminders, expenses, activeRole]);
}
