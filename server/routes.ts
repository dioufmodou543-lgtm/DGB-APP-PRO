import { Request, Response, Router } from 'express';
import { calculateBalanceDue, calculateNetAmount } from '../src/services/currency';
import {
  AttendanceRecord,
  AuditLogEntry,
  Book,
  BookLoan,
  CashProjectionItem,
  CashRegisterSession,
  DiplomaCertificate,
  Enrollment,
  ExpenseStage,
  GradeItem,
  InvoiceSchedule,
  PaymentMethod,
  PaymentPlanType,
  PaymentReceipt,
  PaymentReminder,
  ReminderChannel,
  ReminderLevel,
  StudentAdmission,
  TimetableSlot,
  UserRole,
  VendorExpense,
} from '../src/types/index';
import { AppStore, getStore, logAudit, persistStore, replaceStore, resetStore } from './db';
import {
  formatSequence,
  getActor,
  isNonEmptyString,
  nextSequence,
  nowTimestamp,
  parseGrade,
  parsePositiveFcfa,
  refreshDerivedStatuses,
  requireRoles,
  ROLES,
  scopeStoreForActor,
  secureToken,
  todayISO,
} from './security';
import { runFinancialAndIntegrityTests } from './tests';

export const apiRouter = Router();

// 1. BOOTSTRAP / FULL STORE
apiRouter.get('/bootstrap', (req: Request, res: Response) => {
  const store = getStore();
  if (refreshDerivedStatuses(store)) persistStore();
  res.json({ success: true, data: scopeStoreForActor(store, getActor(req)) });
});

// 2. CONFIGURATION UPDATE
apiRouter.put('/config', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin' && actor.role !== 'dg') {
    return res.status(403).json({ error: 'Accès réservé à l administration et la direction générale' });
  }
  const store = getStore();
  // L'identifiant de configuration ne peut pas être écrasé par le client
  const { id: _ignoredId, ...updates } = req.body || {};
  store.config = { ...store.config, ...updates };
  logAudit(actor, 'MODIFICATION_CONFIG', 'parametre', store.config.id, 'Mise à jour des paramètres de l établissement');
  persistStore();
  res.json({ success: true, data: store.config });
});

// 3. STUDENT ADMISSIONS & DOSSIERS
apiRouter.post('/students', requireRoles(...ROLES.SCOLARITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';

  if (!isNonEmptyString(req.body.firstName) || !isNonEmptyString(req.body.lastName)) {
    return res.status(400).json({ error: 'Le prénom et le nom sont obligatoires' });
  }
  const cni = String(req.body.cniPassport || '').trim();
  if (cni && store.students.some((s) => s.cniPassport && s.cniPassport.trim().toUpperCase() === cni.toUpperCase())) {
    return res.status(409).json({ error: `Un dossier existe déjà avec la pièce d identité ${cni} (doublon)` });
  }

  // Matricule unique basé sur le plus grand numéro existant : ex. ISMNM-2025-0018
  const matPrefix = `${store.config.documentNumbering.matriculePrefix}-${currentYear}-`;
  const matricule = formatSequence(matPrefix, nextSequence(store.students.map((s) => s.matricule), matPrefix), 4);

  const newStudent: StudentAdmission = {
    id: `stu_${Date.now()}`,
    matricule,
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    gender: req.body.gender || 'M',
    birthDate: req.body.birthDate,
    birthPlace: req.body.birthPlace,
    nationality: req.body.nationality || 'Sénégalaise',
    cniPassport: req.body.cniPassport,
    email: req.body.email,
    phone: req.body.phone,
    parentName: req.body.parentName || '',
    parentPhone: req.body.parentPhone || '',
    address: req.body.address || '',
    city: req.body.city || 'Dakar',
    status: req.body.status || 'candidat',
    submissionDate: new Date().toISOString().split('T')[0],
    admissionNotes: req.body.admissionNotes || '',
    documents: req.body.documents || [
      { name: 'Attestation Baccalauréat / Diplôme', status: 'depose' },
      { name: 'Pièce d identité (CNI/Passeport)', status: 'depose' },
    ],
  };

  store.students.unshift(newStudent);
  logAudit(actor, 'CREATION_DOSSIER', 'etudiant', newStudent.id, `Création du dossier pour ${newStudent.firstName} ${newStudent.lastName} (Matricule: ${matricule})`);
  persistStore();

  res.status(201).json({ success: true, data: newStudent });
});

apiRouter.put('/students/:id/status', requireRoles(...ROLES.SCOLARITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const student = store.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Étudiant non trouvé' });

  const allowedStatuses: StudentAdmission['status'][] = ['candidat', 'admis', 'rejete', 'inscrit', 'suspendu'];
  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({ error: 'Statut de dossier invalide' });
  }
  student.status = req.body.status;
  if (req.body.status === 'admis') {
    student.admissionDecisionDate = new Date().toISOString().split('T')[0];
  }
  if (req.body.admissionNotes) {
    student.admissionNotes = req.body.admissionNotes;
  }

  logAudit(actor, 'DECISION_ADMISSION', 'etudiant', student.id, `Statut mis à jour : ${student.status}`);
  persistStore();
  res.json({ success: true, data: student });
});

// 3.B MISE À JOUR D'UN DOSSIER ÉTUDIANT (coordonnées, tuteur, pièces)
apiRouter.put('/students/:id', requireRoles(...ROLES.SCOLARITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const student = store.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Étudiant non trouvé' });

  const editable: (keyof StudentAdmission)[] = [
    'firstName', 'lastName', 'gender', 'birthDate', 'birthPlace', 'nationality', 'cniPassport',
    'email', 'phone', 'parentName', 'parentPhone', 'address', 'city', 'admissionNotes', 'documents',
  ];
  const changes: string[] = [];
  for (const key of editable) {
    if (req.body[key] === undefined) continue;
    if ((key === 'firstName' || key === 'lastName') && !isNonEmptyString(req.body[key])) {
      return res.status(400).json({ error: 'Le prénom et le nom ne peuvent pas être vides' });
    }
    if (JSON.stringify(student[key]) !== JSON.stringify(req.body[key])) {
      (student as any)[key] = req.body[key];
      changes.push(String(key));
    }
  }

  if (changes.length > 0) {
    logAudit(actor, 'MODIFICATION_DOSSIER', 'etudiant', student.id, `Champs modifiés : ${changes.join(', ')}`, req.body.reason);
    persistStore();
  }
  res.json({ success: true, data: student });
});

