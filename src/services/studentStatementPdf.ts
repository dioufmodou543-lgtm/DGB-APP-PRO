import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Enrollment,
  EstablishmentConfig,
  InvoiceSchedule,
  PaymentReceipt,
  Program,
  StudentAdmission,
} from '../types';
import { formatDateFR, plainFCFA } from './recovery';

/**
 * Relevé de compte étudiant (situation financière) : échéancier, règlements
 * et solde. Document remis à la famille ou joint à une relance.
 */
export function generateStudentStatementPDF(params: {
  config: EstablishmentConfig;
  student: StudentAdmission;
  enrollments: Enrollment[];
  programs: Program[];
  invoices: InvoiceSchedule[];
  receipts: PaymentReceipt[];
  generatedBy: string;
}): jsPDF {
  const { config, student, enrollments, programs, invoices, receipts, generatedBy } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split('T')[0];

  // En-tête établissement
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(config.name, 14, 11, { maxWidth: pageWidth - 28 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.address}, ${config.city} - ${config.country}  |  Tél : ${config.phone}  |  ${config.email}`, 14, 18);
  doc.text(`NINEA : ${config.ninea}  |  RC : ${config.rc}`, 14, 23);

  // Titre
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RELEVÉ DE COMPTE ÉTUDIANT', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Situation arrêtée au ${formatDateFR(today)}`, 14, 46);

  // Bloc identité
  const studentEnrollments = enrollments.filter((e) => e.studentId === student.id);
  const latest = [...studentEnrollments].sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))[0];
  const program = programs.find((p) => p.id === latest?.programId);

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 51, pageWidth - 28, 31, 2, 2, 'FD');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  const left = [
    ['Étudiant', `${student.lastName.toUpperCase()} ${student.firstName}`],
    ['Matricule', student.matricule],
    ['Filière', program ? `${program.title} (${program.yearLevel})` : '-'],
  ];
  const right = [
    ['Téléphone', student.phone || '-'],
    ['Tuteur', student.parentName || '-'],
    ['Tél. tuteur', student.parentPhone || '-'],
    ['Plan de paiement', latest ? latest.paymentPlan : '-'],
  ];
  left.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k} :`, 18, 58 + i * 6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v), 42, 58 + i * 6, { maxWidth: 62 });
  });
  right.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k} :`, 110, 58 + i * 6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v), 140, 58 + i * 6, { maxWidth: pageWidth - 158 });
  });

  // Échéancier
  const studentInvoices = invoices
    .filter((i) => i.studentId === student.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const statusLabel: Record<InvoiceSchedule['status'], string> = {
    en_attente: 'À venir',
    partiel: 'Partiel',
    solde: 'Soldé',
    en_retard: 'En retard',
  };

  autoTable(doc, {
    startY: 88,
    head: [['N° facture', 'Libellé', 'Échéance', 'Net dû', 'Payé', 'Reste', 'Statut']],
    body: studentInvoices.map((i) => [
      i.invoiceNumber,
      i.title,
      formatDateFR(i.dueDate),
      plainFCFA(i.netAmount),
      plainFCFA(i.paidAmount),
      plainFCFA(i.balanceDue),
      statusLabel[i.status] || i.status,
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'En retard') {
        data.cell.styles.textColor = [190, 18, 60];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Règlements
  const studentReceipts = receipts
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const methodLabel: Record<string, string> = {
    especes: 'Espèces',
    wave: 'Wave',
    orange_money: 'Orange Money',
    virement: 'Virement',
    cheque: 'Chèque',
  };

  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Historique des règlements', 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['N° reçu', 'Date', 'Mode', 'Référence', 'Montant', 'Statut']],
    body:
      studentReceipts.length > 0
        ? studentReceipts.map((r) => [
            r.receiptNumber,
            formatDateFR(r.paymentDate.substring(0, 10)),
            methodLabel[r.paymentMethod] || r.paymentMethod,
            r.transactionRef || '-',
            plainFCFA(r.amount),
            r.status === 'annule' ? 'Annulé' : 'Valide',
          ])
        : [['-', '-', '-', '-', '-', 'Aucun règlement']],
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    columnStyles: { 4: { halign: 'right' } },
  });

  // Synthèse
  const totalNet = studentInvoices.reduce((s, i) => s + i.netAmount, 0);
  const totalPaid = studentInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalDue = studentInvoices.reduce((s, i) => s + i.balanceDue, 0);
  const overdue = studentInvoices.filter((i) => i.balanceDue > 0 && i.dueDate < today).reduce((s, i) => s + i.balanceDue, 0);

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  const boxX = pageWidth - 14 - 80;
  doc.setFillColor(totalDue > 0 ? 255 : 236, totalDue > 0 ? 241 : 253, totalDue > 0 ? 242 : 245);
  doc.roundedRect(boxX, y, 80, 30, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const rows: [string, string][] = [
    ['Total facturé (net)', plainFCFA(totalNet)],
    ['Total réglé', plainFCFA(totalPaid)],
    ['Dont échu impayé', plainFCFA(overdue)],
  ];
  rows.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal');
    doc.text(k, boxX + 4, y + 7 + i * 5.5);
    doc.text(v, boxX + 76, y + 7 + i * 5.5, { align: 'right' });
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('SOLDE RESTANT DÛ', boxX + 4, y + 26);
  doc.text(plainFCFA(totalDue), boxX + 76, y + 26, { align: 'right' });

  // Pied de page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Document généré le ${formatDateFR(today)} par ${generatedBy} - ${config.acronym}. Montants en francs CFA (XOF).`,
    14,
    pageHeight - 10
  );

  return doc;
}
