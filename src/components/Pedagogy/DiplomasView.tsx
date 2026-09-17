import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  History,
  Layers,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { generateDiplomaPdf, generateQrDataUrl } from '../../services/diplomaPdfGenerator';
import { CertificateMention, CertificateType, DiplomaCertificate, StudentAdmission } from '../../types';

export const DiplomasView: React.FC = () => {
  const { activeRole, currentUser } = useAuth();
  const {
    diplomas,
    students,
    programs,
    academicYears,
    config,
    saveDiploma,
    recordDiplomaPrint,
    revokeDiploma,
    deleteDiploma,
    batchGenerateDiplomas,
    verifyDiplomaRemote,
  } = useApp();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMention, setSelectedMention] = useState<string>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDiploma, setEditingDiploma] = useState<Partial<DiplomaCertificate> | null>(null);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDiploma, setPreviewDiploma] = useState<DiplomaCertificate | null>(null);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [diplomaToRevoke, setDiplomaToRevoke] = useState<DiplomaCertificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyDiploma, setHistoryDiploma] = useState<DiplomaCertificate | null>(null);

  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedSerial(text);
    showToast(`Numéro de série copié : ${text}`);
    setTimeout(() => setCopiedSerial(null), 2500);
  };

  // Filtered List
  const filteredDiplomas = useMemo(() => {
    return diplomas.filter((d) => {
      const student = students.find((s) => s.id === d.studentId);
      const studentName = student ? `${student.firstName} ${student.lastName}`.toLowerCase() : '';
      const matricule = student?.matricule.toLowerCase() || '';
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query ||
        d.serialNumber.toLowerCase().includes(query) ||
        d.securityToken.toLowerCase().includes(query) ||
        d.title.toLowerCase().includes(query) ||
        studentName.includes(query) ||
        matricule.includes(query);

      const matchesType = selectedType === 'all' || d.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || d.status === selectedStatus;
      const matchesMention = selectedMention === 'all' || d.mention === selectedMention;
      const matchesProgram = selectedProgramId === 'all' || d.programId === selectedProgramId;

      return matchesSearch && matchesType && matchesStatus && matchesMention && matchesProgram;
    });
  }, [diplomas, students, searchQuery, selectedType, selectedStatus, selectedMention, selectedProgramId]);

  // Statistics
  const stats = useMemo(() => {
    const totalIssued = diplomas.filter((d) => d.status !== 'revoque').length;
    const diplomasCount = diplomas.filter(
      (d) => (d.type === 'diplome_licence' || d.type === 'diplome_master') && d.status !== 'revoque'
    ).length;
    const attestationsCount = diplomas.filter(
      (d) => (d.type === 'attestation_reussite' || d.type === 'attestation_scolarite') && d.status !== 'revoque'
    ).length;
    const totalPrints = diplomas.reduce((acc, d) => acc + (d.printCount || 0), 0);
    const revokedCount = diplomas.filter((d) => d.status === 'revoque').length;

    return { totalIssued, diplomasCount, attestationsCount, totalPrints, revokedCount };
  }, [diplomas]);

  // Handle open preview
  const handleOpenPreview = (diploma: DiplomaCertificate) => {
    setPreviewDiploma(diploma);
    setIsPreviewModalOpen(true);
  };

  // Handle PDF Export
  const handleDownloadPdf = async (diploma: DiplomaCertificate) => {
    const student = students.find((s) => s.id === diploma.studentId);
    if (!student) {
      alert('Étudiant associé introuvable');
      return;
    }
    const program = programs.find((p) => p.id === diploma.programId);

    setIsGeneratingPdf(true);
    try {
      const pdf = await generateDiplomaPdf({
        diploma,
        student,
        program,
        config,
      });

      // Track print event in database
      await recordDiplomaPrint(diploma.id, 'Téléchargement PDF certifié');

      const prefix = diploma.type.includes('diplome') ? 'Diplome' : 'Attestation';
      const filename = `${prefix}_${student.lastName.toUpperCase()}_${diploma.serialNumber}.pdf`;
      pdf.save(filename);
      showToast(`PDF officiel généré avec succès : ${filename}`);
    } catch (err) {
      console.error('Erreur PDF', err);
      alert('Une erreur est survenue lors de la génération du document PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Check role permission
  const canManageDiplomas = ['admin', 'dg', 'pedagogie', 'scolarite'].includes(activeRole);

  return (
    <div id="diplomas-module-container" className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-amber-500/40 text-sm animate-bounce-short">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-amber-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Norme MESRI • République du Sénégal
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sérialisation Cryptographique Unique
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-serif">
              Délivrance, Suivi & Impression des Diplômes
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Registre officiel des parchemins de Licence, Master et attestations d’études avec attribution de numéro de
              série unique infalsifiable, code QR de vérification instantanée et traçabilité des duplicatas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsVerifyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-all shadow-sm hover:shadow"
            >
              <QrCode className="w-4 h-4" />
              <span>Vérificateur Anti-Fraude</span>
            </button>

            {canManageDiplomas && (
              <>
                <button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm hover:shadow"
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Génération par Promotion</span>
                </button>

                <button
                  onClick={() => {
                    setEditingDiploma(null);
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 transition-all shadow-lg hover:shadow-amber-500/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Délivrer un Document</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Parchemins & Diplômes</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{stats.diplomasCount}</span>
              <span className="text-xs text-slate-500">Licence / Master</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600 shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attestations Réussite</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{stats.attestationsCount}</span>
              <span className="text-xs text-slate-500">provisoires</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Impressions Certifiées</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{stats.totalPrints}</span>
              <span className="text-xs text-emerald-600 font-medium">avec registre</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Titres Actifs</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{stats.totalIssued}</span>
              {stats.revokedCount > 0 && (
                <span className="text-xs text-rose-600 font-medium">({stats.revokedCount} révoqués)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par n° de série (SN-...), étudiant, matricule, PV de délibération..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filtrer par type de document"
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tous types de documents</option>
              <option value="diplome_licence">Diplôme de Licence</option>
              <option value="diplome_master">Diplôme de Master</option>
              <option value="attestation_reussite">Attestation de Réussite</option>
              <option value="attestation_scolarite">Attestation de Scolarité</option>
              <option value="certificat_specialise">Certificat Spécialisé</option>
            </select>

            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              aria-label="Filtrer par filière académique"
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-[200px] truncate"
            >
              <option value="all">Toutes filières</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.title}
                </option>
              ))}
            </select>

            <select
              value={selectedMention}
              onChange={(e) => setSelectedMention(e.target.value)}
              aria-label="Filtrer par mention académique"
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Toutes mentions</option>
              <option value="Tres Bien">Très Bien</option>
              <option value="Bien">Bien</option>
              <option value="Assez Bien">Assez Bien</option>
              <option value="Passable">Passable</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filtrer par statut du document"
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tous statuts</option>
              <option value="delivre">Délivré (Officiel)</option>
              <option value="imprime">Imprimé</option>
              <option value="brouillon">Brouillon</option>
              <option value="revoque">Révoqué</option>
            </select>
          </div>
        </div>
      </div>

      {/* Diplomas & Certificates Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900 text-base">Registre Officiel des Titres & Parchemins</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {filteredDiplomas.length} document{filteredDiplomas.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Base de données synchronisée en temps réel
          </div>
        </div>

        {filteredDiplomas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">Aucun document ne correspond à votre recherche</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Modifiez vos critères de recherche ou délivrez un nouveau diplôme pour l’étudiant.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° de Série & Clé Sécurisée</th>
                  <th className="py-3 px-4">Étudiant Titulaire</th>
                  <th className="py-3 px-4">Type & Intitulé du Titre</th>
                  <th className="py-3 px-4">Délibération & Mention</th>
                  <th className="py-3 px-4">Statut & Impressions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDiplomas.map((d) => {
                  const student = students.find((s) => s.id === d.studentId);
                  const program = programs.find((p) => p.id === d.programId);
                  const isRevoked = d.status === 'revoque';

                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isRevoked ? 'bg-rose-50/30' : ''}`}
                    >
                      {/* Serial Number Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                              {d.serialNumber}
                            </span>
                            <button
                              onClick={() => copyToClipboard(d.serialNumber)}
                              title="Copier le numéro de série"
                              className="text-slate-400 hover:text-amber-600 transition-colors p-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                            <span className="text-amber-600 font-medium">Jeton:</span>
                            <span>{d.securityToken}</span>
                          </div>
                        </div>
                      </td>

                      {/* Student Details Column */}
                      <td className="py-3.5 px-4">
                        {student ? (
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-1.5">
                              <span>{student.firstName} {student.lastName.toUpperCase()}</span>
                              {student.gender === 'F' && (
                                <span className="text-[10px] text-rose-500 bg-rose-50 px-1 rounded">F</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono">{student.matricule}</span>
                              <span>•</span>
                              <span>Né(e) à {student.birthPlace || 'Dakar'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Étudiant non assigné</span>
                        )}
                      </td>

                      {/* Type & Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {d.type.includes('diplome') ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                                <Award className="w-3 h-3 text-amber-700" />
                                Diplôme Officiel
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-900 border border-sky-200">
                                <FileText className="w-3 h-3 text-sky-700" />
                                Attestation
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-1">{d.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {d.specialization || program?.title}
                          </p>
                        </div>
                      </td>

                      {/* Mention & Deliberation */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                d.mention === 'Tres Bien'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  : d.mention === 'Bien'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                  : d.mention === 'Assez Bien'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}
                            >
                              Mention {d.mention}
                            </span>
                            <span className="text-xs font-medium text-slate-700">
                              {d.finalAverage.toFixed(2)}/20
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            PV {d.deliberationPvNumber} ({d.deliberationDate})
                          </div>
                        </div>
                      </td>

                      {/* Status & Print History */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Révoqué / Annulé
                            </span>
                          ) : d.status === 'imprime' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Imprimé
                            </span>
                          ) : d.status === 'delivre' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              <FileCheck className="w-3 h-3" />
                              Délivré
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              Brouillon
                            </span>
                          )}

                          <div>
                            <button
                              onClick={() => {
                                setHistoryDiploma(d);
                                setIsHistoryModalOpen(true);
                              }}
                              className="text-[11px] text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 underline-offset-2 hover:underline"
                            >
                              <History className="w-3 h-3" />
                              <span>
                                {d.printCount === 0
                                  ? '0 tirage'
                                  : `${d.printCount} tirage${d.printCount > 1 ? 's' : ''}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPreview(d)}
                            title="Aperçu du parchemin officiel & Impression"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(d)}
                            disabled={isGeneratingPdf || isRevoked}
                            title="Télécharger le PDF Vectoriel officiel"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {canManageDiplomas && !isRevoked && (
                            <button
                              onClick={() => {
                                setEditingDiploma(d);
                                setIsEditModalOpen(true);
                              }}
                              title="Modifier les détails"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          )}

                          {canManageDiplomas && !isRevoked && (
                            <button
                              onClick={() => {
                                setDiplomaToRevoke(d);
                                setRevokeReason('');
                                setIsRevokeModalOpen(true);
                              }}
                              title="Révoquer / Annuler le diplôme"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          )}

                          {canManageDiplomas && activeRole === 'admin' && (
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Voulez-vous supprimer définitivement la fiche du document ${d.serialNumber} ?`
                                  )
                                ) {
                                  await deleteDiploma(d.id);
                                  showToast('Fiche du diplôme supprimée');
                                }
                              }}
                              title="Supprimer la fiche (Admin)"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: INTERACTIVE PARCHMENT PREVIEW & OFFICIAL PRINT DIALOG */}
      {isPreviewModalOpen && previewDiploma && (
        <ParchmentPreviewModal
          diploma={previewDiploma}
          students={students}
          programs={programs}
          config={config}
          onClose={() => setIsPreviewModalOpen(false)}
          onDownloadPdf={handleDownloadPdf}
          onRecordPrint={async (reason) => {
            const updated = await recordDiplomaPrint(previewDiploma.id, reason);
            setPreviewDiploma(updated);
            showToast('Impression enregistrée dans le registre officiel.');
          }}
        />
      )}

      {/* MODAL 2: ISSUE / EDIT DIPLOMA */}
      {isEditModalOpen && (
        <DiplomaFormModal
          editingDiploma={editingDiploma}
          students={students}
          programs={programs}
          academicYears={academicYears}
          existingDiplomas={diplomas}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingDiploma(null);
          }}
          onSave={async (data) => {
            await saveDiploma(data);
            setIsEditModalOpen(false);
            setEditingDiploma(null);
            showToast(`Document officiel ${data.serialNumber || ''} enregistré avec succès`);
          }}
        />
      )}

      {/* MODAL 3: BATCH GENERATION BY PROMOTION */}
      {isBatchModalOpen && (
        <BatchGenerationModal
          programs={programs}
          students={students}
          existingDiplomas={diplomas}
          onClose={() => setIsBatchModalOpen(false)}
          onGenerate={async (data) => {
            const results = await batchGenerateDiplomas(data);
            setIsBatchModalOpen(false);
            showToast(`${results.length} document(s) officiel(s) généré(s) pour la promotion.`);
          }}
        />
      )}

      {/* MODAL 4: ANTI-FRAUD VERIFICATION CHECKER */}
      {isVerifyModalOpen && (
        <AntiFraudVerifyModal
          onClose={() => setIsVerifyModalOpen(false)}
          onVerify={verifyDiplomaRemote}
          diplomas={diplomas}
          students={students}
        />
      )}

      {/* MODAL 5: REVOCATION DIALOG */}
      {isRevokeModalOpen && diplomaToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Révocation Officielle de Titre</h3>
              <p className="text-xs text-slate-500 mt-1">
                La révocation invalide définitivement le numéro de série{' '}
                <span className="font-mono font-bold text-slate-800">{diplomaToRevoke.serialNumber}</span>. Tout scan QR
                ou contrôle affichera le titre comme nul.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Motif officiel obligatoire de révocation :</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ex : Erreur de délibération, duplicata annulé pour remplacement, fraude aux conditions d'admission..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRevokeModalOpen(false);
                  setDiplomaToRevoke(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!revokeReason.trim()}
                onClick={async () => {
                  await revokeDiploma(diplomaToRevoke.id, revokeReason.trim());
                  setIsRevokeModalOpen(false);
                  setDiplomaToRevoke(null);
                  showToast(`Document ${diplomaToRevoke.serialNumber} officiellement révoqué.`);
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                Confirmer la Révocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PRINT HISTORY VIEWER */}
      {isHistoryModalOpen && historyDiploma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Historique des Impressions & Duplicatas</h3>
                <p className="text-xs text-slate-500 font-mono">N° de série : {historyDiploma.serialNumber}</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyDiploma.printHistory.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                Aucune impression officielle n’a encore été consignée pour ce document.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historyDiploma.printHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                          Exemplaire #{item.copyNumber}
                        </span>
                        <span className="font-medium text-slate-800">{item.reason || 'Impression certifiée'}</span>
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Imprimé par <strong className="text-slate-700">{item.printedBy}</strong> le {item.printedAt}
                      </p>
                    </div>
                    <Printer className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   SUB-COMPONENT: PARCHMENT PREVIEW & HIGH-RESOLUTION PRINT DIALOG
   ========================================================================= */
interface ParchmentPreviewModalProps {
  diploma: DiplomaCertificate;
  students: StudentAdmission[];
  programs: any[];
  config: any;
  onClose: () => void;
  onDownloadPdf: (diploma: DiplomaCertificate) => void;
  onRecordPrint: (reason?: string) => Promise<void>;
}

const ParchmentPreviewModal: React.FC<ParchmentPreviewModalProps> = ({
  diploma,
  students,
  programs,
  config,
  onClose,
  onDownloadPdf,
  onRecordPrint,
}) => {
  const student = students.find((s) => s.id === diploma.studentId);
  const program = programs.find((p) => p.id === diploma.programId);
  const [qrSvgUrl, setQrSvgUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printReason, setPrintReason] = useState(
    diploma.printCount === 0 ? 'Impression originale' : `Duplicata certifié n°${diploma.printCount + 1}`
  );

  React.useEffect(() => {
    generateQrDataUrl(
      diploma.qrVerificationData ||
        `https://ismnm-dakar.sn/verify?sn=${diploma.serialNumber}&token=${diploma.securityToken}`
    ).then((url) => setQrSvgUrl(url));
  }, [diploma]);

  const handleBrowserPrint = async () => {
    setIsPrinting(true);
    try {
      await onRecordPrint(printReason);
      window.print();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPrinting(false);
    }
  };

  const isLandscape =
    diploma.type === 'diplome_licence' ||
    diploma.type === 'diplome_master' ||
    diploma.type === 'certificat_specialise';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl max-w-6xl w-full p-4 md:p-6 shadow-2xl border border-amber-500/30 flex flex-col max-h-[96vh]">
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-base">Aperçu du Document Officiel & Impression</h3>
                <span className="font-mono text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                  {diploma.serialNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Format d’édition : {isLandscape ? 'Parchemin A4 Paysage (Diplôme)' : 'Attestation A4 Portrait (MESRI)'} • Tirage actuel : {diploma.printCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onDownloadPdf(diploma)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Exporter PDF</span>
            </button>

            <button
              onClick={handleBrowserPrint}
              disabled={isPrinting || diploma.status === 'revoque'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 transition-all shadow-lg hover:shadow-amber-500/25"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer l'Exemplaire</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Parchment Preview Stage */}
        <div className="flex-1 overflow-y-auto my-4 py-4 flex justify-center bg-slate-950/50 rounded-xl p-3 border border-slate-800/80">
          {/* Printable Frame with CSS styling */}
          <div
            id="diploma-print-frame"
            className={`bg-[#fcfbf7] text-slate-900 shadow-2xl relative select-none border-[12px] border-double border-[#b45309] ${
              isLandscape
                ? 'w-full max-w-[950px] aspect-[1.414/1] p-8 md:p-12 flex flex-col justify-between'
                : 'w-full max-w-[650px] aspect-[1/1.414] p-8 md:p-12 flex flex-col justify-between'
            }`}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 0 40px rgba(180, 83, 9, 0.05)',
            }}
          >
            {/* Fine Inner Navy Frame */}
            <div className="absolute inset-2 border border-[#0f172a]/80 pointer-events-none" />

            {/* Corner Decorative Dots */}
            <div className="absolute top-3 left-3 w-3 h-3 rounded-full border border-amber-700 flex items-center justify-center">
              <div className="w-1 h-1 bg-amber-700 rounded-full" />
            </div>
            <div className="absolute top-3 right-3 w-3 h-3 rounded-full border border-amber-700 flex items-center justify-center">
              <div className="w-1 h-1 bg-amber-700 rounded-full" />
            </div>
            <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full border border-amber-700 flex items-center justify-center">
              <div className="w-1 h-1 bg-amber-700 rounded-full" />
            </div>
            <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full border border-amber-700 flex items-center justify-center">
              <div className="w-1 h-1 bg-amber-700 rounded-full" />
            </div>

            {/* Watermark in Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
              <div className="text-center font-serif">
                <Award className="w-96 h-96 mx-auto text-amber-900" />
                <p className="text-4xl font-bold uppercase tracking-widest">ISMNM DAKAR</p>
              </div>
            </div>

            {/* Top Header */}
            <div className="text-center space-y-1 relative z-10">
              <div className="flex justify-between items-start">
                <div className="w-20 text-left">
                  <div className="flex h-1.5 w-14 rounded-sm overflow-hidden mb-1">
                    <div className="w-1/3 bg-emerald-600" />
                    <div className="w-1/3 bg-yellow-400" />
                    <div className="w-1/3 bg-red-600" />
                  </div>
                  <p className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Sénégal</p>
                </div>

                <div className="flex-1 px-4">
                  <h4 className="font-serif font-bold text-xs tracking-widest uppercase text-[#0f172a]">
                    RÉPUBLIQUE DU SÉNÉGAL
                  </h4>
                  <p className="font-serif italic text-[9px] text-amber-800">Un Peuple — Un But — Une Foi</p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-tight">
                    MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L’INNOVATION
                  </p>
                </div>

                {/* Serial Badge */}
                <div className="w-40 text-right">
                  <div className="inline-block bg-white/90 border border-amber-700/60 rounded px-2 py-1 text-left shadow-sm">
                    <p className="text-[7.5px] font-bold text-amber-800 uppercase tracking-wider">
                      N° Série Officiel
                    </p>
                    <p className="font-mono text-[10px] font-bold text-[#0f172a] tracking-tight">
                      {diploma.serialNumber}
                    </p>
                    <p className="font-mono text-[7px] text-slate-500">Clé: {diploma.securityToken}</p>
                  </div>
                </div>
              </div>

              {/* Institution Identity */}
              <div className="pt-2">
                <h2 className="font-serif font-bold text-sm md:text-base text-[#0f172a] uppercase tracking-wide">
                  Institut Supérieur des Métiers du Numérique et du Management
                </h2>
                <p className="font-serif italic text-[10px] text-amber-800">
                  Établissement Privé d’Enseignement Supérieur Agréé • Dakar — République du Sénégal
                </p>
                <p className="text-[8.5px] text-slate-500">
                  Arrêté Ministériel MESRI N° {config.accreditationNumber || '004812/2021'} • Système LMD
                </p>
              </div>
            </div>

            {/* Title Banner */}
            <div className="my-2 relative z-10 text-center">
              <div className="inline-block bg-[#0f172a] text-amber-300 font-serif font-bold px-6 py-1.5 rounded border border-amber-500 text-sm md:text-lg tracking-wider uppercase shadow-md">
                {diploma.type === 'diplome_licence'
                  ? 'DIPLÔME DE LICENCE PROFESSIONNELLE'
                  : diploma.type === 'diplome_master'
                  ? 'DIPLÔME DE MASTER PROFESSIONNEL'
                  : diploma.type === 'attestation_reussite'
                  ? 'ATTESTATION PROVISOIRE DE RÉUSSITE'
                  : diploma.title.toUpperCase()}
              </div>
            </div>

            {/* Legal Text & Conferral */}
            <div className="text-center space-y-2 relative z-10 px-4">
              <p className="text-[9px] md:text-[10px] text-slate-700 leading-relaxed font-serif max-w-2xl mx-auto">
                Le Directeur Général et le Jury de délibération de l’ISMNM Dakar, vu la loi relative à l’enseignement
                supérieur et au système LMD, vu le procès-verbal de délibération en date du{' '}
                <strong>{diploma.deliberationDate}</strong> (Réf: {diploma.deliberationPvNumber}), constatant la
                validation intégrale des <strong>{diploma.totalCreditsEarned} crédits ECTS</strong> requis,
              </p>

              <p className="font-serif italic font-bold text-xs text-[#0f172a]">
                Confèrent le présent titre académique à :
              </p>

              {/* Student Recipient Highlight */}
              <div className="py-1">
                <p className="font-serif font-bold text-xl md:text-2xl text-amber-900 tracking-wide">
                  {student ? `${student.firstName.toUpperCase()} ${student.lastName.toUpperCase()}` : '—'}
                </p>
                <div className="w-48 h-0.5 bg-amber-600/50 mx-auto my-1" />
                <p className="text-[10px] text-slate-700">
                  Né(e) le {student?.birthDate || '—'} à {student?.birthPlace || 'Dakar'} • Nationalité :{' '}
                  {student?.nationality || 'Sénégalaise'}
                </p>
                <p className="text-[9px] text-slate-500 font-mono">
                  Matricule : {student?.matricule} • CNI/Passeport : {student?.cniPassport || 'Dossier vérifié'}
                </p>
              </div>

              {/* Specialization & Mention */}
              <div className="space-y-0.5">
                <p className="font-serif font-bold text-xs md:text-sm text-[#0f172a]">
                  Discipline : {diploma.specialization || program?.title}
                </p>
                <p className="text-xs font-bold text-emerald-800">
                  MENTION : {diploma.mention.toUpperCase()} • Moyenne Générale : {diploma.finalAverage.toFixed(2)}/20
                </p>
                <p className="text-[8px] italic text-slate-500 font-serif">
                  Pour en jouir avec les droits et prérogatives qui y sont attachés par les lois et règlements.
                </p>
              </div>

              <p className="text-[9px] text-slate-700 pt-1">
                Fait et délivré à Dakar, en République du Sénégal, le <strong>{diploma.deliveryDate}</strong>
              </p>
            </div>

            {/* Bottom Section: QR Code, Official Seal, Signatures */}
            <div className="grid grid-cols-3 items-end pt-3 relative z-10 border-t border-slate-200">
              {/* Left: QR Code Verification */}
              <div className="flex items-center gap-2">
                {qrSvgUrl && (
                  <img
                    src={qrSvgUrl}
                    alt="QR Code"
                    className="w-16 h-16 rounded border border-slate-300 p-0.5 bg-white"
                  />
                )}
                <div className="text-left space-y-0.5">
                  <p className="text-[8px] font-bold text-[#0f172a] uppercase">Vérification QR</p>
                  <p className="text-[7px] text-slate-500 leading-tight">
                    Scannez pour valider l'authenticité sur le serveur de l’établissement.
                  </p>
                  <p className="font-mono text-[7px] text-amber-700 font-semibold">{diploma.securityToken}</p>
                </div>
              </div>

              {/* Center: Official Golden Seal Stamp */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-amber-700 flex items-center justify-center p-1 text-center">
                  <div className="w-full h-full rounded-full border border-amber-600 flex flex-col items-center justify-center text-amber-900 bg-amber-50/50">
                    <p className="text-[6.5px] font-bold uppercase tracking-tighter">ISMNM DAKAR</p>
                    <p className="text-[5.5px] font-bold text-amber-700">SCEAU OFFICIEL</p>
                    <p className="text-[5px] text-slate-600">RÉP. DU SÉNÉGAL</p>
                    <p className="text-[6px] text-amber-600 font-bold">★ ★ ★</p>
                  </div>
                </div>
              </div>

              {/* Right: Signatures */}
              <div className="text-right space-y-1">
                <p className="text-[8px] font-bold uppercase text-[#0f172a]">Pour l'Établissement & le Jury</p>
                <div className="text-[7.5px] text-slate-600 space-y-0.5">
                  <p>
                    Le Président du Jury : <span className="font-semibold">{diploma.juryPresident}</span>
                  </p>
                  <p>
                    La Directrice Générale : <span className="font-semibold">{diploma.directorName}</span>
                  </p>
                </div>
                <p className="text-[7px] italic text-slate-400 pt-1">[Signatures certifiées & Enregistrement]</p>
              </div>
            </div>

            {/* Bottom Micro-text */}
            <div className="text-center text-[6.5px] text-slate-400 pt-2 border-t border-slate-200 mt-2">
              Toute altération ou fausse déclaration rend le présent parchemin caduc et expose son auteur à des sanctions
              pénales. Enregistré au registre national sous le numéro {diploma.serialNumber}.
            </div>
          </div>
        </div>

        {/* Modal Bottom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Motif d’impression consigné :</span>
            <input
              type="text"
              value={printReason}
              onChange={(e) => setPrintReason(e.target.value)}
              aria-label="Motif d’impression consigné"
              className="text-xs bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 w-64 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Fermer l'Aperçu
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SUB-COMPONENT: DIPLOMA ISSUANCE / EDIT FORM MODAL
   ========================================================================= */
interface DiplomaFormModalProps {
  editingDiploma: Partial<DiplomaCertificate> | null;
  students: StudentAdmission[];
  programs: any[];
  academicYears: any[];
  existingDiplomas: DiplomaCertificate[];
  onClose: () => void;
  onSave: (data: Partial<DiplomaCertificate>) => Promise<void>;
}

const DiplomaFormModal: React.FC<DiplomaFormModalProps> = ({
  editingDiploma,
  students,
  programs,
  academicYears,
  existingDiplomas,
  onClose,
  onSave,
}) => {
  const currentYearCode = academicYears.find((y) => y.isCurrent)?.code?.split('-')[0] || '2025';

  const [studentId, setStudentId] = useState(editingDiploma?.studentId || (students[0]?.id ?? ''));
  const [type, setType] = useState<CertificateType>(editingDiploma?.type || 'diplome_licence');
  const [programId, setProgramId] = useState(editingDiploma?.programId || (programs[0]?.id ?? ''));
  const [academicYearId, setAcademicYearId] = useState(editingDiploma?.academicYearId || 'year_2024_2025');

  // Auto-calculated serial candidate
  const initialSerial = useMemo(() => {
    if (editingDiploma?.serialNumber) return editingDiploma.serialNumber;
    let prefix = 'LIC';
    if (type === 'diplome_master') prefix = 'MAS';
    else if (type === 'attestation_reussite') prefix = 'ATT';
    else if (type === 'attestation_scolarite') prefix = 'SCO';

    let count = existingDiplomas.length + 1;
    let cand = `SN-ISMNM-${currentYearCode}-${prefix}-${String(count).padStart(4, '0')}`;
    while (existingDiplomas.some((d) => d.serialNumber === cand)) {
      count++;
      cand = `SN-ISMNM-${currentYearCode}-${prefix}-${String(count).padStart(4, '0')}`;
    }
    return cand;
  }, [editingDiploma, type, currentYearCode, existingDiplomas]);

  const [serialNumber, setSerialNumber] = useState(editingDiploma?.serialNumber || initialSerial);
  const [title, setTitle] = useState(
    editingDiploma?.title || 'Diplôme de Licence Professionnelle en Informatique'
  );
  const [specialization, setSpecialization] = useState(
    editingDiploma?.specialization || 'Génie Logiciel & Systèmes Répartis'
  );
  const [mention, setMention] = useState<CertificateMention>(editingDiploma?.mention || 'Bien');
  const [finalAverage, setFinalAverage] = useState(editingDiploma?.finalAverage || 14.5);
  const [totalCreditsEarned, setTotalCreditsEarned] = useState(
    editingDiploma?.totalCreditsEarned || (type === 'diplome_master' ? 120 : 180)
  );
  const [deliberationDate, setDeliberationDate] = useState(
    editingDiploma?.deliberationDate || new Date().toISOString().split('T')[0]
  );
  const [deliberationPvNumber, setDeliberationPvNumber] = useState(
    editingDiploma?.deliberationPvNumber || `PV-DELIB-${currentYearCode}/01`
  );
  const [deliveryDate, setDeliveryDate] = useState(
    editingDiploma?.deliveryDate || new Date().toISOString().split('T')[0]
  );
  const [juryPresident, setJuryPresident] = useState(
    editingDiploma?.juryPresident || 'Pr. Ousmane Abdoulaye Diop'
  );
  const [directorName, setDirectorName] = useState(
    editingDiploma?.directorName || 'Dr. Aïssatou Ndiaye Diouf'
  );
  const [registrarName, setRegistrarName] = useState(
    editingDiploma?.registrarName || 'Fatou Kiné Sow'
  );
  const [notes, setNotes] = useState(editingDiploma?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);

  // Validate serial uniqueness
  const handleSerialChange = (val: string) => {
    const formatted = val.trim().toUpperCase();
    setSerialNumber(formatted);
    const collision = existingDiplomas.some(
      (d) => d.id !== editingDiploma?.id && d.serialNumber.toUpperCase() === formatted
    );
    if (collision) {
      setSerialError(`Attention : Le numéro ${formatted} est déjà attribué.`);
    } else {
      setSerialError(null);
    }
  };

  // Auto-fill title and credits when program/type changes
  const handleProgramChange = (progId: string) => {
    setProgramId(progId);
    const p = programs.find((item) => item.id === progId);
    if (p) {
      setSpecialization(p.title);
      if (type === 'diplome_licence') {
        setTitle(`Diplôme de Licence Professionnelle en ${p.title}`);
        setTotalCreditsEarned(180);
      } else if (type === 'diplome_master') {
        setTitle(`Diplôme de Master Professionnel en ${p.title}`);
        setTotalCreditsEarned(120);
      } else if (type === 'attestation_reussite') {
        setTitle(`Attestation Provisoire de Réussite — ${p.title}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !serialNumber) {
      alert('Veuillez renseigner un étudiant et un numéro de série');
      return;
    }

    if (serialError) {
      alert('Veuillez corriger le numéro de série qui est déjà utilisé.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingDiploma?.id,
        studentId,
        type,
        programId,
        academicYearId,
        serialNumber: serialNumber.trim().toUpperCase(),
        title,
        specialization,
        mention,
        finalAverage: Number(finalAverage),
        totalCreditsEarned: Number(totalCreditsEarned),
        deliberationDate,
        deliberationPvNumber,
        deliveryDate,
        juryPresident,
        directorName,
        registrarName,
        notes,
      });
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {editingDiploma ? 'Modifier les données du diplôme' : 'Délivrance d’un Titre / Parchemin Officiel'}
              </h3>
              <p className="text-xs text-slate-500">
                Génération du numéro de série officiel certifié conforme au registre MESRI
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Student selection & autofill */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Étudiant Diplômé / Récipiendaire *</span>
              {selectedStudent && (
                <span className="text-[11px] font-mono text-amber-700 font-normal">
                  Matricule : {selectedStudent.matricule}
                </span>
              )}
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-amber-500"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName.toUpperCase()} ({s.matricule}) — Né(e) le {s.birthDate || '—'} à{' '}
                  {s.birthPlace || 'Dakar'}
                </option>
              ))}
            </select>
          </div>

          {/* Type & Program */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Type de Document *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CertificateType)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option value="diplome_licence">Diplôme de Licence Professionnelle</option>
                <option value="diplome_master">Diplôme de Master Professionnel</option>
                <option value="attestation_reussite">Attestation Provisoire de Réussite</option>
                <option value="attestation_scolarite">Attestation d'Inscription & Assiduité</option>
                <option value="certificat_specialise">Certificat Spécialisé</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Filière / Spécialité *</label>
              <select
                value={programId}
                onChange={(e) => handleProgramChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Serial Number & Security Key */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Numéro de Série Unique Officiel *</span>
              </label>
              <button
                type="button"
                onClick={() => setSerialNumber(initialSerial)}
                className="text-[10px] text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Régénérer automatique
              </button>
            </div>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => handleSerialChange(e.target.value)}
              placeholder="Ex: SN-ISMNM-2025-LIC-0042"
              className={`w-full p-2 bg-white border font-mono font-bold text-sm text-slate-900 rounded-lg focus:outline-none focus:ring-2 ${
                serialError ? 'border-rose-500 ring-rose-200' : 'border-amber-300 focus:ring-amber-500'
              }`}
              required
            />
            {serialError && <p className="text-[11px] text-rose-600 font-medium">{serialError}</p>}
            <p className="text-[10px] text-slate-500">
              Chaque diplôme possède un numéro strictement unique inscrit dans le grand livre des parchemins du MESRI.
            </p>
          </div>

          {/* Title & Specialization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Intitulé Officiel du Diplôme</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Mention de Spécialité</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Academic Deliberation */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Mention</label>
              <select
                value={mention}
                onChange={(e) => setMention(e.target.value as CertificateMention)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                <option value="Tres Bien">Très Bien (≥ 16)</option>
                <option value="Bien">Bien (≥ 14)</option>
                <option value="Assez Bien">Assez Bien (≥ 12)</option>
                <option value="Passable">Passable (≥ 10)</option>
                <option value="Félicitations du Jury">Félicitations du Jury</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Moyenne (/20)</label>
              <input
                type="number"
                step="0.01"
                min="10"
                max="20"
                value={finalAverage}
                onChange={(e) => setFinalAverage(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Crédits ECTS Validés</label>
              <input
                type="number"
                value={totalCreditsEarned}
                onChange={(e) => setTotalCreditsEarned(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          {/* Deliberation Dates & PV */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">N° Procès-Verbal Jury</label>
              <input
                type="text"
                value={deliberationPvNumber}
                onChange={(e) => setDeliberationPvNumber(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Date du PV de Délibération</label>
              <input
                type="date"
                value={deliberationDate}
                onChange={(e) => setDeliberationDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Date de Délivrance Officielle</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          {/* Signers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Président du Jury</label>
              <input
                type="text"
                value={juryPresident}
                onChange={(e) => setJuryPresident(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Directrice Générale</label>
              <input
                type="text"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Chef Scolarité / Registre</label>
              <input
                type="text"
                value={registrarName}
                onChange={(e) => setRegistrarName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!serialError}
              className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-md"
            >
              {isSubmitting ? 'Enregistrement...' : 'Valider & Enregistrer le Titre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   SUB-COMPONENT: BATCH GENERATION MODAL FOR AN ENTIRE PROMOTION
   ========================================================================= */
interface BatchGenerationModalProps {
  programs: any[];
  students: StudentAdmission[];
  existingDiplomas: DiplomaCertificate[];
  onClose: () => void;
  onGenerate: (data: {
    programId: string;
    type: string;
    deliberationDate: string;
    deliberationPvNumber: string;
    studentIds: string[];
  }) => Promise<void>;
}

const BatchGenerationModal: React.FC<BatchGenerationModalProps> = ({
  programs,
  students,
  existingDiplomas,
  onClose,
  onGenerate,
}) => {
  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [type, setType] = useState('diplome_licence');
  const [deliberationDate, setDeliberationDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliberationPvNumber, setDeliberationPvNumber] = useState('PV-DELIB-PROMOTION-2025');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(students.map((s) => s.id));
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]));
  };

  const selectAll = () => {
    setSelectedStudentIds(students.map((s) => s.id));
  };

  const deselectAll = () => {
    setSelectedStudentIds([]);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      alert('Veuillez sélectionner au moins un étudiant.');
      return;
    }

    setIsProcessing(true);
    try {
      await onGenerate({
        programId,
        type,
        deliberationDate,
        deliberationPvNumber,
        studentIds: selectedStudentIds,
      });
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la génération en lot');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Génération Groupée par Promotion</h3>
              <p className="text-xs text-slate-500">Attribution automatisée de numéros de série séquentiels uniques</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleBatchSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Filière / Promotion</label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="w-full p-2 bg-slate-50 border rounded-lg"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Type de Document</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 bg-slate-50 border rounded-lg"
              >
                <option value="diplome_licence">Diplôme de Licence</option>
                <option value="diplome_master">Diplôme de Master</option>
                <option value="attestation_reussite">Attestation de Réussite</option>
                <option value="attestation_scolarite">Attestation de Scolarité</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Date Délibération</label>
              <input
                type="date"
                value={deliberationDate}
                onChange={(e) => setDeliberationDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border rounded-lg"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Réf. Procès-Verbal Jury</label>
              <input
                type="text"
                value={deliberationPvNumber}
                onChange={(e) => setDeliberationPvNumber(e.target.value)}
                className="w-full p-2 bg-slate-50 border rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                Étudiants à diplômer ({selectedStudentIds.length} sélectionné(s))
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] text-sky-600 hover:underline font-medium"
                >
                  Tout cocher
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Tout décocher
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 divide-y divide-slate-100 bg-slate-50/50">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-slate-900">
                      {s.firstName} {s.lastName.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono ml-2">({s.matricule})</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isProcessing || selectedStudentIds.length === 0}
              className="px-5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-md"
            >
              {isProcessing ? 'Génération en cours...' : `Générer ${selectedStudentIds.length} Documents`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
   SUB-COMPONENT: ANTI-FRAUD PUBLIC VERIFICATION CHECKER
   ========================================================================= */
interface AntiFraudVerifyModalProps {
  onClose: () => void;
  onVerify: (query: string) => Promise<any>;
  diplomas: DiplomaCertificate[];
  students: StudentAdmission[];
}

const AntiFraudVerifyModal: React.FC<AntiFraudVerifyModalProps> = ({
  onClose,
  onVerify,
  diplomas,
  students,
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsVerifying(true);
    setHasSearched(true);
    try {
      const data = await onVerify(query.trim());
      setResult(data);
    } catch (err) {
      setResult({ success: false, isValid: false, message: 'Erreur réseau de vérification' });
    } finally {
      setIsVerifying(false);
    }
  };

  const sampleSerials = diplomas.slice(0, 3).map((d) => d.serialNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Portail de Vérification Anti-Fraude</h3>
              <p className="text-xs text-slate-500">Contrôle officiel de validité des diplômes & attestations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Saisissez le Numéro de Série ou le Jeton de Sécurité :
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex : SN-ISMNM-2025-LIC-0042 ou SEC-8A91..."
                className="flex-1 p-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                required
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="px-4 py-2.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm"
              >
                {isVerifying ? 'Vérification...' : 'Vérifier'}
              </button>
            </div>
          </div>

          {/* Quick sample chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Exemples rapides :</span>
            {sampleSerials.map((sn) => (
              <button
                type="button"
                key={sn}
                onClick={() => setQuery(sn)}
                className="text-[10px] font-mono bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 px-2 py-0.5 rounded border border-slate-200"
              >
                {sn}
              </button>
            ))}
          </div>
        </form>

        {/* Results Box */}
        {hasSearched && (
          <div className="pt-2">
            {result?.success && result.data ? (
              <div
                className={`p-4 rounded-xl border ${
                  result.isValid ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
                } space-y-2.5`}
              >
                <div className="flex items-center gap-2">
                  {result.isValid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-emerald-900 text-sm">
                        DOCUMENT AUTHENTIQUE & ENREGISTRÉ AU MESRI
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <span className="font-bold text-rose-900 text-sm">TITRE OFFICIELLEMENT RÉVOQUÉ / ANNULÉ</span>
                    </>
                  )}
                </div>

                <div className="text-xs space-y-1 text-slate-700 border-t pt-2">
                  <p>
                    <strong className="text-slate-900">Titulaire :</strong> {result.data.student?.firstName}{' '}
                    {result.data.student?.lastName?.toUpperCase()} (Matricule : {result.data.student?.matricule})
                  </p>
                  <p>
                    <strong className="text-slate-900">Titre :</strong> {result.data.title}
                  </p>
                  <p>
                    <strong className="text-slate-900">Mention :</strong> {result.data.mention} (Moyenne :{' '}
                    {result.data.finalAverage}/20)
                  </p>
                  <p>
                    <strong className="text-slate-900">Délibération :</strong> PV {result.data.deliberationPvNumber} du{' '}
                    {result.data.deliberationDate}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 pt-1">
                    N° de Série : {result.data.serialNumber} • Clé : {result.data.securityToken}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900">
                  <p className="font-bold">Numéro ou jeton inconnu</p>
                  <p className="text-rose-700 mt-0.5">
                    Aucun document académique valide ne correspond à cet identifiant dans la base d’authenticité de
                    l’ISMNM Dakar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
