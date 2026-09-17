import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  Filter,
  GraduationCap,
  Info,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  X,
  Wifi,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { TimetableSlot } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const PedagogyCalendarView: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const { programs, modules, timetables, saveTimetableSlot, deleteTimetableSlot } = useApp();
  const { activeRole } = useAuth();
  const canManage = activeRole === 'admin' || activeRole === 'pedagogie' || activeRole === 'dg';

  // Navigation State
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 8, 15)); // Default to Sept 2026 or current
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  // Filters
  const [selectedProgramId, setSelectedProgramId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Selected Event
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimetableSlot | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    programId: string;
    moduleId: string;
    teacherId: string;
    room: string;
    dayOfWeek: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
    startTime: string;
    endTime: string;
    sessionType: 'cours' | 'td_tp' | 'examen_partiel' | 'examen_final' | 'rattrapage';
    date: string;
    supervisor: string;
    notes: string;
  }>({
    programId: '',
    moduleId: '',
    teacherId: 'Pr. Birahim Diop',
    room: 'Amphi Cheikh Anta Diop',
    dayOfWeek: 'Lundi',
    startTime: '08:30',
    endTime: '11:30',
    sessionType: 'examen_final',
    date: '2026-09-21',
    supervisor: 'Dr. Aminata Ndiaye',
    notes: 'Calculatrice non autorisée. Présenter carte d étudiant.',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered Sessions
  const filteredSlots = useMemo(() => {
    return timetables.filter((slot) => {
      const matchProgram = selectedProgramId === 'ALL' || slot.programId === selectedProgramId;
      const type = slot.sessionType || 'cours';
      const matchType = selectedType === 'ALL' || type === selectedType;

      const mod = modules.find((m) => m.id === slot.moduleId);
      const modTitle = mod?.moduleTitle?.toLowerCase() || '';
      const modCode = mod?.moduleCode?.toLowerCase() || '';
      const room = slot.room?.toLowerCase() || '';
      const teacher = (slot.teacherId || '')?.toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchSearch = !q || modTitle.includes(q) || modCode.includes(q) || room.includes(q) || teacher.includes(q);

      return matchProgram && matchType && matchSearch;
    });
  }, [timetables, selectedProgramId, selectedType, searchQuery, modules]);

  // Exam vs Course counts
  const stats = useMemo(() => {
    const exams = timetables.filter(
      (t) => t.sessionType === 'examen_final' || t.sessionType === 'examen_partiel' || t.sessionType === 'rattrapage'
    ).length;
    const courses = timetables.filter((t) => !t.sessionType || t.sessionType === 'cours' || t.sessionType === 'td_tp').length;
    return { total: timetables.length, exams, courses };
  }, [timetables]);

  // Calendar Helpers for Month View
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0 in our layout (0 = Lundi ... 6 = Dimanche)
    const firstDayIndex = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    // Previous month padding
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLastDay - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, isCurrentMonth: false, dateStr });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ date: d, isCurrentMonth: true, dateStr });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, isCurrentMonth: false, dateStr });
    }

    return days;
  }, [year, month]);

  // Navigate months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Day of week mapping from date
  const getDayOfWeekFr = (dateStr: string): 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi' => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const map: Record<number, 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi'> = {
      1: 'Lundi',
      2: 'Mardi',
      3: 'Mercredi',
      4: 'Jeudi',
      5: 'Vendredi',
      6: 'Samedi',
      0: 'Lundi',
    };
    return map[day] || 'Lundi';
  };

  // Get slots for a specific date cell
  const getSlotsForDate = (dateStr: string) => {
    const dayName = getDayOfWeekFr(dateStr);
    return filteredSlots.filter((s) => {
      if (s.date) {
        return s.date === dateStr;
      }
      // If recurring weekly slot without specific date, match dayOfWeek
      return s.dayOfWeek === dayName;
    });
  };

  // Color & Badge for Session Types
  const getSessionBadge = (type?: string) => {
    switch (type) {
      case 'examen_final':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
          dot: 'bg-rose-600',
          label: 'Examen Final',
        };
      case 'examen_partiel':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
          dot: 'bg-amber-500',
          label: 'Contrôle / Partiel',
        };
      case 'rattrapage':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
          dot: 'bg-purple-600',
          label: 'Rattrapage',
        };
      case 'td_tp':
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
          dot: 'bg-sky-500',
          label: 'TD / TP',
        };
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
          dot: 'bg-emerald-600',
          label: 'Cours Magistral',
        };
    }
  };

  // Open Add Modal
  const handleOpenAddModal = (presetDate?: string) => {
    setFormError(null);
    const dateVal = presetDate || new Date().toISOString().split('T')[0];
    const progId = selectedProgramId !== 'ALL' ? selectedProgramId : programs[0]?.id || '';
    const progModules = modules.filter((m) => m.programId === progId);

    setSelectedEvent(null);
    setFormData({
      programId: progId,
      moduleId: progModules[0]?.id || modules[0]?.id || '',
      teacherId: 'Pr. Birahim Diop',
      room: 'Amphi Cheikh Anta Diop',
      dayOfWeek: getDayOfWeekFr(dateVal),
      startTime: '08:30',
      endTime: '11:30',
      sessionType: 'examen_final',
      date: dateVal,
      supervisor: 'Dr. Aminata Ndiaye',
      notes: 'Contrôle des identités requis avant entrée.',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (slot: TimetableSlot) => {
    setFormError(null);
    setSelectedEvent(slot);
    setFormData({
      id: slot.id,
      programId: slot.programId,
      moduleId: slot.moduleId,
      teacherId: slot.teacherId || '',
      room: slot.room,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionType: slot.sessionType || 'cours',
      date: slot.date || new Date().toISOString().split('T')[0],
      supervisor: slot.supervisor || '',
      notes: slot.notes || '',
    });
    setIsDetailOpen(false);
    setIsModalOpen(true);
  };

  // View Details
  const handleViewDetails = (slot: TimetableSlot) => {
    setSelectedEvent(slot);
    setIsDetailOpen(true);
  };

  // Save Slot
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.programId || !formData.moduleId || !formData.room) {
      setFormError('Veuillez renseigner le programme, le module et la salle.');
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setFormError('L heure de début doit être antérieure à l heure de fin.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await saveTimetableSlot(formData);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Slot
  const handleDeleteSlot = async (slotId: string) => {
    if (window.confirm('Confirmez-vous la suppression de cette session / examen du planning ?')) {
      try {
        await deleteTimetableSlot(slotId);
        setIsDetailOpen(false);
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Type', 'Date / Jour', 'Heures', 'Programme', 'Module', 'Salle', 'Enseignant / Surveillant', 'Notes'];
    const rows = filteredSlots.map((s) => {
      const prog = programs.find((p) => p.id === s.programId)?.title || s.programId;
      const mod = modules.find((m) => m.id === s.moduleId)?.moduleTitle || s.moduleId;
      const typeLabel = getSessionBadge(s.sessionType).label;
      const timing = `${s.startTime} - ${s.endTime}`;
      const dateDisplay = s.date ? `${s.date} (${s.dayOfWeek})` : `Hebdomadaire (${s.dayOfWeek})`;

      return [
        `"${typeLabel}"`,
        `"${dateDisplay}"`,
        `"${timing}"`,
        `"${prog.replace(/"/g, '""')}"`,
        `"${mod.replace(/"/g, '""')}"`,
        `"${s.room}"`,
        `"${(s.supervisor || s.teacherId || '').replace(/"/g, '""')}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `planning_examens_cours_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="pedagogy-calendar-view" className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Calendar className="w-4 h-4" />
            <span>Planification Académique & Évaluations</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Calendrier Interactif des Examens & Sessions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organisation des épreuves semestrielles, contrôles continus LMD et sessions de cours magistraux / TD.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exporter planning CSV
          </button>

          {canManage && (
            <button
              id="btn-plan-session"
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <CalendarPlus className="w-4 h-4" />
              Planifier un examen / cours
            </button>
          )}
        </div>
      </div>

      {/* Offline Status & Local Cache Banner */}
      {!isOnline ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-200/70 flex items-center justify-center text-amber-800 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Consultation Hors-Ligne des Emplois du Temps Active :</span>{' '}
              <span>L'intégralité du planning académique ({filteredSlots.length} créneaux d'examens et cours) est conservée en mémoire locale via le Service Worker.</span>
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
            <span>Service Worker actif : Emplois du temps ({timetables.length} créneaux) enregistrés pour consultation hors-ligne.</span>
          </div>
          <span className="text-emerald-700 font-semibold flex items-center space-x-1">
            <HardDrive className="w-3 h-3" />
            <span>Disponible Hors-Ligne</span>
          </span>
        </div>
      )}

      {/* KPI Overview Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Séances au Planning</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div>
            <span className="text-xs text-rose-700 font-semibold">Examens & Épreuves LMD</span>
            <div className="text-2xl font-bold text-rose-700 mt-1">{stats.exams}</div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-xs flex items-center justify-between bg-emerald-50/20">
          <div>
            <span className="text-xs text-emerald-700 font-semibold">Cours Magistraux & TD/TP</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.courses}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Navigation Month Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-xs p-0.5">
              <button
                onClick={handlePrevMonth}
                title="Mois précédent"
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3.5 py-1 text-sm font-bold text-slate-900 capitalize min-w-[150px] text-center">
                {monthName}
              </span>
              <button
                onClick={handleNextMonth}
                title="Mois suivant"
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Aujourd hui
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Module, salle, prof..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Program Filter */}
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Toutes les filières</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.yearLevel})
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">Tous les types</option>
              <option value="examen_final">Examens Finaux</option>
              <option value="examen_partiel">Contrôles / Partiels</option>
              <option value="rattrapage">Rattrapages</option>
              <option value="cours">Cours Magistraux</option>
              <option value="td_tp">TD / TP</option>
            </select>

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Mois
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === 'agenda' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Liste Agenda
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MONTH VIEW CALENDAR GRID */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-3">
            <div>Lundi</div>
            <div>Mardi</div>
            <div>Mercredi</div>
            <div>Jeudi</div>
            <div>Vendredi</div>
            <div>Samedi</div>
            <div className="text-slate-400">Dimanche</div>
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {daysInMonth.map((dayObj, idx) => {
              const slots = getSlotsForDate(dayObj.dateStr);
              const isToday =
                new Date().toISOString().split('T')[0] === dayObj.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => canManage && handleOpenAddModal(dayObj.dateStr)}
                  className={`min-h-[115px] p-2 flex flex-col transition-colors group relative ${
                    !dayObj.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : isToday
                      ? 'bg-emerald-50/20'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday
                          ? 'bg-emerald-600 text-white font-bold'
                          : dayObj.isCurrentMonth
                          ? 'text-slate-700'
                          : 'text-slate-300'
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </span>

                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddModal(dayObj.dateStr);
                        }}
                        title="Ajouter une séance ce jour"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-700 rounded transition-opacity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Slot Badges */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {slots.map((slot) => {
                      const mod = modules.find((m) => m.id === slot.moduleId);
                      const badgeInfo = getSessionBadge(slot.sessionType);
                      return (
                        <div
                          key={slot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(slot);
                          }}
                          className={`p-1.5 rounded-md border text-[11px] font-medium leading-tight cursor-pointer transition-all shadow-2xs ${badgeInfo.bg}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badgeInfo.dot}`} />
                            <span className="truncate font-semibold">{mod?.moduleTitle || 'Session'}</span>
                          </div>
                          <div className="text-[10px] opacity-85 mt-0.5 flex items-center justify-between">
                            <span>{slot.startTime}</span>
                            <span className="truncate max-w-[65px] font-mono">{slot.room}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA VIEW LIST */}
      {viewMode === 'agenda' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800 flex items-center justify-between">
            <span>Planning chronologique détaillé</span>
            <span className="text-xs text-slate-500 font-normal">{filteredSlots.length} créneaux programmés</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredSlots.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Aucune session ni examen ne correspond aux critères de filtre.
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const mod = modules.find((m) => m.id === slot.moduleId);
                const prog = programs.find((p) => p.id === slot.programId);
                const badgeInfo = getSessionBadge(slot.sessionType);

                return (
                  <div
                    key={slot.id}
                    onClick={() => handleViewDetails(slot)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${badgeInfo.bg}`}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.bg}`}>
                            {badgeInfo.label}
                          </span>
                          <span className="font-semibold text-slate-900 text-sm">{mod?.moduleTitle}</span>
                          <span className="text-xs font-mono text-slate-400">({mod?.moduleCode})</span>
                        </div>

                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span className="font-medium text-slate-700">{prog?.title}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {slot.room}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {slot.supervisor || slot.teacherId || 'Enseignant responsable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-800">
                          {slot.date ? `${slot.date}` : `Chaque ${slot.dayOfWeek}`}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {slot.startTime} - {slot.endTime}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(slot);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlot(slot.id);
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getSessionBadge(selectedEvent.sessionType).bg}`}>
                  {getSessionBadge(selectedEvent.sessionType).label}
                </span>
                <span className="font-mono text-xs text-slate-400">ID: {selectedEvent.id}</span>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {modules.find((m) => m.id === selectedEvent.moduleId)?.moduleTitle || 'Séance'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {programs.find((p) => p.id === selectedEvent.programId)?.title}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200/70">
              <div className="flex justify-between">
                <span className="text-slate-500">Date / Fréquence :</span>
                <span className="font-semibold text-slate-800">
                  {selectedEvent.date ? `${selectedEvent.date} (${selectedEvent.dayOfWeek})` : `Chaque ${selectedEvent.dayOfWeek}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Créneau horaire :</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedEvent.startTime} - {selectedEvent.endTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Salle / Amphi :</span>
                <span className="font-semibold text-emerald-800">{selectedEvent.room}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Enseignant / Surveillant :</span>
                <span className="font-semibold text-slate-800">
                  {selectedEvent.supervisor || selectedEvent.teacherId || 'Non assigné'}
                </span>
              </div>
              {selectedEvent.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Consignes d examen / Notes :</span>
                  <span className="text-slate-700 italic">{selectedEvent.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {canManage ? (
                <button
                  onClick={() => handleDeleteSlot(selectedEvent.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    onClick={() => handleOpenEditModal(selectedEvent)}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                )}
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {formData.id ? 'Modifier la séance / examen' : 'Planifier un examen ou une session'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type de séance *</label>
                  <select
                    value={formData.sessionType}
                    onChange={(e) => setFormData({ ...formData, sessionType: e.target.value as any })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="examen_final">Examen Final Semestriel</option>
                    <option value="examen_partiel">Contrôle Continu / Partiel</option>
                    <option value="rattrapage">Session de Rattrapage</option>
                    <option value="cours">Cours Magistral</option>
                    <option value="td_tp">Travaux Dirigés / TP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Programme / Filière *</label>
                  <select
                    value={formData.programId}
                    onChange={(e) => {
                      const newProgId = e.target.value;
                      const pMods = modules.filter((m) => m.programId === newProgId);
                      setFormData({
                        ...formData,
                        programId: newProgId,
                        moduleId: pMods[0]?.id || modules[0]?.id || '',
                      });
                    }}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Module / Matière *</label>
                <select
                  value={formData.moduleId}
                  onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                >
                  {modules
                    .filter((m) => !formData.programId || m.programId === formData.programId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.moduleCode}] {m.moduleTitle}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date spécifique (Examens)</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        date: val,
                        dayOfWeek: getDayOfWeekFr(val),
                      });
                    }}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jour de la semaine</label>
                  <select
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value as any })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Lundi">Lundi</option>
                    <option value="Mardi">Mardi</option>
                    <option value="Mercredi">Mercredi</option>
                    <option value="Jeudi">Jeudi</option>
                    <option value="Vendredi">Vendredi</option>
                    <option value="Samedi">Samedi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Début *</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fin *</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Salle *</label>
                  <input
                    type="text"
                    required
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="Amphi A"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Enseignant responsable</label>
                  <input
                    type="text"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    placeholder="Ex: Pr. Birahim Diop"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Surveillant d examen</label>
                  <input
                    type="text"
                    value={formData.supervisor}
                    onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                    placeholder="Ex: Dr. Aminata Ndiaye"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Consignes particulières & Matériel</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Calculatrice autorisée, carte obligatoire..."
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                >
                  {isSaving ? 'Enregistrement...' : formData.id ? 'Mettre à jour' : 'Enregistrer au planning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
