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
  StudentAdmission,
  TimetableSlot,
  UserRole,
  VendorExpense,
} from '../src/types/index';
import { getStore, logAudit, persistStore, resetStore } from './db';
import { runFinancialAndIntegrityTests } from './tests';

export const apiRouter = Router();

// Middleware helper to extract current user/role
function getActor(req: Request) {
  const store = getStore();
  const userId = (req.headers['x-user-id'] as string) || 'usr_admin';
  const role = (req.headers['x-user-role'] as UserRole) || 'admin';
  const user = store.users.find((u) => u.id === userId) || store.users[0];
  return {
    id: user.id,
    name: user.name,
    role: role || user.activeRole || 'admin',
  };
}

// 1. BOOTSTRAP / FULL STORE
apiRouter.get('/bootstrap', (_req: Request, res: Response) => {
  res.json({ success: true, data: getStore() });
});

// 2. CONFIGURATION UPDATE
apiRouter.put('/config', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin' && actor.role !== 'dg') {
    return res.status(403).json({ error: 'Accès réservé à l administration et la direction générale' });
  }
  const store = getStore();
  store.config = { ...store.config, ...req.body };
  logAudit(actor, 'MODIFICATION_CONFIG', 'parametre', store.config.id, 'Mise à jour des paramètres de l établissement');
  persistStore();
  res.json({ success: true, data: store.config });
});

