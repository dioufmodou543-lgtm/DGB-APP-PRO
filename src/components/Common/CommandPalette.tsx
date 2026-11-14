import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CornerDownLeft, FileSpreadsheet, LayoutGrid, Receipt, Search, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { viewsForRole } from '../../navigation';
import { formatFCFA } from '../../services/currency';

type ResultKind = 'vue' | 'etudiant' | 'facture' | 'recu' | 'livre';

interface PaletteResult {
  key: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  run: () => void;
}

const KIND_META: Record<ResultKind, { label: string; icon: React.ElementType }> = {
  vue: { label: 'Module', icon: LayoutGrid },
  etudiant: { label: 'Étudiant', icon: User },
  facture: { label: 'Facture', icon: FileSpreadsheet },
  recu: { label: 'Reçu', icon: Receipt },
  livre: { label: 'Ouvrage', icon: BookOpen },
};

/** Supprime accents et casse pour une recherche tolérante (« Ndiaye » = « ndiaye », « Élève » = « eleve »). */
function normalize(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { students, invoices, receipts, books, setActiveView, setSelectedStudentId, setSelectedReceipt } = useApp();
  const { activeRole } = useAuth();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  const allowedViews = useMemo(() => viewsForRole(activeRole), [activeRole]);
  const canSee = (view: string) => allowedViews.some((v) => v.id === view);

  const results = useMemo<PaletteResult[]>(() => {
    const q = normalize(query.trim());
    const go = (view: string) => () => {
      setActiveView(view);
      onClose();
    };

    const views: PaletteResult[] = allowedViews
      .filter((v) => !q || normalize(v.label).includes(q))
      .map((v) => ({ key: `v_${v.id}`, kind: 'vue', title: v.label, subtitle: 'Ouvrir le module', run: go(v.id) }));

    if (!q) return views.slice(0, 8);

    const out: PaletteResult[] = [...views.slice(0, 4)];

    if (canSee('students')) {
      students
        .filter((s) => normalize(`${s.firstName} ${s.lastName} ${s.lastName} ${s.firstName} ${s.matricule} ${s.phone} ${s.cniPassport}`).includes(q))
        .slice(0, 6)
        .forEach((s) =>
          out.push({
            key: `s_${s.id}`,
            kind: 'etudiant',
            title: `${s.lastName.toUpperCase()} ${s.firstName}`,
            subtitle: `${s.matricule} • ${s.phone} • ${s.status}`,
            run: () => {
              setSelectedStudentId(s.id);
              setActiveView('students');
              onClose();
            },
          })
        );
    }

    if (canSee('invoices')) {
      invoices
        .filter((i) => normalize(`${i.invoiceNumber} ${i.title}`).includes(q))
        .slice(0, 5)
        .forEach((i) =>
          out.push({
            key: `i_${i.id}`,
            kind: 'facture',
            title: i.invoiceNumber,
            subtitle: `${i.title} • reste dû ${formatFCFA(i.balanceDue)}`,
            run: go('invoices'),
          })
        );
    }

    if (canSee('payments')) {
      receipts
        .filter((r) => normalize(`${r.receiptNumber} ${r.transactionRef || ''}`).includes(q))
        .slice(0, 5)
        .forEach((r) =>
          out.push({
            key: `r_${r.id}`,
            kind: 'recu',
            title: r.receiptNumber,
            subtitle: `${formatFCFA(r.amount)} • ${r.paymentMethod} • ${r.paymentDate.substring(0, 10)}${r.status === 'annule' ? ' • ANNULÉ' : ''}`,
            run: () => {
              setSelectedReceipt(r);
              setActiveView('payments');
              onClose();
            },
          })
        );
    }

    if (canSee('library')) {
      books
        .filter((b) => normalize(`${b.title} ${b.author} ${b.isbn}`).includes(q))
        .slice(0, 4)
        .forEach((b) =>
          out.push({
            key: `b_${b.id}`,
            kind: 'livre',
            title: b.title,
            subtitle: `${b.author} • ${b.availableCopies}/${b.totalCopies} disponible(s)`,
            run: go('library'),
          })
        );
    }

    return out;
  }, [query, allowedViews, students, invoices, receipts, books]);

  useEffect(() => {
    if (cursor >= results.length) setCursor(Math.max(0, results.length - 1));
  }, [results.length, cursor]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[cursor]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/50 flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un étudiant, un matricule, une facture, un reçu, un module…"
            className="flex-1 py-3.5 text-sm outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Échap</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-xs text-slate-500">Aucun résultat pour « {query} »</li>
          ) : (
            results.map((r, idx) => {
              const Meta = KIND_META[r.kind];
              const Icon = Meta.icon;
              const active = idx === cursor;
              return (
                <li key={r.key}>
                  <button
                    onMouseEnter={() => setCursor(idx)}
                    onClick={r.run}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${active ? 'bg-emerald-50' : ''}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-900 truncate">{r.title}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{r.subtitle}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{Meta.label}</span>
                    {active && <CornerDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 flex gap-3">
          <span>↑↓ naviguer</span>
          <span>Entrée ouvrir</span>
          <span>Ctrl + K pour rouvrir</span>
        </div>
      </div>
    </div>
  );
};