// 4. ENROLLMENT & AUTOMATIC INVOICE GENERATION
apiRouter.post('/enrollments', requireRoles(...ROLES.INSCRIPTION), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { studentId, programId, academicYearId, paymentPlan, discountType, discountAmount, discountReason } = req.body;

  const student = store.students.find((s) => s.id === studentId);
  const program = store.programs.find((p) => p.id === programId);
  const academicYear = store.academicYears.find((y) => y.id === academicYearId);

  if (!student || !program || !academicYear) {
    return res.status(400).json({ error: 'Données invalides : étudiant, programme ou année introuvable' });
  }

  if (academicYear.isClosed && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Impossible d inscrire sur une année académique clôturée' });
  }

  if (student.status === 'rejete' || student.status === 'suspendu') {
    return res.status(400).json({ error: `Inscription impossible : dossier au statut « ${student.status} »` });
  }

  const alreadyEnrolled = store.enrollments.find(
    (e) => e.studentId === studentId && e.academicYearId === academicYearId
  );
  if (alreadyEnrolled) {
    return res.status(409).json({
      error: 'Cet étudiant est déjà inscrit pour cette année académique (doublon d inscription et de facturation évité)',
    });
  }

  if (discountAmount !== undefined && (Number(discountAmount) < 0 || !Number.isFinite(Number(discountAmount)))) {
    return res.status(400).json({ error: 'Montant de remise invalide' });
  }

  // Lock applied tariffs (Section 3.D)
  const lockedReg = program.defaultFees.registrationFee;
  const lockedTuition = program.defaultFees.tuitionFee;
  const lockedOther = program.defaultFees.labFee + program.defaultFees.otherFees;
  const totalGross = lockedReg + lockedTuition + lockedOther;
  const safeDiscount = Math.min(Math.round(discountAmount || 0), lockedTuition);
  const totalNet = totalGross - safeDiscount;

  const enrollmentId = `enr_${Date.now()}`;
  const newEnrollment: Enrollment = {
    id: enrollmentId,
    studentId,
    programId,
    academicYearId,
    enrollmentDate: new Date().toISOString().split('T')[0],
    paymentPlan: (paymentPlan as PaymentPlanType) || 'mensuel',
    discountType: discountType || 'none',
    discountAmount: safeDiscount,
    discountApprovedBy: safeDiscount > 0 ? actor.name : undefined,
    discountReason: safeDiscount > 0 ? discountReason || 'Remise scolarité accordée' : undefined,
    lockedRegistrationFee: lockedReg,
    lockedTuitionFee: lockedTuition,
    lockedOtherFees: lockedOther,
    totalGross,
    totalNet,
    isClosed: false,
  };

  store.enrollments.unshift(newEnrollment);
  student.status = 'inscrit';

  // Generate Invoices Schedule according to payment plan (Section 3.D)
  const invYear = academicYear.code.split('-')[0];
  const invPrefix = `${store.config.documentNumbering.invoicePrefix}-${invYear}-`;
  const invSeqBase = nextSequence(store.invoices.map((i) => i.invoiceNumber), invPrefix);
  const invoicesToCreate: InvoiceSchedule[] = [];

  // 1. Frais d'inscription (échéance immédiate)
  const regInvNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase).padStart(5, '0')}`;
  invoicesToCreate.push({
    id: `inv_${Date.now()}_reg`,
    enrollmentId,
    studentId,
    invoiceNumber: regInvNum,
    title: `Frais d inscription & Charges fixes - ${program.yearLevel}`,
    dueDate: new Date().toISOString().split('T')[0],
    grossAmount: lockedReg + lockedOther,
    discountShare: 0,
    netAmount: lockedReg + lockedOther,
    paidAmount: 0,
    balanceDue: lockedReg + lockedOther,
    status: 'en_attente',
    category: 'inscription',
    academicYearId,
  });

  // 2. Scolarité selon la modalité choisie
  const netTuition = lockedTuition - safeDiscount;

  if (paymentPlan === 'comptant') {
    // Une seule facture globale
    const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase + 1).padStart(5, '0')}`;
    invoicesToCreate.push({
      id: `inv_${Date.now()}_comptant`,
      enrollmentId,
      studentId,
      invoiceNumber: invNum,
      title: 'Scolarité annuelle intégrale (Paiement au comptant)',
      dueDate: `${invYear}-10-15`,
      grossAmount: lockedTuition,
      discountShare: safeDiscount,
      netAmount: netTuition,
      paidAmount: 0,
      balanceDue: netTuition,
      status: 'en_attente',
      category: 'scolarite',
      academicYearId,
    });
  } else if (paymentPlan === 'trimestriel') {
    // 3 trimestres
    const quarterlyGross = Math.round(lockedTuition / 3);
    const quarterlyDiscount = Math.round(safeDiscount / 3);
    const months = ['10-10', '01-10', '04-10'];
    const titles = ['Trimestre 1 (Oct-Déc)', 'Trimestre 2 (Jan-Mar)', 'Trimestre 3 (Avr-Juin)'];

    for (let i = 0; i < 3; i++) {
      const g = i === 2 ? lockedTuition - quarterlyGross * 2 : quarterlyGross;
      const d = i === 2 ? safeDiscount - quarterlyDiscount * 2 : quarterlyDiscount;
      const n = g - d;
      const yr = i === 0 ? invYear : String(Number(invYear) + 1);
      const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase + 1 + i).padStart(5, '0')}`;

      invoicesToCreate.push({
        id: `inv_${Date.now()}_t${i + 1}`,
        enrollmentId,
        studentId,
        invoiceNumber: invNum,
        title: `Scolarité ${titles[i]}`,
        dueDate: `${yr}-${months[i]}`,
        grossAmount: g,
        discountShare: d,
        netAmount: n,
        paidAmount: 0,
        balanceDue: n,
        status: 'en_attente',
        category: 'scolarite',
        academicYearId,
      });
    }
  } else if (paymentPlan === 'tranches') {
    // 2 tranches (50% / 50%)
    const tranche1Gross = Math.round(lockedTuition * 0.5);
    const tranche2Gross = lockedTuition - tranche1Gross;
    const tranche1Disc = Math.round(safeDiscount * 0.5);
    const tranche2Disc = safeDiscount - tranche1Disc;

    invoicesToCreate.push({
      id: `inv_${Date.now()}_tr1`,
      enrollmentId,
      studentId,
      invoiceNumber: `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase + 1).padStart(5, '0')}`,
      title: 'Scolarité Tranche 1 (50% à la rentrée)',
      dueDate: `${invYear}-10-15`,
      grossAmount: tranche1Gross,
      discountShare: tranche1Disc,
      netAmount: tranche1Gross - tranche1Disc,
      paidAmount: 0,
      balanceDue: tranche1Gross - tranche1Disc,
      status: 'en_attente',
      category: 'scolarite',
      academicYearId,
    });

    invoicesToCreate.push({
      id: `inv_${Date.now()}_tr2`,
      enrollmentId,
      studentId,
      invoiceNumber: `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase + 2).padStart(5, '0')}`,
      title: 'Scolarité Tranche 2 (Solde mi-parcours)',
      dueDate: `${Number(invYear) + 1}-02-15`,
      grossAmount: tranche2Gross,
      discountShare: tranche2Disc,
      netAmount: tranche2Gross - tranche2Disc,
      paidAmount: 0,
      balanceDue: tranche2Gross - tranche2Disc,
      status: 'en_attente',
      category: 'scolarite',
      academicYearId,
    });
  } else {
    // Mensuel (9 mois d'octobre à juin)
    const monthlyGross = Math.round(lockedTuition / 9);
    const monthlyDiscount = Math.round(safeDiscount / 9);
    const scheduleMonths = [
      { name: 'Octobre', m: '10', yOffset: 0 },
      { name: 'Novembre', m: '11', yOffset: 0 },
      { name: 'Décembre', m: '12', yOffset: 0 },
      { name: 'Janvier', m: '01', yOffset: 1 },
      { name: 'Février', m: '02', yOffset: 1 },
      { name: 'Mars', m: '03', yOffset: 1 },
      { name: 'Avril', m: '04', yOffset: 1 },
      { name: 'Mai', m: '05', yOffset: 1 },
      { name: 'Juin', m: '06', yOffset: 1 },
    ];

    let runningGross = 0;
    let runningDisc = 0;

    for (let i = 0; i < 9; i++) {
      const isLast = i === 8;
      const g = isLast ? lockedTuition - runningGross : monthlyGross;
      const d = isLast ? safeDiscount - runningDisc : monthlyDiscount;
      runningGross += g;
      runningDisc += d;
      const n = g - d;
      const item = scheduleMonths[i];
      const yearStr = String(Number(invYear) + item.yOffset);
      const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(invSeqBase + 1 + i).padStart(5, '0')}`;

      invoicesToCreate.push({
        id: `inv_${Date.now()}_m${i + 1}`,
        enrollmentId,
        studentId,
        invoiceNumber: invNum,
        title: `Scolarité Mensualité ${i + 1} (${item.name})`,
        dueDate: `${yearStr}-${item.m}-05`,
        grossAmount: g,
        discountShare: d,
        netAmount: n,
        paidAmount: 0,
        balanceDue: n,
        status: 'en_attente',
        category: 'scolarite',
        academicYearId,
      });
    }
  }

  store.invoices.push(...invoicesToCreate);

  logAudit(
    actor,
    'INSCRIPTION_ET_ECHEANCIER',
    'inscription',
    newEnrollment.id,
    `Inscription de ${student.firstName} ${student.lastName} en ${program.title} (${paymentPlan}). Échéancier généré (${invoicesToCreate.length} factures, Net total: ${totalNet} FCFA)`
  );

  persistStore();

  res.status(201).json({
    success: true,
    data: {
      enrollment: newEnrollment,
      invoices: invoicesToCreate,
    },
  });
});

// 5. PAYMENTS & RECEIPTS (Idempotence anti-doublon, paiement partiel, ventilation FIFO)
const PAYMENT_METHODS: PaymentMethod[] = ['especes', 'wave', 'orange_money', 'virement', 'cheque'];

function recomputeCashSession(store: AppStore) {
  store.cashSession.theoreticalBalance =
    store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
  store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;
}

function applyInvoiceStatus(inv: InvoiceSchedule) {
  inv.balanceDue = calculateBalanceDue(inv.netAmount, inv.paidAmount);
  if (inv.balanceDue === 0) inv.status = 'solde';
  else if (inv.dueDate < todayISO()) inv.status = 'en_retard';
  else inv.status = inv.paidAmount > 0 ? 'partiel' : 'en_attente';
}

apiRouter.post('/payments', requireRoles(...ROLES.ENCAISSEMENT), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { studentId, invoiceScheduleId, amount, paymentMethod, idempotencyKey, transactionRef, notes } = req.body;

  const numAmount = parsePositiveFcfa(amount);
  if (!numAmount) {
    return res.status(400).json({ error: 'Montant invalide : un entier FCFA strictement positif est requis' });
  }

  const method: PaymentMethod = paymentMethod || 'especes';
  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Mode de paiement inconnu' });
  }

  const student = store.students.find((s) => s.id === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Étudiant introuvable' });
  }

  // Idempotence (un double clic ou un webhook répété ne crée jamais deux encaissements)
  const safeIdempKey = idempotencyKey || `auto_idemp_${studentId}_${numAmount}_${Date.now()}`;
  const existingReceipt = store.receipts.find((r) => r.idempotencyKey === safeIdempKey);
  if (existingReceipt) {
    return res.status(409).json({
      error: 'Paiement déjà traité avec cette référence (idempotence anti-doublon)',
      receipt: existingReceipt,
    });
  }

  // Une référence de transaction Mobile Money / banque ne peut être utilisée qu'une fois
  if (transactionRef && method !== 'especes') {
    const dupRef = store.receipts.find(
      (r) => r.status === 'valide' && r.transactionRef && r.transactionRef === transactionRef
    );
    if (dupRef) {
      return res.status(409).json({
        error: `La référence de transaction ${transactionRef} a déjà été encaissée (reçu ${dupRef.receiptNumber})`,
      });
    }
  }

  // Un encaissement en espèces exige une caisse ouverte (sinon l'argent n'est tracé nulle part)
  if (method === 'especes' && (!store.cashSession || store.cashSession.status !== 'ouverte')) {
    return res.status(400).json({
      error: 'Aucune session de caisse ouverte : ouvrez la caisse avant tout encaissement en espèces',
    });
  }

  // Détermination des échéances à solder
  let targets: InvoiceSchedule[];
  if (invoiceScheduleId) {
    const inv = store.invoices.find((i) => i.id === invoiceScheduleId);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable' });
    if (inv.studentId !== studentId) {
      return res.status(400).json({ error: 'Cette facture n appartient pas à l étudiant sélectionné' });
    }
    if (inv.balanceDue <= 0) {
      return res.status(400).json({ error: `La facture ${inv.invoiceNumber} est déjà soldée` });
    }
    if (numAmount > inv.balanceDue) {
      return res.status(400).json({
        error: `Trop-perçu refusé : le reste dû de la facture ${inv.invoiceNumber} est de ${inv.balanceDue} FCFA`,
        maxAmount: inv.balanceDue,
      });
    }
    targets = [inv];
  } else {
    // Ventilation FIFO : les échéances les plus anciennes sont soldées en premier
    targets = store.invoices
      .filter((i) => i.studentId === studentId && i.balanceDue > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const totalDue = targets.reduce((sum, i) => sum + i.balanceDue, 0);
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Aucune facture à solder trouvée pour cet étudiant' });
    }
    if (numAmount > totalDue) {
      return res.status(400).json({
        error: `Trop-perçu refusé : le reste dû total de l étudiant est de ${totalDue} FCFA`,
        maxAmount: totalDue,
      });
    }
  }

  const allocations: NonNullable<PaymentReceipt['allocations']> = [];
  let remaining = numAmount;
  for (const inv of targets) {
    if (remaining <= 0) break;
    const share = Math.min(remaining, inv.balanceDue);
    inv.paidAmount += share;
    applyInvoiceStatus(inv);
    allocations.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amount: share });
    remaining -= share;
  }

  const primaryInvoice = store.invoices.find((i) => i.id === allocations[0].invoiceId)!;
  const enrollment = store.enrollments.find((e) => e.id === primaryInvoice.enrollmentId);

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const recPrefix = `${store.config.documentNumbering.receiptPrefix}-${currentYear}-`;
  const receiptNumber = formatSequence(recPrefix, nextSequence(store.receipts.map((r) => r.receiptNumber), recPrefix), 5);

  const newReceipt: PaymentReceipt = {
    id: `rec_${Date.now()}`,
    receiptNumber,
    idempotencyKey: safeIdempKey,
    studentId,
    enrollmentId: enrollment?.id || '',
    invoiceScheduleId: primaryInvoice.id,
    allocations,
    amount: numAmount,
    paymentMethod: method,
    paymentDate: nowTimestamp(),
    recordedBy: `${actor.name} (${actor.role})`,
    transactionRef: transactionRef || undefined,
    status: 'valide',
    notes: notes || '',
    isConfirmedByServer: true,
  };

  store.receipts.unshift(newReceipt);

  if (method === 'especes') {
    store.cashSession.totalCashIn += numAmount;
    recomputeCashSession(store);
  }

  const allocationText = allocations.map((a) => `${a.invoiceNumber}: ${a.amount} FCFA`).join(', ');
  logAudit(
    actor,
    primaryInvoice.status === 'solde' && allocations.length === 1 ? 'ENCAISSEMENT' : 'ENCAISSEMENT_PARTIEL',
    'paiement',
    newReceipt.receiptNumber,
    `Encaissement de ${numAmount} FCFA par ${method}. Ventilation : ${allocationText}.`
  );

  persistStore();

  res.status(201).json({
    success: true,
    data: {
      receipt: newReceipt,
      updatedInvoice: primaryInvoice,
      updatedInvoices: allocations.map((a) => store.invoices.find((i) => i.id === a.invoiceId)),
    },
  });
});

