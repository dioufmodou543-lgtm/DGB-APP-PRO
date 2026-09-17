import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  Printer,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatFCFA } from '../../services/currency';
import { generateTreasuryPDF, TreasuryReportData } from '../../services/pdfReportGenerator';

export const TreasuryDashboard: React.FC = () => {
  const { invoices, receipts, expenses, cashSession, config } = useApp();
  const { currentUser } = useAuth();

  const [minTreasuryThreshold, setMinTreasuryThreshold] = useState<number>(2000000); // Seuil alerte 2 000 000 FCFA
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);

  // 1. Solde disponible
  const cashPhysical = cashSession.status === 'ouverte' ? cashSession.theoreticalBalance : 0;
  const initialBank = 6500000; // Compte CBAO + Ecobank
  const bankIn = receipts
    .filter((r) => r.status === 'valide' && r.paymentMethod !== 'especes')
    .reduce((s, r) => s + r.amount, 0);
  const bankOut = expenses
    .filter((e) => e.stage === 'decaissement_realise' && e.paymentMethod !== 'especes')
    .reduce((s, e) => s + e.paidAmount, 0);

  const availableBank = initialBank + bankIn - bankOut;
  const totalAvailable = cashPhysical + availableBank;

  // 2. Encaissements futurs confirmés (échéances à venir des étudiants déjà inscrits)
  const today = new Date().toISOString().split('T')[0];
  const date30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const date60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const date90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const confirmedIn30 = invoices
    .filter((i) => i.balanceDue > 0 && i.dueDate >= today && i.dueDate <= date30)
    .reduce((s, i) => s + i.balanceDue, 0);
  const confirmedIn60 = invoices
    .filter((i) => i.balanceDue > 0 && i.dueDate > date30 && i.dueDate <= date60)
    .reduce((s, i) => s + i.balanceDue, 0);
  const confirmedIn90 = invoices
    .filter((i) => i.balanceDue > 0 && i.dueDate > date60 && i.dueDate <= date90)
    .reduce((s, i) => s + i.balanceDue, 0);

  // 3. Encaissements prévisionnels (nouvelles admissions estimées)
  const estimatedIn30 = 850000;
  const estimatedIn60 = 1200000;
  const estimatedIn90 = 1500000;

  // 4. Décaissements planifiés & Dettes fournisseurs
  const debtsDue30 = expenses
    .filter((e) => (e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne') && e.dueDate <= date30)
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);
  const debtsDue60 = expenses
    .filter((e) => (e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne') && e.dueDate > date30 && e.dueDate <= date60)
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);
  const debtsDue90 = expenses
    .filter((e) => (e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne') && e.dueDate > date60 && e.dueDate <= date90)
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);

  // Salaires & charges fixes estimées par mois
  const fixedChargesPerMonth = 1800000; // Salaires permanents + Loyers campus

  // 5. Projections de solde net
  const projectedBalance30 =
    totalAvailable + (confirmedIn30 + estimatedIn30) - (debtsDue30 + fixedChargesPerMonth);
  const projectedBalance60 =
    projectedBalance30 + (confirmedIn60 + estimatedIn60) - (debtsDue60 + fixedChargesPerMonth);
  const projectedBalance90 =
    projectedBalance60 + (confirmedIn90 + estimatedIn90) - (debtsDue90 + fixedChargesPerMonth);

  // Alert triggers
  const hasTension30 = projectedBalance30 < minTreasuryThreshold;
  const hasTension60 = projectedBalance60 < minTreasuryThreshold;
  const hasTension90 = projectedBalance90 < minTreasuryThreshold;

  // Total student receivables isolated (Section 3.G: "isoler les créances étudiantes pour ne pas les confondre avec la trésorerie disponible")
  const totalStudentReceivables = invoices
    .filter((i) => i.balanceDue > 0)
    .reduce((s, i) => s + i.balanceDue, 0);

  const exportTreasuryCSV = () => {
    const csvContent =
      `Tableau de Bord de Trésorerie Prévisionnelle - ISMNM Dakar\n` +
      `Date d extraction : ${new Date().toLocaleString('fr-FR')}\n\n` +
      `Rubrique,Solde Actuel,Horizon +30 Jours,Horizon +60 Jours,Horizon +90 Jours\n` +
      `Trésorerie Disponible Immédiate,"${totalAvailable}",-,-,-\n` +
      `Encaissements Confirmés (Échéanciers),-,"${confirmedIn30}","${confirmedIn60}","${confirmedIn90}"\n` +
      `Encaissements Prévisionnels,-,"${estimatedIn30}","${estimatedIn60}","${estimatedIn90}"\n` +
      `Dettes & Décaissements Planifiés,-,"${debtsDue30 + fixedChargesPerMonth}","${debtsDue60 + fixedChargesPerMonth}","${debtsDue90 + fixedChargesPerMonth}"\n` +
      `Solde Net Projeté,"${totalAvailable}","${projectedBalance30}","${projectedBalance60}","${projectedBalance90}"\n\n` +
      `Créances Étudiantes Isolées Non Encaissées : "${totalStudentReceivables}" FCFA\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tresorerie_previsionnelle_${today}.csv`;
    link.click();
  };

  const getTreasuryReportData = (): TreasuryReportData => ({
    config,
    invoices,
    receipts,
    expenses,
    cashSession,
    totalAvailable,
    cashPhysical,
    availableBank,
    totalStudentReceivables,
    confirmedIn30,
    confirmedIn60,
    confirmedIn90,
    estimatedIn30,
    estimatedIn60,
    estimatedIn90,
    debtsDue30,
    debtsDue60,
    debtsDue90,
    fixedChargesPerMonth,
    projectedBalance30,
    projectedBalance60,
    projectedBalance90,
    minTreasuryThreshold,
    generatedBy: currentUser?.name || 'Modou Diouf',
  });

  const handleDownloadPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const data = getTreasuryReportData();
      const doc = generateTreasuryPDF(data);
      doc.save(`rapport_financier_tresorerie_ISMNM_${today}.pdf`);
      setDownloadSuccessToast(true);
      setTimeout(() => setDownloadSuccessToast(false), 4000);
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      alert('Une erreur est survenue lors de la génération du rapport PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast confirmation de téléchargement PDF */}
      {downloadSuccessToast && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Rapport financier officiel généré et téléchargé en PDF avec succès !</span>
          </div>
          <button onClick={() => setDownloadSuccessToast(false)} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Trésorerie & Projections Prévisionnelles
          </h1>
          <p className="text-xs text-slate-500">
            Pilotage financier à 30, 60 et 90 jours et isolation stricte des créances (Section 3.G)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton Principal Génération Rapport PDF */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Générer Rapport Financier PDF</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Téléchargement direct du PDF A4 certifié"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Télécharger PDF</span>
          </button>

          <button
            onClick={exportTreasuryCSV}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5"
            title="Export CSV pour tableur"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Available Cash & Isolation Banner (Section 3.G) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Available Immediately */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Trésorerie Disponible Immédiate (Caisse + Banques)
            </span>
            <Wallet className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold mt-2">{formatFCFA(totalAvailable)}</div>
          <div className="flex items-center space-x-4 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-700/60">
            <div>
              Caisse physique guichet : <strong className="text-white">{formatFCFA(cashPhysical)}</strong>
            </div>
            <div>•</div>
            <div>
              Comptes bancaires (CBAO / Ecobank) : <strong className="text-white">{formatFCFA(availableBank)}</strong>
            </div>
          </div>
        </div>

        {/* Isolated Student Receivables (Crucial Rule Section 3.G) */}
        <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>Créances Scolarité Isolées</span>
            </div>
            <div className="text-2xl font-bold text-amber-950 mt-2">
              {formatFCFA(totalStudentReceivables)}
            </div>
            <p className="text-[11px] text-amber-800 mt-2 leading-tight">
              Règle Section 3.G : ces créances <strong>ne sont pas comptabilisées</strong> dans le disponible immédiat tant qu elles ne sont pas encaissées.
            </p>
          </div>
          <div className="text-[10px] text-amber-700 font-semibold mt-2">
            À recouvrer auprès des familles
          </div>
        </div>
      </div>

      {/* Tension Alert Notification if below threshold */}
      {(hasTension30 || hasTension60 || hasTension90) && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-start space-x-3 text-xs text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Alerte Tension de Trésorerie Prévisionnelle</div>
            <p className="mt-0.5">
              Le solde projeté passe sous le seuil d alerte de sécurité configuré ({formatFCFA(minTreasuryThreshold)}).
              Accélérez les relances de recouvrement des échéances scolaires ou rééchelonnez les décaissements fournisseurs.
            </p>
          </div>
        </div>
      )}

      {/* Multi-Horizon Projections Table: 30, 60, 90 Days (Section 3.G) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tableau des Projections de Trésorerie à Court et Moyen Terme
            </h2>
            <p className="text-xs text-slate-500">
              Croisement des flux entrants confirmés/estimés et flux sortants planifiés
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">Seuil de réserve :</span>
            <input
              type="number"
              step="500000"
              value={minTreasuryThreshold}
              onChange={(e) => setMinTreasuryThreshold(Number(e.target.value))}
              className="w-32 px-2 py-1 border rounded text-xs font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Rubrique de Trésorerie</th>
                <th className="px-4 py-3 text-right">Aujourd hui</th>
                <th className="px-4 py-3 text-right">À 30 jours</th>
                <th className="px-4 py-3 text-right">À 60 jours</th>
                <th className="px-4 py-3 text-right">À 90 jours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  Solde Initial de Période
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {formatFCFA(totalAvailable)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 font-medium">
                  {formatFCFA(totalAvailable)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 font-medium">
                  {formatFCFA(projectedBalance30)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 font-medium">
                  {formatFCFA(projectedBalance60)}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 bg-emerald-50/20">
                <td className="px-4 py-3 text-emerald-800 font-medium">
                  + Encaissements futurs confirmés (échéanciers actifs)
                </td>
                <td className="px-4 py-3 text-right text-slate-400">-</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  +{formatFCFA(confirmedIn30)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  +{formatFCFA(confirmedIn60)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  +{formatFCFA(confirmedIn90)}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 bg-emerald-50/10">
                <td className="px-4 py-3 text-emerald-700">
                  + Encaissements prévisionnels (nouvelles admissions)
                </td>
                <td className="px-4 py-3 text-right text-slate-400">-</td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  +{formatFCFA(estimatedIn30)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  +{formatFCFA(estimatedIn60)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  +{formatFCFA(estimatedIn90)}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 bg-rose-50/20">
                <td className="px-4 py-3 text-rose-800 font-medium">
                  - Dettes fournisseurs arrivant à échéance
                </td>
                <td className="px-4 py-3 text-right text-slate-400">-</td>
                <td className="px-4 py-3 text-right font-semibold text-rose-700">
                  -{formatFCFA(debtsDue30)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-rose-700">
                  -{formatFCFA(debtsDue60)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-rose-700">
                  -{formatFCFA(debtsDue90)}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 bg-rose-50/10">
                <td className="px-4 py-3 text-rose-700">
                  - Salaires, loyers & charges d exploitation récurrentes
                </td>
                <td className="px-4 py-3 text-right text-slate-400">-</td>
                <td className="px-4 py-3 text-right text-rose-600">
                  -{formatFCFA(fixedChargesPerMonth)}
                </td>
                <td className="px-4 py-3 text-right text-rose-600">
                  -{formatFCFA(fixedChargesPerMonth)}
                </td>
                <td className="px-4 py-3 text-right text-rose-600">
                  -{formatFCFA(fixedChargesPerMonth)}
                </td>
              </tr>

              {/* PROJECTED NET BALANCE ROW */}
              <tr className="bg-slate-900 text-white font-bold text-sm">
                <td className="px-4 py-3">SOLDE NET PROJETÉ DE TRÉSORERIE</td>
                <td className="px-4 py-3 text-right text-indigo-300">{formatFCFA(totalAvailable)}</td>
                <td className={`px-4 py-3 text-right ${projectedBalance30 < minTreasuryThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatFCFA(projectedBalance30)}
                </td>
                <td className={`px-4 py-3 text-right ${projectedBalance60 < minTreasuryThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatFCFA(projectedBalance60)}
                </td>
                <td className={`px-4 py-3 text-right ${projectedBalance90 < minTreasuryThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatFCFA(projectedBalance90)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL RAPPORT FINANCIER PDF OFFICIEL */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold">Rapport Financier & Situation de Trésorerie</h2>
                  <p className="text-[11px] text-slate-400">Édition officielle conforme République du Sénégal • MESRI</p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Body (Preview style document A4) */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 bg-slate-50">
              {/* Document Paper Container */}
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 space-y-6">
                {/* Official Senegal & MESRI Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    RÉPUBLIQUE DU SÉNÉGAL
                  </div>
                  <div className="text-[11px] text-slate-500">Un Peuple - Un But - Une Foi</div>
                  <div className="text-[11px] font-semibold text-slate-700 uppercase">
                    MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L’INNOVATION
                  </div>
                  <h3 className="text-base font-bold text-slate-900 pt-1">
                    {config.name || 'INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT (ISMNM)'}
                  </h3>
                  <div className="text-[10px] text-slate-500">
                    Établissement Privé d’Enseignement Supérieur Agréé • Arrêté N° 004128/MESRI • NINEA : {config.ninea} • RC : {config.rc}
                  </div>
                </div>

                {/* Document Banner */}
                <div className="bg-slate-900 text-white p-3 rounded-lg text-center space-y-0.5">
                  <div className="font-bold text-sm tracking-wide">
                    RAPPORT DE TRÉSORERIE & PROJECTIONS FINANCIÈRES
                  </div>
                  <div className="text-[11px] text-indigo-200">
                    Exercice 2025-2026 • Document certifié édité le {new Date().toLocaleDateString('fr-FR')} par{' '}
                    <strong>{currentUser?.name || 'Modou Diouf'}</strong> (Administrateur & Direction Générale)
                  </div>
                </div>

                {/* 2 Synthesis Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase">
                      Trésorerie Disponible Immédiate (Encaissée)
                    </span>
                    <div className="text-2xl font-bold text-emerald-700">
                      {formatFCFA(totalAvailable)}
                    </div>
                    <div className="text-[11px] text-slate-600 pt-1 space-y-0.5">
                      <div>• Caisse physique guichet : <strong>{formatFCFA(cashPhysical)}</strong></div>
                      <div>• Soldes bancaires (CBAO / Ecobank) : <strong>{formatFCFA(availableBank)}</strong></div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-amber-900 uppercase">
                      Créances Scolarité Isolées (Section 3.G)
                    </span>
                    <div className="text-2xl font-bold text-amber-900">
                      {formatFCFA(totalStudentReceivables)}
                    </div>
                    <p className="text-[10.5px] text-amber-800 leading-tight pt-1">
                      Conformément à la règle de gestion Section 3.G, ces créances ne constituent pas de la trésorerie disponible tant qu’elles ne sont pas encaissées.
                    </p>
                  </div>
                </div>

                {/* Projections Table Preview */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>Tableau des Projections Multi-Horizons (30, 60 & 90 jours)</span>
                    <span className="text-slate-500 font-normal">Seuil de réserve : {formatFCFA(minTreasuryThreshold)}</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Rubrique</th>
                          <th className="px-3 py-2 text-right">Disponible</th>
                          <th className="px-3 py-2 text-right">+30 jours</th>
                          <th className="px-3 py-2 text-right">+60 jours</th>
                          <th className="px-3 py-2 text-right">+90 jours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-3 py-2 font-medium">Solde initial</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatFCFA(totalAvailable)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatFCFA(totalAvailable)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatFCFA(projectedBalance30)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatFCFA(projectedBalance60)}</td>
                        </tr>
                        <tr className="text-emerald-700 bg-emerald-50/20">
                          <td className="px-3 py-2">+ Encaissements confirmés</td>
                          <td className="px-3 py-2 text-right">-</td>
                          <td className="px-3 py-2 text-right font-medium">+{formatFCFA(confirmedIn30)}</td>
                          <td className="px-3 py-2 text-right font-medium">+{formatFCFA(confirmedIn60)}</td>
                          <td className="px-3 py-2 text-right font-medium">+{formatFCFA(confirmedIn90)}</td>
                        </tr>
                        <tr className="text-rose-700 bg-rose-50/20">
                          <td className="px-3 py-2">- Dettes & charges fixes</td>
                          <td className="px-3 py-2 text-right">-</td>
                          <td className="px-3 py-2 text-right font-medium">-{formatFCFA(debtsDue30 + fixedChargesPerMonth)}</td>
                          <td className="px-3 py-2 text-right font-medium">-{formatFCFA(debtsDue60 + fixedChargesPerMonth)}</td>
                          <td className="px-3 py-2 text-right font-medium">-{formatFCFA(debtsDue90 + fixedChargesPerMonth)}</td>
                        </tr>
                        <tr className="bg-slate-900 text-white font-bold">
                          <td className="px-3 py-2">Solde Net Projeté</td>
                          <td className="px-3 py-2 text-right text-indigo-300">{formatFCFA(totalAvailable)}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{formatFCFA(projectedBalance30)}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{formatFCFA(projectedBalance60)}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{formatFCFA(projectedBalance90)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signatures and Certification block */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-[11px]">
                  <div>
                    <div className="font-bold text-slate-900">Le Chef du Service Comptabilité & Finances</div>
                    <div className="text-slate-500 text-[10px]">Contrôle et visa des flux</div>
                    <div className="h-12 border-b border-dashed border-slate-300 flex items-end pb-1 text-[10px] text-slate-400">
                      [Visa & Signature]
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">L’Administrateur & Direction Générale</div>
                    <div className="text-slate-600 font-semibold text-[10px]">
                      {currentUser?.name || 'Modou Diouf'}
                    </div>
                    <div className="h-12 border-b border-dashed border-slate-300 flex items-end justify-end pb-1 text-[10px] text-slate-400">
                      [Signature & Sceau Officiel de l’Établissement]
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Format A4 paysage/portrait certifié conforme avec tables et signatures</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Télécharger le Fichier PDF (.pdf)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
