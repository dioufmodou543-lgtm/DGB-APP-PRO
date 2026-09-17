import React, { useState } from 'react';
import {
  WifiOff,
  Wifi,
  Database,
  Calendar,
  Users,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  X,
  HardDrive,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getOfflineCacheSummary, getAcademicDataFromOfflineCache } from '../../utils/offlineStorage';
import { useApp } from '../../context/AppContext';

interface OfflineStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineStatusModal: React.FC<OfflineStatusModalProps> = ({ isOpen, onClose }) => {
  const { isOnline, isSimulatedOffline, toggleOfflineSimulation } = useOnlineStatus();
  const { students, timetables, modules, refreshData } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const cacheSummary = getOfflineCacheSummary();

  const handleForceCacheRefresh = async () => {
    setIsRefreshing(true);
    setSyncSuccess(null);
    try {
      await refreshData();
      setSyncSuccess('Données académiques synchronisées et stockées avec succès dans le cache local !');
      setTimeout(() => setSyncSuccess(null), 4000);
    } catch (e: any) {
      alert('Erreur de synchronisation : ' + e.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Statut Cache & Service Worker Hors-Ligne
              </h3>
              <p className="text-2xs text-slate-500">
                PWA • Disponibilité continue des emplois du temps et listes d'étudiants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Network Status Card */}
        <div
          className={`rounded-xl p-4 border flex items-center justify-between ${
            isOnline
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isOnline ? 'Connecté au Réseau' : 'Mode Hors-Ligne Actif'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {isOnline
                ? 'Les requêtes passent par le serveur et rafraîchissent automatiquement le cache local.'
                : 'Toutes les consultations (étudiants, emplois du temps, cours) sont servies instantanément par le cache local.'}
            </p>
          </div>

          <button
            onClick={toggleOfflineSimulation}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
              isSimulatedOffline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            {isSimulatedOffline ? 'Désactiver Simulation' : 'Simuler Hors-Ligne'}
          </button>
        </div>

        {/* Cache Storage Metrics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center space-x-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>Contenu Académique Protégé en Cache Local :</span>
            </span>
            <span className="text-2xs text-slate-500 font-normal">
              Dernière sync : {cacheSummary.lastSyncFormatted}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-center">
              <Users className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-900">
                {cacheSummary.studentsCount || students.length}
              </div>
              <div className="text-2xs text-slate-500 font-medium">Étudiants & Dossiers</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-center">
              <Calendar className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-900">
                {cacheSummary.timetablesCount || timetables.length}
              </div>
              <div className="text-2xs text-slate-500 font-medium">Séances d Emploi du Temps</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-center">
              <BookOpen className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-900">
                {cacheSummary.modulesCount || modules.length}
              </div>
              <div className="text-2xs text-slate-500 font-medium">Modules & Matières</div>
            </div>
          </div>
        </div>

        {/* Technical Guarantee Note */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Garantie de Disponibilité Continue (Dual-Layer Cache)</span>
          </div>
          <p className="text-2xs text-slate-500 leading-relaxed">
            1. <strong>Service Worker Workbox</strong> : Intercepte les requêtes réseau et sert les ressources statiques et endpoints API pré-enregistrés même sans signal Internet.<br />
            2. <strong>Persistance Locale Sécurisée</strong> : Mémorise l'état complet des effectifs et du planning hebdomadaire avec restauration automatique au démarrage.
          </p>
        </div>

        {/* Feedback Message */}
        {syncSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccess}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={handleForceCacheRefresh}
            disabled={isRefreshing || !isOnline}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Synchronisation...' : 'Actualiser le Cache Maintenant'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
