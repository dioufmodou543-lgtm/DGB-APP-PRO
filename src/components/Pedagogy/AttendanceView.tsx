import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  History,
  PenTool,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, StudentAdmission, TeachingModule } from '../../types';

export const AttendanceView: React.FC = () => {
  const {
    attendance,
    modules,
    programs,
    students,
    enrollments,
    saveAttendance,
    signAttendance,
    deleteAttendance,
  } = useApp();
  const { currentUser, activeRole } = useAuth();

  // Active view tab: 'sessions' (Course sessions) | 'students' (Student attendance summary)
  const [activeTab, setActiveTab] = useState<'sessions' | 'students'>('sessions');

  // Filters
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valide' | 'brouillon'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isRollCallModalOpen, setIsRollCallModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AttendanceRecord | null>(null);
  const [selectedSessionForPrint, setSelectedSessionForPrint] = useState<AttendanceRecord | null>(null);

  // Roll Call Modal Form state
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formModuleId, setFormModuleId] = useState<string>(modules[0]?.id || 'mod_algo');
  const [formSessionTitle, setFormSessionTitle] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('08:30');
  const [formEndTime, setFormEndTime] = useState<string>('11:30');
  const [formRoom, setFormRoom] = useState<string>('Amphithéâtre Cheikh Anta Diop');
  const [formTopic, setFormTopic] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formAttendees, setFormAttendees] = useState<
    {
      studentId: string;
      status: 'present' | 'absent_justifie' | 'absent_injustifie' | 'retard';
      arrivalDelayMinutes?: number;
      justificationNote?: string;
    }[]
  >([]);

  // Find module details
  const getModule = (id: string): TeachingModule | undefined => {
    return modules.find((m) => m.id === id);
  };

  const getProgram = (id?: string) => {
    return programs.find((p) => p.id === id);
  };

  // Get enrolled students for a specific program
  const getStudentsForProgram = (progId?: string): StudentAdmission[] => {
    if (!progId) return students;
    const enrolledStudentIds = enrollments
      .filter((e) => e.programId === progId)
      .map((e) => e.studentId);
    
    // If no enrollments explicitly found, fallback to students who are admitted or enrolled
    if (enrolledStudentIds.length === 0) {
      return students.filter((s) => s.status === 'inscrit' || s.status === 'admis');
    }
    return students.filter((s) => enrolledStudentIds.includes(s.id));
  };

  // Filtered attendance records
  const filteredRecords = useMemo(() => {
    return attendance.filter((record) => {
      if (selectedProgramId !== 'all' && record.programId !== selectedProgramId) return false;
      if (selectedModuleId !== 'all' && record.moduleId !== selectedModuleId) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const mod = getModule(record.moduleId);
        const matchTitle = record.sessionTitle.toLowerCase().includes(query);
        const matchTopic = (record.topic || '').toLowerCase().includes(query);
        const matchTeacher = (record.teacherName || '').toLowerCase().includes(query);
        const matchModule = (mod?.moduleTitle || '').toLowerCase().includes(query);
        if (!matchTitle && !matchTopic && !matchTeacher && !matchModule) return false;
      }
      return true;
    });
  }, [attendance, selectedProgramId, selectedModuleId, statusFilter, searchQuery, modules]);

  // Overall statistics calculation
  const stats = useMemo(() => {
    let totalAttendeesCount = 0;
    let totalPresent = 0;
    let totalRetard = 0;
    let totalAbsentJustifie = 0;
    let totalAbsentInjustifie = 0;
    let totalHours = 0;

    attendance.forEach((rec) => {
      totalHours += rec.durationHours || 3;
      rec.attendees.forEach((att) => {
        totalAttendeesCount++;
        if (att.status === 'present') totalPresent++;
        else if (att.status === 'retard') {
          totalRetard++;
          totalPresent++; // Retard counts as attended
        } else if (att.status === 'absent_justifie') totalAbsentJustifie++;
        else if (att.status === 'absent_injustifie') totalAbsentInjustifie++;
      });
    });

    const globalPresenceRate =
      totalAttendeesCount > 0
        ? Math.round((totalPresent / totalAttendeesCount) * 100)
        : 100;

    // Identify students with high unexcused absences (>= 2)
    const studentUnexcusedMap: Record<string, number> = {};
    attendance.forEach((rec) => {
      rec.attendees.forEach((att) => {
        if (att.status === 'absent_injustifie') {
          studentUnexcusedMap[att.studentId] = (studentUnexcusedMap[att.studentId] || 0) + 1;
        }
      });
    });

    const atRiskStudentsCount = Object.values(studentUnexcusedMap).filter((count) => count >= 2).length;

    return {
      totalSessions: attendance.length,
      totalHours,
      globalPresenceRate,
      totalAbsentInjustifie,
      atRiskStudentsCount,
    };
  }, [attendance]);

  // Per-student attendance statistics
  const studentAttendanceStats = useMemo(() => {
    return students.map((stu) => {
      let totalSessions = 0;
      let presentCount = 0;
      let retardCount = 0;
      let justifieCount = 0;
      let injustifieCount = 0;

      attendance.forEach((rec) => {
        const attendee = rec.attendees.find((a) => a.studentId === stu.id);
        if (attendee) {
          totalSessions++;
          if (attendee.status === 'present') presentCount++;
          else if (attendee.status === 'retard') retardCount++;
          else if (attendee.status === 'absent_justifie') justifieCount++;
          else if (attendee.status === 'absent_injustifie') injustifieCount++;
        }
      });

      const effectiveAttendance = presentCount + retardCount;
      const rate = totalSessions > 0 ? Math.round((effectiveAttendance / totalSessions) * 100) : 100;
      const enrollment = enrollments.find((e) => e.studentId === stu.id);
      const program = programs.find((p) => p.id === enrollment?.programId);

      return {
        student: stu,
        program,
        totalSessions,
        presentCount,
        retardCount,
        justifieCount,
        injustifieCount,
        rate,
        isAtRisk: injustifieCount >= 2,
      };
    });
  }, [students, attendance, enrollments, programs]);

  // Open Roll Call Modal for a new or existing session
  const handleOpenRollCall = (sessionToEdit?: AttendanceRecord) => {
    if (sessionToEdit) {
      setEditingSession(sessionToEdit);
      setFormDate(sessionToEdit.date);
      setFormModuleId(sessionToEdit.moduleId);
      setFormSessionTitle(sessionToEdit.sessionTitle);
      setFormStartTime(sessionToEdit.startTime || '08:30');
      setFormEndTime(sessionToEdit.endTime || '11:30');
      setFormRoom(sessionToEdit.room || 'Amphithéâtre Cheikh Anta Diop');
      setFormTopic(sessionToEdit.topic || '');
      setFormNotes(sessionToEdit.notes || '');
      setFormAttendees(sessionToEdit.attendees || []);
    } else {
      setEditingSession(null);
      const defaultMod = modules[0] || { id: 'mod_algo', programId: 'prog_lic_info_l1' };
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormModuleId(defaultMod.id);
      setFormSessionTitle(`Séance de cours - ${defaultMod.moduleTitle || 'Algorithmique'}`);
      setFormStartTime('08:30');
      setFormEndTime('11:30');
      setFormRoom('Amphithéâtre Cheikh Anta Diop');
      setFormTopic('');
      setFormNotes('');

      // Pre-fill roster with enrolled students for this module's program
      const classStudents = getStudentsForProgram(defaultMod.programId);
      const initialRoster = classStudents.map((s) => ({
        studentId: s.id,
        status: 'present' as const,
      }));
      setFormAttendees(initialRoster);
    }
    setIsRollCallModalOpen(true);
  };

  // When module changes in the form, re-roster students if starting fresh
  const handleFormModuleChange = (newModId: string) => {
    setFormModuleId(newModId);
    const mod = getModule(newModId);
    if (mod) {
      setFormSessionTitle(`Séance de cours - ${mod.moduleTitle}`);
      if (!editingSession) {
        const classStudents = getStudentsForProgram(mod.programId);
        setFormAttendees(
          classStudents.map((s) => ({
            studentId: s.id,
            status: 'present' as const,
          }))
        );
      }
    }
  };

  // Update status for a specific student in the roll call form
  const handleStudentStatusChange = (
    studentId: string,
    status: 'present' | 'absent_justifie' | 'absent_injustifie' | 'retard'
  ) => {
    setFormAttendees((prev) => {
      const idx = prev.findIndex((a) => a.studentId === studentId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status };
        return copy;
      }
      return [...prev, { studentId, status }];
    });
  };

  // Set delay in minutes
  const handleDelayChange = (studentId: string, minutes: number) => {
    setFormAttendees((prev) =>
      prev.map((a) => (a.studentId === studentId ? { ...a, arrivalDelayMinutes: minutes } : a))
    );
  };

  // Set justification note
  const handleJustificationChange = (studentId: string, note: string) => {
    setFormAttendees((prev) =>
      prev.map((a) => (a.studentId === studentId ? { ...a, justificationNote: note } : a))
    );
  };

  // Mark all students present
  const handleMarkAllPresent = () => {
    setFormAttendees((prev) =>
      prev.map((a) => ({
        ...a,
        status: 'present',
        arrivalDelayMinutes: undefined,
        justificationNote: undefined,
      }))
    );
  };

  // Save session (draft or signed)
  const handleSaveSession = async (signNow: boolean = false) => {
    const selectedMod = getModule(formModuleId);
    const resolvedProgramId = selectedMod?.programId || 'prog_lic_info_l1';
    const teacherName = currentUser.role === 'enseignant' ? currentUser.name : 'Dr. Cheikh Ibrahima Kane';

    try {
      const saved = await saveAttendance({
        id: editingSession ? editingSession.id : undefined,
        date: formDate,
        moduleId: formModuleId,
        teacherId: 'tch_kane',
        teacherName,
        sessionTitle: formSessionTitle,
        startTime: formStartTime,
        endTime: formEndTime,
        room: formRoom,
        programId: resolvedProgramId,
        academicYearId: 'year_2025_2026',
        topic: formTopic,
        notes: formNotes,
        attendees: formAttendees,
        status: signNow ? 'valide' : editingSession?.status || 'brouillon',
        signedAt: signNow ? new Date().toISOString().replace('T', ' ').substring(0, 19) : editingSession?.signedAt,
        signedBy: signNow ? teacherName : editingSession?.signedBy,
      });

      if (signNow && saved.id) {
        await signAttendance(saved.id, teacherName);
      }

      setIsRollCallModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  // Handle direct sign action from table
  const handleDirectSign = async (session: AttendanceRecord) => {
    if (confirm(`Confirmez-vous la signature officielle de la feuille d'émargement "${session.sessionTitle}" ?`)) {
      try {
        await signAttendance(session.id, currentUser.name);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Handle delete
  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Voulez-vous vraiment supprimer la feuille d'émargement "${title}" ?`)) {
      try {
        await deleteAttendance(id);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Open printable view
  const handleOpenPrint = (session: AttendanceRecord) => {
    setSelectedSessionForPrint(session);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Suivi des Présences & Émargement</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Module Pédagogique LMD
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cahier d'appel numérique enseignant, justification des absences et contrôle d'assiduité académique
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => handleOpenRollCall()}
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouvelle Séance d'Émargement
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Taux Global d'Assiduité
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.globalPresenceRate}%
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Présences & retards validés</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Séances Enregistrées
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalSessions}</div>
            <div className="text-[10px] text-slate-500 font-medium">{stats.totalHours} heures de cours dispensées</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Absences Injustifiées
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.totalAbsentInjustifie}
            </div>
            <div className="text-[10px] text-rose-600 font-medium">Non justifiées par motif médical/légal</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Alertes Décrochage LMD
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.atRiskStudentsCount} <span className="text-xs font-normal text-slate-500">étudiant(s)</span>
            </div>
            <div className="text-[10px] text-amber-700 font-medium">≥ 2 absences injustifiées</div>
          </div>
        </div>
      </div>

      {/* Teacher Role Context Banner */}
      {activeRole === 'enseignant' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
              ENS
            </div>
            <div>
              <div className="text-xs font-bold text-teal-950">
                Espace Enseignant : {currentUser.name}
              </div>
              <p className="text-[11px] text-teal-800">
                Vous pouvez émarger directement les séances de vos modules assignés (Algorithmique & C, Architecture système) et signer vos feuilles de présence numériques.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenRollCall()}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium shrink-0 transition-colors"
          >
            Faire l'appel maintenant
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'sessions'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Feuilles d'Émargement & Séances ({filteredRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'students'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Bilan d'Assiduité par Étudiant ({students.length})</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'sessions' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher séance, module, enseignant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56"
                />
              </div>

              {/* Program Filter */}
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Toutes les filières</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.acronym} - {p.title}
                  </option>
                ))}
              </select>

              {/* Module Filter */}
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Tous les modules</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.moduleCode} - {m.moduleTitle}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="valide">Validées / Signées</option>
                <option value="brouillon">Brouillons en cours</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {filteredRecords.length} séance(s) trouvée(s)
            </div>
          </div>

          {/* Sessions List */}
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm font-semibold text-slate-700">Aucune feuille d'émargement trouvée</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Commencez par créer une nouvelle séance d'émargement pour enregistrer la présence de vos étudiants.
              </p>
              <button
                onClick={() => handleOpenRollCall()}
                className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Créer une séance
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredRecords.map((record) => {
                const mod = getModule(record.moduleId);
                const prog = getProgram(record.programId || mod?.programId);
                const presentCount = record.attendees.filter(
                  (a) => a.status === 'present' || a.status === 'retard'
                ).length;
                const totalAttendees = record.attendees.length;
                const presenceRate =
                  totalAttendees > 0 ? Math.round((presentCount / totalAttendees) * 100) : 0;
                const isSigned = record.status === 'valide';

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Session Information */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {record.date}
                        </span>
                        {record.startTime && record.endTime && (
                          <span className="flex items-center text-xs text-slate-500 font-medium">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" />
                            {record.startTime} - {record.endTime} ({record.durationHours || 3}h)
                          </span>
                        )}
                        {record.room && (
                          <span className="text-xs text-slate-500">• {record.room}</span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isSigned
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isSigned ? 'Validée & Signée' : 'Brouillon en cours'}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-900">
                        {record.sessionTitle}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-emerald-800">
                          {mod?.moduleCode || 'UE'} : {mod?.moduleTitle || 'Module'}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          Enseignant : <strong>{record.teacherName || 'Dr. Cheikh Ibrahima Kane'}</strong>
                        </span>
                        {prog && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500">{prog.acronym}</span>
                          </>
                        )}
                      </div>

                      {record.topic && (
                        <p className="text-xs text-slate-500 line-clamp-1 italic bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                          <span className="font-medium text-slate-600">Notions abordées :</span> {record.topic}
                        </p>
                      )}
                    </div>

                    {/* Presence Metrics & Actions */}
                    <div className="flex flex-wrap items-center md:items-end justify-between md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span className="text-base font-bold text-slate-900">
                            {presentCount}/{totalAttendees}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              presenceRate >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : presenceRate >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {presenceRate}%
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">Taux de présence séance</div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenRollCall(record)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                          title="Modifier l'appel ou ajouter des remarques"
                        >
                          {isSigned ? 'Consulter / Modifier' : 'Faire l’appel'}
                        </button>

                        <button
                          onClick={() => handleOpenPrint(record)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                          title="Imprimer la feuille d'émargement officielle"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {!isSigned && (
                          <button
                            onClick={() => handleDirectSign(record)}
                            className="px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold flex items-center space-x-1 transition-colors"
                            title="Signer électroniquement la feuille d'émargement"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>Signer</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(record.id, record.sessionTitle)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Students Attendance Summary Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Assiduité et Tableau des Absences par Étudiant
              </h2>
              <p className="text-xs text-slate-500">
                Calcul automatique des absences justifiées / injustifiées selon les règles LMD sénégalaises
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Étudiant & Matricule</th>
                  <th className="py-3 px-4 font-semibold">Filière / Niveau</th>
                  <th className="py-3 px-4 font-semibold text-center">Séances Évaluées</th>
                  <th className="py-3 px-4 font-semibold text-center text-emerald-700">Présents</th>
                  <th className="py-3 px-4 font-semibold text-center text-amber-700">Retards</th>
                  <th className="py-3 px-4 font-semibold text-center text-blue-700">Abs. Justifiées</th>
                  <th className="py-3 px-4 font-semibold text-center text-rose-700">Abs. Injustifiées</th>
                  <th className="py-3 px-4 font-semibold text-center">Taux Assiduité</th>
                  <th className="py-3 px-4 font-semibold text-right">Statut LMD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentAttendanceStats.map((item) => {
                  return (
                    <tr key={item.student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {item.student.firstName} {item.student.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.student.matricule}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.program ? (
                          <span className="font-medium text-slate-800">
                            {item.program.acronym} ({item.program.yearLevel})
                          </span>
                        ) : (
                          <span className="text-slate-400">Non inscrit</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">
                        {item.totalSessions}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {item.presentCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-700">
                        {item.retardCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700">
                        {item.justifieCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-rose-700">
                        {item.injustifieCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            item.rate >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.rate >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.isAtRisk ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                            Alerte Décrochage
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Régulier
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INTERACTIVE ROLL CALL MODAL (Cahier d'Appel Numérique)       */}
      {/* ------------------------------------------------------------- */}
      {isRollCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingSession ? "Émargement de la Séance de Cours" : "Nouvelle Fiche d'Émargement"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Saisie instantanée des présences, retards et motifs d'absence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRollCallModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Session Meta Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Module */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Module d'Enseignement :
                  </label>
                  <select
                    value={formModuleId}
                    onChange={(e) => handleFormModuleChange(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.moduleCode} — {m.moduleTitle} ({m.hourlyVolume}h LMD)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date de la séance :
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Room */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Salle / Amphi :
                  </label>
                  <input
                    type="text"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="Ex: Amphi C.A. Diop, Salle TP 2"
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Session Title */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Titre / Libellé de la Séance :
                  </label>
                  <input
                    type="text"
                    value={formSessionTitle}
                    onChange={(e) => setFormSessionTitle(e.target.value)}
                    placeholder="Ex: Séance 3 : Structures de données linéaires"
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Heure Début :
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Heure Fin :
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Course Topic Covered */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Thème & Contenu Pédagogique Abordé (Cahier de texte LMD) :
                </label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="Ex: Listes chaînées, complexité algorithmique, allocation dynamique en mémoire..."
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Roster Table Header & Quick Action */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Liste des Étudiants de la Classe ({formAttendees.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Cochez le statut de chaque étudiant pour cette séance.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold text-[11px] flex items-center space-x-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Tous Présents</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Roster */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                  {formAttendees.map((att) => {
                    const student = students.find((s) => s.id === att.studentId);
                    if (!student) return null;

                    return (
                      <div
                        key={student.id}
                        className="p-3 bg-white hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        {/* Student identity */}
                        <div className="flex items-center space-x-3 min-w-[200px]">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            {student.firstName[0]}
                            {student.lastName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {student.matricule}
                            </div>
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Present */}
                          <button
                            type="button"
                            onClick={() => handleStudentStatusChange(student.id, 'present')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center space-x-1 ${
                              att.status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Présent</span>
                          </button>

                          {/* Retard */}
                          <button
                            type="button"
                            onClick={() => handleStudentStatusChange(student.id, 'retard')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center space-x-1 ${
                              att.status === 'retard'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>Retard</span>
                          </button>

                          {/* Absent Justifié */}
                          <button
                            type="button"
                            onClick={() => handleStudentStatusChange(student.id, 'absent_justifie')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center space-x-1 ${
                              att.status === 'absent_justifie'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Abs. Justifiée</span>
                          </button>

                          {/* Absent Injustifié */}
                          <button
                            type="button"
                            onClick={() => handleStudentStatusChange(student.id, 'absent_injustifie')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center space-x-1 ${
                              att.status === 'absent_injustifie'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <UserX className="w-3 h-3" />
                            <span>Absent Injustifié</span>
                          </button>
                        </div>

                        {/* Extra details (delay minutes or justification note) */}
                        <div className="w-full md:w-56">
                          {att.status === 'retard' && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-amber-800 font-medium">Retard :</span>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={att.arrivalDelayMinutes || 15}
                                onChange={(e) => handleDelayChange(student.id, Number(e.target.value))}
                                className="w-16 px-1.5 py-0.5 text-xs rounded border border-amber-300 bg-amber-50 focus:bg-white text-center font-bold"
                              />
                              <span className="text-[10px] text-slate-500">minutes</span>
                            </div>
                          )}

                          {att.status === 'absent_justifie' && (
                            <input
                              type="text"
                              placeholder="Motif (ex: Certificat médical)"
                              value={att.justificationNote || ''}
                              onChange={(e) => handleJustificationChange(student.id, e.target.value)}
                              className="w-full px-2 py-0.5 text-xs rounded border border-blue-300 bg-blue-50 focus:bg-white"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Session Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Observations de l'Enseignant (incidents, participation, matériel TP) :
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Remarques éventuelles sur la séance..."
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Signature Banner */}
              {editingSession?.signedAt && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2 text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold">Feuille d'émargement validée :</span>
                    <span className="ml-1 text-[11px]">
                      Signée électroniquement par <strong>{editingSession.signedBy}</strong> le{' '}
                      {editingSession.signedAt}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                {formAttendees.filter((a) => a.status === 'present' || a.status === 'retard').length} présent(s) /{' '}
                {formAttendees.length} étudiants inscrits
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRollCallModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSession(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs transition-colors"
                >
                  Enregistrer Brouillon
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSession(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Valider & Signer Officiellement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OFFICIAL PRINTABLE ATTENDANCE REGISTER MODAL                  */}
      {/* ------------------------------------------------------------- */}
      {isPrintModalOpen && selectedSessionForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span className="font-bold text-sm text-slate-900">
                  Feuille d'Émargement Officielle (Format Impression Pédagogique)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center space-x-1 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="p-8 overflow-y-auto space-y-6 text-slate-900 text-xs font-sans print:p-0">
              {/* Document Official Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-sm uppercase tracking-wide text-slate-900">
                    RÉPUBLIQUE DU SÉNÉGAL
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Ministère de l'Enseignement Supérieur, de la Recherche et de l'Innovation
                  </div>
                  <div className="text-base font-black text-emerald-800 mt-1">
                    ISMNM DAKAR
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Institut Supérieur des Métiers du Numérique et du Management
                  </div>
                </div>

                <div className="text-right">
                  <div className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded text-[11px]">
                    SESSION ACADÉMIQUE 2025-2026
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    Réf : {selectedSessionForPrint.id}
                  </div>
                </div>
              </div>

              {/* Document Title */}
              <div className="text-center py-2">
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                  FEUILLE D'ÉMARGEMENT & DE PRÉSENCE EN COURS
                </h2>
                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  Conforme aux exigences d'assiduité du système LMD (CAMES / ANAQ-Sup)
                </div>
              </div>

              {/* Session Meta Box */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg bg-slate-50/50">
                <div>
                  <div className="text-[11px]">
                    <span className="font-bold">Filière / Niveau :</span>{' '}
                    {getProgram(selectedSessionForPrint.programId)?.title || 'Licence Informatique L1'}
                  </div>
                  <div className="text-[11px] mt-1">
                    <span className="font-bold">Module :</span>{' '}
                    {getModule(selectedSessionForPrint.moduleId)?.moduleTitle || 'Algorithmique'} (
                    {getModule(selectedSessionForPrint.moduleId)?.moduleCode})
                  </div>
                  <div className="text-[11px] mt-1">
                    <span className="font-bold">Enseignant :</span>{' '}
                    {selectedSessionForPrint.teacherName || 'Dr. Cheikh Ibrahima Kane'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px]">
                    <span className="font-bold">Date de la séance :</span> {selectedSessionForPrint.date}
                  </div>
                  <div className="text-[11px] mt-1">
                    <span className="font-bold">Horaire :</span> {selectedSessionForPrint.startTime} -{' '}
                    {selectedSessionForPrint.endTime} ({selectedSessionForPrint.durationHours || 3}h)
                  </div>
                  <div className="text-[11px] mt-1">
                    <span className="font-bold">Salle :</span>{' '}
                    {selectedSessionForPrint.room || 'Amphi Cheikh Anta Diop'}
                  </div>
                </div>
              </div>

              {/* Topic */}
              {selectedSessionForPrint.topic && (
                <div className="border border-slate-200 p-2.5 rounded bg-slate-50 text-[11px]">
                  <span className="font-bold text-slate-800">Contenu / Thème du cours dispensé :</span>{' '}
                  {selectedSessionForPrint.topic}
                </div>
              )}

              {/* Students Attendance Table */}
              <table className="w-full border border-slate-300 text-left text-[11px]">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-bold w-12 text-center">N°</th>
                    <th className="py-2 px-3 border-r border-slate-300 font-bold">Matricule</th>
                    <th className="py-2 px-3 border-r border-slate-300 font-bold">Nom & Prénom de l'Étudiant</th>
                    <th className="py-2 px-3 border-r border-slate-300 font-bold text-center w-28">Statut</th>
                    <th className="py-2 px-3 font-bold">Observations / Émargement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedSessionForPrint.attendees.map((att, idx) => {
                    const student = students.find((s) => s.id === att.studentId);
                    if (!student) return null;

                    const statusLabels: Record<string, { label: string; class: string }> = {
                      present: { label: 'PRÉSENT', class: 'text-emerald-700 font-bold' },
                      retard: {
                        label: `RETARD (${att.arrivalDelayMinutes || 15} min)`,
                        class: 'text-amber-700 font-bold',
                      },
                      absent_justifie: {
                        label: 'ABS. JUSTIFIÉE',
                        class: 'text-blue-700 font-semibold',
                      },
                      absent_injustifie: {
                        label: 'ABSENT INJUSTIFIÉ',
                        class: 'text-rose-700 font-bold',
                      },
                    };

                    const currentStatus = statusLabels[att.status] || { label: att.status, class: '' };

                    return (
                      <tr key={student.id}>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[10px]">
                          {student.matricule}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-semibold">
                          {student.lastName.toUpperCase()} {student.firstName}
                        </td>
                        <td className={`py-1.5 px-3 border-r border-slate-200 text-center ${currentStatus.class}`}>
                          {currentStatus.label}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 italic text-[10px]">
                          {att.justificationNote || 'Émargé sur tablette / feuille d’appel'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Official Signatures Block */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border border-slate-300 rounded p-4 h-32 flex flex-col justify-between">
                  <div className="font-bold text-slate-800">L'Enseignant Responsable</div>
                  <div className="text-[11px] text-emerald-800 font-semibold">
                    {selectedSessionForPrint.signedBy ? (
                      <>
                        <div>Certifié conforme & signé</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {selectedSessionForPrint.signedAt}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Signature manuscrite</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {selectedSessionForPrint.teacherName || 'Dr. Cheikh Ibrahima Kane'}
                  </div>
                </div>

                <div className="border border-slate-300 rounded p-4 h-32 flex flex-col justify-between">
                  <div className="font-bold text-slate-800">La Direction des Études & Pédagogie</div>
                  <div className="text-[10px] text-slate-400 italic">
                    Visa pour archivage et calcul d'assiduité LMD
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    Pr. Ousmane Diop (Dir. Pédagogique)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
