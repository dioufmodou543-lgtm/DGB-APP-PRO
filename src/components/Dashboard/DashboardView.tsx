import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  Layers,
  Library,
  PlayCircle,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatFCFA } from '../../services/currency';

type RubricTab = 'all' | 'administration' | 'pedagogie' | 'comptabilite';

export const DashboardView: React.FC = () => {
  const [activeRubric, setActiveRubric] = useState<RubricTab>('all');

  const {
    students,
    invoices,
    receipts,
    cashSession,
    expenses,
    programs,
    academicYears,
    diplomas,
    modules,
    timetables,
    attendance,
    grades,
    books,
    bookLoans,
    auditLogs,
    config,
    setIsPriorityFlowOpen,
    setActiveView,
    setSelectedStudentId,
  } = useApp();

  const { activeRole, currentUser } = useAuth();

  // ==========================================
  // METRICS: ADMINISTRATION
  // ==========================================
  const enrolledCount = students.filter((s) => s.status === 'inscrit').length;
  const candidatesCount = students.filter((s) => s.status === 'candidat' || s.status === 'admis').length;
  const totalDiplomasCount = diplomas.length;
  const issuedDiplomasCount = diplomas.filter((d) => d.status === 'delivre' || d.status === 'imprime').length;
  const totalBooksCount = books.length;
  const totalCopiesCount = books.reduce((sum, b) => sum + (b.totalCopies || 1), 0);
  const activeLoansCount = bookLoans.filter((l) => l.status === 'en_cours' || l.status === 'en_retard').length;
  const totalAuditLogsCount = auditLogs.length;

  // ==========================================
  // METRICS: PÉDAGOGIE
  // ==========================================
  const totalProgramsCount = programs.length;
  const accreditedProgramsCount = programs.filter((p) => p.isRegulatedCertified).length;
  const totalModulesCount = modules.length;
  const totalCreditsSum = modules.reduce((sum, m) => sum + (m.credits || 0), 0);
  const totalTimetableSlots = timetables.length;
  const totalAttendanceSessions = attendance.length;
  
  // Calculate average attendance rate
  const totalAttendeesCount = attendance.reduce((sum, a) => sum + a.attendees.length, 0);
  const presentAttendeesCount = attendance.reduce(
    (sum, a) => sum + a.attendees.filter((att) => att.status === 'present').length,
    0
  );
  const averageAttendanceRate = totalAttendeesCount > 0
    ? Math.round((presentAttendeesCount / totalAttendeesCount) * 100)
    : 95;

  const totalGradesCount = grades.length;
  const publishedGradesCount = grades.filter((g) => g.status === 'publie' || g.status === 'valide').length;

  // ==========================================
  // METRICS: COMPTABILITÉ
  // ==========================================
  const validReceipts = receipts.filter((r) => r.status === 'valide');
  const totalCollected = validReceipts.reduce((sum, r) => sum + r.amount, 0);

  const totalReceivables = invoices
    .filter((i) => i.balanceDue > 0)
    .reduce((sum, i) => sum + i.balanceDue, 0);

  const overdueInvoices = invoices.filter(
    (i) => i.status === 'en_retard' || (i.balanceDue > 0 && i.dueDate < new Date().toISOString().split('T')[0])
  );
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  const activeCash = cashSession.status === 'ouverte' ? cashSession.theoreticalBalance : 0;
  const initialBank = 5000000;
  const bankIn = validReceipts.filter((r) => r.paymentMethod !== 'especes').reduce((sum, r) => sum + r.amount, 0);
  const bankOut = expenses
    .filter((e) => e.stage === 'decaissement_realise' && e.paymentMethod !== 'especes')
    .reduce((sum, e) => sum + e.paidAmount, 0);
  const totalAvailable = activeCash + initialBank + bankIn - bankOut;

  const vendorDebts = expenses
    .filter((e) => e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne')
    .reduce((sum, e) => sum + (e.amount - e.paidAmount), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Welcome with Quick Launch */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Tableau de Bord Institutionnel</span>
            <span>•</span>
            <span>Session {activeRole.toUpperCase()}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Bienvenue, {currentUser.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Organisation générale structurée en <strong className="text-emerald-300">3 rubriques clés</strong> : Administration, Pédagogie et Comptabilité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeRole === 'enseignant' && (
            <button
              onClick={() => setActiveView('teacher_portal')}
              className="px-3.5 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-slate-950" />
              <span>Mon Portail Enseignant</span>
            </button>
          )}
          <button
            onClick={() => setIsPriorityFlowOpen(true)}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Parcours Prioritaire (1 à 9)</span>
          </button>
        </div>
      </div>

      {/* Navigation / Rubric Filter Switcher */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveRubric('all')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRubric === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vue Globale (3 Rubriques)</span>
          </button>

          <button
            onClick={() => setActiveRubric('administration')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRubric === 'administration'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700" />
            <span>1. ADMINISTRATION</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                activeRubric === 'administration' ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800'
              }`}
            >
              5 Éléments
            </span>
          </button>

          <button
            onClick={() => setActiveRubric('pedagogie')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRubric === 'pedagogie'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-700" />
            <span>2. PÉDAGOGIE</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                activeRubric === 'pedagogie' ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              4 Éléments
            </span>
          </button>

          <button
            onClick={() => setActiveRubric('comptabilite')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeRubric === 'comptabilite'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-700" />
            <span>3. COMPTABILITÉ</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                activeRubric === 'comptabilite' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              5 Éléments
            </span>
          </button>
        </div>
      </div>

      {/* Executive Summary Triad Cards (Always visible or in 'all') */}
      {(activeRubric === 'all') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Synthese Administration */}
          <div
            onClick={() => setActiveRubric('administration')}
            className="bg-white border-2 border-blue-200 hover:border-blue-400 p-4 rounded-2xl shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rubrique 1</h2>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    ADMINISTRATION
                  </h3>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Effectif Inscrits</span>
                <span className="text-base font-bold text-slate-900">{enrolledCount} étudiants</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Diplômes Sécurisés</span>
                <span className="text-base font-bold text-blue-700">{issuedDiplomasCount} délivrés</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{totalBooksCount} titres bibliothèque</span>
              <span>{totalAuditLogsCount} logs d'audit</span>
            </div>
          </div>

          {/* Card 2: Synthese Pedagogie */}
          <div
            onClick={() => setActiveRubric('pedagogie')}
            className="bg-white border-2 border-indigo-200 hover:border-indigo-400 p-4 rounded-2xl shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rubrique 2</h2>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    PÉDAGOGIE
                  </h3>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Filières LMD</span>
                <span className="text-base font-bold text-slate-900">{totalProgramsCount} maquettes</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Taux d'Assiduité</span>
                <span className="text-base font-bold text-indigo-700">{averageAttendanceRate}% moyen</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{totalTimetableSlots} créneaux planning</span>
              <span>{totalModulesCount} modules UE</span>
            </div>
          </div>

          {/* Card 3: Synthese Comptabilite */}
          <div
            onClick={() => setActiveRubric('comptabilite')}
            className="bg-white border-2 border-emerald-200 hover:border-emerald-400 p-4 rounded-2xl shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rubrique 3</h2>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    COMPTABILITÉ
                  </h3>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Total Encaissé</span>
                <span className="text-sm font-bold text-emerald-700 truncate block">{formatFCFA(totalCollected)}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Trésorerie Nette</span>
                <span className="text-sm font-bold text-slate-900 truncate block">{formatFCFA(totalAvailable)}</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="text-amber-700 font-medium">Créances : {formatFCFA(totalReceivables)}</span>
              <span>Caisse : {formatFCFA(activeCash)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. RUBRIQUE : ADMINISTRATION                                              */}
      {/* ========================================================================= */}
      {(activeRubric === 'all' || activeRubric === 'administration') && (
        <section className="bg-slate-50/70 border-2 border-blue-200/90 rounded-2xl p-5 sm:p-6 space-y-6">
          {/* Header Rubrique Administration */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                    RUBRIQUE 1
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    ADMINISTRATION GÉNÉRALE & SCOLARITÉ
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Gestion des dossiers d'étudiants, admissions, délivrance des diplômes d'État, fonds documentaire et audit de conformité.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('students')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Nouveau Dossier Étudiant</span>
              </button>
            </div>
          </div>

          {/* KPIs Administration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => setActiveView('students')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Étudiants Inscrits</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{enrolledCount}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
                <span className="text-blue-600 font-semibold">+{candidatesCount}</span>
                <span>candidats & admis en attente</span>
              </div>
            </div>

            <div
              onClick={() => setActiveView('diplomas')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Diplômes & Parchemins</span>
                <FileCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{issuedDiplomasCount}</div>
              <div className="text-xs text-emerald-600 font-medium mt-1">
                {totalDiplomasCount} parchemins enregistrés
              </div>
            </div>

            <div
              onClick={() => setActiveView('library')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Bibliothèque & Prêts</span>
                <Library className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalCopiesCount}</div>
              <div className="text-xs text-slate-500 mt-1">
                {totalBooksCount} titres • <span className="text-amber-600 font-semibold">{activeLoansCount} emprunts en cours</span>
              </div>
            </div>

            <div
              onClick={() => setActiveView('audit')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Journal d'Audit</span>
                <History className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalAuditLogsCount}</div>
              <div className="text-xs text-slate-500 mt-1">
                Événements tracés (GMT Dakar)
              </div>
            </div>
          </div>

          {/* Elements classés sous Administration */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-2">
              <span>Éléments et Modules Classés sous ADMINISTRATION (5)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Element 1: Dossiers & Inscriptions */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Dossiers & Inscriptions</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gestion des pièces d'identité, candidatures, matricules et fiches individuelles.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-blue-50/50 rounded-lg text-[11px] text-blue-900 font-medium">
                    {enrolledCount} inscrits • {candidatesCount} candidats
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('students')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Ouvrir les Dossiers</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 2: Diplomes & Attestations */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Diplômes & Attestations</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Attestations de réussite, parchemins officiels avec numérotation et jeton QR anti-fraude.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-blue-50/50 rounded-lg text-[11px] text-blue-900 font-medium">
                    {issuedDiplomasCount} délivrés • Sécurité certifiée
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('diplomas')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Gérer les Diplômes</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 3: Bibliotheque */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <Library className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Bibliothèque & Prêts</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fonds documentaire universitaire, suivi des exemplaires disponibles et fiches de prêts.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-blue-50/50 rounded-lg text-[11px] text-blue-900 font-medium">
                    {totalCopiesCount} ouvrages • {activeLoansCount} emprunts
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('library')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Voir la Bibliothèque</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 4: Journal d'Audit */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <History className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Journal d'Audit</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Traçabilité de chaque action administrative, modification financière et suppression.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-blue-50/50 rounded-lg text-[11px] text-blue-900 font-medium">
                    {totalAuditLogsCount} logs archivés et vérifiés
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('audit')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Historique d'Audit</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 5: Parametrage Etablissement */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <Settings className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Paramétrage Établissement</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Régulation NINEA, Registre Commerce, sites de campus et clôture des années académiques.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-blue-50/50 rounded-lg text-[11px] text-blue-900 font-medium">
                    {config.acronym} Dakar • {academicYears.length} Années
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('settings')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Configurer</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Operational highlight Administration: Recent Students */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase">Derniers Dossiers Étudiants Enregistrés</h4>
              </div>
              <button
                onClick={() => setActiveView('students')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
              >
                <span>Voir la liste complète</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {students.slice(0, 4).map((st) => (
                <div key={st.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-2xs uppercase">
                      {st.firstName[0]}
                      {st.lastName[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {st.firstName} {st.lastName}
                        <span className="ml-2 font-mono text-slate-400 font-normal">{st.matricule}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Nationalité: {st.nationality} • Dossier déposé le {st.submissionDate}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        st.status === 'inscrit'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : st.status === 'admis'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {st.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. RUBRIQUE : PÉDAGOGIE                                                   */}
      {/* ========================================================================= */}
      {(activeRubric === 'all' || activeRubric === 'pedagogie') && (
        <section className="bg-slate-50/70 border-2 border-indigo-200/90 rounded-2xl p-5 sm:p-6 space-y-6">
          {/* Header Rubrique Pedagogie */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                    RUBRIQUE 2
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    PÉDAGOGIE, PROGRAMMES & ENSEIGNEMENT
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Maquettes académiques LMD, emplois du temps hebdomadaires, suivi numérique des présences et relevés de notes.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('pedagogie')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Emploi du Temps Hebdomadaire</span>
              </button>
            </div>
          </div>

          {/* KPIs Pedagogie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => setActiveView('pedagogie')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Filières & Maquettes</span>
                <GraduationCap className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalProgramsCount}</div>
              <div className="text-xs text-indigo-600 font-medium mt-1">
                {accreditedProgramsCount} homologuées MESRI Sénégal
              </div>
            </div>

            <div
              onClick={() => setActiveView('pedagogie')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Créneaux Planning</span>
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalTimetableSlots}</div>
              <div className="text-xs text-slate-500 mt-1">
                Cours, TD/TP et examens programmés
              </div>
            </div>

            <div
              onClick={() => setActiveView('attendance')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Taux de Présence Moyen</span>
                <CalendarCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-900 mt-2">{averageAttendanceRate}%</div>
              <div className="text-xs text-slate-500 mt-1">
                Sur {totalAttendanceSessions} séances émargées
              </div>
            </div>

            <div
              onClick={() => setActiveView('grades')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Évaluations & Notes</span>
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalGradesCount}</div>
              <div className="text-xs text-slate-500 mt-1">
                {publishedGradesCount} notes validées et publiées
              </div>
            </div>
          </div>

          {/* Elements classés sous Pedagogie */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-2">
              <span>Éléments et Modules Classés sous PÉDAGOGIE (4)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Element 1: Espace Enseignant */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Espace & Portail Enseignant</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Guichet dédié au corps professoral : emploi du temps personnel, émargement des séances et saisie des notes.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-indigo-50/50 rounded-lg text-[11px] text-indigo-900 font-medium">
                    Accès rapide enseignants • Mode hors-ligne actif
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('teacher_portal')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Accéder au Portail</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 2: Filières, Programmes & Emploi du temps */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2.5">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Filières & Emplois du Temps</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Structure LMD (Licence/Master), semestres, crédits ECTS, amphis et calendrier hebdomadaire interactif.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-indigo-50/50 rounded-lg text-[11px] text-indigo-900 font-medium">
                    {totalProgramsCount} programmes • {totalTimetableSlots} créneaux
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('pedagogy')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Gérer les Filières</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 3: Suivi des Présences */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2.5">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Suivi des Présences & Émargements</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Émargement numérique des séances de cours, contrôle des retards et justificatifs d'absences.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-indigo-50/50 rounded-lg text-[11px] text-indigo-900 font-medium">
                    {totalAttendanceSessions} feuilles • {averageAttendanceRate}% d'assiduité
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('attendance')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Consulter les Présences</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 4: Notes & Relevés */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2.5">
                    <Award className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Notes & Relevés Semestriels</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Saisie du contrôle continu, examens terminaux, pondérations et génération des relevés académiques.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-indigo-50/50 rounded-lg text-[11px] text-indigo-900 font-medium">
                    {totalGradesCount} notes • {totalCreditsSum} crédits UE
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('grades')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Relevés de Notes</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Operational highlight Pedagogie: Next timetable slots */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase">Créneaux d'Enseignement Programmés</h4>
              </div>
              <button
                onClick={() => setActiveView('pedagogy')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1"
              >
                <span>Planning complet</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {timetables.slice(0, 3).map((slot) => {
                const program = programs.find((p) => p.id === slot.programId);
                const module = modules.find((m) => m.id === slot.moduleId);
                return (
                  <div key={slot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-2xs text-slate-500 font-bold uppercase mb-1">
                      <span>{slot.dayOfWeek}</span>
                      <span className="font-mono bg-indigo-100 text-indigo-900 px-1.5 py-0.2 rounded">
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {module ? module.moduleTitle : 'Module d\'enseignement'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Salle : <strong className="text-slate-700">{slot.room}</strong> • {program?.code}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. RUBRIQUE : COMPTABILITÉ                                                */}
      {/* ========================================================================= */}
      {(activeRubric === 'all' || activeRubric === 'comptabilite') && (
        <section className="bg-slate-50/70 border-2 border-emerald-200/90 rounded-2xl p-5 sm:p-6 space-y-6">
          {/* Header Rubrique Comptabilite */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    RUBRIQUE 3
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    COMPTABILITÉ, FINANCE & CAISSE FCFA
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Facturation des frais de scolarité, encaissements certifiés multi-canaux, caisse guichet, dépenses et trésorerie.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('payments')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Encaisser un Règlement</span>
              </button>
            </div>
          </div>

          {/* KPIs Comptabilite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => setActiveView('payments')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Total Encaissé</span>
                <Receipt className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{formatFCFA(totalCollected)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {validReceipts.length} règlements certifiés conformes
              </div>
            </div>

            <div
              onClick={() => setActiveView('invoices')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Créances Scolarité</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-2">{formatFCFA(totalReceivables)}</div>
              <div className="text-xs text-rose-600 font-medium mt-1">
                Dont {formatFCFA(totalOverdue)} en retard
              </div>
            </div>

            <div
              onClick={() => setActiveView('cash')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Caisse Guichet</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{formatFCFA(activeCash)}</div>
              <div className="text-xs text-slate-500 mt-1">
                Session {cashSession.sessionNumber} ({cashSession.status})
              </div>
            </div>

            <div
              onClick={() => setActiveView('treasury')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Trésorerie Disponible</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-950 mt-2">{formatFCFA(totalAvailable)}</div>
              <div className="text-xs text-slate-500 mt-1">
                Banques + Caisse espèces
              </div>
            </div>
          </div>

          {/* Elements classés sous Comptabilite */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-2">
              <span>Éléments et Modules Classés sous COMPTABILITÉ (5)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Element 1: Facturation & Echeanciers */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Facturation & Échéanciers</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Génération des frais d'inscription, mensualités, bourses et suivi des soldes dus.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-emerald-50/50 rounded-lg text-[11px] text-emerald-900 font-medium">
                    {invoices.length} échéances • {formatFCFA(totalReceivables)} dus
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('invoices')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Voir Échéanciers</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 2: Paiements & Recus */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Paiements & Reçus</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Encaissements certifiés Wave, Orange Money, Espèces, Virements et reçus infalsifiables.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-emerald-50/50 rounded-lg text-[11px] text-emerald-900 font-medium">
                    {validReceipts.length} reçus • {formatFCFA(totalCollected)}
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('payments')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Gérer Règlements</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 3: Gestion de Caisse */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Gestion de Caisse Guichet</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fond de caisse, entrées/sorties physiques, comptage des billets et clôture journalière.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-emerald-50/50 rounded-lg text-[11px] text-emerald-900 font-medium">
                    Session {cashSession.sessionNumber} : {formatFCFA(activeCash)}
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('cash')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Clôturer / Caisse</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 4: Depenses & Fournisseurs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Dépenses & Fournisseurs</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Engagements, vacations d'enseignants, factures fournisseurs et ordonnancement.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-emerald-50/50 rounded-lg text-[11px] text-emerald-900 font-medium">
                    {expenses.length} dépenses • {formatFCFA(vendorDebts)} dettes
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('expenses')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Suivre Dépenses</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Element 5: Tresorerie & Projections */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Trésorerie & Projections</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Soldes bancaires consolidés, échéancier prévisionnel à 30 jours et seuils d'alerte.
                  </p>
                  <div className="mt-3 py-1.5 px-2 bg-emerald-50/50 rounded-lg text-[11px] text-emerald-900 font-medium">
                    Disponible : {formatFCFA(totalAvailable)}
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('treasury')}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Voir Trésorerie</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Operational highlight Comptabilite: Recent Receipts & Cash control */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Derniers règlements certifiés */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase">Derniers Encaissements Réalisés</h4>
                  <p className="text-[11px] text-slate-500">Reçus conformes (Wave, Orange Money, Espèces, Banques)</p>
                </div>
                <button
                  onClick={() => setActiveView('payments')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center space-x-1"
                >
                  <span>Voir tous les reçus</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {receipts.slice(0, 4).map((rec) => {
                  const student = students.find((s) => s.id === rec.studentId);
                  return (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-[11px] uppercase">
                          {rec.paymentMethod.substring(0, 3)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {student ? `${student.firstName} ${student.lastName}` : 'Étudiant'}
                            <span className="ml-2 font-mono text-slate-400 font-normal">{rec.receiptNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rec.paymentDate} • Par {rec.recordedBy ? rec.recordedBy.split('(')[0] : 'Caissier'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-700 text-xs sm:text-sm">{formatFCFA(rec.amount)}</div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Certifié
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: État de Caisse Guichet */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase">État de la Caisse Guichet</h4>
                <p className="text-[11px] text-slate-500">Contrôle du solde théorique de caisse</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Session</span>
                  <span className="font-mono font-bold text-slate-900">{cashSession.sessionNumber}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Statut</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded">
                    {cashSession.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Entrées espèces</span>
                  <span className="text-emerald-700 font-semibold">+{formatFCFA(cashSession.totalCashIn)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Sorties espèces</span>
                  <span className="text-rose-600 font-semibold">-{formatFCFA(cashSession.totalCashOut)}</span>
                </div>
                <div className="flex items-center justify-between font-bold pt-1.5 border-t border-slate-200 text-slate-900">
                  <span>Solde théorique</span>
                  <span className="text-emerald-700 font-bold">{formatFCFA(cashSession.theoreticalBalance)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setActiveView('cash')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Gérer la Caisse Guichet</span>
                </button>
                <button
                  onClick={() => setActiveView('expenses')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Engager une Dépense Fournisseur</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
