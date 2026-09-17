import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  INITIAL_ACADEMIC_YEARS,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
  INITIAL_BOOKS,
  INITIAL_BOOK_LOANS,
  INITIAL_CASH_SESSION,
  INITIAL_CONFIG,
  INITIAL_DIPLOMAS,
  INITIAL_ENROLLMENTS,
  INITIAL_EXPENSES,
  INITIAL_GRADES,
  INITIAL_INVOICES,
  INITIAL_MODULES,
  INITIAL_PROGRAMS,
  INITIAL_RECEIPTS,
  INITIAL_STUDENTS,
  INITIAL_TIMETABLES,
} from '../data/initialData';
import {
  AcademicYear,
  AttendanceRecord,
  AuditLogEntry,
  Book,
  BookLoan,
  CashRegisterSession,
  DiplomaCertificate,
  Enrollment,
  EstablishmentConfig,
  ExpenseStage,
  GradeItem,
  InvoiceSchedule,
  PaymentMethod,
  PaymentReceipt,
  Program,
  StudentAdmission,
  TeachingModule,
  TimetableSlot,
  VendorExpense,
} from '../types';
import { useAuth } from './AuthContext';
import {
  saveAcademicDataToOfflineCache,
  getAcademicDataFromOfflineCache,
} from '../utils/offlineStorage';

