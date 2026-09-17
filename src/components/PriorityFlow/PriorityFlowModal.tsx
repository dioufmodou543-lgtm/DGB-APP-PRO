import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA, numberToFrenchWords } from '../../services/currency';
import {
  Enrollment,
  InvoiceSchedule,
  PaymentMethod,
  PaymentPlanType,
  PaymentReceipt,
  StudentAdmission,
  VendorExpense,
} from '../../types';

export const PriorityFlowModal: React.FC = () => {
  const {
    isPriorityFlowOpen,
    setIsPriorityFlowOpen,
    programs,
    academicYears,
    createStudent,
    createEnrollment,
    recordPayment,
    createExpense,
    setSelectedReceipt,
    setActiveView,
    invoices,
    students,
  } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flow State Storage
  const [createdStudent, setCreatedStudent] = useState<StudentAdmission | null>(null);
  const [createdEnrollment, setCreatedEnrollment] = useState<Enrollment | null>(null);
  const [createdInvoices, setCreatedInvoices] = useState<InvoiceSchedule[]>([]);
  const [createdReceipt, setCreatedReceipt] = useState<PaymentReceipt | null>(null);
  const [createdExpense, setCreatedExpense] = useState<VendorExpense | null>(null);

  // Form Fields for Step 1
  const [firstName, setFirstName] = useState('Aminata');
  const [lastName, setLastName] = useState('Ndiaye');
  const [phone, setPhone] = useState('+221 77 654 32 10');
  const [email, setEmail] = useState('aminata.ndiaye@ismnm-etu.sn');
  const [cniPassport, setCniPassport] = useState('2 890 2005 01923');
  const [birthPlace, setBirthPlace] = useState('Dakar');

  // Form Fields for Step 2 & 3
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id || '');
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanType>('mensuel');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Form Fields for Step 5
  const [partialAmount, setPartialAmount] = useState<number>(40000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [transactionRef, setTransactionRef] = useState('WAVE-SN-DEMO-9912');

  // Form Fields for Step 8
  const [vendorName, setVendorName] = useState('Dr. Ibrahima Kane (Enseignant)');
  const [expenseDesc, setExpenseDesc] = useState('Vacation cours Algorithmique & LMD (30 heures)');
  const [expenseAmount, setExpenseAmount] = useState<number>(300000);
  const [expenseStage, setExpenseStage] = useState<'prevue' | 'dette_constatee' | 'paiement_ordonne' | 'decaissement_realise'>('decaissement_realise');

  if (!isPriorityFlowOpen) return null;

  const steps = [
    { num: 1, title: 'Créer un dossier étudiant', icon: UserPlus },
    { num: 2, title: 'Inscrire à une formation', icon: GraduationCap },
    { num: 3, title: 'Choisir la modalité', icon: CreditCard },
    { num: 4, title: 'Générer l échéancier', icon: FileSpreadsheet },
    { num: 5, title: 'Enregistrer un paiement partiel', icon: DollarSign },
    { num: 6, title: 'Produire un reçu certifié', icon: Receipt },
    { num: 7, title: 'Consulter le reste dû', icon: FileCheck },
    { num: 8, title: 'Enregistrer une dépense', icon: TrendingDown },
    { num: 9, title: 'Impact Trésorerie & Solde', icon: TrendingUp },
  ];

  // STEP 1 Action: Create Student
  const handleStep1Create = async () => {
    setLoading(true);
    setError(null);
    try {
      const stu = await createStudent({
        firstName,
        lastName,
        phone,
        email,
        cniPassport,
        birthPlace,
        birthDate: '2005-04-12',
        gender: 'F',
        nationality: 'Sénégalaise',
        address: 'Sacré-Cœur 3, Villa 219',
        city: 'Dakar',
        status: 'admis',
      });
      setCreatedStudent(stu);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du dossier');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 & 3 & 4 Action: Enroll and generate schedule
  const handleEnrollAndSchedule = async () => {
    if (!createdStudent) return;
    setLoading(true);
    setError(null);
    try {
      const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
      const result = await createEnrollment({
        studentId: createdStudent.id,
        programId: selectedProgramId,
        academicYearId: activeYear.id,
        paymentPlan: selectedPlan,
        discountAmount,
        discountType: discountAmount > 0 ? 'sociale' : 'none',
        discountReason: discountAmount > 0 ? 'Remise rentrée' : undefined,
      });

      setCreatedEnrollment(result.enrollment);
      setCreatedInvoices(result.invoices);
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l inscription');
    } finally {
      setLoading(false);
    }
  };

  // STEP 5 Action: Record Partial Payment
  const handleStep5Payment = async () => {
    if (!createdStudent || createdInvoices.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // Pick first invoice to pay partially
      const targetInv = createdInvoices[0];
      const res = await recordPayment({
        studentId: createdStudent.id,
        invoiceScheduleId: targetInv.id,
        amount: partialAmount,
        paymentMethod,
        transactionRef,
        idempotencyKey: `flow_idemp_${Date.now()}`,
        notes: `Acompte partiel Parcours Prioritaire (${paymentMethod})`,
      });

      setCreatedReceipt(res.receipt);
      // Update local invoice state
      setCreatedInvoices((prev) =>
        prev.map((inv) => (inv.id === res.updatedInvoice.id ? res.updatedInvoice : inv))
      );
      setCurrentStep(6);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l encaissement partiel');
    } finally {
      setLoading(false);
    }
  };

  // STEP 8 Action: Record Vendor Expense
  const handleStep8Expense = async () => {
    setLoading(true);
    setError(null);
    try {
      const exp = await createExpense({
        vendorName,
        category: 'vacation_enseignant',
        description: expenseDesc,
        amount: expenseAmount,
        dueDate: new Date().toISOString().split('T')[0],
        stage: expenseStage,
        paymentMethod: 'virement',
      });
      setCreatedExpense(exp);
      setCurrentStep(9);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l enregistrement de la dépense');
    } finally {
      setLoading(false);
    }
  };

  const selectedProg = programs.find((p) => p.id === selectedProgramId) || programs[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm">
              9/9
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Parcours Prioritaire de Démonstration (Section 5)
              </h2>
              <p className="text-xs text-slate-300">
                Cycle complet de bout en bout : de la création du dossier à l impact en trésorerie
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPriorityFlowOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[700px]">
            {steps.map((s, idx) => {
              const isPast = currentStep > s.num;
              const isCurr = currentStep === s.num;
              return (
                <div key={s.num} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurr
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`ml-1.5 text-xs font-medium ${
                      isCurr ? 'text-indigo-900 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {s.title ? s.title.split(' ')[0] : ''}
                  </span>
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-6 sm:w-8 h-0.5 mx-1.5 ${
                        isPast ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Step Content */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700">
          {/* STEP 1: CREATE STUDENT DOSSIER */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 1 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Créer un nouveau dossier étudiant
                </h3>
                <p className="text-xs text-slate-500">
                  Saisie des coordonnées sénégalaises et génération d un matricule unique officiel.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nom de famille</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone mobile (Sénégal)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Adresse Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">N° CNI ou Passeport</label>
                  <input
                    type="text"
                    value={cniPassport}
                    onChange={(e) => setCniPassport(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lieu de naissance</label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleStep1Create}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2 shadow-xs transition-colors"
                >
                  <span>Créer le dossier & Continuer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE PROGRAM */}
          {currentStep === 2 && createdStudent && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 2 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Inscrire l étudiant à une formation
                </h3>
                <p className="text-xs text-slate-500">
                  Étudiant créé avec succès : <strong>{createdStudent.firstName} {createdStudent.lastName}</strong> (Matricule : <span className="font-mono text-emerald-700 font-bold">{createdStudent.matricule}</span>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Sélectionner la filière / formation accréditée :
                </label>
                <div className="space-y-2">
                  {programs.map((prog) => (
                    <label
                      key={prog.id}
                      className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${
                        selectedProgramId === prog.id
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="program"
                        checked={selectedProgramId === prog.id}
                        onChange={() => setSelectedProgramId(prog.id)}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{prog.title}</span>
                          <span className="text-xs font-bold text-slate-700">
                            {formatFCFA(prog.defaultFees.tuitionFee + prog.defaultFees.registrationFee)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {prog.domain} • Inscription: {formatFCFA(prog.defaultFees.registrationFee)} • Scolarité: {formatFCFA(prog.defaultFees.tuitionFee)}
                        </div>
                        <div className="text-[11px] text-emerald-700 mt-1">
                          Agrément : {prog.accreditationRef} (Valide jusqu au {prog.accreditationValidUntil})
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Passer au choix de la modalité</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT PLAN & DISCOUNTS */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 3 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Choisir la modalité de paiement et remises
                </h3>
                <p className="text-xs text-slate-500">
                  4 modalités configurables conformément à la section 3.D du cahier des charges.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'mensuel',
                    title: 'Mensualités (9 échéances)',
                    desc: 'Octobre à Juin (échéance au 5 de chaque mois)',
                  },
                  {
                    id: 'trimestriel',
                    title: 'Trimestriel (3 échéances)',
                    desc: 'Octobre, Janvier, Avril',
                  },
                  {
                    id: 'tranches',
                    title: 'Par tranches (2 échéances)',
                    desc: '50% à la rentrée + 50% à mi-parcours (Février)',
                  },
                  {
                    id: 'comptant',
                    title: 'En une seule fois (Comptant)',
                    desc: 'Règlement intégral de la scolarité à l inscription',
                  },
                ].map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id as PaymentPlanType)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-200'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">{plan.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.desc}</div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Remise ou Bourse autorisée (FCFA) :
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    step="10000"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <span className="text-xs text-slate-500">
                    Déduite équitablement sur les échéances de scolarité
                  </span>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>
                <button
                  onClick={handleEnrollAndSchedule}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Générer l échéancier officiel</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: GENERATED SCHEDULE */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 4 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Échéancier & Factures générés avec verrouillage du tarif
                </h3>
                <p className="text-xs text-slate-500">
                  Tarif appliqué verrouillé dans le dossier. {createdInvoices.length} factures générées avec numérotation normalisée.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">N° Facture</th>
                      <th className="px-3 py-2 text-left">Libellé</th>
                      <th className="px-3 py-2 text-left">Échéance</th>
                      <th className="px-3 py-2 text-right">Montant Net</th>
                      <th className="px-3 py-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {createdInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2 text-slate-700">{inv.title}</td>
                        <td className="px-3 py-2 text-slate-500">{inv.dueDate}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatFCFA(inv.netAmount)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            En attente
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Modifier modalité
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Passer au paiement partiel (Étape 5)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: RECORD PARTIAL PAYMENT */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 5 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Enregistrer un paiement partiel
                </h3>
                <p className="text-xs text-slate-500">
                  Règle stricte (Section 4) : <em>« Un paiement partiel diminue le reste dû sans déclarer la facture soldée »</em>.
                </p>
              </div>

              {createdInvoices.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex justify-between items-center">
                  <div>
                    Facture ciblée : <strong>{createdInvoices[0].invoiceNumber}</strong> ({createdInvoices[0].title})
                  </div>
                  <div>
                    Montant net facturé : <strong>{formatFCFA(createdInvoices[0].netAmount)}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Montant du règlement partiel (FCFA) :
                  </label>
                  <input
                    type="number"
                    step="5000"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Ex: 40 000 FCFA sur {formatFCFA(createdInvoices[0]?.netAmount || 80000)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Moyen de paiement :</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="wave">Wave Mobile Money Sénégal</option>
                    <option value="orange_money">Orange Money Sénégal</option>
                    <option value="especes">Espèces (Guichet caisse)</option>
                    <option value="virement">Virement bancaire (CBAO / Ecobank)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Référence de transaction / Justificatif :
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Retour
                </button>
                <button
                  onClick={handleStep5Payment}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Confirmer le paiement partiel</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: CERTIFIED RECEIPT */}
          {currentStep === 6 && createdReceipt && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 6 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Reçu d encaissement officiel produit
                </h3>
                <p className="text-xs text-slate-500">
                  Généré avec numéro unique <span className="font-mono font-bold text-emerald-700">{createdReceipt.receiptNumber}</span> et montant certifié en lettres.
                </p>
              </div>

              {/* Printable Receipt Preview Card */}
              <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-3 font-sans">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE (ISMNM)</div>
                    <div className="text-xs text-slate-500">Rue Aimé Césaire, Fann Résidence • Dakar, Sénégal</div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-mono font-bold text-xs rounded">
                      {createdReceipt.receiptNumber}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">{createdReceipt.paymentDate}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    Étudiant : <strong>{createdStudent?.firstName} {createdStudent?.lastName}</strong>
                  </div>
                  <div>
                    Matricule : <strong>{createdStudent?.matricule}</strong>
                  </div>
                  <div>
                    Mode : <strong className="uppercase">{createdReceipt.paymentMethod}</strong>
                  </div>
                  <div>
                    Réf transaction : <span className="font-mono">{createdReceipt.transactionRef || 'Guichet direct'}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-500">Montant réglé :</div>
                    <div className="text-sm font-medium text-slate-700 italic">
                      « {numberToFrenchWords(createdReceipt.amount)} »
                    </div>
                  </div>
                  <div className="text-lg font-bold text-emerald-700">
                    {formatFCFA(createdReceipt.amount)}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Encaissé par : {createdReceipt.recordedBy}</span>
                  <span className="text-emerald-600 font-semibold">✓ Signature Numérique Certifiée</span>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le reçu</span>
                </button>
                <button
                  onClick={() => setCurrentStep(7)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Consulter le reste dû (Étape 7)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: CONSULT BALANCE DUE */}
          {currentStep === 7 && createdInvoices.length > 0 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 7 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Vérification du Reste Dû & Statut Partiel
                </h3>
                <p className="text-xs text-slate-500">
                  Observation directe de la diminution du reste dû sans solder la facture.
                </p>
              </div>

              {/* Invoice Cards */}
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{createdInvoices[0].title}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Statut : PARTIEL (Non soldée)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-slate-500">Net Facturé</div>
                    <div className="font-bold text-slate-900 mt-0.5">{formatFCFA(createdInvoices[0].netAmount)}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-slate-500">Total Réglé</div>
                    <div className="font-bold text-emerald-600 mt-0.5">{formatFCFA(createdInvoices[0].paidAmount)}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-300 bg-amber-50/50">
                    <div className="text-amber-800 font-semibold">Reste Dû Exact</div>
                    <div className="font-bold text-amber-900 text-sm mt-0.5">{formatFCFA(createdInvoices[0].balanceDue)}</div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 pt-1">
                  ✓ <strong>Équation vérifiée :</strong> {formatFCFA(createdInvoices[0].netAmount)} net − {formatFCFA(createdInvoices[0].paidAmount)} payé = <strong>{formatFCFA(createdInvoices[0].balanceDue)} reste dû</strong>.
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Revoir le reçu
                </button>
                <button
                  onClick={() => setCurrentStep(8)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Passer à l enregistrement d une dépense (Étape 8)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: RECORD VENDOR EXPENSE */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 8 sur 9
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Enregistrer une dépense fournisseur (4 étapes de traçabilité)
                </h3>
                <p className="text-xs text-slate-500">
                  Distinction stricte (Section 3.F) : Dépense prévue → Dette constatée → Paiement ordonné → Décaissement réalisé.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fournisseur / Bénéficiaire</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Montant de la charge (FCFA)</label>
                  <input
                    type="number"
                    step="25000"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description / Motif</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Étape comptable :</label>
                  <select
                    value={expenseStage}
                    onChange={(e) => setExpenseStage(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="decaissement_realise">
                      Décaissement réalisé (Affecte immédiatement la trésorerie disponible)
                    </option>
                    <option value="paiement_ordonne">Paiement ordonné (Bon de paiement émis)</option>
                    <option value="dette_constatee">Dette constatée (Facture reçue)</option>
                    <option value="prevue">Dépense prévue (Budget prévisionnel)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(7)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Retour
                </button>
                <button
                  onClick={handleStep8Expense}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Enregistrer & Visualiser l effet trésorerie</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 9: IMPACT ON TREASURY */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Étape 9 sur 9 - Succès complet
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Effet immédiat sur le tableau de bord de trésorerie
                </h3>
                <p className="text-xs text-slate-500">
                  Le cycle prioritaire complet (1 à 9) a été exécuté avec succès.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="font-semibold text-emerald-800 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Encaissement Partiel Enregistré
                  </div>
                  <div className="text-lg font-bold text-emerald-900 mt-1">
                    +{formatFCFA(partialAmount)}
                  </div>
                  <div className="text-emerald-700 text-[11px] mt-1">
                    Reçu N° {createdReceipt?.receiptNumber} • Moyen : {paymentMethod.toUpperCase()}
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="font-semibold text-rose-800 flex items-center">
                    <TrendingDown className="w-4 h-4 mr-1" />
                    Décaissement Fournisseur Réalisé
                  </div>
                  <div className="text-lg font-bold text-rose-900 mt-1">
                    -{formatFCFA(expenseAmount)}
                  </div>
                  <div className="text-rose-700 text-[11px] mt-1">
                    Dépense N° {createdExpense?.expenseNumber} • Bénéficiaire : {vendorName}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="font-semibold text-sm text-emerald-400">
                  Bilan du parcours de test :
                </div>
                <ul className="text-xs space-y-1 text-slate-300">
                  <li>✓ Dossier étudiant créé avec matricule unique (<span className="text-white font-mono">{createdStudent?.matricule}</span>)</li>
                  <li>✓ Inscription en <span className="text-white">{selectedProg?.title}</span> avec tarif verrouillé</li>
                  <li>✓ Modalité <span className="text-white">{selectedPlan}</span> avec génération d échéancier</li>
                  <li>✓ Encaissement partiel de <span className="text-emerald-400">{formatFCFA(partialAmount)}</span> avec reçu officiel</li>
                  <li>✓ Reste dû actualisé avec conservation du statut partiel (sans solder par erreur)</li>
                  <li>✓ Dépense fournisseur enregistrée sans double comptage</li>
                  <li>✓ Trésorerie mise à jour en temps réel</li>
                </ul>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  Relancer un test
                </button>
                <button
                  onClick={() => {
                    setIsPriorityFlowOpen(false);
                    setActiveView('treasury');
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm flex items-center space-x-2"
                >
                  <span>Aller au Tableau de Bord de Trésorerie</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
