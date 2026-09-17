import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Award,
  CheckCircle2,
  CalendarCheck,
  UserCheck,
  UserX,
  Users,
  Search,
  Filter,
  Download,
  Plus,
  Save,
  PenTool,
  Check,
  AlertCircle,
  MapPin,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  Wifi,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { GradeItem, TimetableSlot, AttendanceRecord, StudentAdmission, TeachingModule } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const TeacherPortalView: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const {
    modules,
    programs,
    students,
    enrollments,
    timetables,
    grades,
    attendance,
    saveGradesBatch,
    saveAttendance,
    signAttendance,
    academicYears,
  } = useApp();

  const { currentUser, activeRole } = useAuth();

  // Active top-level subtab: 'timetable' | 'grades' | 'attendance'
  const [activeTab, setActiveTab] = useState<'timetable' | 'grades' | 'attendance'>('timetable');

  // Teacher selector for Admin/Pedagogy supervision mode
  const teachersList = useMemo(() => {
    return [
      { id: 'tch_kane', name: 'Dr. Cheikh Ibrahima Kane', title: 'Maître de Conférences', department: 'Génie Informatique & Systèmes' },
      { id: 'tch_diop', name: 'Pr. Ousmane Abdoulaye Diop', title: 'Professeur Titulaire', department: 'Mathématiques & Informatique' },
      { id: 'tch_sow', name: 'Dr. Mariama Sow', title: 'Chargée d Enseignement', department: 'Gestion, Audit & Finance' },
      { id: 'tch_fall', name: 'M. Babacar Fall', title: 'Expert Professionnel', department: 'Réseaux & Cybersécurité' },
    ];
  }, []);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    currentUser.teacherId || 'tch_kane'
  );

  const activeTeacher = useMemo(() => {
    return (
      teachersList.find((t) => t.id === selectedTeacherId) || {
        id: selectedTeacherId,
        name: currentUser.name || 'Enseignant',
        title: 'Enseignant Chercheur',
        department: 'Corps Enseignant ISMNM',
      }
    );
  }, [selectedTeacherId, teachersList, currentUser]);

  // Modules assigned to this teacher
  const teacherModules = useMemo(() => {
    const list = modules.filter((m) => m.teacherId === selectedTeacherId);
    if (list.length > 0) return list;
    // Fallback: if no specific modules have teacherId, take modules related to informatics or all modules
    return modules.slice(0, 4);
  }, [modules, selectedTeacherId]);

  // Timetables slots assigned to this teacher
  const teacherSlots = useMemo(() => {
    const directSlots = timetables.filter((t) => t.teacherId === selectedTeacherId);
    if (directSlots.length > 0) return directSlots;
    // If no direct teacherId match, match via teacher modules
    const moduleIds = new Set(teacherModules.map((m) => m.id));
    const byModules = timetables.filter((t) => moduleIds.has(t.moduleId));
    if (byModules.length > 0) return byModules;
    return timetables.slice(0, 5);
  }, [timetables, selectedTeacherId, teacherModules]);

  // Total weekly volume
  const weeklyHours = useMemo(() => {
    return teacherSlots.reduce((sum, slot) => {
      if (slot.startTime && slot.endTime) {
        const [sH, sM] = slot.startTime.split(':').map(Number);
        const [eH, eM] = slot.endTime.split(':').map(Number);
        const duration = (eH * 60 + eM - (sH * 60 + sM)) / 60;
        return sum + (duration > 0 ? duration : 3);
      }
      return sum + 3;
    }, 0);
  }, [teacherSlots]);

  // ==========================================
  // TAB 1: EMPLOI DU TEMPS HEBDOMADAIRE STATE
  // ==========================================
  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');

  // Filtered timetable slots
  const filteredSlots = useMemo(() => {
    if (selectedDayFilter === 'all') return teacherSlots;
    return teacherSlots.filter((s) => s.dayOfWeek === selectedDayFilter);
  }, [teacherSlots, selectedDayFilter]);

  // ==========================================
  // TAB 2: SAISIE DIRECTE DES NOTES STATE
  // ==========================================
  const [selectedGradeModuleId, setSelectedGradeModuleId] = useState<string>(
    teacherModules[0]?.id || 'mod_algo'
  );

  const currentGradeModule = useMemo(() => {
    return modules.find((m) => m.id === selectedGradeModuleId) || teacherModules[0] || modules[0];
  }, [modules, selectedGradeModuleId, teacherModules]);

  const currentGradeProgram = useMemo(() => {
    return programs.find((p) => p.id === currentGradeModule?.programId) || programs[0];
  }, [programs, currentGradeModule]);

  // Students belonging to current program
  const classStudents = useMemo(() => {
    if (!currentGradeProgram) return students.slice(0, 10);
    const enrolledIds = new Set(
      enrollments.filter((e) => e.programId === currentGradeProgram.id).map((e) => e.studentId)
    );
    const enrolled = students.filter((s) => enrolledIds.has(s.id));
    if (enrolled.length > 0) return enrolled;
    // Fallback: return active registered students
    return students.filter((s) => s.status === 'inscrit').slice(0, 10);
  }, [students, enrollments, currentGradeProgram]);

  // Local editable grade map: { [studentId]: { cc: number, exam: number, catchUp?: number, status: 'brouillon' | 'valide' } }
  const [editableGrades, setEditableGrades] = useState<{
    [studentId: string]: { cc: number; exam: number; catchUp?: number; status: 'brouillon' | 'valide' };
  }>({});

  const [gradeSaveFeedback, setGradeSaveFeedback] = useState<string | null>(null);
  const [isSavingGrades, setIsSavingGrades] = useState(false);

  // Initialize or update editable grades when module or students change
  React.useEffect(() => {
    if (!selectedGradeModuleId || classStudents.length === 0) return;
    const initialMap: {
      [studentId: string]: { cc: number; exam: number; catchUp?: number; status: 'brouillon' | 'valide' };
    } = {};

    classStudents.forEach((st) => {
      const existingGrade = grades.find(
        (g) => g.studentId === st.id && g.moduleId === selectedGradeModuleId
      );
      if (existingGrade) {
        initialMap[st.id] = {
          cc: existingGrade.continuousAssessmentNote ?? 13.5,
          exam: existingGrade.examNote ?? 14.0,
          catchUp: existingGrade.catchUpExamNote,
          status: existingGrade.status === 'valide' || existingGrade.status === 'publie' ? 'valide' : 'brouillon',
        };
      } else {
        // Default values for quick workflow
        initialMap[st.id] = {
          cc: 14.0,
          exam: 13.0,
          status: 'brouillon',
        };
      }
    });

    setEditableGrades(initialMap);
  }, [selectedGradeModuleId, classStudents, grades]);

  // Calculate stats for current class notes
  const gradeStats = useMemo(() => {
    const list = classStudents.map((st) => {
      const g = editableGrades[st.id] || { cc: 0, exam: 0 };
      const effectiveExam = g.catchUp !== undefined && g.catchUp > g.exam ? g.catchUp : g.exam;
      return Math.round((g.cc * 0.4 + effectiveExam * 0.6) * 10) / 10;
    });

    if (list.length === 0) return { avg: '0.0', passRate: 0, count: 0, min: 0, max: 0 };
    const sum = list.reduce((a, b) => a + b, 0);
    const avg = (sum / list.length).toFixed(1);
    const passed = list.filter((n) => n >= 10).length;
    const passRate = Math.round((passed / list.length) * 100);
    const min = Math.min(...list);
    const max = Math.max(...list);

    return { avg, passRate, count: list.length, min, max };
  }, [classStudents, editableGrades]);

  const handleGradeInputChange = (
    studentId: string,
    field: 'cc' | 'exam' | 'catchUp',
    valStr: string
  ) => {
    let num = parseFloat(valStr);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 20) num = 20;

    setEditableGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: num,
      },
    }));
  };

  const handleSaveAllGrades = async () => {
    setIsSavingGrades(true);
    setGradeSaveFeedback(null);
    try {
      const batchPayload: Partial<GradeItem>[] = classStudents.map((st) => {
        const item = editableGrades[st.id] || { cc: 14, exam: 14, status: 'brouillon' };
        const effectiveExam = item.catchUp !== undefined && item.catchUp > item.exam ? item.catchUp : item.exam;
        const finalNote = Math.round((item.cc * 0.4 + effectiveExam * 0.6) * 10) / 10;
        return {
          studentId: st.id,
          moduleId: selectedGradeModuleId,
          academicYearId: 'year_2025_2026',
          continuousAssessmentNote: item.cc,
          examNote: item.examNote,
          catchUpExamNote: item.catchUp,
          finalNote,
          status: item.status || 'brouillon',
        };
      });

      await saveGradesBatch(batchPayload);
      setGradeSaveFeedback(
        `Succès ! ${batchPayload.length} notes enregistrées pour le module ${currentGradeModule?.moduleTitle}`
      );
      setTimeout(() => setGradeSaveFeedback(null), 4000);
    } catch (err: any) {
      alert(`Erreur lors de l'enregistrement des notes : ${err.message}`);
    } finally {
      setIsSavingGrades(false);
    }
  };

  const handleFillDemoGrades = () => {
    const randomized: { [studentId: string]: { cc: number; exam: number; status: 'brouillon' | 'valide' } } = {};
    classStudents.forEach((st, idx) => {
      const base = 11 + (idx % 8);
      const cc = Math.min(20, Math.round((base + (Math.random() * 3 - 1)) * 2) / 2);
      const exam = Math.min(20, Math.round((base + (Math.random() * 3 - 1)) * 2) / 2);
      randomized[st.id] = {
        cc,
        exam,
        status: 'brouillon',
      };
    });
    setEditableGrades(randomized);
    setGradeSaveFeedback('Notes types générées pour la promotion. Cliquez sur "Enregistrer" pour persister.');
    setTimeout(() => setGradeSaveFeedback(null), 3500);
  };

  const handleExportGradesCsv = () => {
    const headers = ['Matricule', 'Nom', 'Prenom', 'Module', 'CC (/20)', 'Examen (/20)', 'Moyenne (/20)', 'Mention', 'Statut'];
    const rows = classStudents.map((st) => {
      const g = editableGrades[st.id] || { cc: 0, exam: 0, status: 'brouillon' };
      const finalNote = Math.round((g.cc * 0.4 + g.exam * 0.6) * 10) / 10;
      let mention = 'Ajourné';
      if (finalNote >= 16) mention = 'Très Bien';
      else if (finalNote >= 14) mention = 'Bien';
      else if (finalNote >= 12) mention = 'Assez Bien';
      else if (finalNote >= 10) mention = 'Passable';

      return [
        st.matricule,
        st.lastName,
        st.firstName,
        currentGradeModule?.moduleCode || '',
        g.cc.toFixed(1),
        g.exam.toFixed(1),
        finalNote.toFixed(1),
        mention,
        g.status,
      ].join(';');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Notes_${currentGradeModule?.moduleCode || 'module'}_ISMNM.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // TAB 3: ÉMARGEMENT & PRÉSENCES DIRECT STATE
  // ==========================================
  const [selectedAttModuleId, setSelectedAttModuleId] = useState<string>(
    teacherModules[0]?.id || 'mod_algo'
  );

  const currentAttModule = useMemo(() => {
    return modules.find((m) => m.id === selectedAttModuleId) || teacherModules[0] || modules[0];
  }, [modules, selectedAttModuleId, teacherModules]);

  const currentAttProgram = useMemo(() => {
    return programs.find((p) => p.id === currentAttModule?.programId) || programs[0];
  }, [programs, currentAttModule]);

  // Students for current attendance module
  const attStudents = useMemo(() => {
    if (!currentAttProgram) return students.slice(0, 10);
    const enrolledIds = new Set(
      enrollments.filter((e) => e.programId === currentAttProgram.id).map((e) => e.studentId)
    );
    const enrolled = students.filter((s) => enrolledIds.has(s.id));
    if (enrolled.length > 0) return enrolled;
    return students.filter((s) => s.status === 'inscrit').slice(0, 10);
  }, [students, enrollments, currentAttProgram]);

  // Attendance Form fields
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sessionStartTime, setSessionStartTime] = useState<string>('08:30');
  const [sessionEndTime, setSessionEndTime] = useState<string>('11:30');
  const [sessionRoom, setSessionRoom] = useState<string>('Amphithéâtre Cheikh Anta Diop');
  const [sessionTopic, setSessionTopic] = useState<string>(
    'Structures dynamiques, pointeurs et allocation mémoire avancée'
  );
  const [sessionNotes, setSessionNotes] = useState<string>(
    'Bonne assiduité des étudiants et travaux pratiques réalisés sur machine.'
  );

  // Attendee type definition
  interface AttendeeEntry {
    status: 'present' | 'absent_justifie' | 'absent_injustifie' | 'retard';
    delayMinutes?: number;
    note?: string;
  }

  // Attendees map: { [studentId]: AttendeeEntry }
  const [attendeesMap, setAttendeesMap] = useState<Record<string, AttendeeEntry>>({});

  const [attSaveFeedback, setAttSaveFeedback] = useState<string | null>(null);
  const [isSavingAtt, setIsSavingAtt] = useState(false);

  // Initialize attendees map when attendance students change
  React.useEffect(() => {
    const map: Record<string, AttendeeEntry> = {};

    attStudents.forEach((st) => {
      map[st.id] = { status: 'present' };
    });
    setAttendeesMap(map);
  }, [attStudents, selectedAttModuleId]);

  // Attendance counts
  const attStats = useMemo(() => {
    const list: AttendeeEntry[] = Object.values(attendeesMap);
    const total = list.length;
    const present = list.filter((a) => a.status === 'present').length;
    const retard = list.filter((a) => a.status === 'retard').length;
    const justifie = list.filter((a) => a.status === 'absent_justifie').length;
    const injustifie = list.filter((a) => a.status === 'absent_injustifie').length;
    const rate = total > 0 ? Math.round(((present + retard) / total) * 100) : 0;

    return { total, present, retard, justifie, injustifie, rate };
  }, [attendeesMap]);

  const handleMarkAllPresent = () => {
    setAttendeesMap((prev) => {
      const next: Record<string, AttendeeEntry> = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { status: 'present' };
      });
      return next;
    });
  };

  const handleStudentStatusToggle = (
    studentId: string,
    status: 'present' | 'absent_justifie' | 'absent_injustifie' | 'retard'
  ) => {
    setAttendeesMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        delayMinutes: status === 'retard' ? prev[studentId]?.delayMinutes || 15 : undefined,
      },
    }));
  };

  const handleSaveAndSignAttendance = async () => {
    setIsSavingAtt(true);
    setAttSaveFeedback(null);
    try {
      const attendeesList = Object.entries(attendeesMap).map(([studentId, data]: [string, AttendeeEntry]) => ({
        studentId,
        status: data.status,
        arrivalDelayMinutes: data.delayMinutes,
        justificationNote: data.note,
      }));

      const record = await saveAttendance({
        date: sessionDate,
        moduleId: selectedAttModuleId,
        teacherId: selectedTeacherId,
        teacherName: activeTeacher.name,
        sessionTitle: `Séance : ${currentAttModule?.moduleTitle}`,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        durationHours: 3,
        room: sessionRoom,
        programId: currentAttProgram?.id || 'prog_lic_info_l1',
        academicYearId: 'year_2025_2026',
        topic: sessionTopic,
        notes: sessionNotes,
        status: 'valide',
        signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        signedBy: activeTeacher.name,
        attendees: attendeesList,
      });

      if (record && record.id) {
        await signAttendance(record.id, activeTeacher.name);
      }

      setAttSaveFeedback(`Feuille d'émargement enregistrée et signée avec succès par ${activeTeacher.name} !`);
      setTimeout(() => setAttSaveFeedback(null), 4500);
    } catch (err: any) {
      alert(`Erreur lors de l'émargement : ${err.message}`);
    } finally {
      setIsSavingAtt(false);
    }
  };

  // Recent signed sheets for this teacher
  const recentTeacherSheets = useMemo(() => {
    return attendance
      .filter((a) => a.teacherId === selectedTeacherId || a.teacherName === activeTeacher.name)
      .slice(0, 5);
  }, [attendance, selectedTeacherId, activeTeacher]);

  // Action from Timetable: Quick Launch Attendance or Grades for a slot
  const handleSlotAction = (slot: TimetableSlot, action: 'attendance' | 'grades') => {
    if (action === 'attendance') {
      setSelectedAttModuleId(slot.moduleId);
      setSessionRoom(slot.room);
      setSessionStartTime(slot.startTime);
      setSessionEndTime(slot.endTime);
      setActiveTab('attendance');
    } else {
      setSelectedGradeModuleId(slot.moduleId);
      setActiveTab('grades');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Teacher Identity & Workspace Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-emerald-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Espace Enseignant Simplifié</span>
              <span>•</span>
              <span>Année Académique 2025-2026</span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-lg shadow-inner">
                {activeTeacher.name
                  .split(' ')
                  .map((w) => w[0])
                  .filter((_, i) => i < 2)
                  .join('')}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {activeTeacher.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  {activeTeacher.title} • {activeTeacher.department}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl px-4 py-2.5 border border-white/10 text-center">
              <div className="text-xs text-slate-300 font-medium">Charge Hebdo</div>
              <div className="text-lg font-bold text-emerald-400">{weeklyHours}h / semaine</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl px-4 py-2.5 border border-white/10 text-center">
              <div className="text-xs text-slate-300 font-medium">Modules Pris en Charge</div>
              <div className="text-lg font-bold text-white">{teacherModules.length} cours</div>
            </div>
          </div>
        </div>

        {/* Supervision Teacher Switcher (for Admin/Pedagogy) */}
        {(activeRole === 'admin' || activeRole === 'dg' || activeRole === 'pedagogie') && (
          <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-emerald-300">Mode Supervision Pédagogique :</span>
              <span>Visualiser l espace d un enseignant en particulier</span>
            </div>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
            >
              {teachersList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.title})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Offline Status & Cache Notice */}
      {!isOnline ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-200/70 flex items-center justify-center text-amber-800 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Consultation Hors-Ligne Active :</span>{' '}
              <span>Votre planning hebdomadaire ({teacherSlots.length} créneaux) et la liste de vos étudiants sont chargés depuis le cache local (Service Worker).</span>
            </div>
          </div>
          <span className="text-2xs font-bold uppercase bg-amber-200 px-2 py-0.5 rounded text-amber-950 shrink-0">
            Cache Local
          </span>
        </div>
      ) : (
        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-emerald-900 text-2xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Service Worker actif : Emploi du temps ({teacherSlots.length} créneaux) et listes d'étudiants sauvegardés pour consultation hors-ligne.</span>
          </div>
          <span className="text-emerald-700 font-semibold flex items-center space-x-1">
            <HardDrive className="w-3 h-3" />
            <span>Synchronisé</span>
          </span>
        </div>
      )}

      {/* Main Navigation Subtabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'timetable'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Emploi du Temps Hebdomadaire</span>
          <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20 ml-1">
            {teacherSlots.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'grades'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Saisie Directe des Notes</span>
          <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20 ml-1">LMD</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Émargement & Feuilles de Présence</span>
          <span className="px-1.5 py-0.5 rounded-full text-2xs bg-white/20 ml-1">Direct</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: EMPLOI DU TEMPS HEBDOMADAIRE                      */}
      {/* ======================================================== */}
      {activeTab === 'timetable' && (
        <div className="space-y-6">
          {/* Filter Bar & Quick Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Filtrer par Jour :
              </span>
              <button
                onClick={() => setSelectedDayFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  selectedDayFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Toute la semaine ({teacherSlots.length})
              </button>
              {daysOfWeek.map((day) => {
                const count = teacherSlots.filter((s) => s.dayOfWeek === day).length;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      selectedDayFilter === day
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {day} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Semestre en cours • Présentiel Campus Dakar
            </div>
          </div>

          {/* Timetable Grid Cards */}
          {filteredSlots.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 space-y-3">
              <Calendar className="w-10 h-10 mx-auto text-slate-400" />
              <div className="font-semibold text-slate-800 text-base">Aucun cours planifié ce jour</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Vous n avez aucun créneau programmé le {selectedDayFilter}. Sélectionnez un autre jour ou contactez la direction des études.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSlots.map((slot) => {
                const mod = modules.find((m) => m.id === slot.moduleId);
                const prog = programs.find((p) => p.id === slot.programId);
                const isExam = slot.sessionType?.includes('examen');

                return (
                  <div
                    key={slot.id}
                    className={`bg-white rounded-xl border transition-all p-5 flex flex-col justify-between space-y-4 hover:shadow-xs ${
                      isExam
                        ? 'border-purple-200 ring-1 ring-purple-100'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {/* Top Slot Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">
                          {slot.dayOfWeek}
                        </span>
                        <span
                          className={`text-2xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isExam
                              ? 'bg-purple-100 text-purple-800 font-bold'
                              : slot.sessionType === 'td_tp'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {slot.sessionType === 'cours'
                            ? 'Cours Magistral'
                            : slot.sessionType === 'td_tp'
                            ? 'Travaux Pratiques'
                            : isExam
                            ? 'Évaluation Semestrielle'
                            : 'Séance'}
                        </span>
                      </div>

                      {/* Time & Duration */}
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        <span>
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>

                      {/* Module Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {mod?.moduleTitle || 'Module d enseignement'}
                      </h3>

                      <div className="text-xs text-slate-500 font-medium">
                        Code: <span className="font-semibold text-slate-700">{mod?.moduleCode || 'MOD'}</span> •{' '}
                        {prog?.title || 'Filière'}
                      </div>

                      {/* Room & Location */}
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{slot.room}</span>
                      </div>

                      {slot.notes && (
                        <p className="text-2xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          « {slot.notes} »
                        </p>
                      )}
                    </div>

                    {/* Integrated Direct Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => handleSlotAction(slot, 'attendance')}
                        className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                        title="Faire l'appel et marquer les présences"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Faire l Appel</span>
                      </button>

                      <button
                        onClick={() => handleSlotAction(slot, 'grades')}
                        className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                        title="Saisir les notes de la classe"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>Saisir Notes</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SAISIE DIRECTE DES NOTES LMD                      */}
      {/* ======================================================== */}
      {activeTab === 'grades' && (
        <div className="space-y-6">
          {/* Header Controls: Select Module & Class Overview */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Module d Évaluation Actif
                </span>
                <div className="flex items-center space-x-3">
                  <select
                    value={selectedGradeModuleId}
                    onChange={(e) => setSelectedGradeModuleId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3.5 py-2 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    {teacherModules.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.moduleCode}] {m.moduleTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Module Metadata Card */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg font-medium">
                  Filière : <span className="font-bold">{currentGradeProgram?.title}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg font-medium">
                  Crédits : <span className="font-bold">{currentGradeModule?.credits || 6} ECTS</span>
                </div>
                <div className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg font-medium">
                  Coeff : <span className="font-bold">{currentGradeModule?.coefficient || 4}</span>
                </div>
                <div className="bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg font-medium">
                  Formule LMD : <span className="font-bold">40% CC + 60% Exam</span>
                </div>
              </div>
            </div>

            {/* Class Stats Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-2xs text-slate-500 uppercase font-semibold">Étudiants Évalués</div>
                <div className="text-lg font-bold text-slate-900">{gradeStats.count} inscrits</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-2xs text-slate-500 uppercase font-semibold">Moyenne Promotion</div>
                <div className="text-lg font-bold text-emerald-700">{gradeStats.avg} / 20</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-2xs text-slate-500 uppercase font-semibold">Taux de Validation (≥10)</div>
                <div className="text-lg font-bold text-indigo-700">{gradeStats.passRate}%</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-2xs text-slate-500 uppercase font-semibold">Fourchette (Min - Max)</div>
                <div className="text-lg font-bold text-slate-700">
                  {gradeStats.min} - {gradeStats.max} / 20
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveAllGrades}
                  disabled={isSavingGrades}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
                >
                  {isSavingGrades ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Enregistrer Toutes les Notes</span>
                </button>

                <button
                  onClick={handleFillDemoGrades}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="Pré-remplir avec des notes de simulation pour démo"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulation Rapide</span>
                </button>
              </div>

              <button
                onClick={handleExportGradesCsv}
                className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exporter Grille (CSV)</span>
              </button>
            </div>

            {/* Feedback Alert */}
            {gradeSaveFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{gradeSaveFeedback}</span>
              </div>
            )}
          </div>

          {/* Interactive Direct Grades Entry Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Matricule & Étudiant</th>
                    <th className="p-3.5 text-center">Contrôle Continu (40%)</th>
                    <th className="p-3.5 text-center">Examen Semestre (60%)</th>
                    <th className="p-3.5 text-center">Rattrapage (Opt.)</th>
                    <th className="p-3.5 text-center font-black">Note Finale LMD</th>
                    <th className="p-3.5 text-center">Mention / Décision</th>
                    <th className="p-3.5 text-center">Statut Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((st) => {
                    const studentGrade = editableGrades[st.id] || {
                      cc: 14.0,
                      exam: 13.0,
                      status: 'brouillon',
                    };
                    const effectiveExam =
                      studentGrade.catchUp !== undefined && studentGrade.catchUp > studentGrade.exam
                        ? studentGrade.catchUp
                        : studentGrade.exam;
                    const finalCalculated = Math.round((studentGrade.cc * 0.4 + effectiveExam * 0.6) * 10) / 10;
                    const isPassed = finalCalculated >= 10;

                    let mentionText = 'Ajourné';
                    let mentionStyle = 'bg-rose-100 text-rose-800 border-rose-200';
                    if (finalCalculated >= 16) {
                      mentionText = 'Très Bien';
                      mentionStyle = 'bg-emerald-100 text-emerald-900 border-emerald-200';
                    } else if (finalCalculated >= 14) {
                      mentionText = 'Bien';
                      mentionStyle = 'bg-teal-100 text-teal-800 border-teal-200';
                    } else if (finalCalculated >= 12) {
                      mentionText = 'Assez Bien';
                      mentionStyle = 'bg-blue-100 text-blue-800 border-blue-200';
                    } else if (finalCalculated >= 10) {
                      mentionText = 'Passable';
                      mentionStyle = 'bg-amber-100 text-amber-800 border-amber-200';
                    }

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">
                            {st.lastName.toUpperCase()} {st.firstName}
                          </div>
                          <div className="text-2xs text-slate-500 font-mono">{st.matricule}</div>
                        </td>

                        {/* CC Input */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="20"
                              value={studentGrade.cc}
                              onChange={(e) =>
                                handleGradeInputChange(st.id, 'cc', e.target.value)
                              }
                              className="w-16 px-2 py-1.5 text-center bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-2xs text-slate-400">/20</span>
                          </div>
                        </td>

                        {/* Exam Input */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="20"
                              value={studentGrade.exam}
                              onChange={(e) =>
                                handleGradeInputChange(st.id, 'exam', e.target.value)
                              }
                              className="w-16 px-2 py-1.5 text-center bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-2xs text-slate-400">/20</span>
                          </div>
                        </td>

                        {/* Catch-up Input */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="20"
                              placeholder="-"
                              value={studentGrade.catchUp ?? ''}
                              onChange={(e) =>
                                handleGradeInputChange(st.id, 'catchUp', e.target.value)
                              }
                              className="w-14 px-2 py-1 text-center bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-300"
                            />
                          </div>
                        </td>

                        {/* Computed Final Note */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-lg font-black text-sm ${
                              isPassed
                                ? 'bg-emerald-50 text-emerald-800 font-mono'
                                : 'bg-rose-50 text-rose-800 font-mono'
                            }`}
                          >
                            {finalCalculated.toFixed(1)} / 20
                          </span>
                        </td>

                        {/* Mention Badge */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-2xs font-bold border ${mentionStyle}`}
                          >
                            {mentionText}
                          </span>
                        </td>

                        {/* Grade Status */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold ${
                              studentGrade.status === 'valide'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {studentGrade.status === 'valide' ? 'Validé' : 'Brouillon'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ÉMARGEMENT & FEUILLES DE PRÉSENCE DIRECTES        */}
      {/* ======================================================== */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Active Roll-Call Configuration Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <span>Feuille d Émargement Immédiate de la Séance</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Pointage direct en classe avec calcul automatique du taux de présence et signature numérique.
                </p>
              </div>

              {/* One-Click Mark All Present */}
              <button
                onClick={handleMarkAllPresent}
                className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Check className="w-4 h-4 text-emerald-700" />
                <span>⚡ Marquer Tous Présents</span>
              </button>
            </div>

            {/* Session Metadata Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Module de Cours
                </label>
                <select
                  value={selectedAttModuleId}
                  onChange={(e) => setSelectedAttModuleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {teacherModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.moduleCode}] {m.moduleTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Date de la Séance
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Horaires (Début - Fin)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-center font-semibold"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-center font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Salle de Classe
                </label>
                <input
                  type="text"
                  value={sessionRoom}
                  onChange={(e) => setSessionRoom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Topic / Chapter */}
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Thème / Chapitre abordé lors de la séance
              </label>
              <input
                type="text"
                value={sessionTopic}
                onChange={(e) => setSessionTopic(e.target.value)}
                placeholder="ex: Chapitre 3 : Arbres Binaires et Tables de Hachage"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Live Attendance Counter */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <span className="text-slate-600">
                  Total : <strong className="text-slate-900">{attStats.total}</strong>
                </span>
                <span className="text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md">
                  Présents : <strong>{attStats.present}</strong>
                </span>
                <span className="text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-md">
                  Retards : <strong>{attStats.retard}</strong>
                </span>
                <span className="text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-md">
                  Justifiés : <strong>{attStats.justifie}</strong>
                </span>
                <span className="text-rose-700 bg-rose-100/60 px-2.5 py-1 rounded-md">
                  Injustifiés : <strong>{attStats.injustifie}</strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Taux d Assiduité :</span>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-emerald-600 text-white">
                  {attStats.rate}%
                </span>
              </div>
            </div>

            {/* Action to Save & Sign */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500 italic">
                La signature de l enseignant ({activeTeacher.name}) sera apposée électroniquement.
              </div>

              <button
                onClick={handleSaveAndSignAttendance}
                disabled={isSavingAtt}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                {isSavingAtt ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PenTool className="w-4 h-4" />
                )}
                <span>Signer & Valider l Émargement</span>
              </button>
            </div>

            {/* Attendance Feedback */}
            {attSaveFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{attSaveFeedback}</span>
              </div>
            )}
          </div>

          {/* Student Roster Call List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Liste d Appel de la Promotion ({attStudents.length} étudiants inscrits)
              </span>
              <span className="text-2xs text-slate-500">
                Cliquez sur le statut pour pointer chaque étudiant
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {attStudents.map((st) => {
                const currentStatus = attendeesMap[st.id]?.status || 'present';
                const currentDelay = attendeesMap[st.id]?.delayMinutes;

                return (
                  <div
                    key={st.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                        {st.firstName[0]}
                        {st.lastName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {st.lastName.toUpperCase()} {st.firstName}
                        </div>
                        <div className="text-2xs text-slate-500 font-mono">{st.matricule}</div>
                      </div>
                    </div>

                    {/* Quick Status Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Present Button */}
                      <button
                        onClick={() => handleStudentStatusToggle(st.id, 'present')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentStatus === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Présent
                      </button>

                      {/* Retard Button */}
                      <button
                        onClick={() => handleStudentStatusToggle(st.id, 'retard')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentStatus === 'retard'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Retard {currentStatus === 'retard' && currentDelay ? `(${currentDelay}m)` : ''}
                      </button>

                      {/* Absent Justifié Button */}
                      <button
                        onClick={() => handleStudentStatusToggle(st.id, 'absent_justifie')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentStatus === 'absent_justifie'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Justifié
                      </button>

                      {/* Absent Injustifié Button */}
                      <button
                        onClick={() => handleStudentStatusToggle(st.id, 'absent_injustifie')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentStatus === 'absent_injustifie'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Injustifié
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Attendance History Cards */}
          {recentTeacherSheets.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Dernières Feuilles d Émargement Signées par {activeTeacher.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentTeacherSheets.map((sheet) => {
                  const mod = modules.find((m) => m.id === sheet.moduleId);
                  const presentCount = sheet.attendees.filter((a) => a.status === 'present').length;
                  const totalCount = sheet.attendees.length;
                  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  return (
                    <div
                      key={sheet.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">{sheet.sessionTitle}</div>
                        <div className="text-2xs text-slate-500">
                          Date : {sheet.date} • {sheet.startTime} à {sheet.endTime} • {sheet.room}
                        </div>
                        {sheet.topic && (
                          <div className="text-2xs text-slate-600 italic">Thème : {sheet.topic}</div>
                        )}
                        <div className="text-2xs text-emerald-700 font-semibold pt-1">
                          Signé par {sheet.signedBy || activeTeacher.name} à {sheet.signedAt || sheet.date}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                          {presentCount}/{totalCount} ({rate}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
