export type UserRole =
  | 'admin'
  | 'dg'
  | 'scolarite'
  | 'pedagogie'
  | 'comptable'
  | 'caissier'
  | 'enseignant'
  | 'etudiant';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  avatarUrl?: string;
  studentId?: string; // If user is an enrolled student
  teacherId?: string; // If user is a teacher
}

export interface EstablishmentConfig {
  id: string;
  name: string;
  acronym: string;
  motto: string;
  logoUrl?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  ninea: string;
  rc: string;
  accreditationNumber?: string;
  activeAcademicYearId: string;
  sites: CampusSite[];
  documentNumbering: {
    matriculePrefix: string;
    invoicePrefix: string;
    receiptPrefix: string;
    expensePrefix: string;
  };
}

export interface CampusSite {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface AcademicYear {
  id: string;
  code: string; // e.g. "2024-2025", "2025-2026"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean; // Closed year cannot be modified by ordinary users
}

export interface Program {
  id: string;
  code: string; // e.g. "L-INFO", "M-CCA"
  title: string;
  domain: string; // e.g. "Sciences & Technologies", "Gestion & Économie"
  level: 'Licence' | 'Master' | 'Doctorat';
  yearLevel: 'L1' | 'L2' | 'L3' | 'M1' | 'M2';
  semesters: string[]; // e.g. ["S1", "S2"]
  accreditationRef: string; // e.g. "Arrêté Ministériel MESRI N° 004128"
  accreditationValidUntil: string;
  isRegulatedCertified: boolean; // Flag indicating presence of documentation
  defaultFees: {
    registrationFee: number; // in integer FCFA
    tuitionFee: number; // in integer FCFA
    labFee: number;
    otherFees: number;
  };
}

export type PaymentPlanType = 'comptant' | 'mensuel' | 'trimestriel' | 'tranches';

export interface StudentAdmission {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthPlace: string;
  nationality: string;
  cniPassport: string;
  email: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  address: string;
  city: string;
  status: 'candidat' | 'admis' | 'rejete' | 'inscrit' | 'suspendu';
  submissionDate: string;
  admissionDecisionDate?: string;
  admissionNotes?: string;
  documents: {
    name: string;
    status: 'depose' | 'en_attente' | 'valide' | 'rejete';
  }[];
}

export interface Enrollment {
  id: string;
  studentId: string;
  programId: string;
  academicYearId: string;
  enrollmentDate: string;
  paymentPlan: PaymentPlanType;
  discountType?: 'none' | 'etat' | 'sociale' | 'fratrie' | 'excellence' | 'partenaire';
  discountAmount: number; // integer FCFA
  discountApprovedBy?: string;
  discountReason?: string;
  lockedRegistrationFee: number; // Preserved applied tariff at enrollment
  lockedTuitionFee: number;
  lockedOtherFees: number;
  totalGross: number;
  totalNet: number;
  isClosed: boolean;
}

export interface InvoiceSchedule {
  id: string;
  enrollmentId: string;
  studentId: string;
  invoiceNumber: string;
  title: string;
  dueDate: string;
  grossAmount: number; // FCFA integer
  discountShare: number; // FCFA integer
  netAmount: number; // FCFA integer
  paidAmount: number; // FCFA integer
  balanceDue: number; // FCFA integer (netAmount - paidAmount)
  status: 'en_attente' | 'partiel' | 'solde' | 'en_retard';
  category: 'inscription' | 'scolarite' | 'autre';
  academicYearId: string;
}

export type PaymentMethod = 'especes' | 'wave' | 'orange_money' | 'virement' | 'cheque';

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  idempotencyKey: string; // To prevent double charging
  studentId: string;
  enrollmentId: string;
  invoiceScheduleId?: string; // specific or distributed
  amount: number; // FCFA integer
  paymentMethod: PaymentMethod;
  paymentDate: string;
  recordedBy: string; // user name/id
  transactionRef?: string; // Bank or Mobile money confirmation ref
  status: 'valide' | 'annule' | 'regularise';
  notes?: string;
  isConfirmedByServer: boolean;
  cancellationDetails?: {
    cancelledAt: string;
    cancelledBy: string;
    reason: string;
    regularizationOperationId?: string;
  };
}

export interface CashRegisterSession {
  id: string;
  sessionNumber: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  initialCash: number; // Fond de caisse FCFA
  totalCashIn: number;
  totalCashOut: number;
  theoreticalBalance: number; // initial + in - out
  actualCountedBalance?: number; // Solde physique constaté
  difference?: number; // actual - theoretical
  status: 'ouverte' | 'fermee';
  notes?: string;
}

export type ExpenseCategory =
  | 'loyer'
  | 'vacation_enseignant'
  | 'fournitures'
  | 'maintenance'
  | 'electricite'
  | 'internet'
  | 'services'
  | 'autre';

export type ExpenseStage = 'prevue' | 'dette_constatee' | 'paiement_ordonne' | 'decaissement_realise';

export interface VendorExpense {
  id: string;
  expenseNumber: string;
  vendorName: string;
  category: ExpenseCategory;
  description: string;
  invoiceDate: string;
  dueDate: string;
  amount: number; // FCFA integer
  paidAmount: number; // FCFA integer
  stage: ExpenseStage;
  paymentMethod?: PaymentMethod;
  vendorInvoiceRef?: string;
  paidAt?: string;
  recordedBy: string;
  approvedBy?: string;
  notes?: string;
}

