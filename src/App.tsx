import React from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PriorityFlowModal } from './components/PriorityFlow/PriorityFlowModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { StudentsView } from './components/Students/StudentsView';
import { InvoicesView } from './components/Finance/InvoicesView';
import { PaymentsView } from './components/Finance/PaymentsView';
import { CashRegisterView } from './components/Finance/CashRegisterView';
import { ExpensesView } from './components/Finance/ExpensesView';
import { TreasuryDashboard } from './components/Finance/TreasuryDashboard';
import { PedagogyView } from './components/Pedagogy/PedagogyView';
import { GradesView } from './components/Pedagogy/GradesView';
import { AttendanceView } from './components/Pedagogy/AttendanceView';
import { DiplomasView } from './components/Pedagogy/DiplomasView';
import { TeacherPortalView } from './components/Teacher/TeacherPortalView';
import { LibraryView } from './components/Library/LibraryView';
import { AuditView } from './components/Audit/AuditView';
import { TestRunnerView } from './components/Testing/TestRunnerView';
import { SettingsView } from './components/Settings/SettingsView';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';

const AppContent: React.FC = () => {
  const { activeView, isLoading, error } = useApp();

  const renderCurrentView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'teacher_portal':
        return <TeacherPortalView />;
      case 'students':
        return <StudentsView />;
      case 'invoices':
        return <InvoicesView />;
      case 'payments':
        return <PaymentsView />;
      case 'cash':
        return <CashRegisterView />;
      case 'expenses':
        return <ExpensesView />;
      case 'treasury':
        return <TreasuryDashboard />;
      case 'pedagogy':
        return <PedagogyView />;
      case 'grades':
        return <GradesView />;
      case 'attendance':
        return <AttendanceView />;
      case 'diplomas':
        return <DiplomasView />;
      case 'library':
        return <LibraryView />;
      case 'audit':
        return <AuditView />;
      case 'tests':
        return <TestRunnerView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Application Header */}
      <Header />

      {/* Main Layout Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
                <span>{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Chargement des données ISMNM Dakar...</span>
              </div>
            ) : (
              renderCurrentView()
            )}
          </div>
        </main>
      </div>

      {/* Offline Status Floating Indicator */}
      <OfflineIndicator />

      {/* Globally Mounted 9-Step Priority Flow Modal (Section 5) */}
      <PriorityFlowModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
