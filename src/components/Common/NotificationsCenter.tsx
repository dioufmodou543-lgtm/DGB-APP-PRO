import React, { useEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AlertSeverity, useAlerts } from '../../hooks/useAlerts';

const SEVERITY_STYLES: Record<AlertSeverity, { icon: React.ElementType; className: string }> = {
  critique: { icon: AlertOctagon, className: 'text-rose-600 bg-rose-50' },
  attention: { icon: AlertTriangle, className: 'text-amber-600 bg-amber-50' },
  info: { icon: Info, className: 'text-sky-600 bg-sky-50' },
};

export const NotificationsCenter: React.FC = () => {
  const alerts = useAlerts();
  const { setActiveView } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const criticalCount = alerts.filter((a) => a.severity === 'critique').length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title="Alertes et actions à mener"
        aria-label={`Alertes (${alerts.length})`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {alerts.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
              criticalCount > 0 ? 'bg-rose-600' : 'bg-amber-500'
            }`}
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] rounded-xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Alertes & actions à mener</span>
            <span className="text-[10px] text-slate-400">{alerts.length} alerte(s)</span>
          </div>
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              Aucune action en attente pour votre rôle.
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {alerts.map((a) => {
                const { icon: Icon, className } = SEVERITY_STYLES[a.severity];
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        setActiveView(a.view);
                        setOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${className}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-900">{a.title}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 break-words">{a.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