// 6. PAYMENT CANCELLATION & REGULARIZATION (Section 3.E: Ne jamais effacer l'opération originale)
apiRouter.post('/payments/:id/cancel', requireRoles(...ROLES.COMPTABILITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const { reason } = req.body;
  if (!isNonEmptyString(reason, 5)) {
    return res.status(400).json({ error: 'Le motif d annulation est obligatoire et doit être explicite' });
  }

  const store = getStore();
  const receipt = store.receipts.find((r) => r.id === req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Reçu non trouvé' });
  if (receipt.status === 'annule') return res.status(400).json({ error: 'Ce reçu est déjà annulé' });

  // Une annulation en espèces sort de l'argent de la caisse : elle doit être ouverte et approvisionnée
  if (receipt.paymentMethod === 'especes') {
    if (!store.cashSession || store.cashSession.status !== 'ouverte') {
      return res.status(400).json({ error: 'Ouvrez la caisse pour annuler un encaissement en espèces (remboursement)' });
    }
    if (store.cashSession.theoreticalBalance < receipt.amount) {
      return res.status(400).json({ error: 'Solde de caisse insuffisant pour rembourser cet encaissement en espèces' });
    }
  }

  receipt.status = 'annule';
  receipt.cancellationDetails = {
    cancelledAt: nowTimestamp(),
    cancelledBy: actor.name,
    reason: reason.trim(),
    regularizationOperationId: `reg_op_${Date.now()}`,
  };

  // Rétablissement du reste dû sur chaque échéance ventilée
  const allocations =
    receipt.allocations && receipt.allocations.length > 0
      ? receipt.allocations
      : receipt.invoiceScheduleId
        ? [{ invoiceId: receipt.invoiceScheduleId, invoiceNumber: '', amount: receipt.amount }]
        : [];
  for (const alloc of allocations) {
    const inv = store.invoices.find((i) => i.id === alloc.invoiceId);
    if (inv) {
      inv.paidAmount = Math.max(0, inv.paidAmount - alloc.amount);
      applyInvoiceStatus(inv);
    }
  }

  if (receipt.paymentMethod === 'especes') {
    store.cashSession.totalCashOut += receipt.amount;
    recomputeCashSession(store);
  }

  logAudit(
    actor,
    'ANNULATION_ENCAISSEMENT',
    'paiement',
    receipt.receiptNumber,
    `Annulation du reçu de ${receipt.amount} FCFA. Opération de régularisation créée.`,
    reason
  );

  persistStore();
  res.json({ success: true, data: receipt });
});

// 7. CASH REGISTER MANAGEMENT (Section 3.E)
apiRouter.post('/cash/open', requireRoles(...ROLES.CAISSE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { initialCash, notes } = req.body;

  if (store.cashSession && store.cashSession.status === 'ouverte') {
    return res.status(409).json({
      error: `La session ${store.cashSession.sessionNumber} est encore ouverte : clôturez-la avant d en ouvrir une nouvelle`,
    });
  }
  const fund = Math.round(Number(initialCash) || 0);
  if (fund < 0) {
    return res.status(400).json({ error: 'Le fond de caisse ne peut pas être négatif' });
  }

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const cshPrefix = `CSH-${currentYear}-`;
  const sessionNumber = formatSequence(
    cshPrefix,
    nextSequence([...store.cashSessionsHistory.map((c) => c.sessionNumber), store.cashSession?.sessionNumber], cshPrefix),
    4
  );

  const newSession: CashRegisterSession = {
    id: `csh_${Date.now()}`,
    sessionNumber,
    cashierId: actor.id,
    cashierName: actor.name,
    openedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    initialCash: Math.round(Number(initialCash) || 0),
    totalCashIn: 0,
    totalCashOut: 0,
    theoreticalBalance: Math.round(Number(initialCash) || 0),
    actualCountedBalance: Math.round(Number(initialCash) || 0),
    difference: 0,
    status: 'ouverte',
    notes: notes || 'Ouverture de caisse standard',
  };

  store.cashSession = newSession;
  logAudit(actor, 'OUVERTURE_CAISSE', 'caisse', sessionNumber, `Ouverture avec fond de caisse de ${newSession.initialCash} FCFA`);
  persistStore();
  res.status(201).json({ success: true, data: newSession });
});

apiRouter.post('/cash/close', requireRoles(...ROLES.CAISSE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { actualCountedBalance, notes } = req.body;

  if (!store.cashSession || store.cashSession.status !== 'ouverte') {
    return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
  }

  const counted = Math.round(Number(actualCountedBalance));
  if (!Number.isFinite(counted) || counted < 0) {
    return res.status(400).json({ error: 'Le solde physique compté est obligatoire et doit être positif' });
  }
  const diff = counted - store.cashSession.theoreticalBalance;
  if (diff !== 0 && !isNonEmptyString(notes, 5)) {
    return res.status(400).json({
      error: `Écart de caisse de ${diff} FCFA : une justification écrite est obligatoire pour clôturer`,
    });
  }

  store.cashSession.status = 'fermee';
  store.cashSession.closedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
  store.cashSession.actualCountedBalance = counted;
  store.cashSession.difference = diff;
  store.cashSession.notes = notes || store.cashSession.notes;

  store.cashSessionsHistory.unshift({ ...store.cashSession });
  logAudit(
    actor,
    'CLOTURE_CAISSE',
    'caisse',
    store.cashSession.sessionNumber,
    `Clôture de caisse. Solde théorique: ${store.cashSession.theoreticalBalance} FCFA, Physique: ${counted} FCFA, Écart: ${diff} FCFA`
  );

  persistStore();
  res.json({ success: true, data: store.cashSession });
});

apiRouter.post('/cash/movement', requireRoles(...ROLES.CAISSE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { type, amount, motive } = req.body;

  if (!store.cashSession || store.cashSession.status !== 'ouverte') {
    return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
  }

  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: 'Type de mouvement invalide (in / out)' });
  }
  const num = parsePositiveFcfa(amount);
  if (!num) {
    return res.status(400).json({ error: 'Montant de mouvement invalide' });
  }
  if (!isNonEmptyString(motive, 3)) {
    return res.status(400).json({ error: 'Le motif du mouvement de caisse est obligatoire' });
  }
  if (type === 'out' && num > store.cashSession.theoreticalBalance) {
    return res.status(400).json({
      error: `Retrait impossible : solde théorique de caisse insuffisant (${store.cashSession.theoreticalBalance} FCFA)`,
    });
  }
  if (type === 'in') {
    store.cashSession.totalCashIn += num;
  } else {
    store.cashSession.totalCashOut += num;
  }
  store.cashSession.theoreticalBalance =
    store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
  store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;

  logAudit(
    actor,
    type === 'in' ? 'APPROVISIONNEMENT_CAISSE' : 'RETRAIT_CAISSE',
    'caisse',
    store.cashSession.sessionNumber,
    `Mouvement de ${num} FCFA. Motif: ${motive || 'Non spécifié'}`
  );

  persistStore();
  res.json({ success: true, data: store.cashSession });
});

apiRouter.post('/academic-years/:id/close', requireRoles(...ROLES.DIRECTION), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const yr = store.academicYears.find((y) => y.id === req.params.id);
  if (!yr) return res.status(404).json({ error: 'Année académique non trouvée' });
  if (yr.isClosed) return res.status(400).json({ error: 'Cette année académique est déjà clôturée' });

  yr.isClosed = true;
  logAudit(
    actor,
    'CLOTURE_ANNEE_ACADEMIQUE',
    'parametre',
    yr.id,
    `Clôture définitive de l année ${yr.code}. Les modifications d écritures antérieures sont désormais verrouillées.`
  );

  persistStore();
  res.json({ success: true, data: yr });
});

