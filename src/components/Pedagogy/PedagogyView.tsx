import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  GraduationCap,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/currency';
import { Program } from '../../types';
import { AttendanceAnalyticsCharts } from './AttendanceAnalyticsCharts';
import { PedagogyCalendarView } from './PedagogyCalendarView';

export const PedagogyView: React.FC = () => {
  const { programs, students, enrollments, modules, attendance, setActiveView } = useApp();
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(programs[0] || null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'programs' | 'calendar'>('analytics');

  return (
    <div className="space-y-6">
      {/* Header with Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Pédagogie, Formations & Assiduité des Étudiants
          </h1>
          <p className="text-xs text-slate-500">
            Suivi des présences par filière et période, conformité LMD (ANAQ-Sup / MESRI) et maquettes de formation
          </p>
        </div>

        {/* View Switcher: Graphiques d'Assiduité vs Maquettes LMD */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            id="tab-pedagogy-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'analytics'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Graphiques d Assiduité</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-bold">
              Analytique
            </span>
          </button>
          <button
            id="tab-pedagogy-programs"
            onClick={() => setActiveTab('programs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'programs'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
            <span>Filières & Maquettes LMD</span>
          </button>
          <button
            id="tab-pedagogy-calendar"
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>Planning & Examens</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-bold">
              Calendrier
            </span>
          </button>
        </div>
      </div>

      {/* Accreditation highlight banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
          <div>
            <span className="font-bold">Accréditations Ministère de l Enseignement Supérieur du Sénégal & ANAQ-Sup :</span>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Formations habilitées LMD avec obligation d assiduité minimale de 80% pour l admissibilité aux examens semestriels.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveView('attendance')}
          className="shrink-0 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-lg text-xs font-semibold transition-colors"
        >
          Accéder aux Émargements
        </button>
      </div>

      {/* TAB 1: Attendance Analytics Charts */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <AttendanceAnalyticsCharts />
        </div>
      )}

      {/* TAB 2: Programs & Curriculum */}
      {activeTab === 'programs' && (
        <div className="space-y-6">
          {/* Programs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((prog) => {
              const enrolledCount = enrollments.filter((e) => e.programId === prog.id).length;
              const isSelected = selectedProgram?.id === prog.id;

              // Quick attendance rate for this program
              const progAttendance = attendance.filter((a) => a.programId === prog.id || modules.find((m) => m.id === a.moduleId)?.programId === prog.id);
              let totalSlots = 0;
              let presentSlots = 0;
              progAttendance.forEach((r) => {
                r.attendees.forEach((a) => {
                  totalSlots++;
                  if (a.status === 'present' || a.status === 'retard') presentSlots++;
                });
              });
              const progRate = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : null;

              return (
                <div
                  key={prog.id}
                  onClick={() => setSelectedProgram(prog)}
                  className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-600 shadow-sm ring-2 ring-emerald-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {prog.degree} • {prog.yearLevel}
                    </span>
                    <div className="flex items-center space-x-2">
                      {progRate !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${progRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {progRate}% assiduité
                        </span>
                      )}
                      <span className="text-xs font-semibold text-emerald-700">
                        {enrolledCount} inscrit(s)
                      </span>
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 mt-2">{prog.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">{prog.domain}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Inscription :</span>
                      <span className="font-semibold text-slate-800">
                        {formatFCFA(prog.defaultFees.registrationFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scolarité annuelle :</span>
                      <span className="font-semibold text-slate-800">
                        {formatFCFA(prog.defaultFees.tuitionFee)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 text-slate-900 font-bold">
                      <span>Total Annuel :</span>
                      <span className="text-emerald-700">
                        {formatFCFA(prog.defaultFees.registrationFee + prog.defaultFees.tuitionFee)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                    Arrêté : {prog.accreditationRef}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Program Details with Modules / UE */}
          {selectedProgram && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Maquette Pédagogique Officielle LMD
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{selectedProgram.title}</h2>
                  <p className="text-xs text-slate-500">
                    Filière {selectedProgram.domain} • Semestres {selectedProgram.semesters.join(' & ')}
                  </p>
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                  <span className="text-xs text-slate-500 block">Agrément ANAQ-Sup :</span>
                  <span className="font-mono font-bold text-xs text-slate-800">
                    {selectedProgram.accreditationRef} (Valide : {selectedProgram.accreditationValidUntil})
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Unités d Enseignement (UE) & Éléments Constitutifs (EC)
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Code UE</th>
                        <th className="px-4 py-2.5 text-left">Intitulé de l Unité / Module</th>
                        <th className="px-4 py-2.5 text-center">Crédits (CTS)</th>
                        <th className="px-4 py-2.5 text-center">Coefficient</th>
                        <th className="px-4 py-2.5 text-center">Volume Horaire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modules.filter(m => m.programId === selectedProgram.id).map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono font-semibold text-emerald-800">{m.moduleCode}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{m.moduleTitle}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-700">{m.credits}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-700">{m.coefficient}</td>
                          <td className="px-4 py-2.5 text-center text-slate-600">{m.hourlyVolume}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Interactive Calendar for Exams & Sessions */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <PedagogyCalendarView />
        </div>
      )}
    </div>
  );
};
