import React, { useState } from 'react';
import {
  AlertCircle,
  Clock,
  Download,
  FileCheck,
  FileSpreadsheet,
  Filter,
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AuditView: React.FC = () => {
  const { auditLogs } = useApp();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = auditLogs.filter((log) => {
    const textMatch = `${log.userName} ${log.action} ${log.entityType} ${log.details}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const actionMatch = actionFilter === 'all' || log.action.includes(actionFilter);
    return textMatch && actionMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Journal d Audit & Traçabilité Réglementaire
          </h1>
          <p className="text-xs text-slate-500">
            Historique inaltérable de toutes les opérations sensibles (inscriptions, encaissements, annulations, clôtures)
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par utilisateur, entité, action ou détails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">Toutes les actions</option>
            <option value="create">Créations</option>
            <option value="update">Modifications</option>
            <option value="cancel">Annulations & Régularisations</option>
            <option value="close">Clôtures de caisse / Année</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Horodatage (Dakar)</th>
                <th className="px-4 py-3 text-left">Opérateur</th>
                <th className="px-4 py-3 text-left">Rôle</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entité</th>
                <th className="px-4 py-3 text-left">Détails de l opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{log.userName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-800">{log.action}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{log.entityType}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-md">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