// 8. VENDOR EXPENSES (4 stages to prevent double counting - Section 3.F)
const EXPENSE_STAGES: ExpenseStage[] = ['prevue', 'dette_constatee', 'paiement_ordonne', 'decaissement_realise'];

apiRouter.post('/expenses', requireRoles(...ROLES.COMPTABILITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { vendorName, category, description, amount, dueDate, stage, paymentMethod } = req.body;

  const numAmount = parsePositiveFcfa(amount);
  if (!numAmount) return res.status(400).json({ error: 'Montant de dépense invalide' });
  if (!isNonEmptyString(vendorName, 2)) return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire' });
  if (!isNonEmptyString(description, 3)) return res.status(400).json({ error: 'La description de la dépense est obligatoire' });
  if (stage && !EXPENSE_STAGES.includes(stage)) return res.status(400).json({ error: 'Étape de dépense invalide' });

  if (stage === 'decaissement_realise' && paymentMethod === 'especes') {
    if (!store.cashSession || store.cashSession.status !== 'ouverte') {
      return res.status(400).json({ error: 'Ouvrez la caisse avant un décaissement en espèces' });
    }
    if (store.cashSession.theoreticalBalance < numAmount) {
      return res.status(400).json({ error: 'Solde de caisse insuffisant pour ce décaissement en espèces' });
    }
  }

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const expPrefix = `${store.config.documentNumbering.expensePrefix}-${currentYear}-`;
  const expenseNumber = formatSequence(expPrefix, nextSequence(store.expenses.map((e) => e.expenseNumber), expPrefix), 5);

  const newExpense: VendorExpense = {
    id: `exp_${Date.now()}`,
    expenseNumber,
    vendorName,
    category: category || 'autre',
    description,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    amount: numAmount,
    paidAmount: stage === 'decaissement_realise' ? numAmount : 0,
    stage: (stage as ExpenseStage) || 'prevue',
    paymentMethod: paymentMethod || undefined,
    paidAt: stage === 'decaissement_realise' ? new Date().toISOString().split('T')[0] : undefined,
    recordedBy: actor.name,
    approvedBy: stage === 'paiement_ordonne' || stage === 'decaissement_realise' ? actor.name : undefined,
  };

  store.expenses.unshift(newExpense);

  // If directly paid in cash
  if (stage === 'decaissement_realise' && paymentMethod === 'especes' && store.cashSession?.status === 'ouverte') {
    store.cashSession.totalCashOut += numAmount;
    store.cashSession.theoreticalBalance =
      store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
    store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;
  }

  logAudit(
    actor,
    'CREATION_DEPENSE',
    'depense',
    expenseNumber,
    `Engagement dépense fournisseur ${vendorName} pour ${numAmount} FCFA. Étape: ${newExpense.stage}`
  );

  persistStore();
  res.status(201).json({ success: true, data: newExpense });
});

apiRouter.put('/expenses/:id/stage', requireRoles(...ROLES.COMPTABILITE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const expense = store.expenses.find((e) => e.id === req.params.id);
  if (!expense) return res.status(404).json({ error: 'Dépense non trouvée' });

  const { newStage, paymentMethod } = req.body;
  const oldStage = expense.stage;

  // Le cycle de vie d'une dépense est strictement progressif (pas de retour arrière)
  const oldIdx = EXPENSE_STAGES.indexOf(oldStage);
  const newIdx = EXPENSE_STAGES.indexOf(newStage);
  if (newIdx === -1) return res.status(400).json({ error: 'Étape de dépense invalide' });
  if (newIdx <= oldIdx) {
    return res.status(400).json({ error: `Transition interdite : ${oldStage} → ${newStage} (retour arrière impossible)` });
  }
  // Séparation des tâches : seul l'ordonnateur (DG / admin) ordonne le paiement
  if (newStage === 'paiement_ordonne' && actor.role === 'comptable') {
    return res.status(403).json({ error: 'L ordonnancement du paiement est réservé à la direction (DG / admin)' });
  }
  const effectiveMethod: PaymentMethod = paymentMethod || expense.paymentMethod || 'virement';
  if (newStage === 'decaissement_realise' && effectiveMethod === 'especes') {
    if (!store.cashSession || store.cashSession.status !== 'ouverte') {
      return res.status(400).json({ error: 'Ouvrez la caisse avant un décaissement en espèces' });
    }
    if (store.cashSession.theoreticalBalance < expense.amount - expense.paidAmount) {
      return res.status(400).json({ error: 'Solde de caisse insuffisant pour ce décaissement en espèces' });
    }
  }

  expense.stage = newStage;

  if (newStage === 'paiement_ordonne' && !expense.approvedBy) {
    expense.approvedBy = actor.name;
  }

  if (newStage === 'decaissement_realise' && oldStage !== 'decaissement_realise') {
    expense.paidAmount = expense.amount;
    expense.paidAt = new Date().toISOString().split('T')[0];
    expense.paymentMethod = paymentMethod || expense.paymentMethod || 'virement';

    if (expense.paymentMethod === 'especes' && store.cashSession?.status === 'ouverte') {
      store.cashSession.totalCashOut += expense.amount;
      store.cashSession.theoreticalBalance =
        store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
      store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;
    }
  }

  logAudit(
    actor,
    'TRANSITION_ETAPE_DEPENSE',
    'depense',
    expense.expenseNumber,
    `Passage de l étape ${oldStage} vers ${newStage} pour ${expense.amount} FCFA`
  );

  persistStore();
  res.json({ success: true, data: expense });
});

// 9. TREASURY PROJECTIONS & METRICS (Section 3.G)
apiRouter.get('/treasury/projection', requireRoles(...ROLES.COMPTABILITE), (_req: Request, res: Response) => {
  const store = getStore();

  // 1. Solde disponible actuel = Solde caisse ouverte + Trésorerie bancaire active
  const cashAvailable = store.cashSession?.status === 'ouverte' ? store.cashSession.theoreticalBalance : 0;
  // Banque disponible calculée depuis encaissements non-espèces moins décaissements réalisés non-espèces
  const bankInflows = store.receipts
    .filter((r) => r.status === 'valide' && r.paymentMethod !== 'especes')
    .reduce((sum, r) => sum + r.amount, 0);

  const bankOutflows = store.expenses
    .filter((e) => e.stage === 'decaissement_realise' && e.paymentMethod !== 'especes')
    .reduce((sum, e) => sum + e.paidAmount, 0);

  const initialBankFund = 5000000; // Fond de roulement initial bancaire CBAO / Ecobank
  const currentBank = initialBankFund + bankInflows - bankOutflows;
  const currentTotalAvailable = cashAvailable + currentBank;

  // 2. Créances étudiantes totales
  const totalStudentReceivables = store.invoices
    .filter((i) => i.balanceDue > 0)
    .reduce((sum, i) => sum + i.balanceDue, 0);

  // 3. Dettes fournisseurs totales (dette constatée + paiement ordonné)
  const totalVendorDebts = store.expenses
    .filter((e) => e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne')
    .reduce((sum, e) => sum + (e.amount - e.paidAmount), 0);

  // 4. Projection sur 30, 60, 90 jours
  const today = new Date();
  const periods = [
    { label: '30 jours', days: 30 },
    { label: '60 jours', days: 60 },
    { label: '90 jours', days: 90 },
  ];

  const projections: CashProjectionItem[] = periods.map((p) => {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + p.days);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Encaissements futurs confirmés (échéances contractuelles arrivant avant date cible)
    const confirmedInflows = store.invoices
      .filter((i) => i.balanceDue > 0 && i.dueDate <= targetDateStr)
      .reduce((sum, i) => sum + i.balanceDue, 0);

    // Encaissements futurs prévisionnels (ajustement prudentiel de 85% de taux de recouvrement estimé)
    const forecastInflows = Math.round(confirmedInflows * 0.85);

    // Décaissements planifiés (dépenses prévues arrivant à échéance)
    const plannedOutflows = store.expenses
      .filter((e) => e.stage === 'prevue' && e.dueDate <= targetDateStr)
      .reduce((sum, e) => sum + e.amount, 0);

    // Dettes arrivant à échéance
    const dueDebts = store.expenses
      .filter((e) => (e.stage === 'dette_constatee' || e.stage === 'paiement_ordonne') && e.dueDate <= targetDateStr)
      .reduce((sum, e) => sum + (e.amount - e.paidAmount), 0);

    const projectedNet = currentTotalAvailable + forecastInflows - plannedOutflows - dueDebts;
    const financingNeed = projectedNet < 0 ? Math.abs(projectedNet) : 0;

    return {
      date: `À ${p.label} (${targetDateStr})`,
      currentAvailable: currentTotalAvailable,
      confirmedInflows,
      forecastInflows,
      plannedOutflows,
      dueDebts,
      projectedNet,
      financingNeed,
      isAlert: projectedNet < 500000, // Alerte si trésorerie inférieure à 500 000 FCFA
    };
  });

  res.json({
    success: true,
    data: {
      currentAvailable: currentTotalAvailable,
      cashAvailable,
      bankAvailable: currentBank,
      totalStudentReceivables,
      totalVendorDebts,
      projections,
    },
  });
});

// 10. PEDAGOGY: GRADES (Validation & Publication cycle - Section 3.C)
// Règle LMD : 40 % contrôle continu + 60 % examen ; la note de rattrapage remplace l'examen si elle est meilleure.
function computeFinalNote(cc: number, exam: number, catchUp?: number): number {
  const effectiveExam = catchUp !== undefined && catchUp > exam ? catchUp : exam;
  return Math.round((cc * 0.4 + effectiveExam * 0.6) * 100) / 100;
}

type GradeInput = {
  studentId?: string;
  moduleId?: string;
  academicYearId?: string;
  continuousAssessmentNote?: unknown;
  examNote?: unknown;
  catchUpExamNote?: unknown;
  status?: GradeItem['status'];
};

