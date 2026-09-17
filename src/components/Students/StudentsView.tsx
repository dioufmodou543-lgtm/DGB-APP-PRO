import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
  Wifi,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { calculateBalanceDue, formatFCFA } from '../../services/currency';
import { StudentAdmission } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const StudentsView: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const {
    students,
    enrollments,
    invoices,
    programs,
    academicYears,
    createStudent,
    updateStudentStatus,
    createEnrollment,
    setActiveView,
  } = useApp();

  const { activeRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentAdmission | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  // New Student Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('2005-06-15');
  const [birthPlace, setBirthPlace] = useState('Dakar');
  const [cniPassport, setCniPassport] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+221 ');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('+221 ');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Dakar');

  // Enrollment Form State
  const [enrollProgramId, setEnrollProgramId] = useState(programs[0]?.id || '');
  const [enrollPlan, setEnrollPlan] = useState('mensuel');
  const [enrollDiscount, setEnrollDiscount] = useState(0);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      `${s.firstName} ${s.lastName} ${s.matricule} ${s.phone}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !cniPassport) {
      alert('Veuillez renseigner au minimum le prénom, nom et la pièce d identité.');
      return;
    }
    const newStu = await createStudent({
      firstName,
      lastName,
      gender,
      birthDate,
      birthPlace,
      cniPassport,
      email,
      phone,
      parentName,
      parentPhone,
      address,
      city,
      status: 'candidat',
    });
    setIsCreateModalOpen(false);
    setSelectedStudent(newStu);
    // Reset
    setFirstName('');
    setLastName('');
    setCniPassport('');
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const activeYear = academicYears.find((y) => y.isCurrent) || academicYears[0];
    await createEnrollment({
      studentId: selectedStudent.id,
      programId: enrollProgramId,
      academicYearId: activeYear.id,
      paymentPlan: enrollPlan,
      discountAmount: Number(enrollDiscount),
      discountType: enrollDiscount > 0 ? 'sociale' : 'none',
      discountReason: enrollDiscount > 0 ? 'Remise accordée par la commission' : undefined,
    });
    setIsEnrollModalOpen(false);
  };

  // Student financial stats
  const getStudentFinancials = (studentId: string) => {
    const studentInvoices = invoices.filter((i) => i.studentId === studentId);
    const totalGross = studentInvoices.reduce((s, i) => s + i.grossAmount, 0);
    const totalDiscount = studentInvoices.reduce((s, i) => s + i.discountShare, 0);
    const totalNet = studentInvoices.reduce((s, i) => s + i.netAmount, 0);
    const totalPaid = studentInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const balanceDue = studentInvoices.reduce((s, i) => s + i.balanceDue, 0);

    const today = new Date().toISOString().split('T')[0];
    const overdueCount = studentInvoices.filter(
      (i) => i.balanceDue > 0 && i.dueDate < today
    ).length;

    return { totalGross, totalDiscount, totalNet, totalPaid, balanceDue, overdueCount, studentInvoices };
  };

  const exportCSV = () => {
    const headers = 'Matricule,Prénom,Nom,Statut,Téléphone,Email,CNI,Ville\n';
    const rows = filteredStudents
      .map(
        (s) =>
          `"${s.matricule}","${s.firstName}","${s.lastName}","${s.status}","${s.phone}","${s.email}","${s.cniPassport}","${s.city}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etudiants_ismnm_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Admissions & Dossiers Étudiants
          </h1>
          <p className="text-xs text-slate-500">
            Gestion du cycle de vie étudiant : candidature, admission, inscription et situation financière
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportCSV}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter CSV</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Dossier</span>
          </button>
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
              <span className="font-bold">Consultation Hors-Ligne des Étudiants Active :</span>{' '}
              <span>Les {students.length} dossiers étudiants, admissions et parcours sont conservés et consultables en toute sécurité depuis le cache local Service Worker.</span>
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
            <span>Service Worker actif : Répertoire complet ({students.length} étudiants) mis en cache pour consultation immédiate hors-ligne.</span>
          </div>
          <span className="text-emerald-700 font-semibold flex items-center space-x-1">
            <HardDrive className="w-3 h-3" />
            <span>Données en Cache</span>
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, matricule, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Tous les statuts</option>
            <option value="candidat">Candidats</option>
            <option value="admis">Admis</option>
            <option value="inscrit">Inscrits</option>
            <option value="rejete">Rejetés</option>
          </select>
        </div>
      </div>

      {/* Main Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Nom & Prénom</th>
                <th className="px-4 py-3 text-left">Filière / Niveau</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Reste Dû</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((stu) => {
                const enrollment = enrollments.find((e) => e.studentId === stu.id);
                const prog = enrollment ? programs.find((p) => p.id === enrollment.programId) : null;
                const fin = getStudentFinancials(stu.id);

                return (
                  <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{stu.matricule}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {stu.firstName} {stu.lastName}
                      </div>
                      <div className="text-[11px] text-slate-500">{stu.birthPlace} • CNI: {stu.cniPassport}</div>
                    </td>
                    <td className="px-4 py-3">
                      {prog ? (
                        <div>
                          <span className="font-medium text-slate-800">{prog.title}</span>
                          <div className="text-[10px] text-slate-400">{prog.yearLevel} • {enrollment?.paymentPlan}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Non inscrit</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{stu.phone}</div>
                      <div className="text-[10px] text-slate-400">{stu.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          stu.status === 'inscrit'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : stu.status === 'admis'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : stu.status === 'candidat'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {stu.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-900">{formatFCFA(fin.balanceDue)}</div>
                      {fin.overdueCount > 0 && (
                        <div className="text-[10px] text-rose-600 font-semibold">
                          {fin.overdueCount} échéance(s) en retard
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudent(stu)}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Dossier</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* STUDENT DETAIL DRAWER / MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-emerald-400 font-semibold">{selectedStudent.matricule}</span>
                <h2 className="text-lg font-bold">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
              {/* Status Decision Controls */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">Statut du dossier :</span>
                  <span className="font-bold text-emerald-700 uppercase px-2 py-0.5 bg-emerald-100 rounded">
                    {selectedStudent.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveView('diplomas')}
                    className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg font-medium hover:bg-amber-100 flex items-center gap-1.5 transition-colors"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-700" />
                    <span>Diplôme & Attestation</span>
                  </button>
                  {selectedStudent.status === 'candidat' && (
                    <button
                      onClick={() => updateStudentStatus(selectedStudent.id, 'admis', 'Dossier validé par scolarité')}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                    >
                      Prononcer l admission
                    </button>
                  )}
                  {selectedStudent.status !== 'inscrit' && (
                    <button
                      onClick={() => setIsEnrollModalOpen(true)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                    >
                      Inscrire à une formation
                    </button>
                  )}
                </div>
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Date & Lieu de naissance</span>
                  <span className="font-medium text-slate-900">{selectedStudent.birthDate} à {selectedStudent.birthPlace}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">N° CNI / Passeport</span>
                  <span className="font-medium text-slate-900">{selectedStudent.cniPassport}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Téléphone</span>
                  <span className="font-medium text-slate-900">{selectedStudent.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email</span>
                  <span className="font-medium text-slate-900">{selectedStudent.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Parent / Tuteur</span>
                  <span className="font-medium text-slate-900">{selectedStudent.parentName || 'Non renseigné'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Adresse</span>
                  <span className="font-medium text-slate-900">{selectedStudent.address}, {selectedStudent.city}</span>
                </div>
              </div>

              {/* Situation Financière */}
              {(() => {
                const fin = getStudentFinancials(selectedStudent.id);
                return (
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center">
                      <Receipt className="w-4 h-4 mr-1.5 text-emerald-600" />
                      Situation Financière de l Étudiant (Section 3.D)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-slate-400 text-[10px]">Total Facturé</div>
                        <div className="font-bold text-slate-900 mt-1">{formatFCFA(fin.totalNet)}</div>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="text-emerald-700 text-[10px]">Total Réglé</div>
                        <div className="font-bold text-emerald-800 mt-1">{formatFCFA(fin.totalPaid)}</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="text-amber-800 text-[10px]">Reste Dû</div>
                        <div className="font-bold text-amber-900 mt-1">{formatFCFA(fin.balanceDue)}</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <div className="text-purple-800 text-[10px]">Remises Accordées</div>
                        <div className="font-bold text-purple-900 mt-1">{formatFCFA(fin.totalDiscount)}</div>
                      </div>
                    </div>

                    {/* Invoices breakdown */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-3 py-2 text-left">Facture</th>
                            <th className="px-3 py-2 text-left">Libellé</th>
                            <th className="px-3 py-2 text-left">Échéance</th>
                            <th className="px-3 py-2 text-right">Net</th>
                            <th className="px-3 py-2 text-right">Payé</th>
                            <th className="px-3 py-2 text-right">Reste</th>
                            <th className="px-3 py-2 text-center">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fin.studentInvoices.map((inv) => (
                            <tr key={inv.id}>
                              <td className="px-3 py-1.5 font-mono">{inv.invoiceNumber}</td>
                              <td className="px-3 py-1.5">{inv.title}</td>
                              <td className="px-3 py-1.5 text-slate-500">{inv.dueDate}</td>
                              <td className="px-3 py-1.5 text-right font-medium">{formatFCFA(inv.netAmount)}</td>
                              <td className="px-3 py-1.5 text-right text-emerald-600">{formatFCFA(inv.paidAmount)}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-amber-900">{formatFCFA(inv.balanceDue)}</td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  inv.status === 'solde' ? 'bg-emerald-100 text-emerald-800' : inv.status === 'partiel' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Attestation</span>
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STUDENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateStudent}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Nouveau Dossier Candidat / Étudiant</h2>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: Modou"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: Diouf"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Genre</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="M">Masculin (M)</option>
                    <option value="F">Féminin (F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date de naissance</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Lieu de naissance</label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ex: Thiès, Sénégal"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">N° CNI / Passeport</label>
                  <input
                    type="text"
                    required
                    value={cniPassport}
                    onChange={(e) => setCniPassport(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    placeholder="Ex: 1 278 2004 00192"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Enregistrer le dossier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ENROLL STUDENT MODAL */}
      {isEnrollModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleEnrollSubmit}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                Inscrire {selectedStudent.firstName} {selectedStudent.lastName}
              </h2>
              <button type="button" onClick={() => setIsEnrollModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Formation retenue :</label>
                <select
                  value={enrollProgramId}
                  onChange={(e) => setEnrollProgramId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({formatFCFA(p.defaultFees.tuitionFee + p.defaultFees.registrationFee)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Modalité de règlement :</label>
                <select
                  value={enrollPlan}
                  onChange={(e) => setEnrollPlan(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="mensuel">Mensuel (9 mensualités Octobre à Juin)</option>
                  <option value="trimestriel">Trimestriel (3 trimestres)</option>
                  <option value="tranches">Par tranches (50% rentrée / 50% mi-parcours)</option>
                  <option value="comptant">En une seule fois (Comptant à la rentrée)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Remise autorisée (FCFA) :</label>
                <input
                  type="number"
                  step="10000"
                  value={enrollDiscount}
                  onChange={(e) => setEnrollDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-slate-700 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirmer l inscription & Échéancier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
