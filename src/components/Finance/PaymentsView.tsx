import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Smartphone,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatFCFA, numberToFrenchWords } from '../../services/currency';
import { PaymentMethod, PaymentReceipt } from '../../types';

export const PaymentsView: React.FC = () => {
  const { receipts, students, invoices, recordPayment, cancelPayment } = useApp();
  const { activeRole } = useAuth();

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Mobile Money Simulator Modal State
  const [isMMModalOpen, setIsMMModalOpen] = useState(false);
  const [mmProvider, setMmProvider] = useState<'wave' | 'orange_money'>('wave');
  const [mmStudentId, setMmStudentId] = useState(students[0]?.id || '');
  const [mmAmount, setMmAmount] = useState<number>(50000);
  const [mmPhone, setMmPhone] = useState('+221 77 123 45 67');
  const [mmPendingStep, setMmPendingStep] = useState<'initial' | 'awaiting_push' | 'confirmed'>('initial');
  const [loading, setLoading] = useState(false);

  const filteredReceipts = receipts.filter((r) => {
    const stu = students.find((s) => s.id === r.studentId);
    const matchesSearch =
      `${r.receiptNumber} ${r.transactionRef || ''} ${stu?.firstName || ''} ${stu?.lastName || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesMethod = methodFilter === 'all' || r.paymentMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const handleCancelReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt || !cancelReason.trim()) return;
    try {
      await cancelPayment(selectedReceipt.id, cancelReason);
      setIsCancelModalOpen(false);
      setSelectedReceipt(null);
      setCancelReason('');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l annulation');
    }
  };

  // Mobile money simulation confirmation
  const handleLaunchMobileMoney = () => {
    setMmPendingStep('awaiting_push');
  };

  const handleConfirmMobileMoney = async () => {
    setLoading(true);
    try {
      const txRef = `${mmProvider.toUpperCase()}-SN-2025-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await recordPayment({
        studentId: mmStudentId,
        amount: mmAmount,
        paymentMethod: mmProvider,
        transactionRef: txRef,
        idempotencyKey: `idemp_${mmProvider}_${Date.now()}`,
        notes: `Règlement validé via Passerelle ${mmProvider === 'wave' ? 'Wave Sénégal' : 'Orange Money'} (Mode Démonstration)`,
      });
      setMmPendingStep('confirmed');
      setSelectedReceipt(res.receipt);
    } catch (err: any) {
      alert(err.message || 'Erreur passerelle de paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Reçus d Encaissement & Passerelles Mobiles
          </h1>
          <p className="text-xs text-slate-500">
            Émission de reçus uniques certifiés (Espèces, Wave, Orange Money, Banques)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setMmPendingStep('initial');
              setIsMMModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>Passerelle Wave / Orange Money</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par N° reçu, référence transaction, nom d étudiant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Tous les moyens</option>
            <option value="wave">Wave Sénégal</option>
            <option value="orange_money">Orange Money</option>
            <option value="especes">Espèces</option>
            <option value="virement">Virement bancaire</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">N° Reçu</th>
                <th className="px-4 py-3 text-left">Étudiant</th>
                <th className="px-4 py-3 text-left">Date & Heure</th>
                <th className="px-4 py-3 text-left">Moyen</th>
                <th className="px-4 py-3 text-left">Réf Transaction</th>
                <th className="px-4 py-3 text-right">Montant Encaissé</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.map((r) => {
                const stu = students.find((s) => s.id === r.studentId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800">{r.receiptNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {stu ? `${stu.firstName} ${stu.lastName}` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{stu?.matricule}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{r.paymentDate}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {r.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{r.transactionRef || 'Guichet'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">
                      {formatFCFA(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'valide'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {r.status === 'valide' ? 'Validé' : 'Annulé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => setSelectedReceipt(r)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Reçu</span>
                      </button>
                      {r.status === 'valide' && ['admin', 'dg', 'comptable'].includes(activeRole) && (
                        <button
                          onClick={() => {
                            setSelectedReceipt(r);
                            setIsCancelModalOpen(true);
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-medium"
                          title="Annuler le reçu et enregistrer une régularisation"
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICIAL RECEIPT VIEW / PRINT MODAL */}
      {selectedReceipt && !isCancelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Reçu Officiel de Caisse</h2>
                <span className="font-mono text-xs text-emerald-400">{selectedReceipt.receiptNumber}</span>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Header Institution */}
              <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT
                  </h3>
                  <div className="text-slate-500 text-[11px]">
                    Rue Aimé Césaire, Fann Résidence • Dakar, Sénégal<br />
                    NINEA : 007892341 2V2 • RC : SN-DKR-2018-B-14290
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-500">
                  Date : {selectedReceipt.paymentDate}
                </div>
              </div>

              {/* Student and Payment Details */}
              {(() => {
                const stu = students.find((s) => s.id === selectedReceipt.studentId);
                const inv = invoices.find((i) => i.id === selectedReceipt.invoiceScheduleId);
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Étudiant :</span>
                        <span className="font-bold text-slate-900">{stu?.firstName} {stu?.lastName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Matricule :</span>
                        <span className="font-mono font-bold text-slate-900">{stu?.matricule}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Mode de règlement :</span>
                        <span className="font-semibold text-slate-800 uppercase">{selectedReceipt.paymentMethod}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Réf. Transaction :</span>
                        <span className="font-mono text-slate-700">{selectedReceipt.transactionRef || 'Guichet Caisse'}</span>
                      </div>
                    </div>

                    {inv && (
                      <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200 text-blue-900">
                        Facture imputée : <strong>{inv.invoiceNumber}</strong> - {inv.title}
                      </div>
                    )}

                    {/* Amount in Numbers & Words */}
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-900 font-semibold text-xs">Montant total reçu :</span>
                        <span className="text-xl font-bold text-emerald-800">{formatFCFA(selectedReceipt.amount)}</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 italic pt-1 border-t border-emerald-200">
                        Arrêté à la somme de : <strong>{numberToFrenchWords(selectedReceipt.amount)}</strong>
                      </div>
                    </div>

                    {selectedReceipt.status === 'annule' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                        <div className="font-bold">REÇU ANNULÉ (OPÉRATION DE RÉGULARISATION)</div>
                        <div className="text-[11px] mt-0.5">
                          Annulé par : {selectedReceipt.cancellationDetails?.cancelledBy} le {selectedReceipt.cancellationDetails?.cancelledAt}
                        </div>
                        <div className="text-[11px] mt-0.5 italic">
                          Motif : « {selectedReceipt.cancellationDetails?.reason} »
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400">
                      <span>Agent caissier : {selectedReceipt.recordedBy}</span>
                      <span className="font-semibold text-emerald-700">Cachet & Signature électronique ✓</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium flex items-center space-x-1.5 hover:bg-slate-100 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Reçu</span>
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL RECEIPT MODAL (Mandatory reason and regularization) */}
      {isCancelModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCancelReceipt}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Ban className="w-5 h-5" />
                <h2 className="text-base font-bold">Annuler l encaissement</h2>
              </div>
              <button type="button" onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 leading-relaxed">
                <strong>Attention (Règle d intégrité Section 3.E) :</strong> L opération originale ne sera pas effacée. Elle sera marquée « annulée » et une écriture de régularisation sera liée pour rétablir le solde dû de la facture.
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Motif d annulation obligatoire :
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  placeholder="Ex: Erreur de saisie guichet sur le montant ou transaction rejetée par la banque..."
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Abandonner
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirmer l annulation traçable
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MOBILE MONEY SIMULATOR MODAL (WAVE & ORANGE MONEY SÉNÉGAL) */}
      {isMMModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className={`px-6 py-4 text-white flex items-center justify-between ${
                mmProvider === 'wave' ? 'bg-[#1e40af]' : 'bg-[#ea580c]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5" />
                <div>
                  <h2 className="text-base font-bold">
                    Passerelle Mobile Money Sénégal (Mode Démo)
                  </h2>
                  <span className="text-xs opacity-90">
                    {mmProvider === 'wave' ? 'Wave Sénégal (Paiement QR / Push)' : 'Orange Money Sénégal (USSD #144# / Max it)'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMMModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Notice Section 3.E */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                <strong>Garantie serveur :</strong> Conformément à la section 3.E, aucun paiement n est confirmé sur un simple clic client. La confirmation transite par le serveur avec vérification d idempotence anti-doublon.
              </div>

              {/* Step: Initial selection */}
              {mmPendingStep === 'initial' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMmProvider('wave')}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                        mmProvider === 'wave'
                          ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Wave Sénégal
                    </button>
                    <button
                      type="button"
                      onClick={() => setMmProvider('orange_money')}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                        mmProvider === 'orange_money'
                          ? 'border-orange-600 bg-orange-50 text-orange-800 ring-2 ring-orange-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Orange Money Sénégal
                    </button>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Sélectionner l étudiant :</label>
                    <select
                      value={mmStudentId}
                      onChange={(e) => setMmStudentId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.matricule})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Numéro Mobile de débit (+221) :</label>
                    <input
                      type="text"
                      value={mmPhone}
                      onChange={(e) => setMmPhone(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Montant à régler en FCFA :</label>
                    <input
                      type="number"
                      step="5000"
                      value={mmAmount}
                      onChange={(e) => setMmAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-slate-900 text-sm"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleLaunchMobileMoney}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center space-x-2"
                    >
                      <span>Initier le paiement sécurisé</span>
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Awaiting validation push */}
              {mmPendingStep === 'awaiting_push' && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center animate-pulse">
                    <QrCode className="w-8 h-8 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Notification envoyée au mobile {mmPhone}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Demande d autorisation de débit de <strong>{formatFCFA(mmAmount)}</strong> via {mmProvider.toUpperCase()}
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                    Code marchand ISMNM : <strong>ISMNM-SN-MERCHANT-01</strong>
                  </div>

                  <div className="flex justify-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMmPendingStep('initial')}
                      className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleConfirmMobileMoney}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simuler validation client (PIN saisi sur mobile)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Confirmed */}
              {mmPendingStep === 'confirmed' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Paiement Mobile Confirmé</h3>
                  <p className="text-xs text-slate-500">
                    La transaction a été validée côté serveur. Le reçu numéroté a été généré automatiquement.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsMMModalOpen(false)}
                    className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
                  >
                    Fermer & voir le reçu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