/** Applique une saisie de note. Retourne un message d'erreur ou la note mise à jour. */
function upsertGrade(store: AppStore, actor: ReturnType<typeof getActor>, input: GradeInput): GradeItem | string {
  const { studentId, moduleId } = input;
  if (!studentId || !moduleId) return 'Étudiant et module obligatoires';
  if (!store.students.some((s) => s.id === studentId)) return `Étudiant ${studentId} introuvable`;
  if (!store.modules.some((m) => m.id === moduleId)) return `Module ${moduleId} introuvable`;

  const cc = parseGrade(input.continuousAssessmentNote);
  const exam = parseGrade(input.examNote);
  const catchUp = parseGrade(input.catchUpExamNote);
  if (cc === null || exam === null || catchUp === null) return 'Les notes doivent être comprises entre 0 et 20';

  const academicYearId =
    input.academicYearId || store.academicYears.find((y) => y.isCurrent)?.id || store.config.activeAcademicYearId;
  const year = store.academicYears.find((y) => y.id === academicYearId);
  if (year?.isClosed && actor.role !== 'admin') return `L année ${year.code} est clôturée : notes verrouillées`;

  // Seule la direction pédagogique peut valider ou publier
  const canValidate = ['admin', 'dg', 'pedagogie'].includes(actor.role);
  let status = input.status;
  if (status && status !== 'brouillon' && !canValidate) status = 'brouillon';

  let existing = store.grades.find(
    (g) => g.studentId === studentId && g.moduleId === moduleId && g.academicYearId === academicYearId
  );

  if (existing && existing.status !== 'brouillon' && !canValidate) {
    return `La note de ${studentId} est déjà ${existing.status === 'publie' ? 'publiée' : 'validée'} : modification réservée à la direction pédagogique`;
  }

  const ccVal = cc ?? existing?.continuousAssessmentNote ?? 0;
  const examVal = exam ?? existing?.examNote ?? 0;
  const catchUpVal = catchUp ?? existing?.catchUpExamNote;
  const finalNote = computeFinalNote(ccVal, examVal, catchUpVal);

  if (existing) {
    existing.continuousAssessmentNote = ccVal;
    existing.examNote = examVal;
    if (catchUpVal !== undefined) existing.catchUpExamNote = catchUpVal;
    existing.finalNote = finalNote;
    if (status) existing.status = status;
  } else {
    existing = {
      id: `grd_${Date.now()}_${secureToken(4).toLowerCase()}`,
      studentId,
      moduleId,
      academicYearId,
      continuousAssessmentNote: ccVal,
      examNote: examVal,
      catchUpExamNote: catchUpVal,
      finalNote,
      status: status || 'brouillon',
    };
    store.grades.unshift(existing);
  }
  if (existing.status !== 'brouillon') {
    existing.validatedBy = actor.name;
    existing.validatedAt = todayISO();
  }
  return existing;
}

apiRouter.post('/grades', requireRoles(...ROLES.NOTES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const result = upsertGrade(store, actor, req.body || {});
  if (typeof result === 'string') return res.status(400).json({ error: result });

  logAudit(actor, 'SAISIE_NOTE', 'note', result.id, `Note saisie pour étudiant ${result.studentId} module ${result.moduleId} : ${result.finalNote}/20 (Statut: ${result.status})`);
  persistStore();
  res.json({ success: true, data: result });
});

// Batch grades update for teachers (tout ou rien : aucune note n'est enregistrée si une ligne est invalide)
apiRouter.post('/grades/batch', requireRoles(...ROLES.NOTES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { grades: gradeList } = req.body;

  if (!Array.isArray(gradeList) || gradeList.length === 0) {
    return res.status(400).json({ error: 'Liste de notes invalide ou vide' });
  }

  const snapshot = JSON.stringify(store.grades);
  const updatedItems: GradeItem[] = [];
  for (const item of gradeList) {
    const result = upsertGrade(store, actor, item || {});
    if (typeof result === 'string') {
      store.grades = JSON.parse(snapshot); // annulation de la transaction
      return res.status(400).json({ error: result });
    }
    updatedItems.push(result);
  }

  logAudit(
    actor,
    'SAISIE_LOT_NOTES',
    'note',
    gradeList[0]?.moduleId || 'batch',
    `Saisie et mise à jour en lot de ${updatedItems.length} notes par ${actor.name}`
  );

  persistStore();
  res.json({ success: true, count: updatedItems.length, data: updatedItems });
});

apiRouter.post('/grades/:id/validate', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin' && actor.role !== 'pedagogie' && actor.role !== 'dg') {
    return res.status(403).json({ error: 'Seule la direction pédagogique peut valider et publier les notes' });
  }

  const store = getStore();
  const grade = store.grades.find((g) => g.id === req.params.id);
  if (!grade) return res.status(404).json({ error: 'Note non trouvée' });

  const nextStatus = req.body.status || 'valide';
  if (!['brouillon', 'valide', 'publie'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Statut de note invalide' });
  }
  grade.status = nextStatus;
  grade.validatedBy = actor.name;
  grade.validatedAt = new Date().toISOString().split('T')[0];

  logAudit(actor, 'VALIDATION_NOTE', 'note', grade.id, `Note passée au statut ${nextStatus} par ${actor.name}`);
  persistStore();
  res.json({ success: true, data: grade });
});

// 10.B ATTENDANCE & TEACHER CLASS TRACKING (Suivi des présences & Émargement)
apiRouter.get('/attendance', (_req: Request, res: Response) => {
  const store = getStore();
  res.json({ success: true, data: store.attendance || [] });
});

apiRouter.post('/attendance', requireRoles(...ROLES.PRESENCES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const {
    id,
    date,
    moduleId,
    teacherId,
    teacherName,
    sessionTitle,
    startTime,
    endTime,
    durationHours,
    room,
    programId,
    academicYearId,
    topic,
    status,
    notes,
    attendees,
    signedAt,
    signedBy,
  } = req.body;

  // Compute duration in hours if not explicitly provided
  let calculatedDuration = durationHours;
  if (!calculatedDuration && startTime && endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff > 0) {
      calculatedDuration = Math.round((diff / 60) * 10) / 10;
    }
  }

  // Find existing or create new
  let record: AttendanceRecord | undefined;
  if (id) {
    record = store.attendance.find((a) => a.id === id);
  }

  const moduleItem = store.modules.find((m) => m.id === moduleId);
  const resolvedProgramId = programId || moduleItem?.programId || 'prog_lic_info_l1';
  const resolvedTeacherName = teacherName || actor.name;
  const resolvedTeacherId = teacherId || (actor.role === 'enseignant' ? 'tch_kane' : 'tch_kane');

  if (record) {
    record.date = date || record.date;
    record.moduleId = moduleId || record.moduleId;
    record.teacherId = resolvedTeacherId;
    record.teacherName = resolvedTeacherName;
    record.sessionTitle = sessionTitle || record.sessionTitle;
    record.startTime = startTime || record.startTime;
    record.endTime = endTime || record.endTime;
    record.durationHours = calculatedDuration ?? record.durationHours;
    record.room = room ?? record.room;
    record.programId = resolvedProgramId;
    record.academicYearId = academicYearId || record.academicYearId;
    record.topic = topic ?? record.topic;
    record.status = status || record.status;
    record.notes = notes ?? record.notes;
    record.attendees = attendees || record.attendees;
    if (signedAt) record.signedAt = signedAt;
    if (signedBy) record.signedBy = signedBy;
  } else {
    record = {
      id: id || `att_${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      moduleId: moduleId || (moduleItem ? moduleItem.id : 'mod_algo'),
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      sessionTitle: sessionTitle || `Séance de cours - ${moduleItem?.moduleTitle || 'Module'}`,
      startTime: startTime || '08:30',
      endTime: endTime || '11:30',
      durationHours: calculatedDuration || 3,
      room: room || 'Amphithéâtre Cheikh Anta Diop',
      programId: resolvedProgramId,
      academicYearId: academicYearId || 'year_2025_2026',
      topic: topic || '',
      status: status || 'brouillon',
      notes: notes || '',
      attendees: attendees || [],
      signedAt: signedAt,
      signedBy: signedBy,
    };
    store.attendance.unshift(record);
  }

  const presentCount = record.attendees.filter((a) => a.status === 'present').length;
  const totalCount = record.attendees.length;

  logAudit(
    actor,
    'EMARGEMENT_COURS',
    'presence',
    record.id,
    `Émargement séance "${record.sessionTitle}" (${record.date}) par ${actor.name} : ${presentCount}/${totalCount} présents`
  );

  persistStore();
  res.json({ success: true, data: record });
});

apiRouter.put('/attendance/:id', requireRoles(...ROLES.PRESENCES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const record = store.attendance.find((a) => a.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Fiche de présence non trouvée' });

  if (req.body.attendees) record.attendees = req.body.attendees;
  if (req.body.topic !== undefined) record.topic = req.body.topic;
  if (req.body.notes !== undefined) record.notes = req.body.notes;
  if (req.body.status) record.status = req.body.status;
  if (req.body.sessionTitle) record.sessionTitle = req.body.sessionTitle;
  if (req.body.room) record.room = req.body.room;

  logAudit(
    actor,
    'MODIFICATION_EMARGEMENT',
    'presence',
    record.id,
    `Mise à jour des présences pour la séance "${record.sessionTitle}"`
  );

  persistStore();
  res.json({ success: true, data: record });
});

apiRouter.post('/attendance/:id/sign', requireRoles(...ROLES.PRESENCES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const record = store.attendance.find((a) => a.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Fiche de présence non trouvée' });

  record.status = 'valide';
  record.signedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
  record.signedBy = req.body.signedBy || actor.name;

  logAudit(
    actor,
    'SIGNATURE_FEUILLE_PRESENCE',
    'presence',
    record.id,
    `Signature & validation officielle de la feuille d'émargement "${record.sessionTitle}" par ${record.signedBy}`
  );

  persistStore();
  res.json({ success: true, data: record });
});

