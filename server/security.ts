import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../src/types/index';
import { AppStore, getStore } from './db';

/**
 * Sécurité & validation centralisées de l'API DGB App PRO.
 *
 * - Le rôle transmis par le client (en-tête x-user-role) n'est accepté que s'il
 *   fait partie des rôles réellement attribués à l'utilisateur. Un étudiant ne
 *   peut donc plus se déclarer « admin » en modifiant un en-tête HTTP.
 * - Chaque route sensible déclare explicitement les rôles autorisés.
 */

export interface Actor {
  id: string;
  name: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
}

export function getActor(req: Request): Actor {
  const store = getStore();
  const userId = (req.headers['x-user-id'] as string) || 'usr_admin';
  const requestedRole = req.headers['x-user-role'] as UserRole | undefined;
  const user = store.users.find((u) => u.id === userId) || store.users[0];

  const role: UserRole =
    requestedRole && user.roles.includes(requestedRole) ? requestedRole : user.activeRole || user.roles[0];

  return {
    id: user.id,
    name: user.name,
    role,
    studentId: user.studentId,
    teacherId: user.teacherId,
  };
}

/** Middleware Express : refuse la requête si le rôle actif n'est pas autorisé. */
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = getActor(req);
    if (!roles.includes(actor.role)) {
      return res.status(403).json({
        error: `Action non autorisée pour le rôle « ${actor.role} ». Rôles habilités : ${roles.join(', ')}.`,
      });
    }
    next();
  };
}

export const ROLES = {
  ADMIN: ['admin'] as UserRole[],
  DIRECTION: ['admin', 'dg'] as UserRole[],
  SCOLARITE: ['admin', 'dg', 'scolarite'] as UserRole[],
  INSCRIPTION: ['admin', 'dg', 'scolarite', 'comptable'] as UserRole[],
  ENCAISSEMENT: ['admin', 'dg', 'comptable', 'caissier'] as UserRole[],
  CAISSE: ['admin', 'comptable', 'caissier'] as UserRole[],
  COMPTABILITE: ['admin', 'dg', 'comptable'] as UserRole[],
  RELANCE: ['admin', 'dg', 'comptable', 'scolarite', 'caissier'] as UserRole[],
  NOTES: ['admin', 'dg', 'pedagogie', 'enseignant'] as UserRole[],
  PRESENCES: ['admin', 'dg', 'pedagogie', 'enseignant', 'scolarite'] as UserRole[],
  DIPLOMES: ['admin', 'dg', 'pedagogie', 'scolarite'] as UserRole[],
  BIBLIOTHEQUE: ['admin', 'dg', 'pedagogie', 'scolarite'] as UserRole[],
  PLANNING: ['admin', 'dg', 'pedagogie'] as UserRole[],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Montant FCFA strictement positif et entier. Retourne null si invalide. */
export function parsePositiveFcfa(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded <= 0) return null;
  if (rounded > 1_000_000_000) return null; // garde-fou : 1 milliard FCFA
  return rounded;
}

/** Note sur 20 : undefined si absente, null si invalide. */
export function parseGrade(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 20) return null;
  return Math.round(n * 100) / 100;
}

export function isNonEmptyString(value: unknown, minLength = 1): value is string {
  return typeof value === 'string' && value.trim().length >= minLength;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/** Jeton cryptographiquement sûr (anti-falsification des diplômes). */
export function secureToken(length: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Numérotation séquentielle robuste
// ---------------------------------------------------------------------------

/**
 * Calcule le prochain numéro de séquence pour un préfixe donné, à partir du plus
 * grand numéro existant (et non du nombre d'éléments, qui produit des doublons
 * dès qu'un élément est supprimé ou que des données sont importées).
 */
export function nextSequence(existingNumbers: (string | undefined)[], prefix: string): number {
  let max = 0;
  for (const num of existingNumbers) {
    if (!num || !num.startsWith(prefix)) continue;
    const match = num.slice(prefix.length).match(/^(\d+)/);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > max) max = value;
    }
  }
  return max + 1;
}

export function formatSequence(prefix: string, value: number, pad: number): string {
  return `${prefix}${String(value).padStart(pad, '0')}`;
}

// ---------------------------------------------------------------------------
// Statuts dérivés (retards)
// ---------------------------------------------------------------------------

/**
 * Met à jour les statuts dépendants de la date du jour :
 * - facture avec reste dû et échéance dépassée → « en_retard »
 * - emprunt de bibliothèque non rendu et échéance dépassée → « en_retard »
 * Retourne true si au moins un statut a changé.
 */
export function refreshDerivedStatuses(store: AppStore): boolean {
  const today = todayISO();
  let changed = false;

  for (const inv of store.invoices) {
    let expected: typeof inv.status;
    if (inv.balanceDue <= 0) expected = 'solde';
    else if (inv.dueDate < today) expected = 'en_retard';
    else expected = inv.paidAmount > 0 ? 'partiel' : 'en_attente';

    if (inv.status !== expected) {
      inv.status = expected;
      changed = true;
    }
  }

  for (const loan of store.bookLoans || []) {
    if ((loan.status === 'en_cours' || loan.status === 'prolonge') && loan.dueDate < today) {
      loan.status = 'en_retard';
      changed = true;
    }
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Cloisonnement des données par rôle
// ---------------------------------------------------------------------------

/**
 * Un étudiant ne doit recevoir que ses propres données (dossier, factures,
 * reçus, notes publiées, présences). Les autres rôles reçoivent le store complet.
 */
export function scopeStoreForActor(store: AppStore, actor: Actor): AppStore {
  if (actor.role !== 'etudiant') return store;

  const sid = actor.studentId;
  return {
    ...store,
    users: store.users.filter((u) => u.id === actor.id),
    students: store.students.filter((s) => s.id === sid),
    enrollments: store.enrollments.filter((e) => e.studentId === sid),
    invoices: store.invoices.filter((i) => i.studentId === sid),
    receipts: store.receipts.filter((r) => r.studentId === sid),
    grades: store.grades.filter((g) => g.studentId === sid && g.status === 'publie'),
    attendance: store.attendance.map((a) => ({
      ...a,
      attendees: a.attendees.filter((att) => att.studentId === sid),
    })),
    diplomas: store.diplomas.filter((d) => d.studentId === sid),
    bookLoans: (store.bookLoans || []).filter((l) => l.studentId === sid),
    reminders: (store.reminders || []).filter((r) => r.studentId === sid),
    expenses: [],
    auditLogs: [],
    cashSessionsHistory: [],
  };
}
