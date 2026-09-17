import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TestRunnerView: React.FC = () => {
  const { testResults, runIntegrityTests, isRunningTests } = useApp();
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (!testResults || testResults.length === 0) {
      runIntegrityTests().then(() => setHasRun(true));
    } else {
      setHasRun(true);
    }
  }, []);

  const handleManualRun = async () => {
    await runIntegrityTests();
    setHasRun(true);
  };

  const totalPassed = testResults.filter((t) => t.passed).length;
  const totalFailed = testResults.filter((t) => !t.passed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Suite Automatisée de Tests d Intégrité (Section 4)
          </h1>
          <p className="text-xs text-slate-500">
            Validation mathématique des 8 règles de gestion financière, d idempotence et de sécurité
          </p>
        </div>

        <button
          onClick={handleManualRun}
          disabled={isRunningTests}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
          <span>{isRunningTests ? 'Exécution en cours...' : 'Réexécuter les 8 Tests'}</span>
        </button>
      </div>

      {/* Global Score Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
              Rapport d Audit & Conformité Financière
            </div>
            <h2 className="text-xl font-bold">
              {totalPassed} / {testResults.length} Règles Validées avec Succès
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Calculs d arrondi sans virgule flottante • Contrôle strict des doublons
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-center px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block uppercase">Succès</span>
            <span className="text-xl font-bold text-emerald-400">{totalPassed}</span>
          </div>
          <div className="text-center px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block uppercase">Échecs</span>
            <span className="text-xl font-bold text-rose-400">{totalFailed}</span>
          </div>
        </div>
      </div>

      {/* 8 Rules Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testResults.map((t, idx) => (
          <div
            key={t.id}
            className={`p-5 rounded-xl border bg-white shadow-2xs transition-all ${
              t.passed ? 'border-slate-200 hover:border-emerald-300' : 'border-rose-300 bg-rose-50/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-bold text-sm text-slate-900">{t.name}</span>
              </div>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  t.passed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {t.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{t.passed ? 'CONFORME' : 'ÉCHEC'}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-2.5">{t.description}</p>

            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] font-mono text-slate-700">
              <span className="text-slate-400 block mb-0.5">// Résultat d assertion :</span>
              {t.details}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
