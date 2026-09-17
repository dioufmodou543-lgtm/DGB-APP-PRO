import React, { useState } from 'react';
import { WifiOff, Database, ShieldCheck, RefreshCw, ChevronRight } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { OfflineStatusModal } from './OfflineStatusModal';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSimulatedOffline } = useOnlineStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Floating Offline Notification Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 sm:right-6 z-40 max-w-md animate-bounce-short">
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-amber-500/50 flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                  <span>Mode Hors-Ligne Actif</span>
                  {isSimulatedOffline && (
                    <span className="text-2xs bg-amber-500/30 text-amber-200 px-1.5 py-0.2 rounded-sm font-normal">
                      Simulé
                    </span>
                  )}
                </div>
                <div className="text-2xs text-slate-300 leading-snug">
                  Emplois du temps et listes d'étudiants servis depuis le cache Service Worker.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-2xs font-bold shrink-0 border border-slate-700 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <span>Détails</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Offline Status & Diagnostic Modal */}
      <OfflineStatusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
