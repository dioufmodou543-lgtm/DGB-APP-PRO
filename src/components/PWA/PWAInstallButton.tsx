import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Desktop / Android flow with native prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer ${className}`}
        title="Installer l'application ISMNM sur votre appareil"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'App (Hors-ligne)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl border border-emerald-300/40 bg-emerald-950/40 hover:bg-emerald-900/60 px-2.5 py-1.5 text-2xs font-semibold text-emerald-200 transition-colors cursor-pointer ${className}`}
          title="Installer sur iPhone / iPad"
        >
          <Smartphone className="w-3 h-3 text-emerald-300" />
          <span>Installer sur iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Installer sur iPhone & iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Pour utiliser l'application ISMNM même sans connexion Internet :
              </p>

              <ol className="text-xs text-slate-700 space-y-2.5 list-decimal pl-4 font-medium">
                <li>
                  Appuyez sur le bouton de <strong>Partage</strong> (l'icône carrée avec flèche vers le haut) dans la barre de Safari.
                </li>
                <li>
                  Faites défiler le menu vers le bas et sélectionnez <strong>Sur l'écran d'accueil</strong>.
                </li>
                <li>
                  Validez en touchant <strong>Ajouter</strong> en haut à droite.
                </li>
              </ol>

              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-center space-x-2 text-2xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Les emplois du temps et listes d'étudiants seront consultables hors-ligne.</span>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-2 text-xs font-bold transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers before prompt fires
  return null;
};
