import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Filter,
  Layers,
  Plus,
  Search,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/currency';
import { ExpenseCategory, ExpenseStage, VendorExpense } from '../../types';

export const ExpensesView: React.FC = () => {
  const { expenses, createExpense, advanceExpenseStage } = useApp();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New Expense form state
  const [vendorName, setVendorName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('vacation_enseignant');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(150000);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialStage, setInitialStage] = useState<ExpenseStage>('prevue');
  const [vendorInvoiceRef, setVendorInvoiceRef] = useState('');

  // Summaries per stage
  const prevues = expenses.filter((e) => e.stage === 'prevue').reduce((s, e) => s + e.amount, 0);
  const dettes = expenses.filter((e) => e.stage === 'dette_constatee').reduce((s, e) => s + e.amount, 0);
  const ordonnes = expenses.filter((e) => e.stage === 'paiement_ordonne').reduce((s, e) => s + e.amount, 0);
  const decaissements = expenses.filter((e) => e.stage === 'decaissement_realise').reduce((s, e) => s + e.paidAmount, 0);

  const filteredExpenses = expenses.filter((e) => {
    const textMatch = `${e.expenseNumber} ${e.vendorName} ${e.description}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const stageMatch = stageFilter === 'all' || e.stage === stageFilter;
    const catMatch = categoryFilter === 'all' || e.category === categoryFilter;
    return textMatch && stageMatch && catMatch;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !description) return;
    try {
      await createExpense({
        vendorName,
        category,
        description,
        amount: Number(amount),
        dueDate,
        stage: initialStage,
        vendorInvoiceRef,
      });
      setIsNewModalOpen(false);
      setVendorName('');
      setDescription('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdvance = async (expense: VendorExpense) => {
    let nextStage: ExpenseStage = 'decaissement_realise';
    if (expense.stage === 'prevue') nextStage = 'dette_constatee';
    else if (expense.stage === 'dette_constatee') nextStage = 'paiement_ordonne';
    else if (expense.stage === 'paiement_ordonne') nextStage = 'decaissement_realise';

    await advanceExpenseStage(expense.id, nextStage);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Dépenses & Fournisseurs (Cycle 4 Étapes)
          </h1>
          <p className="text-xs text-slate-500">
            Suivi des engagements sans double comptage conformément à la Section 3.F
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Dépense / Facture</span>
        </button>
      </div>

      {/* 4 Stages Progression Summary (Section 3.F & 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-500">1. Dépenses Prévues</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">Budget</span>
          </div>
          <div className="text-lg font-bold text-slate-800 mt-2">{formatFCFA(prevues)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Prévisions sans engagement juridique</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-800">2. Dettes Constatées</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Factures</span>
          </div>
          <div className="text-lg font-bold text-amber-900 mt-2">{formatFCFA(dettes)}</div>
          <p className="text-[11px] text-amber-700 mt-1">Service fait, facture reçue en attente</p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-blue-800">3. Paiements Ordonnés</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Bons émis</span>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-2">{formatFCFA(ordonnes)}</div>
          <p className="text-[11px] text-blue-700 mt-1">Validé pour virement ou chèque</p>
        </div>

        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-rose-800">4. Décaissements Réalisés</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">Sortie réelle</span>
          </div>
          <div className="text-lg font-bold text-rose-900 mt-2">{formatFCFA(decaissements)}</div>
          <p className="text-[11px] text-rose-700 mt-1">Sortie effective des comptes bancaires/caisse</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par N° dépense, fournisseur, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Toutes les étapes</option>
            <option value="prevue">Dépenses prévues</option>
            <option value="dette_constatee">Dettes constatées</option>
            <option value="paiement_ordonne">Paiements ordonnés</option>
            <option value="decaissement_realise">Décaissements réalisés</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Toutes catégories</option>
            <option value="vacation_enseignant">Vacations Enseignants</option>
            <option value="loyer">Loyers Campus</option>
            <option value="electricite">Électricité (Senelec)</option>
            <option value="internet">Internet & Télécoms (Sonatel)</option>
            <option value="fournitures">Fournitures & consommables</option>
            <option value="maintenance">Maintenance & Sécurité</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">N° Dépense</th>
                <th className="px-4 py-3 text-left">Fournisseur / Bénéficiaire</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Échéance</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Étape Comptable</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{exp.expenseNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{exp.vendorName}</div>
                    <div className="text-[11px] text-slate-500">{exp.description}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    {exp.category.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium">{exp.dueDate}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">
                    {formatFCFA(exp.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        exp.stage === 'decaissement_realise'
                          ? 'bg-rose-100 text-rose-800'
                          : exp.stage === 'paiement_ordonne'
                          ? 'bg-blue-100 text-blue-800'
                          : exp.stage === 'dette_constatee'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {exp.stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {exp.stage !== 'decaissement_realise' && (
                      <button
                        onClick={() => handleAdvance(exp)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded text-xs font-medium inline-flex items-center space-x-1"
                      >
                        <span>
                          {exp.stage === 'prevue'
                            ? 'Constater dette'
                            : exp.stage === 'dette_constatee'
                            ? 'Ordonnancer'
                            : 'Décaisser'}
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW EXPENSE MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Engager une Dépense Fournisseur</h2>
              <button type="button" onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Fournisseur / Prestataire :</label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: Senelec, Sonatel, Loyer Fann, Dr. Diallo..."
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Catégorie :</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="vacation_enseignant">Vacations Enseignants</option>
                    <option value="loyer">Loyers Campus</option>
                    <option value="electricite">Électricité (Senelec)</option>
                    <option value="internet">Internet & Télécoms</option>
                    <option value="fournitures">Fournitures pédagogiques</option>
                    <option value="maintenance">Maintenance campus</option>
                    <option value="autre">Autre exploitation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Montant en FCFA :</label>
                  <input
                    type="number"
                    required
                    step="10000"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Description / Motif :</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: Facture électricité campus Octobre 2025..."
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date d échéance :</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Étape initiale :</label>
                  <select
                    value={initialStage}
                    onChange={(e) => setInitialStage(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="prevue">1. Dépense prévue (Budget)</option>
                    <option value="dette_constatee">2. Dette constatée (Facture reçue)</option>
                    <option value="paiement_ordonne">3. Paiement ordonné (Bon émis)</option>
                    <option value="decaissement_realise">4. Décaissement réalisé (Sortie directe)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Enregistrer la dépense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