interface AppContextType {
  loading: boolean;
  config: EstablishmentConfig;
  academicYears: AcademicYear[];
  programs: Program[];
  students: StudentAdmission[];
  enrollments: Enrollment[];
  invoices: InvoiceSchedule[];
  receipts: PaymentReceipt[];
  cashSession: CashRegisterSession;
  expenses: VendorExpense[];
  modules: TeachingModule[];
  grades: GradeItem[];
  attendance: AttendanceRecord[];
  timetables: TimetableSlot[];
  diplomas: DiplomaCertificate[];
  books: Book[];
  bookLoans: BookLoan[];
  auditLogs: AuditLogEntry[];
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  selectedReceipt: PaymentReceipt | null;
  setSelectedReceipt: (receipt: PaymentReceipt | null) => void;
  isPriorityFlowOpen: boolean;
  setIsPriorityFlowOpen: (open: boolean) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  isLoading: boolean;
  error: string | null;
  testResults: any[];
  isRunningTests: boolean;
  // Actions
  refreshData: () => Promise<void>;
  createStudent: (studentData: Partial<StudentAdmission>) => Promise<StudentAdmission>;
  updateStudentStatus: (id: string, status: StudentAdmission['status'], notes?: string) => Promise<void>;
  createEnrollment: (data: {
    studentId: string;
    programId: string;
    academicYearId: string;
    paymentPlan: string;
    discountType?: string;
    discountAmount?: number;
    discountReason?: string;
  }) => Promise<{ enrollment: Enrollment; invoices: InvoiceSchedule[] }>;
  recordPayment: (data: {
    studentId: string;
    invoiceScheduleId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    idempotencyKey?: string;
    transactionRef?: string;
    notes?: string;
  }) => Promise<{ receipt: PaymentReceipt; updatedInvoice: InvoiceSchedule }>;
  cancelPayment: (receiptId: string, reason: string) => Promise<void>;
  openCashSession: (initialCash: number, notes?: string) => Promise<void>;
  closeCashSession: (countedCash: number, notes?: string) => Promise<void>;
  recordCashMovement: (type: 'in' | 'out', amount: number, motive: string) => Promise<void>;
  closeAcademicYear: (yearId: string) => Promise<void>;
  createExpense: (data: {
    vendorName: string;
    category: VendorExpense['category'];
    description: string;
    amount: number;
    dueDate?: string;
    stage?: ExpenseStage;
    paymentMethod?: PaymentMethod;
  }) => Promise<VendorExpense>;
  updateExpenseStage: (id: string, newStage: ExpenseStage, paymentMethod?: PaymentMethod) => Promise<void>;
  advanceExpenseStage: (id: string, newStage: ExpenseStage, paymentMethod?: PaymentMethod) => Promise<void>;
  saveGrade: (data: Partial<GradeItem>) => Promise<GradeItem>;
  saveGradesBatch: (gradeList: Partial<GradeItem>[]) => Promise<GradeItem[]>;
  createGrade: (data: Partial<GradeItem>) => Promise<GradeItem>;
  validateGrade: (id: string, status: 'valide' | 'publie') => Promise<void>;
  updateGradeStatus: (id: string, status: 'valide' | 'publie') => Promise<void>;
  saveAttendance: (data: Partial<AttendanceRecord>) => Promise<AttendanceRecord>;
  signAttendance: (id: string, signedBy?: string) => Promise<AttendanceRecord>;
  deleteAttendance: (id: string) => Promise<void>;
  saveDiploma: (data: Partial<DiplomaCertificate>) => Promise<DiplomaCertificate>;
  recordDiplomaPrint: (id: string, reason?: string) => Promise<DiplomaCertificate>;
  revokeDiploma: (id: string, reason: string) => Promise<DiplomaCertificate>;
  deleteDiploma: (id: string) => Promise<void>;
  batchGenerateDiplomas: (data: {
    programId: string;
    type: string;
    deliberationDate: string;
    deliberationPvNumber: string;
    studentIds: string[];
  }) => Promise<DiplomaCertificate[]>;
  verifyDiplomaRemote: (serialOrToken: string) => Promise<any>;
  // Library Actions
  createBook: (data: Partial<Book>) => Promise<Book>;
  updateBook: (id: string, data: Partial<Book>) => Promise<Book>;
  deleteBook: (id: string) => Promise<void>;
  createBookLoan: (data: {
    bookId: string;
    studentId: string;
    loanDate?: string;
    dueDate?: string;
    conditionAtLoan?: any;
    remarks?: string;
  }) => Promise<BookLoan>;
  returnBookLoan: (id: string, data?: { returnDate?: string; conditionAtReturn?: any; remarks?: string }) => Promise<BookLoan>;
  extendBookLoan: (id: string, extensionDays?: number) => Promise<BookLoan>;
  // Timetables & Exams Planning Actions
  saveTimetableSlot: (data: Partial<TimetableSlot>) => Promise<TimetableSlot>;
  deleteTimetableSlot: (id: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
  runTests: () => Promise<any>;
  runIntegrityTests: () => Promise<any[]>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, activeRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const [config, setConfig] = useState<EstablishmentConfig>(INITIAL_CONFIG);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(INITIAL_ACADEMIC_YEARS);
  const [programs, setPrograms] = useState<Program[]>(INITIAL_PROGRAMS);
  const [students, setStudents] = useState<StudentAdmission[]>(INITIAL_STUDENTS);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(INITIAL_ENROLLMENTS);
  const [invoices, setInvoices] = useState<InvoiceSchedule[]>(INITIAL_INVOICES);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>(INITIAL_RECEIPTS);
  const [cashSession, setCashSession] = useState<CashRegisterSession>(INITIAL_CASH_SESSION);
  const [expenses, setExpenses] = useState<VendorExpense[]>(INITIAL_EXPENSES);
  const [modules, setModules] = useState<TeachingModule[]>(INITIAL_MODULES);
  const [grades, setGrades] = useState<GradeItem[]>(INITIAL_GRADES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [timetables, setTimetables] = useState<TimetableSlot[]>(INITIAL_TIMETABLES);
  const [diplomas, setDiplomas] = useState<DiplomaCertificate[]>(INITIAL_DIPLOMAS);
  const [books, setBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [bookLoans, setBookLoans] = useState<BookLoan[]>(INITIAL_BOOK_LOANS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [isPriorityFlowOpen, setIsPriorityFlowOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser.id,
    'x-user-role': activeRole,
  });

  const refreshData = async () => {
    try {
      const res = await fetch('/api/bootstrap', { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setConfig(json.data.config);
          setAcademicYears(json.data.academicYears);
          setPrograms(json.data.programs);
          setStudents(json.data.students);
          setEnrollments(json.data.enrollments);
          setInvoices(json.data.invoices);
          setReceipts(json.data.receipts);
          setCashSession(json.data.cashSession);
          setExpenses(json.data.expenses);
          setModules(json.data.modules);
          setGrades(json.data.grades);
          if (json.data.attendance) setAttendance(json.data.attendance);
          if (json.data.diplomas) setDiplomas(json.data.diplomas);
          if (json.data.books) setBooks(json.data.books);
          if (json.data.bookLoans) setBookLoans(json.data.bookLoans);
          setTimetables(json.data.timetables);
          setAuditLogs(json.data.auditLogs);

          // Persist to local offline cache bundle
          saveAcademicDataToOfflineCache(json.data);
        }
      } else {
        throw new Error('API unavailable: status ' + res.status);
      }
    } catch (e) {
      console.warn('Backend unavailable or offline, loading from local offline cache:', e);
      // Restore from offline cache bundle
      const cached = getAcademicDataFromOfflineCache();
      if (cached && cached.data) {
        if (cached.data.config) setConfig(cached.data.config);
        if (cached.data.academicYears) setAcademicYears(cached.data.academicYears);
        if (cached.data.programs) setPrograms(cached.data.programs);
        if (cached.data.students) setStudents(cached.data.students);
        if (cached.data.enrollments) setEnrollments(cached.data.enrollments);
        if (cached.data.invoices) setInvoices(cached.data.invoices);
        if (cached.data.receipts) setReceipts(cached.data.receipts);
        if (cached.data.cashSession) setCashSession(cached.data.cashSession);
        if (cached.data.expenses) setExpenses(cached.data.expenses);
        if (cached.data.modules) setModules(cached.data.modules);
        if (cached.data.grades) setGrades(cached.data.grades);
        if (cached.data.attendance) setAttendance(cached.data.attendance);
        if (cached.data.diplomas) setDiplomas(cached.data.diplomas);
        if (cached.data.books) setBooks(cached.data.books);
        if (cached.data.bookLoans) setBookLoans(cached.data.bookLoans);
        if (cached.data.timetables) setTimetables(cached.data.timetables);
        if (cached.data.auditLogs) setAuditLogs(cached.data.auditLogs);
      }
    } finally {
      setLoading(false);
    }
  };

  // Immediate hydration from cache on mount for instant zero-latency rendering & offline support
  useEffect(() => {
    const cached = getAcademicDataFromOfflineCache();
    if (cached && cached.data) {
      if (cached.data.config) setConfig(cached.data.config);
      if (cached.data.academicYears) setAcademicYears(cached.data.academicYears);
      if (cached.data.programs) setPrograms(cached.data.programs);
      if (cached.data.students) setStudents(cached.data.students);
      if (cached.data.enrollments) setEnrollments(cached.data.enrollments);
      if (cached.data.modules) setModules(cached.data.modules);
      if (cached.data.timetables) setTimetables(cached.data.timetables);
      if (cached.data.grades) setGrades(cached.data.grades);
      if (cached.data.attendance) setAttendance(cached.data.attendance);
    }
    refreshData();
  }, []);

  const createStudent = async (studentData: Partial<StudentAdmission>) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(studentData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du dossier');
      await refreshData();
      return data.data;
    } catch (e: any) {
      // Fallback
      const count = students.length + 1;
      const matricule = `${config.documentNumbering.matriculePrefix}-2025-${String(count).padStart(4, '0')}`;
      const newStu: StudentAdmission = {
        id: `stu_${Date.now()}`,
        matricule,
        firstName: studentData.firstName || '',
        lastName: studentData.lastName || '',
        gender: studentData.gender || 'M',
        birthDate: studentData.birthDate || '2005-01-01',
        birthPlace: studentData.birthPlace || 'Dakar',
        nationality: studentData.nationality || 'Sénégalaise',
        cniPassport: studentData.cniPassport || '',
        email: studentData.email || '',
        phone: studentData.phone || '',
        parentName: studentData.parentName || '',
        parentPhone: studentData.parentPhone || '',
        address: studentData.address || '',
        city: studentData.city || 'Dakar',
        status: studentData.status || 'candidat',
        submissionDate: new Date().toISOString().split('T')[0],
        documents: [],
      };
      setStudents((prev) => [newStu, ...prev]);
      return newStu;
    }
  };

  const updateStudentStatus = async (id: string, status: StudentAdmission['status'], notes?: string) => {
    await fetch(`/api/students/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, admissionNotes: notes }),
    });
    await refreshData();
  };

  const createEnrollment = async (data: {
    studentId: string;
    programId: string;
    academicYearId: string;
    paymentPlan: string;
    discountType?: string;
    discountAmount?: number;
    discountReason?: string;
  }) => {
    const res = await fetch('/api/enrollments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur inscription');
    await refreshData();
    return result.data;
  };

  const recordPayment = async (data: {
    studentId: string;
    invoiceScheduleId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    idempotencyKey?: string;
    transactionRef?: string;
    notes?: string;
  }) => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur encaissement');
    await refreshData();
    return result.data;
  };

  const cancelPayment = async (receiptId: string, reason: string) => {
    const res = await fetch(`/api/payments/${receiptId}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur annulation');
    await refreshData();
  };

  const openCashSession = async (initialCash: number, notes?: string) => {
    const res = await fetch('/api/cash/open', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initialCash, notes }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur ouverture de caisse');
    await refreshData();
  };

  const closeCashSession = async (countedCash: number, notes?: string) => {
    const res = await fetch('/api/cash/close', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ actualCountedBalance: countedCash, notes }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur clôture de caisse');
    await refreshData();
  };

  const createExpense = async (data: any) => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur création dépense');
    await refreshData();
    return result.data;
  };

  const updateExpenseStage = async (id: string, newStage: ExpenseStage, paymentMethod?: PaymentMethod) => {
    const res = await fetch(`/api/expenses/${id}/stage`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ newStage, paymentMethod }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur transition étape');
    await refreshData();
  };

  const saveGrade = async (data: Partial<GradeItem>) => {
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur note');
    await refreshData();
    return result.data;
  };

  const saveGradesBatch = async (gradeList: Partial<GradeItem>[]): Promise<GradeItem[]> => {
    try {
      const res = await fetch('/api/grades/batch', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ grades: gradeList }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur enregistrement par lot des notes');
      await refreshData();
      return result.data;
    } catch (e: any) {
      console.warn('Backend batch grades failed, updating local state:', e);
      const updatedList: GradeItem[] = [];
      setGrades((prev) => {
        let current = [...prev];
        for (const item of gradeList) {
          const cc = item.continuousAssessmentNote ?? 0;
          const exam = item.examNote ?? 0;
          const finalNote = Math.round((cc * 0.4 + exam * 0.6) * 10) / 10;
          const idx = current.findIndex(
            (g) => g.studentId === item.studentId && g.moduleId === item.moduleId
          );
          if (idx >= 0) {
            const updated = {
              ...current[idx],
              continuousAssessmentNote: cc,
              examNote: exam,
              catchUpExamNote: item.catchUpExamNote,
              finalNote,
              status: item.status || current[idx].status,
            };
            current[idx] = updated;
            updatedList.push(updated);
          } else {
            const created: GradeItem = {
              id: item.id || `grd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              studentId: item.studentId || '',
              moduleId: item.moduleId || '',
              academicYearId: item.academicYearId || 'year_2025_2026',
              continuousAssessmentNote: cc,
              examNote: exam,
              catchUpExamNote: item.catchUpExamNote,
              finalNote,
              status: item.status || 'brouillon',
            };
            current.unshift(created);
            updatedList.push(created);
          }
        }
        return current;
      });
      return updatedList;
    }
  };

  const validateGrade = async (id: string, status: 'valide' | 'publie') => {
    const res = await fetch(`/api/grades/${id}/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur validation note');
    await refreshData();
  };

  const runTests = async () => {
    const res = await fetch('/api/tests/run', { headers: getHeaders() });
    const result = await res.json();
    return result.data;
  };

  const resetDemoData = async () => {
    const res = await fetch('/api/admin/reset', { method: 'POST', headers: getHeaders() });
    const result = await res.json();
    await refreshData();
    return result.data;
  };

  const closeAcademicYear = async (yearId: string) => {
    const res = await fetch(`/api/academic-years/${yearId}/close`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur clôture année');
    await refreshData();
  };

  const recordCashMovement = async (type: 'in' | 'out', amount: number, motive: string) => {
    const res = await fetch('/api/cash/movement', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type, amount, motive }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur mouvement caisse');
    await refreshData();
  };

  const saveAttendance = async (data: Partial<AttendanceRecord>): Promise<AttendanceRecord> => {
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur lors de l'enregistrement de l'émargement");
      await refreshData();
      return result.data;
    } catch (e: any) {
      const fallbackRecord: AttendanceRecord = {
        id: data.id || `att_${Date.now()}`,
        date: data.date || new Date().toISOString().split('T')[0],
        moduleId: data.moduleId || 'mod_algo',
        teacherId: data.teacherId || 'tch_kane',
        teacherName: data.teacherName || currentUser.name,
        sessionTitle: data.sessionTitle || 'Séance de cours',
        startTime: data.startTime || '08:30',
        endTime: data.endTime || '11:30',
        durationHours: data.durationHours || 3,
        room: data.room || 'Amphithéâtre Cheikh Anta Diop',
        programId: data.programId || 'prog_lic_info_l1',
        academicYearId: data.academicYearId || 'year_2025_2026',
        topic: data.topic || '',
        status: data.status || 'brouillon',
        notes: data.notes || '',
        attendees: data.attendees || [],
        signedAt: data.signedAt,
        signedBy: data.signedBy,
      };
      setAttendance((prev) => {
        const idx = prev.findIndex((a) => a.id === fallbackRecord.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = fallbackRecord;
          return copy;
        }
        return [fallbackRecord, ...prev];
      });
      return fallbackRecord;
    }
  };

  const signAttendance = async (id: string, signedBy?: string): Promise<AttendanceRecord> => {
    try {
      const res = await fetch(`/api/attendance/${id}/sign`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ signedBy }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la signature');
      await refreshData();
      return result.data;
    } catch (e: any) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'valide' as const,
                signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                signedBy: signedBy || currentUser.name,
              }
            : a
        )
      );
      const updated = attendance.find((a) => a.id === id);
      return updated!;
    }
  };

  const deleteAttendance = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la suppression');
      await refreshData();
    } catch (e: any) {
      setAttendance((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const saveDiploma = async (data: Partial<DiplomaCertificate>): Promise<DiplomaCertificate> => {
    try {
      const url = data.id && diplomas.some((d) => d.id === data.id)
        ? `/api/diplomas/${data.id}`
        : '/api/diplomas';
      const method = data.id && diplomas.some((d) => d.id === data.id) ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de l enregistrement du diplôme');
      await refreshData();
      return result.data;
    } catch (e: any) {
      setError(e.message);
      // Fallback local update
      if (data.id && diplomas.some((d) => d.id === data.id)) {
        setDiplomas((prev) =>
          prev.map((d) => (d.id === data.id ? ({ ...d, ...data } as DiplomaCertificate) : d))
        );
        return diplomas.find((d) => d.id === data.id)!;
      } else {
        const currentYear = academicYears.find((y) => y.isCurrent)?.code?.split('-')[0] || '2025';
        const typePrefix = data.type === 'diplome_master' ? 'MAS' : data.type === 'attestation_reussite' ? 'ATT' : 'LIC';
        const serialNumber = data.serialNumber || `SN-ISMNM-${currentYear}-${typePrefix}-${String(diplomas.length + 1).padStart(4, '0')}`;
        const newDoc: DiplomaCertificate = {
          id: `cert_${Date.now()}`,
          serialNumber,
          securityToken: `SEC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${currentYear}`,
          studentId: data.studentId || '',
          programId: data.programId || '',
          academicYearId: data.academicYearId || 'year_2024_2025',
          type: data.type || 'diplome_licence',
          title: data.title || 'Diplôme de Fin d Études',
          specialization: data.specialization || '',
          mention: data.mention || 'Bien',
          finalAverage: data.finalAverage || 14.5,
          totalCreditsEarned: data.totalCreditsEarned || 180,
          deliberationDate: data.deliberationDate || new Date().toISOString().split('T')[0],
          deliberationPvNumber: data.deliberationPvNumber || 'PV-DELIB/01',
          deliveryDate: data.deliveryDate || new Date().toISOString().split('T')[0],
          juryPresident: data.juryPresident || 'Pr. Ousmane Abdoulaye Diop',
          directorName: data.directorName || 'Dr. Aïssatou Ndiaye Diouf',
          registrarName: data.registrarName || 'Fatou Kiné Sow',
          status: data.status || 'delivre',
          printCount: 0,
          printHistory: [],
          notes: data.notes || '',
          qrVerificationData: `https://ismnm-dakar.sn/verify?sn=${serialNumber}`,
        };
        setDiplomas((prev) => [newDoc, ...prev]);
        return newDoc;
      }
    }
  };

  const recordDiplomaPrint = async (id: string, reason?: string): Promise<DiplomaCertificate> => {
    try {
      const res = await fetch(`/api/diplomas/${id}/print`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de l enregistrement de l impression');
      await refreshData();
      return result.data;
    } catch (e: any) {
      setDiplomas((prev) =>
        prev.map((d) => {
          if (d.id === id) {
            const nextCount = (d.printCount || 0) + 1;
            return {
              ...d,
              status: 'imprime',
              printCount: nextCount,
              printHistory: [
                ...d.printHistory,
                {
                  printedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  printedBy: currentUser.name,
                  copyNumber: nextCount,
                  reason: reason || (nextCount === 1 ? 'Impression originale' : `Duplicata certifié N° ${nextCount}`),
                },
              ],
            };
          }
          return d;
        })
      );
      return diplomas.find((d) => d.id === id)!;
    }
  };

  const revokeDiploma = async (id: string, reason: string): Promise<DiplomaCertificate> => {
    try {
      const res = await fetch(`/api/diplomas/${id}/revoke`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la révocation');
      await refreshData();
      return result.data;
    } catch (e: any) {
      setDiplomas((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'revoque',
                revocationReason: reason,
                revokedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                revokedBy: currentUser.name,
              }
            : d
        )
      );
      return diplomas.find((d) => d.id === id)!;
    }
  };

  const deleteDiploma = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/diplomas/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la suppression');
      await refreshData();
    } catch (e: any) {
      setDiplomas((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const batchGenerateDiplomas = async (data: {
    programId: string;
    type: string;
    deliberationDate: string;
    deliberationPvNumber: string;
    studentIds: string[];
  }): Promise<DiplomaCertificate[]> => {
    try {
      const res = await fetch('/api/diplomas/batch-generate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la génération groupée');
      await refreshData();
      return result.data;
    } catch (e: any) {
      throw e;
    }
  };

  const verifyDiplomaRemote = async (serialOrToken: string): Promise<any> => {
    try {
      const res = await fetch(`/api/diplomas/verify/${encodeURIComponent(serialOrToken)}`);
      return await res.json();
    } catch (e: any) {
      // Local fallback search
      const query = serialOrToken.trim().toUpperCase();
      const match = diplomas.find(
        (d) => d.serialNumber.toUpperCase() === query || d.securityToken.toUpperCase() === query
      );
      if (!match) {
        return { success: false, isValid: false, message: 'Non trouvé' };
      }
      const student = students.find((s) => s.id === match.studentId);
      const program = programs.find((p) => p.id === match.programId);
      return {
        success: true,
        isValid: match.status !== 'revoque',
        data: {
          serialNumber: match.serialNumber,
          securityToken: match.securityToken,
          status: match.status,
          title: match.title,
          type: match.type,
          mention: match.mention,
          finalAverage: match.finalAverage,
          deliberationDate: match.deliberationDate,
          deliberationPvNumber: match.deliberationPvNumber,
          deliveryDate: match.deliveryDate,
          student: student ? { firstName: student.firstName, lastName: student.lastName, matricule: student.matricule } : null,
          program: program ? { title: program.title, level: program.level } : null,
        },
      };
    }
  };

  const runIntegrityTests = async () => {
    setIsRunningTests(true);
    try {
      const data = await runTests();
      const results = data.tests || [];
      setTestResults(results);
      return results;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setIsRunningTests(false);
    }
  };

  const createBook = async (data: Partial<Book>): Promise<Book> => {
    try {
      const res = await fetch('/api/library/books', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la création du livre');
      }
      const json = await res.json();
      const newBook: Book = json.data;
      setBooks((prev) => [newBook, ...prev]);
      return newBook;
    } catch (e: any) {
      // Local fallback
      const newBook: Book = {
        id: `book_${Date.now()}`,
        isbn: data.isbn || `978-2-${Math.floor(100000000 + Math.random() * 900000000)}`,
        title: data.title || 'Sans titre',
        author: data.author || 'Inconnu',
        category: data.category || 'Général',
        publisher: data.publisher || 'Éditions Académiques',
        publishYear: data.publishYear || new Date().getFullYear(),
        location: data.location || 'Rayon Général',
        totalCopies: data.totalCopies || 1,
        availableCopies: data.availableCopies ?? data.totalCopies ?? 1,
        description: data.description || '',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setBooks((prev) => [newBook, ...prev]);
      return newBook;
    }
  };

  const updateBook = async (id: string, data: Partial<Book>): Promise<Book> => {
    try {
      const res = await fetch(`/api/library/books/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la modification du livre');
      }
      const json = await res.json();
      const updated: Book = json.data;
      setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    } catch (e: any) {
      let updatedBook: Book | null = null;
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id === id) {
            updatedBook = { ...b, ...data };
            return updatedBook;
          }
          return b;
        })
      );
      return updatedBook || (data as Book);
    }
  };

  const deleteBook = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/library/books/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression du livre');
      }
      setBooks((prev) => prev.filter((b) => b.id !== id));
    } catch (e: any) {
      setBooks((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const createBookLoan = async (data: {
    bookId: string;
    studentId: string;
    loanDate?: string;
    dueDate?: string;
    conditionAtLoan?: any;
    remarks?: string;
  }): Promise<BookLoan> => {
    try {
      const res = await fetch('/api/library/loans', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l enregistrement de l emprunt');
      }
      const json = await res.json();
      const newLoan: BookLoan = json.data;
      setBookLoans((prev) => [newLoan, ...prev]);
      // Update available copies
      setBooks((prev) =>
        prev.map((b) =>
          b.id === data.bookId ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) } : b
        )
      );
      return newLoan;
    } catch (e: any) {
      const student = students.find((s) => s.id === data.studentId);
      const book = books.find((b) => b.id === data.bookId);
      const today = new Date().toISOString().split('T')[0];
      const dueDate = data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const newLoan: BookLoan = {
        id: `loan_${Date.now()}`,
        loanNumber: `EMP-2025-${String(bookLoans.length + 1).padStart(4, '0')}`,
        bookId: data.bookId,
        bookTitle: book?.title || 'Ouvrage',
        bookIsbn: book?.isbn || '',
        studentId: data.studentId,
        studentMatricule: student?.matricule || 'ISMNM-2025-0000',
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Étudiant',
        loanDate: data.loanDate || today,
        dueDate,
        status: 'en_cours',
        conditionAtLoan: data.conditionAtLoan || 'bon_etat',
        remarks: data.remarks || '',
        recordedBy: `${currentUser.name} (${activeRole})`,
        extensionCount: 0,
      };
      setBookLoans((prev) => [newLoan, ...prev]);
      setBooks((prev) =>
        prev.map((b) =>
          b.id === data.bookId ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) } : b
        )
      );
      return newLoan;
    }
  };

  const returnBookLoan = async (
    id: string,
    data?: { returnDate?: string; conditionAtReturn?: any; remarks?: string }
  ): Promise<BookLoan> => {
    try {
      const res = await fetch(`/api/library/loans/${id}/return`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data || {}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la restitution');
      }
      const json = await res.json();
      const updated: BookLoan = json.data;
      setBookLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setBooks((prev) =>
        prev.map((b) =>
          b.id === updated.bookId ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) } : b
        )
      );
      return updated;
    } catch (e: any) {
      let updatedLoan: BookLoan | null = null;
      const today = new Date().toISOString().split('T')[0];
      setBookLoans((prev) =>
        prev.map((l) => {
          if (l.id === id) {
            updatedLoan = {
              ...l,
              status: 'rendu',
              returnDate: data?.returnDate || today,
              conditionAtReturn: data?.conditionAtReturn || l.conditionAtLoan || 'bon_etat',
              returnedBy: `${currentUser.name} (${activeRole})`,
            };
            return updatedLoan;
          }
          return l;
        })
      );
      if (updatedLoan) {
        const u = updatedLoan as BookLoan;
        setBooks((prev) =>
          prev.map((b) =>
            b.id === u.bookId ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) } : b
          )
        );
        return u;
      }
      throw e;
    }
  };

  const extendBookLoan = async (id: string, extensionDays = 14): Promise<BookLoan> => {
    try {
      const res = await fetch(`/api/library/loans/${id}/extend`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ extensionDays }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la prolongation');
      }
      const json = await res.json();
      const updated: BookLoan = json.data;
      setBookLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated;
    } catch (e: any) {
      let updatedLoan: BookLoan | null = null;
      setBookLoans((prev) =>
        prev.map((l) => {
          if (l.id === id) {
            const currentDue = new Date(l.dueDate);
            currentDue.setDate(currentDue.getDate() + extensionDays);
            const newDueDate = currentDue.toISOString().split('T')[0];
            const today = new Date().toISOString().split('T')[0];
            updatedLoan = {
              ...l,
              dueDate: newDueDate,
              extensionCount: (l.extensionCount || 0) + 1,
              status: newDueDate >= today ? 'en_cours' : 'en_retard',
            };
            return updatedLoan;
          }
          return l;
        })
      );
      if (updatedLoan) return updatedLoan;
      throw e;
    }
  };

  const saveTimetableSlot = async (data: Partial<TimetableSlot>): Promise<TimetableSlot> => {
    try {
      const isUpdate = !!data.id;
      const url = isUpdate ? `/api/timetables/${data.id}` : '/api/timetables';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la sauvegarde du créneau');
      }

      const json = await res.json();
      const saved: TimetableSlot = json.data;

      setTimetables((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });

      return saved;
    } catch (e: any) {
      console.warn('Backend timetable save failed, falling back to local state:', e);
      const fallbackSlot: TimetableSlot = {
        id: data.id || `tt_${Date.now()}`,
        programId: data.programId || programs[0]?.id || '',
        moduleId: data.moduleId || modules[0]?.id || '',
        teacherId: data.teacherId || '',
        room: data.room || 'Salle A1',
        dayOfWeek: data.dayOfWeek || 'Lundi',
        startTime: data.startTime || '08:30',
        endTime: data.endTime || '10:30',
        sessionType: data.sessionType || 'cours',
        date: data.date,
        supervisor: data.supervisor,
        notes: data.notes,
      };

      setTimetables((prev) => {
        const idx = prev.findIndex((t) => t.id === fallbackSlot.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = fallbackSlot;
          return next;
        }
        return [...prev, fallbackSlot];
      });

      return fallbackSlot;
    }
  };

  const deleteTimetableSlot = async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/timetables/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression du créneau');
      }

      setTimetables((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      console.warn('Backend timetable delete failed, falling back to local state:', e);
      setTimetables((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <AppContext.Provider
      value={{
        loading,
        isLoading: loading,
        error,
        config,
        academicYears,
        programs,
        students,
        enrollments,
        invoices,
        receipts,
        cashSession,
        expenses,
        modules,
        grades,
        attendance,
        timetables,
        diplomas,
        books,
        bookLoans,
        auditLogs,
        selectedStudentId,
        setSelectedStudentId,
        selectedReceipt,
        setSelectedReceipt,
        isPriorityFlowOpen,
        setIsPriorityFlowOpen,
        activeView,
        setActiveView,
        testResults,
        isRunningTests,
        refreshData,
        createStudent,
        updateStudentStatus,
        createEnrollment,
        recordPayment,
        cancelPayment,
        openCashSession,
        closeCashSession,
        recordCashMovement,
        closeAcademicYear,
        createExpense,
        updateExpenseStage,
        advanceExpenseStage: updateExpenseStage,
        saveGrade,
        saveGradesBatch,
        createGrade: saveGrade,
        validateGrade,
        updateGradeStatus: validateGrade,
        saveAttendance,
        signAttendance,
        deleteAttendance,
        saveDiploma,
        recordDiplomaPrint,
        revokeDiploma,
        deleteDiploma,
        batchGenerateDiplomas,
        verifyDiplomaRemote,
        createBook,
        updateBook,
        deleteBook,
        createBookLoan,
        returnBookLoan,
        extendBookLoan,
        saveTimetableSlot,
        deleteTimetableSlot,
        resetDemoData,
        runTests,
        runIntegrityTests,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
