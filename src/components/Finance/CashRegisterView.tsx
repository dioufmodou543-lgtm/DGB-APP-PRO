import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  History,
  Lock,
  Plus,
  Printer,
  ShieldCheck,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { calculateCashTheoreticalBalance, formatFCFA } from '../../services/currency';

export const CashRegisterView: React.FC = () => {
  const { cashSession, openCashSession, closeCashSession, recordCashMovement } = useApp();
  const { currentUser, activeRole } = useAuth();

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  // Close session form
  const [physicalCashCounted, setPhysicalCashCounted] = useState<number>(
    cashSession.theoreticalBalance || 0
  );
  const [closeNotes, setCloseNotes] = useState('');

  // Open session form
  const [initialFund, setInitialFund] = useState<number>(150000);

  // Manual cash movement form (Sortie de caisse / approvisionnement)
  const [movementType, setMovementType] = useState<'entree' | 'sortie'>('sortie');
  const [movementAmount, setMovementAmount] = useState<number>(10000);
  const [movementReason, setMovementReason] = useState('Achats fournitures bureau secrétariat');

  const cashDiscrepancy = physicalCashCounted - cashSession.theoreticalBalance;

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await openCashSession(Number(initialFund));
      setIsOpenModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await closeCashSession(Number(physicalCashCounted), closeNotes);
      setIsCloseModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordCashMovement(movementType, Number(movementAmount), movementReason);
      setIsMovementModalOpen(false);
      setMovementReason('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Gestion de Caisse Physique Guichet
          </h1>
          <p className="text-xs text-slate-500">
            Contrôle du solde théorique, journal des espèces et procès-verbal de clôture
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {cashSession.status === 'ouverte' ? (
            <>
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mouvement d espèces</span>
              </button>
              <button
                onClick={() => {
                  setPhysicalCashCounted(cashSession.theoreticalBalance);
                  setIsCloseModalOpen(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Clôturer la caisse (PV)</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsOpenModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
            >
              <Unlock className="w-4 h-4" />
              <span>Ouvrir une nouvelle session de caisse</span>
            </button>
          )}
        </div>
      </div>

      {/* Cash Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Session en cours</span>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">
            {cashSession.sessionNumber}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                cashSession.status === 'ouverte'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {cashSession.status}
            </span>
            <span className="text-[11px] text-slate-400">Ouverte par {cashSession.openedBy ? cashSession.openedBy.split('(')[0] : 'Agent'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Fond de caisse initial</span>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatFCFA(cashSession.initialCash)}
          </div>
          <span className="text-[11px] text-slate-400">Dotation d ouverture</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">Flux de la journée</span>
          <div className="text-sm font-semibold text-emerald-700 mt-1">
            +{formatFCFA(cashSession.totalCashIn)} (Entrées)
          </div>
          <div className="text-xs font-semibold text-rose-700">
            -{formatFCFA(cashSession.totalCashOut)} (Sorties)
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 shadow-2xs">
          <span className="text-xs text-emerald-800 font-semibold block">Solde Théorique Exact</span>
          <div className="text-2xl font-bold text-emerald-900 mt-1">
            {formatFCFA(cashSession.theoreticalBalance)}
          </div>
          <span className="text-[11px] text-emerald-700">
            = Fond initial + Entrées - Sorties
          </span>
        </div>
      </div>

      {/* Movements Journal */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Journal des Mouvements d Espèces de la Session</h2>
            <p className="text-xs text-slate-500">Traçabilité chronologique complète des encaissements et décaissements physiques</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-2.5 py-1 text-xs border rounded-lg text-slate-600 hover:bg-slate-50 flex items-center space-x-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer le journal</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-3 py-2 text-left">Heure</th>
                <th className="px-3 py-2 text-left">Type de flux</th>
                <th className="px-3 py-2 text-left">Motif / Justificatif</th>
                <th className="px-3 py-2 text-left">Réf Reçu</th>
                <th className="px-3 py-2 text-right">Montant (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cashSession.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Aucun mouvement d espèces enregistré pour le moment dans cette session.
                  </td>
                </tr>
              ) : (
                cashSession.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 font-mono">{m.timestamp.slice(11, 16)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.type === 'entree'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {m.type === 'entree' ? '+ Entrée' : '- Sortie'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium">{m.reason}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{m.receiptNumber || 'N/A'}</td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        m.type === 'entree' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {m.type === 'entree' ? '+' : '-'} {formatFCFA(m.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CLOSE CASH SESSION (WITH PHYSICAL COUNT & DISCREPANCY RECONCILIATION) */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseSession}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Procès-Verbal de Clôture de Caisse</h2>
                <span className="font-mono text-xs text-emerald-400">{cashSession.sessionNumber}</span>
              </div>
              <button type="button" onClick={() => setIsCloseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Solde théorique attendu :</span>
                  <span className="font-bold text-slate-900">{formatFCFA(cashSession.theoreticalBalance)}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Calculé rigoureusement selon l équation : Fond ({formatFCFA(cashSession.initialCash)}) + Entrées ({formatFCFA(cashSession.totalCashIn)}) - Sorties ({formatFCFA(cashSession.totalCashOut)})
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Solde physique compté en caisse (Billetage & Pièces) en FCFA :
                </label>
                <input
                  type="number"
                  required
                  value={physicalCashCounted}
                  onChange={(e) => setPhysicalCashCounted(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-bold text-sm text-slate-900"
                />
              </div>

              {/* Discrepancy indicator */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  cashDiscrepancy === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div>
                  <span className="font-semibold block">Écart de caisse constaté :</span>
                  <span className="text-[11px]">
                    {cashDiscrepancy === 0
                      ? 'Parfaite concordance (Aucun écart)'
                      : cashDiscrepancy > 0
                      ? 'Excédent de caisse inexpliqué'
                      : 'Manquant de caisse'}
                  </span>
                </div>
                <div className="font-bold text-base">
                  {cashDiscrepancy > 0 ? '+' : ''}{formatFCFA(cashDiscrepancy)}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Observations / Remarques de clôture :
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  placeholder="Justification des écarts ou observations de fin de vacation..."
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Valider & Clôturer Définitivement la Session
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: OPEN CASH SESSION */}
      {isOpenModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenSession}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Ouvrir une session de caisse</h2>
              <button type="button" onClick={() => setIsOpenModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Dotation initiale / Fond de caisse physique (FCFA) :
                </label>
                <input
                  type="number"
                  required
                  step="5000"
                  value={initialFund}
                  onChange={(e) => setInitialFund(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-bold text-sm"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Montant physique disponible en caisse pour le rendu de monnaie
                </span>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsOpenModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Ouvrir la session
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CASH MOVEMENT (PETITE CAISSE) */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddMovement}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Mouvement exceptionnel d espèces</h2>
              <button type="button" onClick={() => setIsMovementModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sens du mouvement :</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('sortie')}
                    className={`flex-1 py-2 rounded-lg font-semibold border ${
                      movementType === 'sortie' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-slate-50'
                    }`}
                  >
                    Sortie d espèces (Dépense guichet)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('entree')}
                    className={`flex-1 py-2 rounded-lg font-semibold border ${
                      movementType === 'entree' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50'
                    }`}
                  >
                    Entrée d espèces (Apport)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Montant en FCFA :</label>
                <input
                  type="number"
                  required
                  step="1000"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Justificatif / Motif :</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Enregistrer le mouvement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
