import React from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PWAInstallButton } from './PWA/PWAInstallButton';
import { OfflineStatusModal } from './PWA/OfflineStatusModal';

export const Header: React.FC = () => {
  const { config, academicYears, setIsPriorityFlowOpen, resetDemoData, setActiveView } = useApp();
  const { currentUser, activeRole, users, switchUser, setActiveRole } = useAuth();
  const { isOnline, isSimulatedOffline } = useOnlineStatus();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = React.useState(false);

  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];

  const roleLabels: Record<UserRole, { label: string; badge: string }> = {
    admin: { label: 'Administrateur', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    dg: { label: 'Direction Générale', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    scolarite: { label: 'Scolarité', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    pedagogie: { label: 'Pédagogie', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    comptable: { label: 'Comptable', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    caissier: { label: 'Caissier(ère)', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
    enseignant: { label: 'Enseignant', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
    etudiant: { label: 'Étudiant', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Institution Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              SN
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-900 text-sm sm:text-base leading-tight">
                  {config.name}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Dakar, Sénégal (XOF)
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Année : <strong className="ml-1 text-slate-700">{currentYear.code}</strong>
                </span>
                <span>•</span>
                <span className="text-emerald-600 font-medium">Session Active</span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Role Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Priority Flow Button */}
            <button
              onClick={() => setIsPriorityFlowOpen(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
              title="Tester le parcours prioritaire en 9 étapes (Cahier des charges section 5)"
            >
              <PlayCircle className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Parcours Prioritaire</span> (9 étapes)
            </button>

            {/* Test Runner Button */}
            <button
              onClick={() => setActiveView('tests')}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
              title="Vérifier les règles de calcul et intégrité"
            >
              <ShieldCheck className="w-4 h-4 mr-1 text-indigo-600" />
              <span className="hidden md:inline">Tests Intégrité</span>
            </button>

            {/* Role Switcher Menu */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium transition-colors">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline text-slate-500">Rôle :</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${roleLabels[activeRole]?.badge}`}
                >
                  {roleLabels[activeRole]?.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-1 w-64 rounded-lg bg-white shadow-lg border border-slate-200 py-1.5 hidden group-hover:block hover:block z-50">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Changer de rôle actif
                </div>
                {(Object.keys(roleLabels) as UserRole[]).map((r) => {
                  const matchingUser = users.find((u) => u.roles.includes(r));
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setActiveRole(r);
                        if (matchingUser) switchUser(matchingUser.id);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        activeRole === r ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            activeRole === r ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span>{roleLabels[r].label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {matchingUser?.name ? matchingUser.name.split(' ')[0] : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PWA In-App Install Button */}
            <PWAInstallButton />

            {/* Offline Cache & Connection Status Trigger */}
            <button
              onClick={() => setIsOfflineModalOpen(true)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Statut du Service Worker & Cache Hors-Ligne (Emplois du temps & Étudiants)"
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden md:inline">En ligne</span>
                  <span className="text-2xs bg-emerald-200/60 text-emerald-900 px-1 rounded-xs">Cache PWA</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold">Hors-ligne</span>
                  {isSimulatedOffline && (
                    <span className="text-2xs bg-amber-200 text-amber-900 px-1 rounded-xs">Simulé</span>
                  )}
                </>
              )}
            </button>

            {/* Reset Demo Data Button */}
            <button
              onClick={() => {
                if (window.confirm('Voulez-vous réinitialiser le jeu de données de démonstration ?')) {
                  resetDemoData();
                }
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Réinitialiser les données de démonstration"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Offline Diagnostic & Cache Modal */}
      <OfflineStatusModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </header>
  );
};
