import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  Filter,
  GraduationCap,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { GradeItem, StudentAdmission } from '../../types';

export const GradesView: React.FC = () => {
  const { grades, students, modules, programs, saveGrade, validateGrade } = useApp();
  const { activeRole, currentUser } = useAuth();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [isNewGradeModalOpen, setIsNewGradeModalOpen] = useState(false);

  // New Grade Form
  const [targetStudentId, setTargetStudentId] = useState(students[0]?.id || '');
  const [targetModuleId, setTargetModuleId] = useState(modules[0]?.id || '');
  const [ccNote, setCcNote] = useState<number>(14.0);
  const [examNote, setExamNote] = useState<number>(15.0);

  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const studentGrades = grades.filter((g) => g.studentId === selectedStudentId);

  // Helper to get module info for a grade
  const getModuleForGrade = (moduleId: string) => {
    return (
      modules.find((m) => m.id === moduleId) || {
        moduleCode: 'MOD-GEN',
        moduleTitle: 'Enseignement fondamental',
        credits: 4,
        coefficient: 2,
        hourlyVolume: 30,
      }
    );
  };

  // Calculate weighted average
  const publishedOrValidGrades = studentGrades.filter(
    (g) => g.status === 'publie' || g.status === 'valide'
  );

  const totalCoeff = publishedOrValidGrades.reduce(
    (sum, g) => sum + getModuleForGrade(g.moduleId).coefficient,
    0
  );
  const weightedSum = publishedOrValidGrades.reduce(
    (sum, g) => sum + g.finalNote * getModuleForGrade(g.moduleId).coefficient,
    0
  );
  const averageGrade = totalCoeff > 0 ? (weightedSum / totalCoeff).toFixed(2) : '0.00';
  const validatedCredits = publishedOrValidGrades
    .filter((g) => g.finalNote >= 10)
    .reduce((sum, g) => sum + getModuleForGrade(g.moduleId).credits, 0);

  const getMention = (avg: number) => {
    if (avg >= 16) return 'Très Bien';
    if (avg >= 14) return 'Bien';
    if (avg >= 12) return 'Assez Bien';
    if (avg >= 10) return 'Passable';
    return 'Ajourné';
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCalculated = Number((ccNote * 0.4 + examNote * 0.6).toFixed(2));
    try {
      await saveGrade({
        studentId: targetStudentId,
        moduleId: targetModuleId,
        academicYearId: 'year_2025_2026',
        continuousAssessmentNote: Number(ccNote),
        examNote: Number(examNote),
        finalNote: finalCalculated,
        status: 'brouillon',
      });
      setIsNewGradeModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Notes, Évaluations & Relevés LMD
          </h1>
          <p className="text-xs text-slate-500">
            Cycle de validation : Brouillon → Validé par commission → Publié aux étudiants
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {['admin', 'pedagogie', 'enseignant'].includes(activeRole) && (
            <button
              onClick={() => setIsNewGradeModalOpen(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Saisir une note</span>
            </button>
          )}
          <button
            onClick={() => setIsTranscriptModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Éditer Relevé Officiel LMD</span>
          </button>
        </div>
      </div>

      {/* Student selector & summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-700">Sélectionner l étudiant :</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-xs font-bold bg-white"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.matricule})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-500">Moyenne pondérée :</span>
            <span className="text-lg font-bold text-slate-900 bg-slate-100 px-3 py-0.5 rounded-lg">
              {averageGrade} / 20
            </span>
            <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800">
              {getMention(Number(averageGrade))}
            </span>
          </div>
        </div>

        {/* Grades Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Code & Matière</th>
                <th className="px-4 py-3 text-center">Coeff.</th>
                <th className="px-4 py-3 text-center">Crédits</th>
                <th className="px-4 py-3 text-right">Contrôle C.</th>
                <th className="px-4 py-3 text-right">Examen</th>
                <th className="px-4 py-3 text-right">Moyenne Finale</th>
                <th className="px-4 py-3 text-center">Statut Validation</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentGrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Aucune note saisie pour cet étudiant actuellement.
                  </td>
                </tr>
              ) : (
                studentGrades.map((g) => {
                  const mod = getModuleForGrade(g.moduleId);
                  return (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900">{mod.moduleCode}</span>
                        <div className="text-[11px] text-slate-500">{mod.moduleTitle}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{mod.coefficient}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{mod.credits}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">
                        {g.continuousAssessmentNote !== undefined ? g.continuousAssessmentNote.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">
                        {g.examNote !== undefined ? g.examNote.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm font-mono">
                        {g.finalNote.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            g.status === 'publie'
                              ? 'bg-emerald-100 text-emerald-800'
                              : g.status === 'valide'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {g.status === 'brouillon' && ['admin', 'pedagogie'].includes(activeRole) && (
                          <button
                            onClick={() => validateGrade(g.id, 'valide')}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold"
                          >
                            Valider
                          </button>
                        )}
                        {g.status === 'valide' && ['admin', 'pedagogie', 'dg'].includes(activeRole) && (
                          <button
                            onClick={() => validateGrade(g.id, 'publie')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
                          >
                            Publier
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICIAL TRANSCRIPT PRINT MODAL */}
      {isTranscriptModalOpen && currentStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Relevé de Notes Officiel LMD (République du Sénégal)</h2>
              <button onClick={() => setIsTranscriptModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-5 text-xs text-slate-800 font-sans">
              {/* Official Academic Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  RÉPUBLIQUE DU SÉNÉGAL
                </div>
                <div className="text-[11px] text-slate-500">Un Peuple - Un But - Une Foi</div>
                <div className="text-[11px] font-semibold text-slate-600 uppercase">
                  MINISTÈRE DE L ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L INNOVATION
                </div>
                <h3 className="text-base font-bold text-slate-900 pt-1">
                  INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT (ISMNM)
                </h3>
                <div className="text-[10px] text-slate-500">
                  Établissement Privé d Enseignement Supérieur Agréé • Arrêté Ministériel N° 004128/MESRI
                </div>
              </div>

              {/* Student identification */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Nom et Prénom de l Étudiant :</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {currentStudent.lastName.toUpperCase()} {currentStudent.firstName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Matricule National :</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">{currentStudent.matricule}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Date et Lieu de Naissance :</span>
                  <span className="font-medium text-slate-800">{currentStudent.birthDate} à {currentStudent.birthPlace}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Année Académique & Semestre :</span>
                  <span className="font-semibold text-slate-800">2025-2026 • Semestre 1</span>
                </div>
              </div>

              {/* Grade details */}
              <table className="min-w-full border border-slate-300 text-xs">
                <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                  <tr>
                    <th className="p-2 text-left border-r border-slate-300">Code & Intitulé UE</th>
                    <th className="p-2 text-center border-r border-slate-300">Crédits (CTS)</th>
                    <th className="p-2 text-center border-r border-slate-300">Coeff.</th>
                    <th className="p-2 text-right border-r border-slate-300">Note Finale / 20</th>
                    <th className="p-2 text-center">Décision UE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentGrades.map((g) => {
                    const mod = getModuleForGrade(g.moduleId);
                    return (
                      <tr key={g.id}>
                        <td className="p-2 border-r border-slate-200">
                          <span className="font-mono font-bold text-slate-900">{mod.moduleCode}</span> - {mod.moduleTitle}
                        </td>
                        <td className="p-2 text-center border-r border-slate-200 font-semibold">{mod.credits}</td>
                        <td className="p-2 text-center border-r border-slate-200">{mod.coefficient}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-bold text-slate-900">
                          {g.finalNote.toFixed(2)}
                        </td>
                        <td className="p-2 text-center uppercase text-[10px] font-bold">
                          {g.finalNote >= 10 ? (
                            <span className="text-emerald-700">Validé</span>
                          ) : (
                            <span className="text-rose-700">Rattrapage</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Deliberation Footer */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="text-slate-500 text-xs">Moyenne Générale Pondérée :</div>
                  <div className="text-2xl font-bold text-slate-900">{averageGrade} / 20</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-xs">Décision du Jury de Délibération :</div>
                  <div className="text-base font-bold text-emerald-800">
                    ADMIS • Mention {getMention(Number(averageGrade))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Crédits validés : {validatedCredits} CTS
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-between items-end text-xs">
                <div>
                  Fait à Dakar, le {new Date().toLocaleDateString('fr-FR')}<br />
                  <strong>Le Chef du Service Pédagogique</strong>
                </div>
                <div className="text-center">
                  <strong>Le Directeur Général</strong><br />
                  <span className="text-[10px] text-slate-400 block mt-8">[Signature et Sceau de l Établissement]</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs font-semibold flex items-center space-x-1.5 hover:bg-slate-100 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le relevé certifié</span>
              </button>
              <button
                onClick={() => setIsTranscriptModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW GRADE MODAL */}
      {isNewGradeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddGrade}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Saisie d Évaluation & Note</h2>
              <button type="button" onClick={() => setIsNewGradeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Étudiant :</label>
                <select
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.matricule})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Module / Matière :</label>
                <select
                  value={targetModuleId}
                  onChange={(e) => setTargetModuleId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.moduleCode} - {m.moduleTitle} (Coeff {m.coefficient}, {m.credits} CTS)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Contrôle Continu (40%) :</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="20"
                    required
                    value={ccNote}
                    onChange={(e) => setCcNote(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Examen Terminal (60%) :</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="20"
                    required
                    value={examNote}
                    onChange={(e) => setExamNote(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border text-slate-600">
                Moyenne calculée : <strong>{((ccNote * 0.4) + (examNote * 0.6)).toFixed(2)} / 20</strong>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsNewGradeModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Enregistrer la note (Brouillon)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
