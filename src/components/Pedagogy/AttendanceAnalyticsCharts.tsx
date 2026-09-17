import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Filter,
  GraduationCap,
  Info,
  Layers,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, Program, TeachingModule } from '../../types';

// Period filter definition
type PeriodFilterType = 'all' | 's1' | 's2' | '2025-10' | '2025-11' | '2025-12' | '2026-01' | '2026-02' | '2026-03';

interface ProgramAttendanceStats {
  programId: string;
  programCode: string;
  programTitle: string;
  degree: string;
  yearLevel: string;
  enrolledStudentsCount: number;
  sessionsCount: number;
  totalHours: number;
  totalAttendeeSlots: number;
  presentCount: number;
  retardCount: number;
  justifiedCount: number;
  unjustifiedCount: number;
  attendanceRate: number; // (present + retard) / total * 100
  strictPresentRate: number; // present / total * 100
  punctualityRate: number; // present / (present + retard) * 100
  unjustifiedRate: number; // unjustified / total * 100
  complianceStatus: 'excellent' | 'conforme' | 'vigilance' | 'alerte';
}

const STATUS_COLORS = {
  present: '#059669', // Emerald 600
  retard: '#d97706', // Amber 600
  absent_justifie: '#0284c7', // Sky 600
  absent_injustifie: '#e11d48', // Rose 600
};

const PROGRAM_LINE_COLORS: Record<string, string> = {
  prog_lic_info_l1: '#059669', // Emerald
  prog_lic_info_l3: '#2563eb', // Blue
  prog_mast_cca_m1: '#7c3aed', // Purple
  prog_lic_mgt_l1: '#d97706', // Amber
};