export interface GradeEntry {
  id: string;
  studentId: string;
  academicYearId: string;
  semester: string;
  moduleCode: string;
  moduleTitle: string;
  evaluationType: 'cc' | 'sn' | 'sr';
  grade: number;
  maxGrade: number;
  coefficient: number;
  credits: number;
  session: 'normale' | 'rattrapage';
  status: 'brouillon' | 'valide' | 'publie';
  validatedBy?: string;
  validatedAt?: string;
}

export interface FinancialTestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
  description: string;
}

export interface TeachingModule {
  id: string;
  programId: string;
  ueCode: string;
  ueTitle: string;
  moduleCode: string;
  moduleTitle: string;
  credits: number;
  coefficient: number;
  hourlyVolume: number;
  teacherId?: string;
}

export interface GradeItem {
  id: string;
  studentId: string;
  moduleId: string;
  academicYearId: string;
  continuousAssessmentNote?: number; // e.g. 14.5 / 20
  examNote?: number; // e.g. 13.0 / 20
  catchUpExamNote?: number;
  finalNote: number; // Computed
  status: 'brouillon' | 'valide' | 'publie';
  validatedBy?: string;
  validatedAt?: string;
}

export interface TimetableSlot {
  id: string;
  programId: string;
  moduleId: string;
  teacherId: string;
  room: string;
  dayOfWeek: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  startTime: string; // "08:30"
  endTime: string; // "10:30"
  sessionType?: 'cours' | 'td_tp' | 'examen_partiel' | 'examen_final' | 'rattrapage';
  date?: string; // Format YYYY-MM-DD for specific scheduled sessions / exams
  supervisor?: string; // Surveillant d'examen ou chargé de TD
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  moduleId: string;
  teacherId: string;
  teacherName?: string;
  sessionTitle: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  room?: string;
  programId?: string;
  academicYearId?: string;
  topic?: string;
  status?: 'brouillon' | 'valide' | 'cloture';
  notes?: string;
  attendees: {
    studentId: string;
    status: 'present' | 'absent_justifie' | 'absent_injustifie' | 'retard';
    arrivalDelayMinutes?: number;
    justificationNote?: string;
  }[];
  signedAt?: string;
  signedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity: 'etudiant' | 'inscription' | 'facture' | 'paiement' | 'caisse' | 'depense' | 'note' | 'parametre' | 'presence' | 'diplome' | 'livre' | 'emprunt' | 'cours' | 'planning' | 'module';
  entityId: string;
  details: string;
  reason?: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  publishYear: number;
  location: string; // Ex: 'Rayon Informatique A2', 'Rayon Gestion B1'
  totalCopies: number;
  availableCopies: number;
  description?: string;
  createdAt: string;
}

export type LoanStatus = 'en_cours' | 'rendu' | 'en_retard' | 'prolonge';
export type BookCondition = 'neuf' | 'bon_etat' | 'use' | 'abime';

export interface BookLoan {
  id: string;
  loanNumber: string; // Ex: 'EMP-2026-0001'
  bookId: string;
  bookTitle: string;
  bookIsbn: string;
  studentId: string;
  studentMatricule: string;
  studentName: string;
  loanDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
  status: LoanStatus;
  conditionAtLoan: BookCondition;
  conditionAtReturn?: BookCondition;
  remarks?: string;
  recordedBy: string;
  returnedBy?: string;
  extensionCount?: number;
}

export type CertificateType =
  | 'diplome_licence'
  | 'diplome_master'
  | 'attestation_reussite'
  | 'attestation_scolarite'
  | 'certificat_specialise';

export type CertificateMention =
  | 'Tres Bien'
  | 'Bien'
  | 'Assez Bien'
  | 'Passable'
  | 'Félicitations du Jury';

export interface PrintLogEntry {
  printedAt: string;
  printedBy: string;
  copyNumber: number;
  reason?: string;
}

export interface DiplomaCertificate {
  id: string;
  serialNumber: string; // Ex: "SN-ISMNM-2025-LIC-0089"
  securityToken: string; // Ex: "SEC-7A8B-9C1D"
  studentId: string;
  programId: string;
  academicYearId: string;
  type: CertificateType;
  title: string;
  specialization?: string;
  mention: CertificateMention;
  finalAverage: number;
  totalCreditsEarned: number;
  deliberationDate: string;
  deliberationPvNumber: string;
  deliveryDate: string;
  juryPresident: string;
  directorName: string;
  registrarName: string;
  status: 'brouillon' | 'delivre' | 'imprime' | 'archive' | 'revoque';
  printCount: number;
  printHistory: PrintLogEntry[];
  revocationReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  notes?: string;
  qrVerificationData?: string;
}

export interface CashProjectionItem {
  date: string;
  currentAvailable: number;
  confirmedInflows: number;
  forecastInflows: number;
  plannedOutflows: number;
  dueDebts: number;
  projectedNet: number;
  financingNeed: number;
  isAlert: boolean;
}
