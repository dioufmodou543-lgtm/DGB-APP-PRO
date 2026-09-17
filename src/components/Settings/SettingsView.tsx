import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsView: React.FC = () => {
  const { academicYears, closeAcademicYear } = useApp();

  const [savedMessage, setSavedMessage] = useState(false);

  // Institution settings state
  const [instName, setInstName] = useState(
    'Institut Supérieur des Métiers du Numérique et du Management'
  );
  const [sigle, setSigle] = useState('ISMNM');
  const [ninea, setNinea] = useState('007892341 2V2');
  const [rc, setRc] = useState('SN-DKR-2018-B-14290');
  const [arrete, setArrete] = useState('Arrêté Ministériel MESRI N° 004128/MESRI/DGES/DESP');
  const [address, setAddress] = useState('Rue Aimé Césaire, Fann Résidence, Dakar, Sénégal');
  const [phone, setPhone] = useState('+221 33 825 40 40');
  const [email, setEmail] = useState('direction@ismnm.edu.sn');

  // Numbering prefixes
  const [prefixStudent, setPrefixStudent] = useState('ETU-');
  const [prefixInvoice, setPrefixInvoice] = useState('FAC-');
  const [prefixReceipt, setPrefixReceipt] = useState('REC-');
  const [prefixExpense, setPrefixExpense] = useState('DEP-');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
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
                    Année Universitaire {yr.name}
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer</span>
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
          <h2 className="text-sm font-bold text-slate-900">Règles de Numérotation Séquentielle des Pièces</h2>
          <p className="text-xs text-slate-500">Préfixes appliqués aux dossiers, factures, reçus et décaissements</p>
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
            <span className="text-[10px] text-slate-400 mt-1 block">Ex: ETU-2025-001</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Factures Échéancier</span>
            <input
              type="text"
              value={prefixInvoice}
              onChange={(e) => setPrefixInvoice(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex: FAC-2025-0042</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Reçus d Encaissement</span>
            <input
              type="text"
              value={prefixReceipt}
              onChange={(e) => setPrefixReceipt(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex: REC-2025-0103</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block mb-1">Pièces de Dépenses</span>
            <input
              type="text"
              value={prefixExpense}
              onChange={(e) => setPrefixExpense(e.target.value)}
              className="w-full px-2.5 py-1.5 border rounded font-mono font-bold bg-white text-xs"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Ex: DEP-2025-008</span>
          </div>
        </div>
      </div>
    </div>
  );
};