apiRouter.delete('/attendance/:id', requireRoles(...ROLES.PRESENCES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const index = store.attendance.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Fiche de présence non trouvée' });

  const [removed] = store.attendance.splice(index, 1);
  logAudit(actor, 'SUPPRESSION_EMARGEMENT', 'presence', removed.id, `Suppression de la séance "${removed.sessionTitle}"`);
  persistStore();
  res.json({ success: true, message: 'Fiche supprimée' });
});

// 11. DIPLOMAS & CERTIFICATES MANAGEMENT
// Helper to generate guaranteed unique serial number
function generateUniqueSerialNumber(store: any, type: string, year: string): string {
  let prefix = 'LIC';
  if (type === 'diplome_master') prefix = 'MAS';
  else if (type === 'attestation_reussite') prefix = 'ATT';
  else if (type === 'attestation_scolarite') prefix = 'SCO';
  else if (type === 'certificat_specialise') prefix = 'CRT';

  let counter = 1;
  const existingSerials = new Set((store.diplomas || []).map((d: DiplomaCertificate) => d.serialNumber));
  
  let candidate = '';
  do {
    const padded = String(counter).padStart(4, '0');
    candidate = `SN-ISMNM-${year}-${prefix}-${padded}`;
    counter++;
  } while (existingSerials.has(candidate));

  return candidate;
}

// Helper to generate security verification token
function generateSecurityToken(year: string): string {
  // Jeton cryptographiquement sûr (Math.random est prévisible et permettrait de forger des jetons)
  return `SEC-${secureToken(4)}-${secureToken(4)}-${year}`;
}

// List all diplomas & certificates
apiRouter.get('/diplomas', (_req: Request, res: Response) => {
  const store = getStore();
  res.json({ success: true, data: store.diplomas || [] });
});

// Public / Anti-fraud verification endpoint
apiRouter.get('/diplomas/verify/:query', (req: Request, res: Response) => {
  const store = getStore();
  const query = (req.params.query || '').trim().toUpperCase();
  const diploma = (store.diplomas || []).find(
    (d) =>
      d.serialNumber.toUpperCase() === query ||
      d.securityToken.toUpperCase() === query
  );

  if (!diploma) {
    return res.status(404).json({
      success: false,
      isValid: false,
      message: 'Numéro de série ou jeton de vérification non reconnu dans le registre officiel de l\'ISMNM Dakar.',
    });
  }

  const student = store.students.find((s) => s.id === diploma.studentId);
  const program = store.programs.find((p) => p.id === diploma.programId);

  return res.json({
    success: true,
    isValid: diploma.status !== 'revoque',
    data: {
      serialNumber: diploma.serialNumber,
      securityToken: diploma.securityToken,
      status: diploma.status,
      title: diploma.title,
      type: diploma.type,
      mention: diploma.mention,
      finalAverage: diploma.finalAverage,
      totalCreditsEarned: diploma.totalCreditsEarned,
      deliberationDate: diploma.deliberationDate,
      deliberationPvNumber: diploma.deliberationPvNumber,
      deliveryDate: diploma.deliveryDate,
      student: student
        ? {
            firstName: student.firstName,
            lastName: student.lastName,
            matricule: student.matricule,
            birthDate: student.birthDate,
            birthPlace: student.birthPlace,
            nationality: student.nationality,
          }
        : null,
      program: program
        ? {
            title: program.title,
            code: program.code,
            level: program.level,
            accreditationRef: program.accreditationRef,
          }
        : null,
      institution: {
        name: store.config.name,
        motto: store.config.motto,
        accreditationMesri: store.config.accreditationNumber || 'Arrêté MESRI N° 004812',
      },
      revokedInfo:
        diploma.status === 'revoque'
          ? {
              reason: diploma.revocationReason,
              date: diploma.revokedAt,
            }
          : undefined,
    },
  });
});

