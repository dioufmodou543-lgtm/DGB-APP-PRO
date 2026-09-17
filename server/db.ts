import fs from 'fs';
import path from 'path';
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
  INITIAL_USERS,
} from '../src/data/initialData';
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
  GradeItem,
  InvoiceSchedule,
  PaymentReceipt,
  Program,
  StudentAdmission,
  TeachingModule,
  TimetableSlot,
  User,
  VendorExpense,
} from '../src/types/index';

export interface AppStore {
  config: EstablishmentConfig;
  academicYears: AcademicYear[];
  programs: Program[];
  users: User[];
  students: StudentAdmission[];
  enrollments: Enrollment[];
  invoices: InvoiceSchedule[];
  receipts: PaymentReceipt[];
  cashSession: CashRegisterSession;
  cashSessionsHistory: CashRegisterSession[];
  expenses: VendorExpense[];
  modules: TeachingModule[];
  grades: GradeItem[];
  timetables: TimetableSlot[];
  attendance: AttendanceRecord[];
  diplomas: DiplomaCertificate[];
  books: Book[];
  bookLoans: BookLoan[];
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function getDefaultStore(): AppStore {
  return {
    config: JSON.parse(JSON.stringify(INITIAL_CONFIG)),
    academicYears: JSON.parse(JSON.stringify(INITIAL_ACADEMIC_YEARS)),
    programs: JSON.parse(JSON.stringify(INITIAL_PROGRAMS)),
    users: JSON.parse(JSON.stringify(INITIAL_USERS)),
    students: JSON.parse(JSON.stringify(INITIAL_STUDENTS)),
    enrollments: JSON.parse(JSON.stringify(INITIAL_ENROLLMENTS)),
    invoices: JSON.parse(JSON.stringify(INITIAL_INVOICES)),
    receipts: JSON.parse(JSON.stringify(INITIAL_RECEIPTS)),
    cashSession: JSON.parse(JSON.stringify(INITIAL_CASH_SESSION)),
    cashSessionsHistory: [],
    expenses: JSON.parse(JSON.stringify(INITIAL_EXPENSES)),
    modules: JSON.parse(JSON.stringify(INITIAL_MODULES)),
    grades: JSON.parse(JSON.stringify(INITIAL_GRADES)),
    timetables: JSON.parse(JSON.stringify(INITIAL_TIMETABLES)),
    attendance: JSON.parse(JSON.stringify(INITIAL_ATTENDANCE)),
    diplomas: JSON.parse(JSON.stringify(INITIAL_DIPLOMAS)),
    books: JSON.parse(JSON.stringify(INITIAL_BOOKS)),
    bookLoans: JSON.parse(JSON.stringify(INITIAL_BOOK_LOANS)),
    auditLogs: JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS)),
  };
}

let store: AppStore = getDefaultStore();

// Initial load if db file exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    store = JSON.parse(raw);
    if (!store.diplomas || !Array.isArray(store.diplomas)) {
      store.diplomas = JSON.parse(JSON.stringify(INITIAL_DIPLOMAS));
    }
    if (!store.modules || !Array.isArray(store.modules) || store.modules.length < INITIAL_MODULES.length) {
      store.modules = JSON.parse(JSON.stringify(INITIAL_MODULES));
    }
    if (!store.attendance || !Array.isArray(store.attendance) || store.attendance.length < INITIAL_ATTENDANCE.length) {
      store.attendance = JSON.parse(JSON.stringify(INITIAL_ATTENDANCE));
    }
    if (!store.books || !Array.isArray(store.books) || store.books.length < INITIAL_BOOKS.length) {
      store.books = JSON.parse(JSON.stringify(INITIAL_BOOKS));
    }
    if (!store.bookLoans || !Array.isArray(store.bookLoans)) {
      store.bookLoans = JSON.parse(JSON.stringify(INITIAL_BOOK_LOANS));
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }
} catch (err) {
  console.warn('Failed to load store from disk, using in-memory default:', err);
  store = getDefaultStore();
}

export function persistStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to disk:', err);
  }
}

export function getStore(): AppStore {
  return store;
}

export function resetStore(): AppStore {
  store = getDefaultStore();
  persistStore();
  return store;
}

export function logAudit(
  actor: { id: string; name: string; role: any },
  action: string,
  entity: AuditLogEntry['entity'],
  entityId: string,
  details: string,
  reason?: string
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    action,
    entity,
    entityId,
    details,
    reason,
  };
  store.auditLogs.unshift(entry);
  persistStore();
  return entry;
}