export const AttendanceAnalyticsCharts: React.FC = () => {
  const { attendance, programs, modules, enrollments, students, setActiveView } = useApp();

  // State filters
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilterType>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [activeChartTab, setActiveChartTab] = useState<'filiere' | 'evolution' | 'repartition' | 'modules' | 'table'>('filiere');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<AttendanceRecord | null>(null);

  // Filter attendance records by period
  const filteredAttendance = useMemo(() => {
    return attendance.filter((rec) => {
      // Filter by period
      const recDate = rec.date;
      if (selectedPeriod === 's1') {
        // Oct 2025 to Feb 2026
        if (recDate < '2025-10-01' || recDate > '2026-02-28') return false;
      } else if (selectedPeriod === 's2') {
        // March 2026 to July 2026
        if (recDate < '2026-03-01' || recDate > '2026-07-31') return false;
      } else if (selectedPeriod !== 'all') {
        // e.g. "2025-10"
        if (!recDate.startsWith(selectedPeriod)) return false;
      }

      // Filter by program if specific program selected
      if (selectedProgramId !== 'all') {
        const progId = rec.programId || modules.find((m) => m.id === rec.moduleId)?.programId;
        if (progId !== selectedProgramId) return false;
      }

      return true;
    });
  }, [attendance, selectedPeriod, selectedProgramId, modules]);

  // Comprehensive stats by Program
  const programStats: ProgramAttendanceStats[] = useMemo(() => {
    return programs.map((prog) => {
      const progRecords = attendance.filter((rec) => {
        // Filter by program
        const pId = rec.programId || modules.find((m) => m.id === rec.moduleId)?.programId;
        if (pId !== prog.id) return false;

        // Filter by period
        const recDate = rec.date;
        if (selectedPeriod === 's1') {
          if (recDate < '2025-10-01' || recDate > '2026-02-28') return false;
        } else if (selectedPeriod === 's2') {
          if (recDate < '2026-03-01' || recDate > '2026-07-31') return false;
        } else if (selectedPeriod !== 'all') {
          if (!recDate.startsWith(selectedPeriod)) return false;
        }
        return true;
      });

      const enrolledCount = enrollments.filter((e) => e.programId === prog.id).length;
      let totalSlots = 0;
      let presents = 0;
      let retards = 0;
      let justifie = 0;
      let injustifie = 0;
      let totalHours = 0;

      progRecords.forEach((r) => {
        totalHours += r.durationHours || 3;
        r.attendees.forEach((a) => {
          totalSlots++;
          if (a.status === 'present') presents++;
          else if (a.status === 'retard') retards++;
          else if (a.status === 'absent_justifie') justifie++;
          else if (a.status === 'absent_injustifie') injustifie++;
        });
      });

      const attendanceRate = totalSlots > 0 ? Math.round(((presents + retards) / totalSlots) * 1000) / 10 : 0;
      const strictPresentRate = totalSlots > 0 ? Math.round((presents / totalSlots) * 1000) / 10 : 0;
      const punctualityRate = presents + retards > 0 ? Math.round((presents / (presents + retards)) * 1000) / 10 : 100;
      const unjustifiedRate = totalSlots > 0 ? Math.round((injustifie / totalSlots) * 1000) / 10 : 0;

      let complianceStatus: 'excellent' | 'conforme' | 'vigilance' | 'alerte' = 'conforme';
      if (attendanceRate >= 92) complianceStatus = 'excellent';
      else if (attendanceRate >= 80) complianceStatus = 'conforme';
      else if (attendanceRate >= 70) complianceStatus = 'vigilance';
      else complianceStatus = 'alerte';

      return {
        programId: prog.id,
        programCode: prog.code,
        programTitle: prog.title,
        degree: prog.degree || prog.level,
        yearLevel: prog.yearLevel,
        enrolledStudentsCount: enrolledCount > 0 ? enrolledCount : 5,
        sessionsCount: progRecords.length,
        totalHours,
        totalAttendeeSlots: totalSlots,
        presentCount: presents,
        retardCount: retards,
        justifiedCount: justifie,
        unjustifiedCount: injustifie,
        attendanceRate,
        strictPresentRate,
        punctualityRate,
        unjustifiedRate,
        complianceStatus,
      };
    });
  }, [programs, attendance, modules, enrollments, selectedPeriod]);

  // Overall KPIs for the selected period & filters
  const overallKPIs = useMemo(() => {
    let totalSlots = 0;
    let presents = 0;
    let retards = 0;
    let justifie = 0;
    let injustifie = 0;
    let totalHours = 0;

    filteredAttendance.forEach((r) => {
      totalHours += r.durationHours || 3;
      r.attendees.forEach((a) => {
        totalSlots++;
        if (a.status === 'present') presents++;
        else if (a.status === 'retard') retards++;
        else if (a.status === 'absent_justifie') justifie++;
        else if (a.status === 'absent_injustifie') injustifie++;
      });
    });

    const globalRate = totalSlots > 0 ? Math.round(((presents + retards) / totalSlots) * 1000) / 10 : 0;
    const punctuality = presents + retards > 0 ? Math.round((presents / (presents + retards)) * 1000) / 10 : 100;
    const unexcusedRate = totalSlots > 0 ? Math.round((injustifie / totalSlots) * 1000) / 10 : 0;

    // Best program
    const sortedPrograms = [...programStats].sort((a, b) => b.attendanceRate - a.attendanceRate);
    const topProgram = sortedPrograms[0];

    return {
      sessionsCount: filteredAttendance.length,
      totalHours,
      totalAttendeeSlots: totalSlots,
      presents,
      retards,
      justifie,
      injustifie,
      globalRate,
      punctuality,
      unexcusedRate,
      topProgram,
    };
  }, [filteredAttendance, programStats]);

  // Data for BarChart: Taux de présence par filière
  const barChartData = useMemo(() => {
    return programStats.map((p) => ({
      name: p.programCode,
      fullName: p.programTitle,
      tauxPresence: p.attendanceRate,
      tauxStrict: p.strictPresentRate,
      tauxRetard: Math.round((100 - p.punctualityRate) * 10) / 10,
      injustifie: p.unjustifiedRate,
      sessions: p.sessionsCount,
      etudiants: p.enrolledStudentsCount,
    }));
  }, [programStats]);

  // Data for Line/Area Chart: Chronological monthly evolution
  const monthlyTrendData = useMemo(() => {
    const months = [
      { key: '2025-10', label: 'Octobre 2025' },
      { key: '2025-11', label: 'Novembre 2025' },
      { key: '2025-12', label: 'Décembre 2025' },
      { key: '2026-01', label: 'Janvier 2026' },
      { key: '2026-02', label: 'Février 2026' },
      { key: '2026-03', label: 'Mars 2026' },
    ];

    return months.map((m) => {
      const monthRecords = attendance.filter((r) => r.date.startsWith(m.key));
      
      // Global month rate
      let mTotal = 0;
      let mPresent = 0;
      monthRecords.forEach((r) => {
        r.attendees.forEach((a) => {
          mTotal++;
          if (a.status === 'present' || a.status === 'retard') mPresent++;
        });
      });
      const globalMonthRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 1000) / 10 : null;

      // Rate per program
      const result: Record<string, any> = {
        month: m.label,
        key: m.key,
        Global: globalMonthRate,
      };

      programs.forEach((prog) => {
        const progMonthRecords = monthRecords.filter((r) => {
          const pId = r.programId || modules.find((mod) => mod.id === r.moduleId)?.programId;
          return pId === prog.id;
        });

        let pTotal = 0;
        let pPresent = 0;
        progMonthRecords.forEach((r) => {
          r.attendees.forEach((a) => {
            pTotal++;
            if (a.status === 'present' || a.status === 'retard') pPresent++;
          });
        });

        result[prog.code] = pTotal > 0 ? Math.round((pPresent / pTotal) * 1000) / 10 : null;
      });

      return result;
    });
  }, [attendance, programs, modules]);

  // Data for Donut Chart: Status distribution
  const donutData = useMemo(() => {
    const total = overallKPIs.totalAttendeeSlots;
    if (total === 0) return [];

    return [
      {
        name: 'Présents à l heure',
        value: overallKPIs.presents,
        percentage: Math.round((overallKPIs.presents / total) * 1000) / 10,
        color: STATUS_COLORS.present,
      },
      {
        name: 'En retard',
        value: overallKPIs.retards,
        percentage: Math.round((overallKPIs.retards / total) * 1000) / 10,
        color: STATUS_COLORS.retard,
      },
      {
        name: 'Absences justifiées',
        value: overallKPIs.justifie,
        percentage: Math.round((overallKPIs.justifie / total) * 1000) / 10,
        color: STATUS_COLORS.absent_justifie,
      },
      {
        name: 'Absences non justifiées',
        value: overallKPIs.injustifie,
        percentage: Math.round((overallKPIs.injustifie / total) * 1000) / 10,
        color: STATUS_COLORS.absent_injustifie,
      },
    ];
  }, [overallKPIs]);

  // Data for Module-level attendance
  const moduleAttendanceData = useMemo(() => {
    const relevantModules = selectedProgramId === 'all'
      ? modules
      : modules.filter((m) => m.programId === selectedProgramId);

    return relevantModules.map((mod) => {
      const modRecords = filteredAttendance.filter((r) => r.moduleId === mod.id);
      let slots = 0;
      let presents = 0;
      let injustifie = 0;

      modRecords.forEach((r) => {
        r.attendees.forEach((a) => {
          slots++;
          if (a.status === 'present' || a.status === 'retard') presents++;
          if (a.status === 'absent_injustifie') injustifie++;
        });
      });

      const rate = slots > 0 ? Math.round((presents / slots) * 1000) / 10 : 0;
      const prog = programs.find((p) => p.id === mod.programId);

      return {
        moduleCode: mod.moduleCode,
        moduleTitle: mod.moduleTitle,
        programCode: prog?.code || 'LMD',
        sessions: modRecords.length,
        rate,
        hourlyVolume: mod.hourlyVolume,
        slots,
      };
    }).filter((m) => m.sessions > 0);
  }, [modules, selectedProgramId, filteredAttendance, programs]);

  return (
    <div id="pedagogy-attendance-analytics" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Taux de Présence & Assiduité des Étudiants</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Normes LMD / ANAQ-Sup
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Visualisation analytique multi-filières, suivi chronologique par période et seuil réglementaire d assiduité
              </p>
            </div>
          </div>
        </div>

        {/* Global action link */}
        <div className="flex items-center gap-2">
          <button
            id="btn-navigate-to-attendance"
            onClick={() => setActiveView('attendance')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fiches d Émargement & Registre</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Period & Program Selectors */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Période :</span>
            <select
              id="select-attendance-period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodFilterType)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
            >
              <option value="all">Année Universitaire Complète (2025-2026)</option>
              <option value="s1">Semestre 1 (Octobre 2025 - Février 2026)</option>
              <option value="s2">Semestre 2 (Mars 2026 - Juillet 2026)</option>
              <optgroup label="Par Mois">
                <option value="2025-10">Octobre 2025</option>
                <option value="2025-11">Novembre 2025</option>
                <option value="2025-12">Décembre 2025</option>
                <option value="2026-01">Janvier 2026</option>
                <option value="2026-02">Février 2026</option>
                <option value="2026-03">Mars 2026</option>
              </optgroup>
            </select>
          </div>

          {/* Program Filter */}
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Filière :</span>
            <select
              id="select-attendance-program"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
            >
              <option value="all">Toutes les filières (Vue comparée)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart View Switcher Tabs */}
        <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
          <button
            id="tab-chart-filiere"
            onClick={() => setActiveChartTab('filiere')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeChartTab === 'filiere'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Par Filière</span>
          </button>
          <button
            id="tab-chart-evolution"
            onClick={() => setActiveChartTab('evolution')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeChartTab === 'evolution'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Évolution Période</span>
          </button>
          <button
            id="tab-chart-repartition"
            onClick={() => setActiveChartTab('repartition')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeChartTab === 'repartition'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Distribution Statuts</span>
          </button>
          <button
            id="tab-chart-modules"
            onClick={() => setActiveChartTab('modules')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeChartTab === 'modules'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Par Module</span>
          </button>
          <button
            id="tab-chart-table"
            onClick={() => setActiveChartTab('table')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeChartTab === 'table'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tableau Synthèse</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Global Attendance Rate */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-emerald-100/40 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
            <span>Taux de Présence Global</span>
            <span className="p-1 bg-emerald-200/60 text-emerald-900 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-emerald-950">
              {overallKPIs.globalRate}%
            </span>
            <span className="text-[11px] font-bold text-emerald-700">
              {overallKPIs.globalRate >= 80 ? '≥ 80% LMD Conforme' : '< 80% Seuil critique'}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="w-full bg-emerald-200/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(overallKPIs.globalRate, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-emerald-800 flex justify-between">
            <span>{overallKPIs.presents + overallKPIs.retards} présences validées</span>
            <span>Sur {overallKPIs.totalAttendeeSlots} émargements</span>
          </div>
        </div>

        {/* KPI 2: Sessions & Volume */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
            <span>Séances Tenues</span>
            <span className="p-1 bg-slate-200 text-slate-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {overallKPIs.sessionsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              séances ({overallKPIs.totalHours} heures)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Émargements certifiés par enseignants</span>
          </div>
        </div>

        {/* KPI 3: Punctuality */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
            <span>Taux de Ponctualité</span>
            <span className="p-1 bg-amber-100 text-amber-800 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {overallKPIs.punctuality}%
            </span>
            <span className="text-[11px] font-semibold text-amber-700">
              {overallKPIs.retards} retard(s) noté(s)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Retards constatés ≤ 20 min</span>
          </div>
        </div>

        {/* KPI 4: Absenteeism & Best Performer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
            <span>Filière la Plus Assidue</span>
            <span className="p-1 bg-blue-100 text-blue-800 rounded-lg">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="truncate">
            <span className="text-base font-extrabold text-slate-900 block truncate">
              {overallKPIs.topProgram?.programCode} ({overallKPIs.topProgram?.attendanceRate}%)
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              {overallKPIs.topProgram?.programTitle}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Absences injustifiées globales : {overallKPIs.unexcusedRate}%</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Display Area */}
      <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white">
        {/* View 1: Bar Chart per Program */}
        {activeChartTab === 'filiere' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Comparatif du Taux de Présence par Filière</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Seuil Réglementaire LMD : 80%
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Calculé sur l ensemble des séances d émargement pour la période sélectionnée
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-600" />
                  <span>Présents & Retards tolérés</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
                  <span className="text-rose-700 font-semibold">Seuil Examens (80%)</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg border border-slate-800 space-y-1 max-w-xs">
                          <p className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-1">
                            {data.fullName}
                          </p>
                          <div className="flex justify-between text-emerald-400 font-bold pt-1">
                            <span>Taux de présence global :</span>
                            <span>{data.tauxPresence}%</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Présents ponctuels :</span>
                            <span>{data.tauxStrict}%</span>
                          </div>
                          <div className="flex justify-between text-amber-300">
                            <span>Retards :</span>
                            <span>{data.tauxRetard}%</span>
                          </div>
                          <div className="flex justify-between text-rose-400">
                            <span>Absences injustifiées :</span>
                            <span>{data.injustifie}%</span>
                          </div>
                          <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1 text-[10px]">
                            <span>Séances analysées :</span>
                            <span>{data.sessions} séances</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#e11d48"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Seuil LMD 80%',
                      position: 'insideTopRight',
                      fill: '#e11d48',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <Bar dataKey="tauxPresence" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {barChartData.map((entry, index) => {
                      const color =
                        entry.tauxPresence >= 85
                          ? '#059669' // Emerald
                          : entry.tauxPresence >= 80
                          ? '#10b981' // Light Emerald
                          : entry.tauxPresence >= 70
                          ? '#d97706' // Amber
                          : '#e11d48'; // Rose
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sub-grid with filière status cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              {programStats.map((p) => (
                <div
                  key={p.programId}
                  onClick={() => setSelectedProgramId(p.programId)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedProgramId === p.programId
                      ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-200'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800">{p.programCode}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.attendanceRate >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.attendanceRate}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{p.programTitle}</p>
                  <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                    <span>{p.sessionsCount} séances</span>
                    <span>{p.unjustifiedCount} abs. non justifiées</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View 2: Evolution over time (Monthly trend) */}
        {activeChartTab === 'evolution' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Dynamique Chronologique du Taux de Présence par Mois</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Évolution mois par mois pour suivre l assiduité avant et après les périodes d évaluation
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="w-3 h-0.5 bg-slate-900" />
                  <span>Moyenne Globale</span>
                </span>
                {programs.map((prog) => (
                  <span key={prog.id} className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-3 h-0.5"
                      style={{ backgroundColor: PROGRAM_LINE_COLORS[prog.id] || '#64748b' }}
                    />
                    <span>{prog.code}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[60, 100]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg border border-slate-800 space-y-1.5 max-w-xs">
                          <p className="font-bold text-slate-100 border-b border-slate-800 pb-1">
                            {label}
                          </p>
                          {payload.map((entry, idx) => (
                            <div
                              key={`tooltip-${idx}`}
                              className="flex justify-between items-center text-xs"
                            >
                              <span style={{ color: entry.color }} className="font-semibold">
                                {entry.name} :
                              </span>
                              <span className="font-mono font-bold">
                                {entry.value !== null ? `${entry.value}%` : 'N/A'}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#e11d48"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Seuil LMD 80%',
                      position: 'insideTopRight',
                      fill: '#e11d48',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Global"
                    name="Moyenne Établissement"
                    stroke="#0f172a"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0f172a' }}
                    activeDot={{ r: 6 }}
                  />
                  {programs.map((prog) => (
                    <Line
                      key={prog.id}
                      type="monotone"
                      dataKey={prog.code}
                      name={prog.code}
                      stroke={PROGRAM_LINE_COLORS[prog.id] || '#64748b'}
                      strokeWidth={1.75}
                      strokeDasharray="3 3"
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* View 3: Distribution Donut Chart */}
        {activeChartTab === 'repartition' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Distribution Globale des Statuts d Émargement
              </h3>
              <p className="text-xs text-slate-500">
                Répartition des présences, retards et absences (justifiées vs injustifiées) sur {overallKPIs.totalAttendeeSlots} pointages
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6 pt-2">
              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, item: any) => [
                        `${value} pointages (${item.payload.percentage}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {overallKPIs.globalRate}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Présence
                  </span>
                </div>
              </div>

              {/* Legend & Breakdown Details */}
              <div className="space-y-3">
                {donutData.map((item, idx) => (
                  <div
                    key={`legend-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {item.value} pointage(s)
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View 4: Attendance per Module */}
        {activeChartTab === 'modules' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Assiduité par Module d Enseignement & Unité Constitutive
                </h3>
                <p className="text-xs text-slate-500">
                  Identification des modules enregistrant une baisse de présence ou un absentéisme anormal
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                {moduleAttendanceData.length} module(s) actif(s)
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={moduleAttendanceData}
                  margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="moduleCode"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg max-w-xs space-y-1">
                          <p className="font-bold text-slate-100">{d.moduleTitle}</p>
                          <p className="text-slate-400 text-[11px]">{d.programCode} • {d.hourlyVolume}h volume</p>
                          <div className="flex justify-between pt-1 border-t border-slate-800 text-emerald-400 font-bold">
                            <span>Taux de présence :</span>
                            <span>{d.rate}%</span>
                          </div>
                          <div className="flex justify-between text-slate-300 text-[11px]">
                            <span>Séances tenues :</span>
                            <span>{d.sessions} séances</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine x={80} stroke="#e11d48" strokeDasharray="4 4" />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {moduleAttendanceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.rate >= 85 ? '#059669' : entry.rate >= 80 ? '#10b981' : '#d97706'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* View 5: Comprehensive Matrix Table */}
        {activeChartTab === 'table' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Registre d Assiduité & Bilan de Conformité Réglementaire
                </h3>
                <p className="text-xs text-slate-500">
                  Synthèse officielle d assiduité pour le Conseil Pédagogique et la Commission de Délibération LMD
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Code & Filière</th>
                    <th className="px-3 py-2.5 text-center">Inscrits</th>
                    <th className="px-3 py-2.5 text-center">Séances</th>
                    <th className="px-3 py-2.5 text-center">Volume H.</th>
                    <th className="px-3 py-2.5 text-center">Présents</th>
                    <th className="px-3 py-2.5 text-center">Retards</th>
                    <th className="px-3 py-2.5 text-center text-rose-700">Abs. Injustifiées</th>
                    <th className="px-4 py-2.5 text-right">Taux Net</th>
                    <th className="px-4 py-2.5 text-center">Statut LMD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {programStats.map((p) => (
                    <tr key={p.programId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.programCode}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{p.programTitle}</div>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-slate-700">
                        {p.enrolledStudentsCount}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-slate-700">
                        {p.sessionsCount}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600">
                        {p.totalHours}h
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-emerald-700">
                        {p.presentCount}
                      </td>
                      <td className="px-3 py-3 text-center text-amber-700 font-medium">
                        {p.retardCount}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-rose-600">
                        {p.unjustifiedCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-extrabold text-slate-900">
                          {p.attendanceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.attendanceRate >= 90 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Excellente Assiduité
                          </span>
                        ) : p.attendanceRate >= 80 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Conforme LMD (≥80%)
                          </span>
                        ) : p.attendanceRate >= 70 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Vigilance (70-79%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Alerte Défaillance (&lt;70%)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Regulatory LMD Guidance Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-800">
              Règle Réglementaire d Assiduité LMD (Art. 18 Décret Enseignement Supérieur) :
            </span>
            <p className="text-slate-500 mt-0.5 text-[11px]">
              La présence aux travaux dirigés (TD), travaux pratiques (TP) et cours magistraux est obligatoire. Un taux de présence inférieur à 80% sans justification médicale agréée entraîne l inéligibilité aux sessions d examen normales.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveView('attendance')}
          className="shrink-0 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center space-x-1.5"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Émarger une séance</span>
        </button>
      </div>
    </div>
  );
};
