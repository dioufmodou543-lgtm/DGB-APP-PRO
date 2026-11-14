import React from 'react';
import {
  Award,
  BellRing,
  CalendarCheck,
  FileCheck,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { UserRole } from './types';

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

export interface MenuSection {
  title: string;
  badge?: string;
  items: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'VUE GLOBALE',
    items: [
      {
        id: 'dashboard',
        label: 'Tableau de bord',
        icon: LayoutDashboard,
        roles: ['admin', 'dg', 'scolarite', 'pedagogie', 'comptable', 'caissier', 'enseignant', 'etudiant'],
      },
    ],
  },
  {
    title: 'ADMINISTRATION',
    badge: 'Scolarité & Dossiers',
    items: [
      {
        id: 'students',
        label: 'Dossiers & Inscriptions',
        icon: Users,
        roles: ['admin', 'dg', 'scolarite', 'comptable'],
      },
      {
        id: 'diplomas',
        label: 'Diplômes & Attestations',
        icon: FileCheck,
        roles: ['admin', 'dg', 'pedagogie', 'scolarite', 'etudiant'],
      },
      {
        id: 'library',
        label: 'Bibliothèque & Prêts',
        icon: Library,
        roles: ['admin', 'dg', 'pedagogie', 'scolarite', 'enseignant', 'etudiant', 'comptable', 'caissier'],
      },
      {
        id: 'audit',
        label: 'Journal d Audit',
        icon: History,
        roles: ['admin', 'dg', 'comptable'],
      },
      {
        id: 'settings',
        label: 'Paramétrage Établissement',
        icon: Settings,
        roles: ['admin', 'dg'],
      },
    ],
  },
  {
    title: 'PÉDAGOGIE',
    badge: 'Programmes & Cours',
    items: [
      {
        id: 'teacher_portal',
        label: 'Espace Enseignant',
        icon: UserCheck,
        roles: ['admin', 'dg', 'pedagogie', 'enseignant'],
      },
      {
        id: 'pedagogy',
        label: 'Filières & Emplois du temps',
        icon: GraduationCap,
        roles: ['admin', 'dg', 'pedagogie', 'scolarite', 'enseignant'],
      },
      {
        id: 'attendance',
        label: 'Suivi des Présences',
        icon: CalendarCheck,
        roles: ['admin', 'dg', 'pedagogie', 'enseignant', 'scolarite', 'etudiant'],
      },
      {
        id: 'grades',
        label: 'Notes & Relevés',
        icon: Award,
        roles: ['admin', 'dg', 'pedagogie', 'enseignant', 'etudiant'],
      },
    ],
  },
  {
    title: 'COMPTABILITÉ',
    badge: 'Finance & Trésorerie FCFA',
    items: [
      {
        id: 'invoices',
        label: 'Facturation & Échéanciers',
        icon: FileSpreadsheet,
        roles: ['admin', 'dg', 'comptable', 'scolarite', 'etudiant'],
      },
      {
        id: 'payments',
        label: 'Paiements & Reçus',
        icon: Receipt,
        roles: ['admin', 'dg', 'comptable', 'caissier', 'etudiant'],
      },
      {
        id: 'recovery',
        label: 'Recouvrement & Relances',
        icon: BellRing,
        roles: ['admin', 'dg', 'comptable', 'scolarite', 'caissier'],
      },
      {
        id: 'cash',
        label: 'Gestion de Caisse',
        icon: Wallet,
        roles: ['admin', 'caissier', 'comptable', 'dg'],
      },
      {
        id: 'expenses',
        label: 'Dépenses & Fournisseurs',
        icon: Truck,
        roles: ['admin', 'dg', 'comptable'],
      },
      {
        id: 'treasury',
        label: 'Trésorerie & Projections',
        icon: TrendingUp,
        roles: ['admin', 'dg', 'comptable'],
      },
    ],
  },
  {
    title: 'CONTRÔLE & TESTS',
    items: [
      {
        id: 'tests',
        label: 'Tests & Calculs (Section 4)',
        icon: ShieldCheck,
        roles: ['admin', 'dg', 'comptable', 'scolarite', 'pedagogie', 'caissier'],
      },
    ],
  },
];

/** Toutes les vues accessibles pour un rôle donné (navigation, recherche globale, garde d'accès). */
export function viewsForRole(role: UserRole): MenuItem[] {
  return MENU_SECTIONS.flatMap((section) => section.items).filter((item) => item.roles.includes(role));
}
