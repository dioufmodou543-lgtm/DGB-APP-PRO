import React from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  FileText,
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
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView } = useApp();
  const { activeRole } = useAuth();

  const menuSections = [
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

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3">
          Navigation Principale
        </div>
      </div>

      <nav className="p-2 space-y-4 flex-1 overflow-y-auto">
        {menuSections.map((section, idx) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(activeRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </span>
                {section.badge && (
                  <span className="text-[9px] text-slate-400 font-normal truncate max-w-[100px]">
                    {section.badge}
                  </span>
                )}
              </div>

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-bold shadow-2xs border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Senegal Currency & Context Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
        <div className="flex items-center justify-between font-medium text-slate-700 mb-1">
          <span>Devise officielle</span>
          <span className="bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded">
            FCFA (XOF)
          </span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Calculs monétaires sans virgule flottante • Horodatage Dakar (GMT)
        </p>
      </div>
    </aside>
  );
};