// 3. STUDENT ADMISSIONS & DOSSIERS
apiRouter.post('/students', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';

  // Generate unique matricule: e.g. ISMNM-2025-0018
  const count = store.students.length + 1;
  const matricule = `${store.config.documentNumbering.matriculePrefix}-${currentYear}-${String(count).padStart(4, '0')}`;

  const newStudent: StudentAdmission = {
    id: `stu_${Date.now()}`,
    matricule,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
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

apiRouter.put('/students/:id/status', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const student = store.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Étudiant non trouvé' });

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

// 4. ENROLLMENT & AUTOMATIC INVOICE GENERATION
apiRouter.post('/enrollments', (req: Request, res: Response) => {
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
  const invoicesToCreate: InvoiceSchedule[] = [];

  // 1. Frais d'inscription (échéance immédiate)
  const regInvNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 1).padStart(5, '0')}`;
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
    const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 2).padStart(5, '0')}`;
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
      const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 2 + i).padStart(5, '0')}`;

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
      invoiceNumber: `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 2).padStart(5, '0')}`,
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
      invoiceNumber: `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 3).padStart(5, '0')}`,
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
      const invNum = `${store.config.documentNumbering.invoicePrefix}-${invYear}-${String(store.invoices.length + 2 + i).padStart(5, '0')}`;

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

// 5. PAYMENTS & RECEIPTS (With anti-doublon idempotency & partial payment support)
apiRouter.post('/payments', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const {
    studentId,
    invoiceScheduleId,
    amount,
    paymentMethod,
    idempotencyKey,
    transactionRef,
    notes,
  } = req.body;

  const numAmount = Math.round(Number(amount));
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  // Idempotency check (Section 4: un double clic ou webhook répété ne doit pas créer deux encaissements)
  const safeIdempKey = idempotencyKey || `auto_idemp_${studentId}_${numAmount}_${Date.now()}`;
  const existingReceipt = store.receipts.find((r) => r.idempotencyKey === safeIdempKey);
  if (existingReceipt) {
    return res.status(409).json({
      error: 'Paiement déjà traité avec cette référence (idempotence anti-doublon)',
      receipt: existingReceipt,
    });
  }

  // Find invoice or student pending invoices
  let targetInvoice: InvoiceSchedule | undefined;
  if (invoiceScheduleId) {
    targetInvoice = store.invoices.find((i) => i.id === invoiceScheduleId);
  } else {
    // FIFO allocation: find oldest pending invoice for student
    targetInvoice = store.invoices
      .filter((i) => i.studentId === studentId && i.balanceDue > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  }

  if (!targetInvoice) {
    return res.status(400).json({ error: 'Aucune facture à solder trouvée pour cet étudiant' });
  }

  const enrollment = store.enrollments.find((e) => e.id === targetInvoice!.enrollmentId);

  // Apply payment to invoice
  const currentPaid = targetInvoice.paidAmount;
  const newPaid = currentPaid + numAmount;
  targetInvoice.paidAmount = newPaid;
  targetInvoice.balanceDue = calculateBalanceDue(targetInvoice.netAmount, newPaid);

  if (targetInvoice.balanceDue === 0) {
    targetInvoice.status = 'solde';
  } else if (newPaid > 0) {
    targetInvoice.status = 'partiel'; // Ne pas marquer la facture soldée si reste dû > 0 !
  }

  // Generate Receipt
  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const receiptCount = store.receipts.length + 1;
  const receiptNumber = `${store.config.documentNumbering.receiptPrefix}-${currentYear}-${String(receiptCount).padStart(5, '0')}`;

  const newReceipt: PaymentReceipt = {
    id: `rec_${Date.now()}`,
    receiptNumber,
    idempotencyKey: safeIdempKey,
    studentId,
    enrollmentId: enrollment?.id || '',
    invoiceScheduleId: targetInvoice.id,
    amount: numAmount,
    paymentMethod: (paymentMethod as PaymentMethod) || 'especes',
    paymentDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    recordedBy: `${actor.name} (${actor.role})`,
    transactionRef: transactionRef || undefined,
    status: 'valide',
    notes: notes || '',
    isConfirmedByServer: true,
  };

  store.receipts.unshift(newReceipt);

  // If cash payment, update open cash register session
  if (paymentMethod === 'especes' && store.cashSession && store.cashSession.status === 'ouverte') {
    store.cashSession.totalCashIn += numAmount;
    store.cashSession.theoreticalBalance =
      store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
    store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;
  }

  logAudit(
    actor,
    targetInvoice.status === 'partiel' ? 'ENCAISSEMENT_PARTIEL' : 'ENCAISSEMENT',
    'paiement',
    newReceipt.receiptNumber,
    `Encaissement de ${numAmount} FCFA par ${paymentMethod} pour la facture ${targetInvoice.invoiceNumber}. Nouveau solde dû: ${targetInvoice.balanceDue} FCFA.`
  );

  persistStore();

  res.status(201).json({
    success: true,
    data: {
      receipt: newReceipt,
      updatedInvoice: targetInvoice,
    },
  });
});

// 6. PAYMENT CANCELLATION & REGULARIZATION (Section 3.E: Ne jamais effacer l'opération originale)
apiRouter.post('/payments/:id/cancel', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin' && actor.role !== 'dg' && actor.role !== 'comptable') {
    return res.status(403).json({ error: 'Autorisation insuffisante pour annuler un encaissement' });
  }

  const { reason } = req.body;
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'Le motif d annulation est obligatoire et doit être explicite' });
  }

  const store = getStore();
  const receipt = store.receipts.find((r) => r.id === req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Reçu non trouvé' });
  if (receipt.status === 'annule') return res.status(400).json({ error: 'Ce reçu est déjà annulé' });

  // Mark as cancelled and link regularization
  receipt.status = 'annule';
  receipt.cancellationDetails = {
    cancelledAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    cancelledBy: actor.name,
    reason,
    regularizationOperationId: `reg_op_${Date.now()}`,
  };

  // Re-adjust invoice
  if (receipt.invoiceScheduleId) {
    const inv = store.invoices.find((i) => i.id === receipt.invoiceScheduleId);
    if (inv) {
      inv.paidAmount = Math.max(0, inv.paidAmount - receipt.amount);
      inv.balanceDue = calculateBalanceDue(inv.netAmount, inv.paidAmount);
      inv.status = inv.paidAmount === 0 ? 'en_attente' : 'partiel';
    }
  }

  // Adjust cash if it was cash
  if (receipt.paymentMethod === 'especes' && store.cashSession?.status === 'ouverte') {
    store.cashSession.totalCashIn = Math.max(0, store.cashSession.totalCashIn - receipt.amount);
    store.cashSession.theoreticalBalance =
      store.cashSession.initialCash + store.cashSession.totalCashIn - store.cashSession.totalCashOut;
    store.cashSession.actualCountedBalance = store.cashSession.theoreticalBalance;
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
apiRouter.post('/cash/open', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { initialCash, notes } = req.body;

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const sessionCount = store.cashSessionsHistory.length + 1;
  const sessionNumber = `CSH-${currentYear}-${String(sessionCount).padStart(4, '0')}`;

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

apiRouter.post('/cash/close', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { actualCountedBalance, notes } = req.body;

  if (!store.cashSession || store.cashSession.status !== 'ouverte') {
    return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
  }

  const counted = Math.round(Number(actualCountedBalance) || 0);
  const diff = counted - store.cashSession.theoreticalBalance;

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

apiRouter.post('/cash/movement', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { type, amount, motive } = req.body;

  if (!store.cashSession || store.cashSession.status !== 'ouverte') {
    return res.status(400).json({ error: 'Aucune session de caisse ouverte' });
  }

  const num = Math.round(Number(amount) || 0);
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

apiRouter.post('/academic-years/:id/close', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const yr = store.academicYears.find((y) => y.id === req.params.id);
  if (!yr) return res.status(404).json({ error: 'Année académique non trouvée' });

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
apiRouter.post('/expenses', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { vendorName, category, description, amount, dueDate, stage, paymentMethod } = req.body;

  const currentYear = store.academicYears.find((y) => y.isCurrent)?.code.split('-')[0] || '2025';
  const count = store.expenses.length + 1;
  const expenseNumber = `${store.config.documentNumbering.expensePrefix}-${currentYear}-${String(count).padStart(5, '0')}`;
  const numAmount = Math.round(Number(amount));

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

apiRouter.put('/expenses/:id/stage', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const expense = store.expenses.find((e) => e.id === req.params.id);
  if (!expense) return res.status(404).json({ error: 'Dépense non trouvée' });

  const { newStage, paymentMethod } = req.body;
  const oldStage = expense.stage;
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
apiRouter.get('/treasury/projection', (_req: Request, res: Response) => {
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
apiRouter.post('/grades', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { studentId, moduleId, academicYearId, continuousAssessmentNote, examNote, status } = req.body;

  const cc = Number(continuousAssessmentNote) || 0;
  const exam = Number(examNote) || 0;
  // Weighted note in LMD: 40% Continuous assessment + 60% Exam
  const finalNote = Math.round((cc * 0.4 + exam * 0.6) * 10) / 10;

  let existing = store.grades.find(
    (g) => g.studentId === studentId && g.moduleId === moduleId && g.academicYearId === academicYearId
  );

  if (existing) {
    existing.continuousAssessmentNote = cc;
    existing.examNote = exam;
    existing.finalNote = finalNote;
    existing.status = status || existing.status;
  } else {
    existing = {
      id: `grd_${Date.now()}`,
      studentId,
      moduleId,
      academicYearId,
      continuousAssessmentNote: cc,
      examNote: exam,
      finalNote,
      status: status || 'brouillon',
    };
    store.grades.unshift(existing);
  }

  logAudit(actor, 'SAISIE_NOTE', 'note', existing.id, `Note saisie pour étudiant ${studentId} module ${moduleId} : ${finalNote}/20 (Statut: ${existing.status})`);
  persistStore();
  res.json({ success: true, data: existing });
});

// Batch grades update for teachers
apiRouter.post('/grades/batch', (req: Request, res: Response) => {
  const actor = getActor(req);
  const store = getStore();
  const { grades: gradeList } = req.body;

  if (!Array.isArray(gradeList) || gradeList.length === 0) {
    return res.status(400).json({ error: 'Liste de notes invalide ou vide' });
  }

  const updatedItems: GradeItem[] = [];

  for (const item of gradeList) {
    const { studentId, moduleId, academicYearId, continuousAssessmentNote, examNote, catchUpExamNote, status } = item;
    if (!studentId || !moduleId) continue;

    const cc = continuousAssessmentNote !== undefined ? Number(continuousAssessmentNote) : 0;
    const exam = examNote !== undefined ? Number(examNote) : 0;
    const catchUp = catchUpExamNote !== undefined ? Number(catchUpExamNote) : undefined;
    const effectiveExam = catchUp !== undefined && catchUp > exam ? catchUp : exam;
    const finalNote = Math.round((cc * 0.4 + effectiveExam * 0.6) * 10) / 10;

    let existing = store.grades.find(
      (g) => g.studentId === studentId && g.moduleId === moduleId && (!academicYearId || g.academicYearId === academicYearId)
    );

    if (existing) {
      existing.continuousAssessmentNote = cc;
      existing.examNote = exam;
      if (catchUp !== undefined) existing.catchUpExamNote = catchUp;
      existing.finalNote = finalNote;
      if (status) existing.status = status;
      updatedItems.push(existing);
    } else {
      const newGrade: GradeItem = {
        id: `grd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        studentId,
        moduleId,
        academicYearId: academicYearId || 'year_2025_2026',
        continuousAssessmentNote: cc,
        examNote: exam,
        catchUpExamNote: catchUp,
        finalNote,
        status: status || 'brouillon',
      };
      store.grades.unshift(newGrade);
      updatedItems.push(newGrade);
    }
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