// Create / Issue new diploma or certificate
apiRouter.post('/diplomas', requireRoles(...ROLES.DIPLOMES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const body = req.body;
  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';

  // Serial number handling & collision check
  let serialNumber = (body.serialNumber || '').trim().toUpperCase();
  if (!serialNumber) {
    serialNumber = generateUniqueSerialNumber(store, body.type || 'diplome_licence', currentYear);
  } else {
    // Verify uniqueness
    const exists = store.diplomas.some(
      (d) => d.serialNumber.toUpperCase() === serialNumber
    );
    if (exists) {
      return res.status(400).json({
        error: `Le numéro de série "${serialNumber}" est déjà attribué à un autre document officiel. Le numéro doit être strictement unique.`,
      });
    }
  }

  const securityToken = body.securityToken || generateSecurityToken(currentYear);
  const qrVerificationData = `https://ismnm-dakar.sn/verify?sn=${encodeURIComponent(serialNumber)}&token=${encodeURIComponent(securityToken)}`;

  const newDiploma: DiplomaCertificate = {
    id: `cert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    serialNumber,
    securityToken,
    studentId: body.studentId,
    programId: body.programId,
    academicYearId: body.academicYearId || 'year_2024_2025',
    type: body.type || 'diplome_licence',
    title: body.title || 'Diplôme de Fin d\'Études',
    specialization: body.specialization || '',
    mention: body.mention || 'Bien',
    finalAverage: Number(body.finalAverage) || 14.0,
    totalCreditsEarned: Number(body.totalCreditsEarned) || (body.type === 'diplome_master' ? 120 : 180),
    deliberationDate: body.deliberationDate || new Date().toISOString().split('T')[0],
    deliberationPvNumber: body.deliberationPvNumber || `PV-DELIB-${currentYear}/${String(store.diplomas.length + 1).padStart(2, '0')}`,
    deliveryDate: body.deliveryDate || new Date().toISOString().split('T')[0],
    juryPresident: body.juryPresident || 'Pr. Ousmane Abdoulaye Diop',
    directorName: body.directorName || 'Dr. Aïssatou Ndiaye Diouf',
    registrarName: body.registrarName || 'Fatou Kiné Sow',
    status: body.status || 'delivre',
    printCount: 0,
    printHistory: [],
    notes: body.notes || '',
    qrVerificationData,
  };

  store.diplomas.unshift(newDiploma);

  const student = store.students.find((s) => s.id === newDiploma.studentId);
  logAudit(
    actor,
    'DELIVRANCE_DIPLOME',
    'diplome',
    newDiploma.id,
    `Délivrance de ${newDiploma.title} à ${student ? `${student.firstName} ${student.lastName}` : 'l\'étudiant'} (N° Série: ${newDiploma.serialNumber})`
  );

  persistStore();
  res.status(201).json({ success: true, data: newDiploma });
});

// Update diploma details
apiRouter.put('/diplomas/:id', requireRoles(...ROLES.DIPLOMES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const index = store.diplomas.findIndex((d) => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Document non trouvé' });

  const current = store.diplomas[index];
  if (current.status === 'revoque') {
    return res.status(400).json({ error: 'Impossible de modifier un document officiel qui a été révoqué.' });
  }

  // If serialNumber was changed, check uniqueness
  if (req.body.serialNumber && req.body.serialNumber.trim().toUpperCase() !== current.serialNumber) {
    const newSerial = req.body.serialNumber.trim().toUpperCase();
    const collision = store.diplomas.some((d) => d.id !== current.id && d.serialNumber.toUpperCase() === newSerial);
    if (collision) {
      return res.status(400).json({ error: `Le numéro de série "${newSerial}" est déjà utilisé.` });
    }
    current.serialNumber = newSerial;
  }

  // Update other fields
  const updated: DiplomaCertificate = {
    ...current,
    ...req.body,
    id: current.id,
    serialNumber: current.serialNumber, // preserved or validated above
    printCount: current.printCount, // preserved
    printHistory: current.printHistory, // preserved
  };

  store.diplomas[index] = updated;

  logAudit(
    actor,
    'MODIFICATION_DIPLOME',
    'diplome',
    updated.id,
    `Mise à jour des informations pour le document ${updated.serialNumber}`
  );

  persistStore();
  res.json({ success: true, data: updated });
});

// Record official print event
apiRouter.post('/diplomas/:id/print', requireRoles(...ROLES.DIPLOMES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const diploma = store.diplomas.find((d) => d.id === req.params.id);
  if (!diploma) return res.status(404).json({ error: 'Document non trouvé' });

  if (diploma.status === 'revoque') {
    return res.status(400).json({ error: 'Ce document est révoqué et ne peut plus être imprimé.' });
  }

  diploma.printCount = (diploma.printCount || 0) + 1;
  const reason = req.body.reason || (diploma.printCount === 1 ? 'Impression originale' : `Duplicata certifié N° ${diploma.printCount}`);

  diploma.printHistory.push({
    printedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    printedBy: actor.name,
    copyNumber: diploma.printCount,
    reason,
  });

  if (diploma.status === 'brouillon' || diploma.status === 'delivre') {
    diploma.status = 'imprime';
  }

  logAudit(
    actor,
    'IMPRESSION_DIPLOME',
    'diplome',
    diploma.id,
    `Impression officielle (Exemplaire n°${diploma.printCount} - ${reason}) du document ${diploma.serialNumber} par ${actor.name}`
  );

  persistStore();
  res.json({ success: true, data: diploma });
});

// Revoke diploma
apiRouter.post('/diplomas/:id/revoke', requireRoles(...ROLES.DIRECTION), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const diploma = store.diplomas.find((d) => d.id === req.params.id);
  if (!diploma) return res.status(404).json({ error: 'Document non trouvé' });

  const reason = req.body.reason;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Un motif officiel de révocation est obligatoire.' });
  }

  diploma.status = 'revoque';
  diploma.revocationReason = reason.trim();
  diploma.revokedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
  diploma.revokedBy = actor.name;

  logAudit(
    actor,
    'REVOCATION_DIPLOME',
    'diplome',
    diploma.id,
    `RÉVOCATION OFFICIELLE du document ${diploma.serialNumber}. Motif : ${diploma.revocationReason}`
  );

  persistStore();
  res.json({ success: true, data: diploma });
});

// Delete diploma (only for drafts or admin)
apiRouter.delete('/diplomas/:id', requireRoles(...ROLES.DIRECTION), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const index = store.diplomas.findIndex((d) => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Document non trouvé' });

  const [removed] = store.diplomas.splice(index, 1);
  logAudit(
    actor,
    'SUPPRESSION_DIPLOME',
    'diplome',
    removed.id,
    `Suppression du document ${removed.serialNumber} (${removed.title})`
  );

  persistStore();
  res.json({ success: true, message: 'Document supprimé' });
});

// Batch generation for a program
apiRouter.post('/diplomas/batch-generate', requireRoles(...ROLES.DIPLOMES), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  if (!store.diplomas) store.diplomas = [];

  const { programId, type, deliberationDate, deliberationPvNumber, studentIds } = req.body;
  if (!programId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'Filière et liste des étudiants requises' });
  }

  const program = store.programs.find((p) => p.id === programId);
  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';

  const generated: DiplomaCertificate[] = [];

  for (const studentId of studentIds) {
    // Check if student already has this diploma type for this program
    const alreadyHas = store.diplomas.some(
      (d) => d.studentId === studentId && d.programId === programId && d.type === type && d.status !== 'revoque'
    );
    if (alreadyHas) continue;

    const serialNumber = generateUniqueSerialNumber(store, type || 'diplome_licence', currentYear);
    const securityToken = generateSecurityToken(currentYear);
    const qrVerificationData = `https://ismnm-dakar.sn/verify?sn=${encodeURIComponent(serialNumber)}&token=${encodeURIComponent(securityToken)}`;

    let defaultTitle = 'Diplôme de Fin d\'Études';
    if (type === 'diplome_licence') defaultTitle = `Diplôme de Licence Professionnelle en ${program?.title || 'Informatique'}`;
    else if (type === 'diplome_master') defaultTitle = `Diplôme de Master Professionnel en ${program?.title || 'Gestion'}`;
    else if (type === 'attestation_reussite') defaultTitle = `Attestation Provisoire de Réussite - ${program?.title || 'Cycle LMD'}`;
    else if (type === 'attestation_scolarite') defaultTitle = `Attestation d'Inscription & d'Assiduité - ${program?.title || 'Cycle LMD'}`;

    const newDoc: DiplomaCertificate = {
      id: `cert_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      serialNumber,
      securityToken,
      studentId,
      programId,
      academicYearId: 'year_2024_2025',
      type: type || 'diplome_licence',
      title: defaultTitle,
      specialization: program?.title || '',
      mention: 'Bien',
      finalAverage: 14.5,
      totalCreditsEarned: type === 'diplome_master' ? 120 : 180,
      deliberationDate: deliberationDate || new Date().toISOString().split('T')[0],
      deliberationPvNumber: deliberationPvNumber || `PV-DELIB-${currentYear}/BATCH`,
      deliveryDate: new Date().toISOString().split('T')[0],
      juryPresident: 'Pr. Ousmane Abdoulaye Diop',
      directorName: 'Dr. Aïssatou Ndiaye Diouf',
      registrarName: 'Fatou Kiné Sow',
      status: 'delivre',
      printCount: 0,
      printHistory: [],
      notes: 'Génération groupée de promotion délibérée.',
      qrVerificationData,
    };

    store.diplomas.unshift(newDoc);
    generated.push(newDoc);
  }

  logAudit(
    actor,
    'GENERATION_LOT_DIPLOMES',
    'diplome',
    programId,
    `Génération en lot de ${generated.length} document(s) (${type}) pour la filière ${program?.title || programId}`
  );

  persistStore();
  res.json({ success: true, count: generated.length, data: generated });
});

// 12. GESTION DE BIBLIOTHÈQUE & FONDS DOCUMENTAIRE (Ouvrages & Emprunts)
apiRouter.get('/library/books', (_req: Request, res: Response) => {
  const store = getStore();
  res.json({ success: true, data: store.books || [] });
});

apiRouter.post('/library/books', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { isbn, title, author, category, publisher, publishYear, location, totalCopies, description } = req.body;

  if (!title || !author) {
    return res.status(400).json({ error: 'Le titre et l auteur sont obligatoires' });
  }

  const copies = Math.max(1, Number(totalCopies) || 1);
  const newBook: Book = {
    id: `book_${Date.now()}`,
    isbn: isbn || `978-2-${Math.floor(100000000 + Math.random() * 900000000)}`,
    title,
    author,
    category: category || 'Général',
    publisher: publisher || 'Édition Académique',
    publishYear: Number(publishYear) || new Date().getFullYear(),
    location: location || 'Rayon Général',
    totalCopies: copies,
    availableCopies: copies,
    description: description || '',
    createdAt: new Date().toISOString().split('T')[0],
  };

  if (!store.books) store.books = [];
  store.books.unshift(newBook);
  logAudit(actor, 'CREATION_OUVRAGE', 'livre', newBook.id, `Enregistrement du livre "${newBook.title}" (${copies} ex.)`);
  persistStore();

  res.json({ success: true, data: newBook });
});

apiRouter.put('/library/books/:id', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const bookIndex = store.books?.findIndex((b) => b.id === req.params.id);

  if (bookIndex === -1 || bookIndex === undefined) {
    return res.status(404).json({ error: 'Ouvrage introuvable' });
  }

  const existing = store.books[bookIndex];
  const oldTotal = existing.totalCopies;
  const newTotal = req.body.totalCopies !== undefined ? Math.max(1, Number(req.body.totalCopies)) : oldTotal;
  const difference = newTotal - oldTotal;

  const updated: Book = {
    ...existing,
    ...req.body,
    totalCopies: newTotal,
    availableCopies: Math.max(0, existing.availableCopies + difference),
  };

  store.books[bookIndex] = updated;
  logAudit(actor, 'MODIFICATION_OUVRAGE', 'livre', updated.id, `Mise à jour de l ouvrage "${updated.title}"`);
  persistStore();

  res.json({ success: true, data: updated });
});

apiRouter.delete('/library/books/:id', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const book = store.books?.find((b) => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({ error: 'Ouvrage introuvable' });
  }

  // Check if active loans exist
  const activeLoans = store.bookLoans?.filter((l) => l.bookId === book.id && l.status !== 'rendu');
  if (activeLoans && activeLoans.length > 0) {
    return res.status(400).json({ error: `Impossible de supprimer cet ouvrage car ${activeLoans.length} exemplaire(s) sont actuellement empruntés.` });
  }

  store.books = store.books.filter((b) => b.id !== req.params.id);
  logAudit(actor, 'SUPPRESSION_OUVRAGE', 'livre', book.id, `Suppression de l ouvrage "${book.title}"`);
  persistStore();

  res.json({ success: true, message: 'Ouvrage supprimé avec succès' });
});

// Emprunts
apiRouter.get('/library/loans', (_req: Request, res: Response) => {
  const store = getStore();
  const today = new Date().toISOString().split('T')[0];

  // Auto-flag overdue loans
  if (store.bookLoans) {
    store.bookLoans.forEach((loan) => {
      if (loan.status === 'en_cours' && loan.dueDate < today) {
        loan.status = 'en_retard';
      }
    });
  }

  res.json({ success: true, data: store.bookLoans || [] });
});

apiRouter.post('/library/loans', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { bookId, studentId, loanDate, dueDate, conditionAtLoan, remarks } = req.body;

  const book = store.books?.find((b) => b.id === bookId);
  if (!book) {
    return res.status(404).json({ error: 'Ouvrage introuvable' });
  }

  if (book.availableCopies <= 0) {
    return res.status(400).json({ error: 'Aucun exemplaire disponible pour cet ouvrage actuellement' });
  }

  const student = store.students?.find((s) => s.id === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Étudiant introuvable' });
  }

  const today = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const currentYear = store.academicYears?.find((y) => y.isCurrent)?.code?.split('-')[0] || '2025';
  const count = (store.bookLoans?.length || 0) + 1;
  const loanNumber = `EMP-${currentYear}-${String(count).padStart(4, '0')}`;

  const newLoan: BookLoan = {
    id: `loan_${Date.now()}`,
    loanNumber,
    bookId: book.id,
    bookTitle: book.title,
    bookIsbn: book.isbn,
    studentId: student.id,
    studentMatricule: student.matricule,
    studentName: `${student.firstName} ${student.lastName}`,
    loanDate: loanDate || today,
    dueDate: dueDate || defaultDueDate,
    status: 'en_cours',
    conditionAtLoan: conditionAtLoan || 'bon_etat',
    remarks: remarks || '',
    recordedBy: `${actor.name} (${actor.role})`,
    extensionCount: 0,
  };

  book.availableCopies = Math.max(0, book.availableCopies - 1);
  if (!store.bookLoans) store.bookLoans = [];
  store.bookLoans.unshift(newLoan);

  logAudit(
    actor,
    'EMPRUNT_LIVRE',
    'emprunt',
    newLoan.id,
    `Prêt de "${book.title}" à l étudiant ${student.firstName} ${student.lastName} (${student.matricule}) - Échéance : ${newLoan.dueDate}`
  );

  persistStore();
  res.json({ success: true, data: newLoan, bookAvailableCopies: book.availableCopies });
});

apiRouter.put('/library/loans/:id/return', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const loan = store.bookLoans?.find((l) => l.id === req.params.id);

  if (!loan) {
    return res.status(404).json({ error: 'Fiche d emprunt introuvable' });
  }

  if (loan.status === 'rendu') {
    return res.status(400).json({ error: 'Cet emprunt a déjà été enregistré comme restitué' });
  }

  const { returnDate, conditionAtReturn, remarks } = req.body;
  const today = new Date().toISOString().split('T')[0];

  loan.status = 'rendu';
  loan.returnDate = returnDate || today;
  loan.conditionAtReturn = conditionAtReturn || loan.conditionAtLoan || 'bon_etat';
  loan.returnedBy = `${actor.name} (${actor.role})`;
  if (remarks) loan.remarks = (loan.remarks ? loan.remarks + ' | ' : '') + remarks;

  // Restock book
  const book = store.books?.find((b) => b.id === loan.bookId);
  if (book) {
    book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
  }

  logAudit(
    actor,
    'RETOUR_LIVRE',
    'emprunt',
    loan.id,
    `Restitution du livre "${loan.bookTitle}" par ${loan.studentName} (État : ${loan.conditionAtReturn})`
  );

  persistStore();
  res.json({ success: true, data: loan, bookAvailableCopies: book?.availableCopies });
});

apiRouter.put('/library/loans/:id/extend', requireRoles(...ROLES.BIBLIOTHEQUE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const loan = store.bookLoans?.find((l) => l.id === req.params.id);

  if (!loan) {
    return res.status(404).json({ error: 'Fiche d emprunt introuvable' });
  }

  if (loan.status === 'rendu') {
    return res.status(400).json({ error: 'Impossible de prolonger un emprunt déjà restitué' });
  }

  const extensionDays = Number(req.body.extensionDays) || 14;
  const currentDue = new Date(loan.dueDate);
  currentDue.setDate(currentDue.getDate() + extensionDays);
  const newDueDate = currentDue.toISOString().split('T')[0];

  loan.dueDate = newDueDate;
  loan.extensionCount = (loan.extensionCount || 0) + 1;
  const today = new Date().toISOString().split('T')[0];
  if (newDueDate >= today) {
    loan.status = 'en_cours';
  }

  logAudit(
    actor,
    'PROLONGATION_EMPRUNT',
    'emprunt',
    loan.id,
    `Prolongation de ${extensionDays} jours de l emprunt "${loan.bookTitle}" pour ${loan.studentName}. Nouvelle échéance : ${newDueDate}`
  );

  persistStore();
  res.json({ success: true, data: loan });
});

// 13. PLANIFICATION DES COURS & EXAMENS (Emploi du temps & Sessions)
apiRouter.post('/timetables', requireRoles(...ROLES.PLANNING), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { programId, moduleId, teacherId, room, dayOfWeek, startTime, endTime, sessionType, date, supervisor, notes } = req.body;

  if (!programId || !moduleId || !room || !startTime || !endTime) {
    return res.status(400).json({ error: 'Champs obligatoires manquants pour la séance' });
  }

  const newSlot: TimetableSlot = {
    id: `tt_${Date.now()}`,
    programId,
    moduleId,
    teacherId: teacherId || '',
    room,
    dayOfWeek: dayOfWeek || 'Lundi',
    startTime,
    endTime,
    sessionType: sessionType || 'cours',
    date: date || undefined,
    supervisor: supervisor || undefined,
    notes: notes || undefined,
  };

  if (!store.timetables) store.timetables = [];
  store.timetables.push(newSlot);

  const moduleObj = store.modules.find((m) => m.id === moduleId);
  logAudit(
    actor,
    'PLANIFICATION_SESSION',
    'module',
    newSlot.id,
    `Planification ${newSlot.sessionType || 'cours'} : ${moduleObj?.moduleTitle || moduleId} (${newSlot.dayOfWeek} ${newSlot.startTime}-${newSlot.endTime} en salle ${room})`
  );

  persistStore();
  res.json({ success: true, data: newSlot });
});

apiRouter.put('/timetables/:id', requireRoles(...ROLES.PLANNING), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const index = store.timetables.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Créneau introuvable' });
  }

  const updated: TimetableSlot = {
    ...store.timetables[index],
    ...req.body,
  };
  store.timetables[index] = updated;

  logAudit(
    actor,
    'MODIFICATION_SESSION',
    'module',
    updated.id,
    `Modification du créneau / session : ${updated.dayOfWeek} ${updated.startTime}-${updated.endTime} salle ${updated.room}`
  );

  persistStore();
  res.json({ success: true, data: updated });
});

apiRouter.delete('/timetables/:id', requireRoles(...ROLES.PLANNING), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const slot = store.timetables.find((t) => t.id === req.params.id);
  if (!slot) {
    return res.status(404).json({ error: 'Créneau introuvable' });
  }

  store.timetables = store.timetables.filter((t) => t.id !== req.params.id);
  logAudit(
    actor,
    'SUPPRESSION_SESSION',
    'module',
    slot.id,
    `Suppression du créneau : ${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}`
  );

  persistStore();
  res.json({ success: true, message: 'Créneau supprimé' });
});

// 15. RECOUVREMENT : RELANCES DES IMPAYÉS
const REMINDER_CHANNELS: ReminderChannel[] = ['whatsapp', 'sms', 'email', 'appel', 'courrier'];
const REMINDER_LEVELS: ReminderLevel[] = ['courtoise', 'ferme', 'mise_en_demeure'];

apiRouter.get('/reminders', requireRoles(...ROLES.RELANCE), (_req: Request, res: Response) => {
  res.json({ success: true, data: getStore().reminders || [] });
});

apiRouter.post('/reminders', requireRoles(...ROLES.RELANCE), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { studentId, channel, level, recipient, message, promiseDate, notes } = req.body;

  const student = store.students.find((s) => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Étudiant introuvable' });
  if (!REMINDER_CHANNELS.includes(channel)) return res.status(400).json({ error: 'Canal de relance invalide' });
  if (!REMINDER_LEVELS.includes(level)) return res.status(400).json({ error: 'Niveau de relance invalide' });
  if (!isNonEmptyString(message, 10)) return res.status(400).json({ error: 'Le message de relance est obligatoire' });
  if (level === 'mise_en_demeure' && !['admin', 'dg', 'comptable'].includes(actor.role)) {
    return res.status(403).json({ error: 'La mise en demeure est réservée à la comptabilité et à la direction' });
  }

  const unpaid = store.invoices.filter((i) => i.studentId === studentId && i.balanceDue > 0);
  if (unpaid.length === 0) return res.status(400).json({ error: 'Cet étudiant n a aucun impayé : relance inutile' });

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const relPrefix = `REL-${currentYear}-`;
  const reminder: PaymentReminder = {
    id: `rem_${Date.now()}_${secureToken(4).toLowerCase()}`,
    reminderNumber: formatSequence(relPrefix, nextSequence((store.reminders || []).map((r) => r.reminderNumber), relPrefix), 5),
    studentId,
    invoiceIds: unpaid.map((i) => i.id),
    amountDue: unpaid.reduce((sum, i) => sum + i.balanceDue, 0),
    channel,
    level,
    recipient: String(recipient || student.parentPhone || student.phone || ''),
    message: message.trim(),
    sentAt: nowTimestamp(),
    sentBy: actor.name,
    promiseDate: promiseDate || undefined,
    notes: notes || undefined,
  };

  if (!store.reminders) store.reminders = [];
  store.reminders.unshift(reminder);
  logAudit(
    actor,
    'RELANCE_IMPAYE',
    'relance',
    reminder.reminderNumber,
    `Relance ${level} (${channel}) envoyée à ${student.firstName} ${student.lastName} pour ${reminder.amountDue} FCFA${promiseDate ? `. Promesse de paiement au ${promiseDate}` : ''}`
  );
  persistStore();
  res.status(201).json({ success: true, data: reminder });
});

// 16. SAUVEGARDE & RESTAURATION DE LA BASE
const REQUIRED_STORE_KEYS: (keyof AppStore)[] = [
  'config', 'academicYears', 'programs', 'users', 'students', 'enrollments', 'invoices',
  'receipts', 'cashSession', 'expenses', 'modules', 'grades', 'timetables', 'auditLogs',
];

apiRouter.get('/admin/backup', requireRoles(...ROLES.DIRECTION), (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  logAudit(actor, 'EXPORT_SAUVEGARDE', 'systeme', 'backup', 'Téléchargement d une sauvegarde complète de la base');
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').substring(0, 19);
  res.setHeader('Content-Disposition', `attachment; filename="dgb-sauvegarde-${stamp}.json"`);
  res.json({
    format: 'dgb-app-pro-backup',
    version: 1,
    exportedAt: nowTimestamp(),
    exportedBy: actor.name,
    data: store,
  });
});

apiRouter.post('/admin/restore', requireRoles(...ROLES.ADMIN), (req: Request, res: Response) => {
  const actor = getActor(req);
  const payload = req.body;
  const data = payload?.format === 'dgb-app-pro-backup' ? payload.data : payload;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Fichier de sauvegarde illisible' });
  }
  const missing = REQUIRED_STORE_KEYS.filter((k) => data[k] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Sauvegarde incomplète : sections manquantes (${missing.join(', ')})` });
  }
  const arrays = REQUIRED_STORE_KEYS.filter((k) => k !== 'config' && k !== 'cashSession');
  const notArrays = arrays.filter((k) => !Array.isArray(data[k]));
  if (notArrays.length > 0) {
    return res.status(400).json({ error: `Sauvegarde corrompue : sections invalides (${notArrays.join(', ')})` });
  }

  const restored: AppStore = {
    cashSessionsHistory: [],
    attendance: [],
    diplomas: [],
    books: [],
    bookLoans: [],
    reminders: [],
    ...data,
  };
  replaceStore(restored);
  logAudit(
    actor,
    'RESTAURATION_SAUVEGARDE',
    'systeme',
    'restore',
    `Restauration d une sauvegarde (${restored.students.length} étudiants, ${restored.invoices.length} factures, ${restored.receipts.length} reçus)`,
    payload?.exportedAt ? `Sauvegarde du ${payload.exportedAt}` : undefined
  );
  res.json({ success: true, data: { students: restored.students.length, invoices: restored.invoices.length } });
});

// 14. AUTOMATED TESTS & DATA INTEGRITY RUNNER (Section 4)
apiRouter.get('/tests/run', (_req: Request, res: Response) => {
  const testReport = runFinancialAndIntegrityTests();
  res.json({ success: true, data: testReport });
});

// 12. RESET TO DEMO DATA
apiRouter.post('/admin/reset', requireRoles(...ROLES.ADMIN), (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l administrateur' });
  }
  const fresh = resetStore();
  logAudit(actor, 'REINITIALISATION_DEMO', 'parametre', 'all', 'Réinitialisation des données de démonstration');
  res.json({ success: true, data: fresh });
});
