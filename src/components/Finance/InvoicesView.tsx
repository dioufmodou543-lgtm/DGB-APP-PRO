import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Filter,
  Printer,
  Receipt,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/currency';
import { InvoiceSchedule, PaymentMethod } from '../../types';

export const InvoicesView: React.FC = () => {
  const { invoices, students, recordPayment } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSchedule | null>(null);

  // Quick Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('wave');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredInvoices = invoices.filter((inv) => {
    const student = students.find((s) => s.id === inv.studentId);
    const textMatch = `${inv.invoiceNumber} ${inv.title} ${student?.firstName || ''} ${student?.lastName || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const statusMatch = statusFilter === 'all' || inv.status === statusFilter;
    return textMatch && statusMatch;
  });

  const openPaymentModal = (inv: InvoiceSchedule) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.balanceDue);
    setPayRef(`TX-${Date.now().toString().slice(-6)}`);
    setIsPayModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setLoading(true);
    try {
      await recordPayment({
        studentId: selectedInvoice.studentId,
        invoiceScheduleId: selectedInvoice.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        transactionRef: payRef,
        notes: payNotes || `Règlement facture ${selectedInvoice.invoiceNumber}`,
      });
      setIsPayModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Facturation & Échéanciers Étudiants
          </h1>
          <p className="text-xs text-slate-500">
            Suivi des factures générées, règlements partiels et restes dus en FCFA
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par N° facture, titre ou étudiant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Tous les états</option>
            <option value="en_attente">En attente</option>
            <option value="partiel">Partiellement payé</option>
            <option value="solde">Soldé</option>
            <option value="en_retard">En retard</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">N° Facture</th>
                <th className="px-4 py-3 text-left">Étudiant</th>
                <th className="px-4 py-3 text-left">Libellé</th>
                <th className="px-4 py-3 text-left">Échéance</th>
                <th className="px-4 py-3 text-right">Montant Net</th>
                <th className="px-4 py-3 text-right">Payé</th>
                <th className="px-4 py-3 text-right">Reste Dû</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const student = students.find((s) => s.id === inv.studentId);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {student ? `${student.firstName} ${student.lastName}` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{student?.matricule}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inv.title}</td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{inv.dueDate}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatFCFA(inv.netAmount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatFCFA(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-900">{formatFCFA(inv.balanceDue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'solde'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.status === 'partiel'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.balanceDue > 0 ? (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                        >
                          Encaisser
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium">Soldée</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK PAYMENT MODAL */}
      {isPayModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handlePaymentSubmit}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Encaisser un règlement</h2>
                <span className="font-mono text-xs text-emerald-400">{selectedInvoice.invoiceNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block">Facture : {selectedInvoice.title}</span>
                  <span className="font-bold text-slate-800">Net facturé : {formatFCFA(selectedInvoice.netAmount)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Reste à payer :</span>
                  <span className="font-bold text-amber-700 text-sm">{formatFCFA(selectedInvoice.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Montant du règlement en FCFA (Acompte partiel possible) :
                </label>
                <input
                  type="number"
                  required
                  max={selectedInvoice.balanceDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Mode de règlement :</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                >
                  <option value="wave">Wave Sénégal (Mobile Money)</option>
                  <option value="orange_money">Orange Money Sénégal</option>
                  <option value="especes">Espèces (Guichet)</option>
                  <option value="virement">Virement bancaire (CBAO / Ecobank)</option>
                  <option value="cheque">Chèque certifié</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Référence transaction :</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
                  placeholder="Ex: WAVE-TX-10924"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Observations :</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  placeholder="Notes de caisse..."
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirmer l encaissement & Éditer le reçu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
