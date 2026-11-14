import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Copy,
  Download,
  FileText,
  History,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Send,
  Smartphone,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentReminder, ReminderChannel, ReminderLevel } from '../../types';
import { formatFCFA } from '../../services/currency';
import {
  AGING_BUCKETS,
  AgingBucketId,
  buildDebtors,
  buildReminderMessage,
  DebtorSummary,
  emptyBuckets,
  formatDateFR,
  mailtoLink,
  RiskLevel,
  smsLink,
  whatsappLink,
} from '../../services/recovery';
import { generateStudentStatementPDF } from '../../services/studentStatementPdf';
import { downloadCSV, todayStamp } from '../../utils/csv';

const RISK_STYLES: Record<RiskLevel, { label: string; className: string }> = {
  faible: { label: 'Faible', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  moyen: { label: 'Moyen', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  eleve: { label: 'Élevé', className: 'bg-orange-50 text-orange-800 border-orange-200' },
  critique: { label: 'Critique', className: 'bg-rose-50 text-rose-800 border-rose-300' },
};

const LEVEL_LABELS: Record<ReminderLevel, string> = {
  courtoise: 'Relance courtoise',
  ferme: 'Relance ferme',
  mise_en_demeure: 'Mise en demeure',
};

const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'E-mail',
  appel: 'Appel téléphonique',
  courrier: 'Courrier remis en main propre',
};

const BUCKET_COLORS: Record<AgingBucketId, string> = {
  non_echu: 'bg-slate-300',
  j0_30: 'bg-amber-400',
  j31_60: 'bg-orange-500',
  j61_90: 'bg-rose-500',
  j90_plus: 'bg-rose-800',
};

export const RecoveryView: React.FC = () => {
  const { students, invoices, enrollments, programs, receipts, reminders, config, sendReminder } = useApp();
  const { currentUser, activeRole } = useAuth();
  const today = todayStamp();

  const [tab, setTab] = useState<'debiteurs' | 'historique'>('debiteurs');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [bucketFilter, setBucketFilter] = useState<'all' | AgingBucketId>('all');

  const [activeDebtor, setActiveDebtor] = useState<DebtorSummary | null>(null);
  const [addressee, setAddressee] = useState<'etudiant' | 'tuteur'>('tuteur');
  const [channel, setChannel] = useState<ReminderChannel>('whatsapp');
  const [level, setLevel] = useState<ReminderLevel>('courtoise');
  const [message, setMessage] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const canSendFormalNotice = ['admin', 'dg', 'comptable'].includes(activeRole);

  const debtors = useMemo(
    () => buildDebtors({ students, invoices, enrollments, programs, reminders, today }),
    [students, invoices, enrollments, programs, reminders, today]
  );

  const totals = useMemo(() => {
    const buckets = emptyBuckets();
    for (const d of debtors) {
      for (const b of AGING_BUCKETS) buckets[b.id] += d.buckets[b.id];
    }
    const totalDue = debtors.reduce((s, d) => s + d.totalDue, 0);
    const overdue = debtors.reduce((s, d) => s + d.overdueAmount, 0);
    const billedToDate = invoices.filter((i) => i.dueDate <= today).reduce((s, i) => s + i.netAmount, 0);
    const paidOnBilledToDate = invoices.filter((i) => i.dueDate <= today).reduce((s, i) => s + i.paidAmount, 0);
    const recoveryRate = billedToDate > 0 ? Math.round((paidOnBilledToDate / billedToDate) * 1000) / 10 : 100;
    const monthPrefix = today.substring(0, 7);
    const remindersThisMonth = reminders.filter((r) => r.sentAt.startsWith(monthPrefix)).length;
    const upcomingPromises = reminders.filter((r) => r.promiseDate && r.promiseDate >= today);
    const brokenPromises = reminders.filter((r) => {
      if (!r.promiseDate || r.promiseDate >= today) return false;
      return debtors.some((d) => d.student.id === r.studentId && d.lastReminder?.id === r.id);
    });
    return { buckets, totalDue, overdue, recoveryRate, remindersThisMonth, upcomingPromises, brokenPromises };
  }, [debtors, invoices, reminders, today]);

  const filtered = debtors.filter((d) => {
    const q = search.trim().toLowerCase();
    const textOk =
      !q ||
      `${d.student.firstName} ${d.student.lastName} ${d.student.matricule} ${d.student.phone} ${d.student.parentName}`
        .toLowerCase()
        .includes(q);
    const riskOk = riskFilter === 'all' || d.risk === riskFilter;
    const progOk = programFilter === 'all' || d.program?.id === programFilter;
    const bucketOk = bucketFilter === 'all' || d.buckets[bucketFilter] > 0;
    return textOk && riskOk && progOk && bucketOk;
  });

  const maxBucket = Math.max(1, ...AGING_BUCKETS.map((b) => totals.buckets[b.id]));

  const regenerateMessage = (d: DebtorSummary, lvl: ReminderLevel, who: 'etudiant' | 'tuteur') => {
    setMessage(
      buildReminderMessage({
        debtor: d,
        level: lvl,
        addressee: who,
        establishmentName: config.acronym || config.name,
        establishmentPhone: config.phone,
      })
    );
  };

  const openReminder = (d: DebtorSummary) => {
    const who: 'etudiant' | 'tuteur' = d.student.parentPhone && d.student.parentPhone.trim().length > 5 ? 'tuteur' : 'etudiant';
    const lvl: ReminderLevel = d.suggestedLevel === 'mise_en_demeure' && !canSendFormalNotice ? 'ferme' : d.suggestedLevel;
    setActiveDebtor(d);
    setAddressee(who);
    setLevel(lvl);
    setChannel('whatsapp');
    setPromiseDate('');
    setNotes('');
    setFeedback(null);
    regenerateMessage(d, lvl, who);
  };

  const recipientFor = (d: DebtorSummary, who: 'etudiant' | 'tuteur', ch: ReminderChannel) => {
    if (ch === 'email') return d.student.email;
    return who === 'tuteur' ? d.student.parentPhone || d.student.phone : d.student.phone;
  };

  const handleSend = async () => {
    if (!activeDebtor) return;
    const recipient = recipientFor(activeDebtor, addressee, channel);
    setSending(true);
    setFeedback(null);
    // Onglet ouvert immédiatement (dans le geste utilisateur) pour ne pas être bloqué par le navigateur
    const waWindow = channel === 'whatsapp' ? window.open('', '_blank') : null;
    try {
      await sendReminder({
        studentId: activeDebtor.student.id,
        channel,
        level,
        recipient,
        message,
        promiseDate: promiseDate || undefined,
        notes: notes || undefined,
      });
      // Ouverture de l'application de messagerie avec le message pré-rempli
      if (channel === 'whatsapp') {
        const link = whatsappLink(recipient, message);
        if (waWindow) {
          waWindow.opener = null;
          waWindow.location.href = link;
        } else {
          window.open(link, '_blank', 'noopener');
        }
      }
      if (channel === 'sms') window.location.href = smsLink(recipient, message);
      if (channel === 'email') {
        window.location.href = mailtoLink(recipient, `${LEVEL_LABELS[level]} – ${config.acronym}`, message);
      }
      setFeedback({ type: 'ok', text: 'Relance enregistrée dans le journal de recouvrement.' });
      setTimeout(() => setActiveDebtor(null), 900);
    } catch (e: any) {
      waWindow?.close();
      setFeedback({ type: 'error', text: e.message || 'Erreur lors de l envoi' });
    } finally {
      setSending(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setFeedback({ type: 'ok', text: 'Message copié dans le presse-papiers.' });
    } catch {
      setFeedback({ type: 'error', text: 'Copie impossible : sélectionnez le texte manuellement.' });
    }
  };

  const downloadStatement = (d: DebtorSummary) => {
    const doc = generateStudentStatementPDF({
      config,
      student: d.student,
      enrollments,
      programs,
      invoices,
      receipts,
      generatedBy: currentUser.name,
    });
    doc.save(`releve_compte_${d.student.matricule}_${today}.pdf`);
  };

  const exportDebtors = () => {
    downloadCSV<DebtorSummary>(`balance_agee_creances_${today}`, filtered, [
      { header: 'Matricule', value: (d) => d.student.matricule },
      { header: 'Nom', value: (d) => d.student.lastName },
      { header: 'Prénom', value: (d) => d.student.firstName },
      { header: 'Filière', value: (d) => d.program?.code || '' },
      { header: 'Téléphone étudiant', value: (d) => d.student.phone },
      { header: 'Tuteur', value: (d) => d.student.parentName },
      { header: 'Téléphone tuteur', value: (d) => d.student.parentPhone },
      { header: 'Non échu (FCFA)', value: (d) => d.buckets.non_echu },
      { header: '1-30 j (FCFA)', value: (d) => d.buckets.j0_30 },
      { header: '31-60 j (FCFA)', value: (d) => d.buckets.j31_60 },
      { header: '61-90 j (FCFA)', value: (d) => d.buckets.j61_90 },
      { header: '> 90 j (FCFA)', value: (d) => d.buckets.j90_plus },
      { header: 'Total dû (FCFA)', value: (d) => d.totalDue },
      { header: 'Retard max (jours)', value: (d) => d.maxDaysOverdue },
      { header: 'Risque', value: (d) => RISK_STYLES[d.risk].label },
      { header: 'Nb relances', value: (d) => d.reminderCount },
      { header: 'Dernière relance', value: (d) => d.lastReminder?.sentAt || '' },
    ]);
  };

  const exportHistory = () => {
    downloadCSV<PaymentReminder>(`journal_relances_${today}`, reminders, [
      { header: 'N° relance', value: (r) => r.reminderNumber },
      { header: 'Date', value: (r) => r.sentAt },
      { header: 'Matricule', value: (r) => students.find((s) => s.id === r.studentId)?.matricule || r.studentId },
      { header: 'Niveau', value: (r) => LEVEL_LABELS[r.level] },
      { header: 'Canal', value: (r) => CHANNEL_LABELS[r.channel] },
      { header: 'Destinataire', value: (r) => r.recipient },
      { header: 'Montant dû (FCFA)', value: (r) => r.amountDue },
      { header: 'Promesse de paiement', value: (r) => r.promiseDate || '' },
      { header: 'Agent', value: (r) => r.sentBy },
    ]);
  };

  const kpis = [
    { label: 'Créances totales', value: formatFCFA(totals.totalDue), sub: `${debtors.length} étudiant(s) débiteur(s)`, icon: Users, tone: 'text-slate-900' },
    { label: 'Dont échu (impayé)', value: formatFCFA(totals.overdue), sub: 'À recouvrer en priorité', icon: AlertTriangle, tone: 'text-rose-700' },
    { label: 'Taux de recouvrement', value: `${totals.recoveryRate} %`, sub: 'Sur les échéances arrivées à terme', icon: TrendingDown, tone: totals.recoveryRate >= 85 ? 'text-emerald-700' : 'text-amber-700' },
    { label: 'Relances ce mois', value: String(totals.remindersThisMonth), sub: `${totals.upcomingPromises.length} promesse(s) de paiement à venir`, icon: BellRing, tone: 'text-indigo-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recouvrement & Relances des impayés</h1>
          <p className="text-xs text-slate-500">
            Balance âgée des créances étudiantes, relances WhatsApp / SMS / e-mail tracées et relevés de compte PDF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={tab === 'debiteurs' ? exportDebtors : exportHistory}
            className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exporter (Excel / CSV)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>{k.label}</span>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className={`mt-2 text-lg font-bold ${k.tone}`}>{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {totals.brokenPromises.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
          <CalendarClock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{totals.brokenPromises.length} promesse(s) de paiement non tenue(s)</strong> : la date promise est dépassée et
            l étudiant présente toujours un impayé. Une relance de niveau supérieur est recommandée.
          </span>
        </div>
      )}

      {/* Balance âgée */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Balance âgée des créances</h2>
          {bucketFilter !== 'all' && (
            <button onClick={() => setBucketFilter('all')} className="text-[11px] text-emerald-700 font-semibold hover:underline">
              Réinitialiser le filtre
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {AGING_BUCKETS.map((b) => {
            const amount = totals.buckets[b.id];
            const pct = totals.totalDue > 0 ? Math.round((amount / totals.totalDue) * 100) : 0;
            const active = bucketFilter === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setBucketFilter(active ? 'all' : b.id)}
                className={`w-full grid grid-cols-[110px_1fr_auto] sm:grid-cols-[190px_1fr_170px] items-center gap-3 text-left rounded-lg px-2 py-1 transition-colors ${
                  active ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-slate-50'
                }`}
                title="Filtrer la liste des débiteurs sur cette tranche"
              >
                <span className="text-xs text-slate-700 font-medium truncate">
                  <span className="sm:hidden">{b.short}</span>
                  <span className="hidden sm:inline">{b.label}</span>
                </span>
                <span className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${BUCKET_COLORS[b.id]}`}
                    style={{ width: `${Math.max(amount > 0 ? 2 : 0, (amount / maxBucket) * 100)}%` }}
                  />
                </span>
                <span className="text-xs font-semibold text-slate-900 text-right tabular-nums">
                  {formatFCFA(amount)} <span className="text-slate-400 font-normal">({pct} %)</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: 'debiteurs' as const, label: `Débiteurs (${debtors.length})`, icon: Users },
          { id: 'historique' as const, label: `Journal des relances (${reminders.length})`, icon: History },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'debiteurs' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un étudiant, matricule, téléphone, tuteur…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Tous les niveaux de risque</option>
              {(Object.keys(RISK_STYLES) as RiskLevel[]).map((r) => (
                <option key={r} value={r}>
                  Risque {RISK_STYLES[r].label.toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Toutes les filières</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.yearLevel}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Aucun débiteur ne correspond aux critères. {debtors.length === 0 && 'Toutes les échéances sont soldées. 🎉'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5">Étudiant</th>
                    <th className="text-right px-3 py-2.5">Total dû</th>
                    <th className="text-right px-3 py-2.5">Échu</th>
                    <th className="text-center px-3 py-2.5">Retard</th>
                    <th className="text-left px-3 py-2.5">Dernière relance</th>
                    <th className="text-center px-3 py-2.5">Risque</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d) => (
                    <tr key={d.student.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {d.student.lastName.toUpperCase()} {d.student.firstName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.student.matricule} {d.program ? `• ${d.program.code} ${d.program.yearLevel}` : ''} •{' '}
                          {d.unpaidInvoices.length} échéance(s)
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatFCFA(d.totalDue)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${d.overdueAmount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                        {formatFCFA(d.overdueAmount)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {d.maxDaysOverdue > 0 ? (
                          <span className="font-semibold text-slate-800">{d.maxDaysOverdue} j</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-600">
                        {d.lastReminder ? (
                          <>
                            <div>{LEVEL_LABELS[d.lastReminder.level]}</div>
                            <div className="text-slate-400">
                              {formatDateFR(d.lastReminder.sentAt)} • {CHANNEL_LABELS[d.lastReminder.channel]}
                              {d.reminderCount > 1 ? ` • ${d.reminderCount} au total` : ''}
                            </div>
                            {d.lastReminder.promiseDate && (
                              <div className={d.lastReminder.promiseDate < today ? 'text-rose-600 font-semibold' : 'text-emerald-700'}>
                                Promesse : {formatDateFR(d.lastReminder.promiseDate)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">Jamais relancé</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${RISK_STYLES[d.risk].className}`}>
                          {RISK_STYLES[d.risk].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => downloadStatement(d)}
                            className="inline-flex items-center px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                            title="Télécharger le relevé de compte PDF"
                          >
                            <FileText className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Relevé</span>
                          </button>
                          <button
                            onClick={() => openReminder(d)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-semibold"
                          >
                            <Send className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Relancer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
          {reminders.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">Aucune relance enregistrée pour le moment.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">N° / Date</th>
                  <th className="text-left px-3 py-2.5">Étudiant</th>
                  <th className="text-left px-3 py-2.5">Niveau & canal</th>
                  <th className="text-right px-3 py-2.5">Montant dû</th>
                  <th className="text-left px-3 py-2.5">Promesse</th>
                  <th className="text-left px-4 py-2.5">Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reminders.map((r) => {
                  const s = students.find((st) => st.id === r.studentId);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5">
                        <div className="font-mono font-semibold text-slate-800">{r.reminderNumber}</div>
                        <div className="text-[11px] text-slate-500">{r.sentAt}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {s ? `${s.lastName.toUpperCase()} ${s.firstName}` : r.studentId}
                        <div className="text-[11px] text-slate-500">{r.recipient}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{LEVEL_LABELS[r.level]}</div>
                        <div className="text-[11px] text-slate-500">{CHANNEL_LABELS[r.channel]}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatFCFA(r.amountDue)}</td>
                      <td className="px-3 py-2.5">{r.promiseDate ? formatDateFR(r.promiseDate) : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.sentBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal de relance */}
      {activeDebtor && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Relancer {activeDebtor.student.firstName} {activeDebtor.student.lastName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {activeDebtor.student.matricule} • Reste dû {formatFCFA(activeDebtor.totalDue)} • Niveau suggéré :{' '}
                  {LEVEL_LABELS[activeDebtor.suggestedLevel]}
                </p>
              </div>
              <button onClick={() => setActiveDebtor(null)} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Fermer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>Destinataire</span>
                  <select
                    value={addressee}
                    onChange={(e) => {
                      const who = e.target.value as 'etudiant' | 'tuteur';
                      setAddressee(who);
                      regenerateMessage(activeDebtor, level, who);
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white font-normal"
                  >
                    <option value="tuteur">Tuteur / parent</option>
                    <option value="etudiant">Étudiant</option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>Niveau</span>
                  <select
                    value={level}
                    onChange={(e) => {
                      const lvl = e.target.value as ReminderLevel;
                      setLevel(lvl);
                      regenerateMessage(activeDebtor, lvl, addressee);
                    }}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white font-normal"
                  >
                    <option value="courtoise">Relance courtoise</option>
                    <option value="ferme">Relance ferme</option>
                    <option value="mise_en_demeure" disabled={!canSendFormalNotice}>
                      Mise en demeure {canSendFormalNotice ? '' : '(comptabilité / direction)'}
                    </option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>Canal</span>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as ReminderChannel)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white font-normal"
                  >
                    {(Object.keys(CHANNEL_LABELS) as ReminderChannel[]).map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                {channel === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                Envoi à : <strong className="text-slate-800">{recipientFor(activeDebtor, addressee, channel) || 'coordonnée manquante'}</strong>
              </div>

              <label className="block text-[11px] font-semibold text-slate-600 space-y-1">
                <span>Message (modifiable)</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={11}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-normal font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>Promesse de paiement (facultatif)</span>
                  <input
                    type="date"
                    min={today}
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg font-normal"
                  />
                </label>
                <label className="text-[11px] font-semibold text-slate-600 space-y-1">
                  <span>Note interne (facultatif)</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex : parent joint par téléphone, accord sur 2 versements"
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg font-normal"
                  />
                </label>
              </div>

              {feedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs ${
                    feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                onClick={copyMessage}
                className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copier le message
              </button>
              <button
                onClick={handleSend}
                disabled={sending || message.trim().length < 10}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {channel === 'whatsapp' ? (
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                ) : channel === 'sms' ? (
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                ) : channel === 'email' ? (
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                {sending
                  ? 'Enregistrement…'
                  : ['whatsapp', 'sms', 'email'].includes(channel)
                    ? `Enregistrer & ouvrir ${CHANNEL_LABELS[channel]}`
                    : 'Enregistrer la relance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
