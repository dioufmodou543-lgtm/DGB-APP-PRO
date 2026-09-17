import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  BookMarked,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Filter,
  GraduationCap,
  Library,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Book, BookLoan } from '../../types';

export const LibraryView: React.FC = () => {
  const {
    books,
    bookLoans,
    students,
    createBook,
    updateBook,
    deleteBook,
    createBookLoan,
    returnBookLoan,
    extendBookLoan,
  } = useApp();

  const { currentUser, activeRole } = useAuth();
  const canManage = activeRole === 'admin' || activeRole === 'dg' || activeRole === 'pedagogie' || activeRole === 'scolarite';

  const [activeTab, setActiveTab] = useState<'catalog' | 'loans'>('catalog');

  // Search & Filter state for Books
  const [bookSearch, setBookSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'depleted'>('all');

  // Search & Filter state for Loans
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'en_cours' | 'en_retard' | 'rendu'>('all');

  // Modals
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [preselectedBookId, setPreselectedBookId] = useState<string>('');

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<BookLoan | null>(null);
  const [returnCondition, setReturnCondition] = useState<'neuf' | 'bon_etat' | 'abime' | 'perdu'>('bon_etat');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  // Book form state
  const [bookForm, setBookForm] = useState<{
    isbn: string;
    title: string;
    author: string;
    category: string;
    publisher: string;
    publishYear: number;
    location: string;
    totalCopies: number;
    description: string;
  }>({
    isbn: '',
    title: '',
    author: '',
    category: 'Informatique & Télécoms',
    publisher: '',
    publishYear: new Date().getFullYear(),
    location: 'Rayon A1',
    totalCopies: 3,
    description: '',
  });

  // Loan form state
  const [loanForm, setLoanForm] = useState<{
    bookId: string;
    studentId: string;
    loanDate: string;
    dueDate: string;
    conditionAtLoan: 'neuf' | 'bon_etat' | 'abime';
    remarks: string;
  }>({
    bookId: '',
    studentId: '',
    loanDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    conditionAtLoan: 'bon_etat',
    remarks: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories derived from books
  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  // KPIs
  const kpis = useMemo(() => {
    const totalBooks = books.length;
    const totalCopies = books.reduce((acc, b) => acc + (b.totalCopies || 0), 0);
    const availableCopies = books.reduce((acc, b) => acc + (b.availableCopies || 0), 0);
    const activeLoans = bookLoans.filter((l) => l.status === 'en_cours').length;
    const overdueLoans = bookLoans.filter((l) => l.status === 'en_retard').length;
    const returnedLoans = bookLoans.filter((l) => l.status === 'rendu').length;

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      activeLoans,
      overdueLoans,
      returnedLoans,
    };
  }, [books, bookLoans]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchSearch =
        !bookSearch ||
        b.title?.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.author?.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.isbn?.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.location?.toLowerCase().includes(bookSearch.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || b.category === selectedCategory;

      const matchAvail =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && b.availableCopies > 0) ||
        (availabilityFilter === 'depleted' && b.availableCopies === 0);

      return matchSearch && matchCategory && matchAvail;
    });
  }, [books, bookSearch, selectedCategory, availabilityFilter]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return bookLoans.filter((l) => {
      const matchSearch =
        !loanSearch ||
        l.loanNumber?.toLowerCase().includes(loanSearch.toLowerCase()) ||
        l.bookTitle?.toLowerCase().includes(loanSearch.toLowerCase()) ||
        l.studentName?.toLowerCase().includes(loanSearch.toLowerCase()) ||
        l.studentMatricule?.toLowerCase().includes(loanSearch.toLowerCase());

      const matchStatus = loanStatusFilter === 'all' || l.status === loanStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [bookLoans, loanSearch, loanStatusFilter]);

  // Open Add/Edit Book Modal
  const handleOpenBookModal = (book?: Book) => {
    setFormError(null);
    if (book) {
      setEditingBook(book);
      setBookForm({
        isbn: book.isbn || '',
        title: book.title || '',
        author: book.author || '',
        category: book.category || 'Informatique & Télécoms',
        publisher: book.publisher || '',
        publishYear: book.publishYear || new Date().getFullYear(),
        location: book.location || 'Rayon A1',
        totalCopies: book.totalCopies || 1,
        description: book.description || '',
      });
    } else {
      setEditingBook(null);
      setBookForm({
        isbn: `978-2-${Math.floor(10 + Math.random() * 89)}-${Math.floor(100000 + Math.random() * 899999)}-${Math.floor(1 + Math.random() * 9)}`,
        title: '',
        author: '',
        category: 'Informatique & Télécoms',
        publisher: 'Éditions Académiques',
        publishYear: new Date().getFullYear(),
        location: 'Rayon Info A1',
        totalCopies: 3,
        description: '',
      });
    }
    setIsBookModalOpen(true);
  };

  // Submit Book
  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      setFormError('Le titre et l auteur sont obligatoires.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingBook) {
        await updateBook(editingBook.id, bookForm);
      } else {
        await createBook(bookForm);
      }
      setIsBookModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de l enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Book
  const handleDeleteBook = async (book: Book) => {
    const active = bookLoans.filter((l) => l.bookId === book.id && l.status !== 'rendu');
    if (active.length > 0) {
      alert(`Impossible de supprimer cet ouvrage : ${active.length} exemplaire(s) sont actuellement empruntés.`);
      return;
    }
    if (window.confirm(`Confirmez-vous la suppression définitive de l ouvrage "${book.title}" ?`)) {
      try {
        await deleteBook(book.id);
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    }
  };

  // Open Loan Modal
  const handleOpenLoanModal = (bookId?: string) => {
    setFormError(null);
    setLoanForm({
      bookId: bookId || (books.find((b) => b.availableCopies > 0)?.id || ''),
      studentId: students[0]?.id || '',
      loanDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      conditionAtLoan: 'bon_etat',
      remarks: '',
    });
    setPreselectedBookId(bookId || '');
    setIsLoanModalOpen(true);
  };

  // Submit Loan
  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.bookId) {
      setFormError('Veuillez sélectionner un ouvrage.');
      return;
    }
    if (!loanForm.studentId) {
      setFormError('Veuillez sélectionner un étudiant.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await createBookLoan(loanForm);
      setIsLoanModalOpen(false);
      setActiveTab('loans');
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la création de l emprunt');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (loan: BookLoan) => {
    setSelectedLoanForReturn(loan);
    setReturnCondition((loan.conditionAtLoan as any) || 'bon_etat');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnRemarks('');
    setIsReturnModalOpen(true);
  };

  // Submit Return
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForReturn) return;
    setIsSubmitting(true);
    try {
      await returnBookLoan(selectedLoanForReturn.id, {
        returnDate,
        conditionAtReturn: returnCondition,
        remarks: returnRemarks,
      });
      setIsReturnModalOpen(false);
      setSelectedLoanForReturn(null);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation du retour');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extend Loan
  const handleExtendLoan = async (loan: BookLoan) => {
    if (window.confirm(`Prolonger l emprunt de "${loan.bookTitle}" pour ${loan.studentName} de 14 jours supplémentaires ?`)) {
      try {
        await extendBookLoan(loan.id, 14);
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la prolongation');
      }
    }
  };

  // Export CSV
  const handleExportBooksCSV = () => {
    const headers = ['ISBN', 'Titre', 'Auteur', 'Catégorie', 'Éditeur', 'Année', 'Emplacement', 'Total', 'Disponibles'];
    const rows = filteredBooks.map((b) => [
      `"${b.isbn || ''}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${(b.category || '').replace(/"/g, '""')}"`,
      `"${(b.publisher || '').replace(/"/g, '""')}"`,
      b.publishYear || '',
      `"${b.location || ''}"`,
      b.totalCopies,
      b.availableCopies,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventaire_bibliotheque_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLoansCSV = () => {
    const headers = ['N° Emprunt', 'Matricule', 'Étudiant', 'Ouvrage', 'Date Emprunt', 'Échéance', 'Statut', 'Date Retour', 'Prolongations'];
    const rows = filteredLoans.map((l) => [
      l.loanNumber,
      l.studentMatricule,
      `"${(l.studentName || '').replace(/"/g, '""')}"`,
      `"${(l.bookTitle || '').replace(/"/g, '""')}"`,
      l.loanDate,
      l.dueDate,
      l.status,
      l.returnDate || '',
      l.extensionCount || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `emprunts_bibliotheque_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for status badge
  const getLoanStatusBadge = (status: BookLoan['status'], dueDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (status === 'rendu') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Restitué
        </span>
      );
    }
    if (status === 'en_retard' || (status === 'en_cours' && dueDate < today)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          En retard
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
        <Clock className="w-3.5 h-3.5 text-sky-600" />
        En cours
      </span>
    );
  };

  return (
    <div id="library-module" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fonds Documentaire & Bibliothèque</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gestion de l inventaire des ouvrages universitaires, prêts étudiants et suivi des retours à échéance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-export-library-csv"
            onClick={activeTab === 'catalog' ? handleExportBooksCSV : handleExportLoansCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exporter CSV
          </button>

          <button
            id="btn-new-loan-primary"
            onClick={() => handleOpenLoanModal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            Prêter un livre
          </button>

          {canManage && (
            <button
              id="btn-add-book-primary"
              onClick={() => handleOpenBookModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nouvel Ouvrage
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ouvrages Référencés</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.totalBooks}</span>
            <span className="text-xs text-slate-500 font-medium">titres</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Volume total :</span>
            <span className="font-semibold text-slate-700">{kpis.totalCopies} exemplaires</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Disponibles en Rayon</span>
            <BookMarked className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{kpis.availableCopies}</span>
            <span className="text-xs text-slate-500 font-medium">/ {kpis.totalCopies} ex.</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${kpis.totalCopies ? (kpis.availableCopies / kpis.totalCopies) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-sky-600 uppercase tracking-wider">Prêts en cours</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-700">{kpis.activeLoans}</span>
            <span className="text-xs text-slate-500 font-medium">emprunt(s)</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Restitutions clôturées :</span>
            <span className="font-semibold text-slate-700">{kpis.returnedLoans}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 uppercase tracking-wider">Emprunts en Retard</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${kpis.overdueLoans > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {kpis.overdueLoans}
            </span>
            <span className="text-xs text-slate-500 font-medium">à relancer</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {kpis.overdueLoans > 0 ? (
              <span className="text-rose-600 font-medium">Action requise : relance étudiant</span>
            ) : (
              <span className="text-emerald-600 font-medium">Aucun retard critique</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3">
          <button
            id="tab-library-catalog"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-5 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Catalogue & Rayonnage
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">
              {books.length}
            </span>
          </button>

          <button
            id="tab-library-loans"
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-5 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'loans'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Gestion des Emprunts & Retours
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              {kpis.activeLoans + kpis.overdueLoans}
            </span>
            {kpis.overdueLoans > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-xs font-bold animate-pulse">
                {kpis.overdueLoans}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: CATALOGUE DES OUVRAGES */}
        {activeTab === 'catalog' && (
          <div className="p-5 space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par titre, auteur, ISBN..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="ALL">Toutes les disciplines</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    onClick={() => setAvailabilityFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      availabilityFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setAvailabilityFilter('available')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      availabilityFilter === 'available' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    En rayon ({books.filter((b) => b.availableCopies > 0).length})
                  </button>
                  <button
                    onClick={() => setAvailabilityFilter('depleted')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      availabilityFilter === 'depleted' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Prêtés intégralement
                  </button>
                </div>
              </div>
            </div>

            {/* Books Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Ouvrage & Auteur</th>
                    <th className="py-3 px-4">Discipline / Catégorie</th>
                    <th className="py-3 px-4">Localisation Rayon</th>
                    <th className="py-3 px-4 text-center">Disponibilité</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBooks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Aucun ouvrage ne correspond aux critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredBooks.map((book) => {
                      const isAvailable = book.availableCopies > 0;
                      return (
                        <tr key={book.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 line-clamp-1">{book.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{book.author}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-400">{book.isbn}</span>
                              {book.publishYear && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>{book.publishYear}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                              {book.category || 'Général'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {book.location || 'Rayon Général'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  isAvailable
                                    ? book.availableCopies <= 1
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {book.availableCopies} / {book.totalCopies} en rayon
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenLoanModal(book.id)}
                                disabled={!isAvailable}
                                title={isAvailable ? 'Enregistrer un prêt pour ce livre' : 'Aucun exemplaire disponible'}
                                className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                                  isAvailable
                                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                    : 'border-slate-200 text-slate-300 cursor-not-allowed'
                                }`}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Prêter</span>
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    onClick={() => handleOpenBookModal(book)}
                                    title="Modifier la fiche"
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBook(book)}
                                    title="Supprimer l ouvrage"
                                    className="p-1.5 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GESTION DES EMPRUNTS & RETOURS */}
        {activeTab === 'loans' && (
          <div className="p-5 space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par étudiant, matricule, livre..."
                  value={loanSearch}
                  onChange={(e) => setLoanSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    onClick={() => setLoanStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      loanStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Tous ({bookLoans.length})
                  </button>
                  <button
                    onClick={() => setLoanStatusFilter('en_cours')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      loanStatusFilter === 'en_cours' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    En cours ({kpis.activeLoans})
                  </button>
                  <button
                    onClick={() => setLoanStatusFilter('en_retard')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      loanStatusFilter === 'en_retard' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    En retard ({kpis.overdueLoans})
                  </button>
                  <button
                    onClick={() => setLoanStatusFilter('rendu')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                      loanStatusFilter === 'rendu' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Restitués ({kpis.returnedLoans})
                  </button>
                </div>
              </div>
            </div>

            {/* Overdue alert banner if any */}
            {kpis.overdueLoans > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-sm text-rose-900">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-semibold">{kpis.overdueLoans} emprunt(s) ont dépassé leur date limite de restitution.</span>{' '}
                    Pensez à contacter les étudiants ou à prolonger la durée du prêt le cas échéant.
                  </div>
                </div>
                <button
                  onClick={() => setLoanStatusFilter('en_retard')}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 shrink-0"
                >
                  Voir les retards
                </button>
              </div>
            )}

            {/* Loans Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Réf. Emprunt</th>
                    <th className="py-3 px-4">Étudiant Emprunteur</th>
                    <th className="py-3 px-4">Ouvrage Emprunté</th>
                    <th className="py-3 px-4">Dates & Échéance</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions Restitution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun emprunt enregistré ne correspond aux critères.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => {
                      const isReturned = loan.status === 'rendu';
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                            {loan.loanNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              {loan.studentName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{loan.studentMatricule}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 line-clamp-1">{loan.bookTitle}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{loan.bookIsbn}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs text-slate-600">
                              <span className="text-slate-400">Prêté le :</span>{' '}
                              <span className="font-medium text-slate-800">{loan.loanDate}</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              <span className="text-slate-400">Échéance :</span>{' '}
                              <span className={`font-semibold ${loan.status === 'en_retard' ? 'text-rose-600' : 'text-slate-800'}`}>
                                {loan.dueDate}
                              </span>
                            </div>
                            {loan.returnDate && (
                              <div className="text-xs text-emerald-600 mt-0.5 font-medium">
                                Rendu le : {loan.returnDate}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {getLoanStatusBadge(loan.status, loan.dueDate)}
                            {loan.extensionCount && loan.extensionCount > 0 ? (
                              <div className="text-[10px] text-slate-400 mt-1">
                                +{loan.extensionCount} prolongation(s)
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {!isReturned ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenReturnModal(loan)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Restituer
                                </button>
                                <button
                                  onClick={() => handleExtendLoan(loan)}
                                  title="Prolonger de 14 jours"
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  Prolonger
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic">
                                Clôturé par {loan.returnedBy || 'Agent'}
                              </div>
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
        )}
      </div>

      {/* MODAL: ADD / EDIT BOOK */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingBook ? 'Modifier la fiche de l ouvrage' : 'Référencer un nouvel ouvrage'}
              </h3>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBook} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Titre de l ouvrage *</label>
                <input
                  type="text"
                  required
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  placeholder="Ex: Comptabilité Générale SYSCOHADA"
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Auteur(s) *</label>
                  <input
                    type="text"
                    required
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    placeholder="Ex: Pr. Birahim Diop"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Numéro ISBN</label>
                  <input
                    type="text"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    placeholder="978-2-..."
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Discipline / Catégorie</label>
                  <input
                    type="text"
                    value={bookForm.category}
                    onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                    placeholder="Ex: Informatique, Droit..."
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Éditeur & Année</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bookForm.publisher}
                      onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                      placeholder="Éditeur"
                      className="w-2/3 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <input
                      type="number"
                      value={bookForm.publishYear}
                      onChange={(e) => setBookForm({ ...bookForm, publishYear: Number(e.target.value) })}
                      className="w-1/3 text-sm px-2 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emplacement Rayonnage</label>
                  <input
                    type="text"
                    value={bookForm.location}
                    onChange={(e) => setBookForm({ ...bookForm, location: e.target.value })}
                    placeholder="Ex: Rayon Info A1 - Étagère 2"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre d exemplaires total</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={bookForm.totalCopies}
                    onChange={(e) => setBookForm({ ...bookForm, totalCopies: Math.max(1, Number(e.target.value)) })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Notes de contenu</label>
                <textarea
                  rows={2}
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  placeholder="Matières concernées, public cible..."
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : editingBook ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE LOAN */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Enregistrer un nouvel emprunt</h3>
              <button
                onClick={() => setIsLoanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLoan} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ouvrage à prêter *</label>
                <select
                  required
                  value={loanForm.bookId}
                  onChange={(e) => setLoanForm({ ...loanForm, bookId: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">Sélectionner un ouvrage...</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.availableCopies <= 0}>
                      {b.title} — ({b.availableCopies} dispo / {b.totalCopies}) {b.availableCopies <= 0 ? '[Épuisé]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Étudiant emprunteur *</label>
                <select
                  required
                  value={loanForm.studentId}
                  onChange={(e) => setLoanForm({ ...loanForm, studentId: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="">Sélectionner un étudiant...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.matricule})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date d emprunt</label>
                  <input
                    type="date"
                    required
                    value={loanForm.loanDate}
                    onChange={(e) => setLoanForm({ ...loanForm, loanDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date limite de retour</label>
                  <input
                    type="date"
                    required
                    value={loanForm.dueDate}
                    onChange={(e) => setLoanForm({ ...loanForm, dueDate: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">État de l ouvrage prêté</label>
                  <select
                    value={loanForm.conditionAtLoan}
                    onChange={(e) => setLoanForm({ ...loanForm, conditionAtLoan: e.target.value as any })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="neuf">Neuf</option>
                    <option value="bon_etat">Bon état</option>
                    <option value="abime">Usagé / Déjà annoté</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Observations</label>
                  <input
                    type="text"
                    value={loanForm.remarks}
                    onChange={(e) => setLoanForm({ ...loanForm, remarks: e.target.value })}
                    placeholder="Ex: Projet de semestre..."
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Validation...' : 'Valider le prêt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RETURN LOAN */}
      {isReturnModalOpen && selectedLoanForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Enregistrer la restitution</h3>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Ouvrage :</span>
                <span className="font-semibold text-slate-800 text-right">{selectedLoanForReturn.bookTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Étudiant :</span>
                <span className="font-semibold text-slate-800">{selectedLoanForReturn.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Échéance initiale :</span>
                <span className="font-mono text-slate-800">{selectedLoanForReturn.dueDate}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date effective de restitution</label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">État lors du retour</label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                >
                  <option value="neuf">Parfait état (Neuf)</option>
                  <option value="bon_etat">Bon état normal</option>
                  <option value="abime">Abîmé / Pages détachées</option>
                  <option value="perdu">Ouvrage Perdu (Remplacement dû)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarques ou pénalités</label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Ex: Restitué sans dommage..."
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'Traitement...' : 'Confirmer la restitution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
