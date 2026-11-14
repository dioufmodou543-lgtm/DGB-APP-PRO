import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  FileText,
  Hash,
  Layers,
  Lock,
  Save,
  Settings,
  ShieldCheck,
  DatabaseBackup,
  Download,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { academicYears, closeAcademicYear, config, updateConfig, downloadBackup, restoreBackup } = useApp();
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Identité légale : initialisée depuis la configuration réelle de l'établissement
  const [instName, setInstName] = useState(config.name);
  const [sigle, setSigle] = useState(config.acronym);
  const [ninea, setNinea] = useState(config.ninea);
  const [rc, setRc] = useState(config.rc);
  const [arrete, setArrete] = useState(config.accreditationNumber || '');
  const [address, setAddress] = useState(config.address);
  const [phone, setPhone] = useState(config.phone);
  const [email, setEmail] = useState(config.email);

  // Préfixes de numérotation (le serveur ajoute « -ANNÉE-NUMÉRO »)
  const [prefixStudent, setPrefixStudent] = useState(config.documentNumbering.matriculePrefix);
  const [prefixInvoice, setPrefixInvoice] = useState(config.documentNumbering.invoicePrefix);
  const [prefixReceipt, setPrefixReceipt] = useState(config.documentNumbering.receiptPrefix);
  const [prefixExpense, setPrefixExpense] = useState(config.documentNumbering.expensePrefix);

  // Resynchronisation si la configuration est rechargée depuis le serveur
  useEffect(() => {
    setInstName(config.name);
    setSigle(config.acronym);
    setNinea(config.ninea);
    setRc(config.rc);
    setArrete(config.accreditationNumber || '');
    setAddress(config.address);
    setPhone(config.phone);
    setEmail(config.email);
    setPrefixStudent(config.documentNumbering.matriculePrefix);
    setPrefixInvoice(config.documentNumbering.invoicePrefix);
    setPrefixReceipt(config.documentNumbering.receiptPrefix);
    setPrefixExpense(config.documentNumbering.expensePrefix);
  }, [config]);

  const cleanPrefix = (p: string) => p.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaveError(null);
    const prefixes = [prefixStudent, prefixInvoice, prefixReceipt, prefixExpense].map(cleanPrefix);
    if (!instName.trim() || !sigle.trim()) {
      setSaveError('La raison sociale et le sigle sont obligatoires.');
      return;
    }
    if (prefixes.some((p) => p.length < 2)) {
      setSaveError('Chaque préfixe de numérotation doit contenir au moins 2 caractères (lettres ou chiffres).');
      return;
    }
    if (new Set(prefixes).size !== prefixes.length) {
      setSaveError('Les préfixes de numérotation doivent être distincts.');
      return;
    }
    setIsSaving(true);
    try {
      await updateConfig({
        name: instName.trim(),
        acronym: sigle.trim(),
        ninea: ninea.trim(),
        rc: rc.trim(),
        accreditationNumber: arrete.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        documentNumbering: {
          matriculePrefix: prefixes[0],
          invoicePrefix: prefixes[1],
          receiptPrefix: prefixes[2],
          expensePrefix: prefixes[3],
        },
      });
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Erreur lors de l enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  // Sauvegarde & restauration
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      await downloadBackup();
      setBackupMessage({ type: 'ok', text: 'Sauvegarde téléchargée. Conservez-la hors de ce serveur (clé USB, cloud).' });
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'Sauvegarde impossible' });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestore = async (file: File | undefined) => {
    if (!file) return;
    const ok = window.confirm(
      `Restaurer la sauvegarde « ${file.name} » ?\n\nToutes les données actuelles seront remplacées. Téléchargez d abord une sauvegarde de l état actuel si nécessaire.`
    );
    if (!ok) return;
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const summary = await restoreBackup(file);
      setBackupMessage({
        type: 'ok',
        text: `Restauration réussie : ${summary.students} étudiants et ${summary.invoices} factures chargés.`,
      });
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'Restauration impossible' });
    } finally {
      setBackupBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCloseYear = async (yearId: string) => {
    const confirm = window.confirm(
      'ATTENTION : La clôture de l année académique est définitive et irréversible conformément aux règles financières sénégalaises (Section 3.A & 4). Confirmez-vous la clôture ?'
    );
    if (!confirm) return;
    try {
      await closeAcademicYear(yearId);
      alert('Année académique clôturée avec succès.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Paramétrage Établissement & Années Académiques
          </h1>
          <p className="text-xs text-slate-500">
            Identité légale (Sénégal), devises, numérotation et verrouillage des exercices clos
          </p>
        </div>

        {saveError && (
          <div className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>{saveError}</span>
          </div>
        )}
        {savedMessage && (
          <div className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Paramètres enregistrés avec succès</span>
          </div>
        )}
      </div>

      {/* Academic Years Configuration (Section 3.A & 4) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Années Académiques & Clôture d Exercice</h2>
            <p className="text-xs text-slate-500">
              Règle stricte (Section 4) : Une année clôturée interdit toute modification ultérieure sur les inscriptions ou paiements passés.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {academicYears.map((yr) => (
            <div key={yr.id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    Année Universitaire {yr.code}
                    {yr.isCurrent && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        En cours
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Du {yr.startDate} au {yr.endDate}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    yr.isClosed
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {yr.isClosed ? 'Exercice Clôturé (Verrouillé)' : 'Exercice Ouvert'}
                </span>

                {!yr.isClosed && !yr.isCurrent && (
                  <button
                    onClick={() => handleCloseYear(yr.id)}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold flex items-center space-x-1"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Clôturer l année</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Institution Legal Identity Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Données Juridiques & Immatriculation (Sénégal)</h2>
            <p className="text-xs text-slate-500">Mentions légales obligatoires figurant sur les reçus, factures et attestations</p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Raison Sociale Complète :</label>
            <input
              type="text"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Sigle Officiel :</label>
            <input
              type="text"
              value={sigle}
              onChange={(e) => setSigle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Numéro NINEA :</label>
            <input
              type="text"
              value={ninea}
              onChange={(e) => setNinea(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Registre du Commerce (RC) :</label>
            <input
              type="text"
              value={rc}
              onChange={(e) => setRc(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-medium mb-1">Arrêté d Habilitation Ministériel :</label>
            <input
              type="text"
              value={arrete}
              onChange={(e) => setArrete(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Adresse Campus :</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Téléphone Secrétariat :</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </form>

      {/* Numbering Rules Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Règles de Numérotation Séquentielle des Pièces</h2>
              <p className="text-xs text-slate-500">
                Préfixes appliqués aux nouvelles pièces (format PRÉFIXE-ANNÉE-NUMÉRO). Les pièces déjà émises ne sont jamais renumérotées.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={isSaving}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Matricules Étudiants</span>
            <input
              type="text"
              value={prefixStudent}
              onChange={(e) => setPrefixStudent(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex : {cleanPrefix(prefixStudent)}-2025-0001</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Factures Échéancier</span>
            <input
              type="text"
              value={prefixInvoice}
              onChange={(e) => setPrefixInvoice(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex : {cleanPrefix(prefixInvoice)}-2025-00042</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Reçus d Encaissement</span>
            <input
              type="text"
              value={prefixReceipt}
              onChange={(e) => setPrefixReceipt(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex : {cleanPrefix(prefixReceipt)}-2025-00103</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Pièces de Dépenses</span>
            <input
              type="text"
              value={prefixExpense}
              onChange={(e) => setPrefixExpense(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex : {cleanPrefix(prefixExpense)}-2025-00008</span>
          </div>
        </div>
      </div>

      {/* Sauvegarde & restauration */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <DatabaseBackup className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Sauvegarde & Restauration de la base</h2>
            <p className="text-xs text-slate-500">
              Exportez régulièrement l intégralité des données (dossiers, factures, reçus, notes, audit) dans un fichier
              JSON. Recommandé : une sauvegarde quotidienne conservée hors du serveur.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleBackup}
            disabled={backupBusy}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Télécharger une sauvegarde complète
          </button>
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handleRestore(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={backupBusy}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-xs font-semibold"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Restaurer depuis un fichier…
              </button>
            </>
          )}
        </div>
        {!isAdmin && (
          <p className="text-[11px] text-slate-500">La restauration est réservée à l administrateur.</p>
        )}
        {backupMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs ${
              backupMessage.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {backupMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};