apiRouter.post('/attendance', (req: Request, res: Response) => {
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

apiRouter.put('/attendance/:id', (req: Request, res: Response) => {
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

apiRouter.post('/attendance/:id/sign', (req: Request, res: Response) => {
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

apiRouter.delete('/attendance/:id', (req: Request, res: Response) => {
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SEC-${p1}-${p2}-${year}`;
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
apiRouter.post('/diplomas', (req: Request, res: Response) => {
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
apiRouter.put('/diplomas/:id', (req: Request, res: Response) => {
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
apiRouter.post('/diplomas/:id/print', (req: Request, res: Response) => {
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
apiRouter.post('/diplomas/:id/revoke', (req: Request, res: Response) => {
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
apiRouter.delete('/diplomas/:id', (req: Request, res: Response) => {
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
apiRouter.post('/diplomas/batch-generate', (req: Request, res: Response) => {
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

apiRouter.post('/library/books', (req: Request, res: Response) => {
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

apiRouter.put('/library/books/:id', (req: Request, res: Response) => {
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

apiRouter.delete('/library/books/:id', (req: Request, res: Response) => {
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

apiRouter.post('/library/loans', (req: Request, res: Response) => {
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

apiRouter.put('/library/loans/:id/return', (req: Request, res: Response) => {
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

apiRouter.put('/library/loans/:id/extend', (req: Request, res: Response) => {
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
apiRouter.post('/timetables', (req: Request, res: Response) => {
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

apiRouter.put('/timetables/:id', (req: Request, res: Response) => {
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

apiRouter.delete('/timetables/:id', (req: Request, res: Response) => {
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

// 14. AUTOMATED TESTS & DATA INTEGRITY RUNNER (Section 4)
apiRouter.get('/tests/run', (_req: Request, res: Response) => {
  const testReport = runFinancialAndIntegrityTests();
  res.json({ success: true, data: testReport });
});

// 12. RESET TO DEMO DATA
apiRouter.post('/admin/reset', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l administrateur' });
  }
  const fresh = resetStore();
  logAudit(actor, 'REINITIALISATION_DEMO', 'parametre', 'all', 'Réinitialisation des données de démonstration');
  res.json({ success: true, data: fresh });
});
