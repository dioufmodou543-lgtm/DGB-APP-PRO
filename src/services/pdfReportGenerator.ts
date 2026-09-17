import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatFCFA } from './currency';
import {
  EstablishmentConfig,
  InvoiceSchedule,
  PaymentReceipt,
  VendorExpense,
  CashRegisterSession,
} from '../types';

export interface TreasuryReportData {
  config: EstablishmentConfig;
  invoices: InvoiceSchedule[];
  receipts: PaymentReceipt[];
  expenses: VendorExpense[];
  cashSession: CashRegisterSession;
  totalAvailable: number;
  cashPhysical: number;
  availableBank: number;
  totalStudentReceivables: number;
  confirmedIn30: number;
  confirmedIn60: number;
  confirmedIn90: number;
  estimatedIn30: number;
  estimatedIn60: number;
  estimatedIn90: number;
  debtsDue30: number;
  debtsDue60: number;
  debtsDue90: number;
  fixedChargesPerMonth: number;
  projectedBalance30: number;
  projectedBalance60: number;
  projectedBalance90: number;
  minTreasuryThreshold: number;
  generatedBy: string; // e.g. "Modou Diouf"
}

export function generateTreasuryPDF(data: TreasuryReportData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const todayStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Palette couleurs institutionnelle ISMNM
  const primaryNavy = [15, 23, 42]; // slate-900
  const slateGray = [100, 116, 139];

  // 1. En-tête officiel République du Sénégal & MESRI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text('Un Peuple - Un But - Une Foi', pageWidth / 2, 15, { align: 'center' });
  doc.text(
    'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L’INNOVATION',
    pageWidth / 2,
    18,
    { align: 'center' }
  );

  // Ligne de séparation supérieure
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(14, 21, pageWidth - 14, 21);

  // Logo textuel & Raison sociale
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(data.config.name || 'INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT (ISMNM DAKAR)', 14, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `Agrément Ministériel MESRI N° 004128/MESRI • NINEA : ${data.config.ninea || '008234192'} • RC : ${data.config.rc || 'SN-DKR-2022-B-14920'}`,
    14,
    32
  );
  doc.text(
    `Campus Dakar : ${data.config.address || 'Point E, Boulevard de l’Est, Dakar'} • Tél : ${data.config.phone || '+221 33 825 00 00'} • ${data.config.email || 'contact@ismnm.sn'}`,
    14,
    36
  );

  // Encadré titre du rapport
  doc.setFillColor(15, 23, 42); // slate-900 background
  doc.roundedRect(14, 40, pageWidth - 28, 14, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RAPPORT DE TRÉSORERIE & PROJECTIONS FINANCIÈRES', pageWidth / 2, 46, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Exercice Académique 2025-2026 • Document édité le ${todayStr} à ${timeStr} par ${data.generatedBy}`,
    pageWidth / 2,
    51,
    { align: 'center' }
  );

  // 2. Bloc synthèse : Trésorerie disponible vs Créances scolarité isolées (Section 3.G)
  const boxY = 58;
  const colWidth = (pageWidth - 28 - 4) / 2;

  // Box Gauche : Disponible Immédiat
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, colWidth, 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('TRÉSORERIE DISPONIBLE IMMÉDIATE (ENCAISSÉE)', 18, boxY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(16, 185, 129); // emerald
  doc.text(formatFCFA(data.totalAvailable), 18, boxY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `• Caisse physique guichet : ${formatFCFA(data.cashPhysical)}`,
    18,
    boxY + 17
  );
  doc.text(
    `• Soldes bancaires (CBAO / Ecobank) : ${formatFCFA(data.availableBank)}`,
    18,
    boxY + 22
  );

  // Box Droite : Créances Scolarité Isolées (Règle d'or Section 3.G)
  const boxRightX = 14 + colWidth + 4;
  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(253, 224, 71); // amber-300
  doc.roundedRect(boxRightX, boxY, colWidth, 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('CRÉANCES SCOLARITÉ ISOLÉES (SECTION 3.G)', boxRightX + 4, boxY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(formatFCFA(data.totalStudentReceivables), boxRightX + 4, boxY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(146, 64, 14);
  doc.text(
    'Règle d’intégrité : Ces créances ne constituent pas de la',
    boxRightX + 4,
    boxY + 17
  );
  doc.text(
    'trésorerie disponible tant qu’elles ne sont pas encaissées.',
    boxRightX + 4,
    boxY + 21
  );

  // 3. Tableau des Projections de Trésorerie à 30, 60 et 90 Jours
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('TABLEAU DE BORD PRÉVISIONNEL MULTI-HORIZONS (30, 60 & 90 JOURS)', 14, 90);

  const tableStartY = 93;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'right',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 65 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    head: [
      [
        'Rubriques Financières',
        'Disponible Actuel',
        'Horizon +30j',
        'Horizon +60j',
        'Horizon +90j',
      ],
    ],
    body: [
      [
        '1. Solde Initial de Période',
        formatFCFA(data.totalAvailable),
        formatFCFA(data.totalAvailable),
        formatFCFA(data.projectedBalance30),
        formatFCFA(data.projectedBalance60),
      ],
      [
        '+ Encaissements Confirmés (Échéanciers Inscrits)',
        '-',
        `+ ${formatFCFA(data.confirmedIn30)}`,
        `+ ${formatFCFA(data.confirmedIn60)}`,
        `+ ${formatFCFA(data.confirmedIn90)}`,
      ],
      [
        '+ Encaissements Prévisionnels (Nouvelles Inscriptions)',
        '-',
        `+ ${formatFCFA(data.estimatedIn30)}`,
        `+ ${formatFCFA(data.estimatedIn60)}`,
        `+ ${formatFCFA(data.estimatedIn90)}`,
      ],
      [
        '- Dettes Fournisseurs & Décaissements Planifiés',
        '-',
        `- ${formatFCFA(data.debtsDue30)}`,
        `- ${formatFCFA(data.debtsDue60)}`,
        `- ${formatFCFA(data.debtsDue90)}`,
      ],
      [
        '- Salaires Permanents & Charges Fixes d’Exploitation',
        '-',
        `- ${formatFCFA(data.fixedChargesPerMonth)}`,
        `- ${formatFCFA(data.fixedChargesPerMonth)}`,
        `- ${formatFCFA(data.fixedChargesPerMonth)}`,
      ],
      [
        'SOLDE NET PROJETÉ DE TRÉSORERIE',
        formatFCFA(data.totalAvailable),
        formatFCFA(data.projectedBalance30),
        formatFCFA(data.projectedBalance60),
        formatFCFA(data.projectedBalance90),
      ],
    ],
    didParseCell: (hookData) => {
      // Colorer la ligne finale du Solde Net Projeté
      if (hookData.section === 'body' && hookData.row.index === 5) {
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  // 4. Détails Analytiques (Ventilation des Encaissements & Décaissements)
  const currentY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('VENTILATION DES ENCAISSEMENTS & DES STADES DE DÉPENSES', 14, currentY);

  // Calculs ventilations
  const waveTotal = data.receipts
    .filter((r) => r.status === 'valide' && r.paymentMethod === 'wave')
    .reduce((s, r) => s + r.amount, 0);
  const omTotal = data.receipts
    .filter((r) => r.status === 'valide' && r.paymentMethod === 'orange_money')
    .reduce((s, r) => s + r.amount, 0);
  const cashTotal = data.receipts
    .filter((r) => r.status === 'valide' && r.paymentMethod === 'especes')
    .reduce((s, r) => s + r.amount, 0);
  const bankTransferTotal = data.receipts
    .filter((r) => r.status === 'valide' && (r.paymentMethod === 'virement' || r.paymentMethod === 'cheque'))
    .reduce((s, r) => s + r.amount, 0);

  const expPrevue = data.expenses
    .filter((e) => e.stage === 'prevue')
    .reduce((s, e) => s + e.amount, 0);
  const expConstatee = data.expenses
    .filter((e) => e.stage === 'dette_constatee')
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);
  const expOrdonnee = data.expenses
    .filter((e) => e.stage === 'paiement_ordonne')
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);
  const expRealisee = data.expenses
    .filter((e) => e.stage === 'decaissement_realise')
    .reduce((s, e) => s + e.paidAmount, 0);

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.2,
    },
    head: [
      ['Canal d’Encaissement Valide', 'Total (FCFA)', 'Stade de Dépense Fournisseur (4 Étapes)', 'Montant (FCFA)'],
    ],
    body: [
      ['Wave Sénégal (Mobile Money)', formatFCFA(waveTotal), '1. Dépenses prévues (engagements)', formatFCFA(expPrevue)],
      ['Orange Money Sénégal', formatFCFA(omTotal), '2. Dettes constatées (factures reçues)', formatFCFA(expConstatee)],
      ['Guichet Caisse Espèces', formatFCFA(cashTotal), '3. Paiements ordonnancés (bons)', formatFCFA(expOrdonnee)],
      ['Virements & Chèques bancaires', formatFCFA(bankTransferTotal), '4. Décaissements réalisés (débités)', formatFCFA(expRealisee)],
    ],
  });

  // 5. Bloc de conformité, signatures et visa
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Encadré de certification
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, finalY, pageWidth - 28, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('CERTIFICATION D’EXACTITUDE & CONFORMITÉ MESRI / OHADA :', 18, finalY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `Nous certifions que les données de trésorerie et créances susmentionnées reflètent fidèlement les écritures`,
    18,
    finalY + 8
  );
  doc.text(
    `comptables et sessions de caisse certifiées de l'établissement pour la période en cours.`,
    18,
    finalY + 11.5
  );

  // Signatures
  const signY = finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('Le Chef du Service Comptabilité & Finances', 25, signY);
  doc.text('L’Administrateur & Direction Générale', pageWidth - 80, signY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text('Visa & Vérification interne', 25, signY + 4);
  doc.text(`Signataire certifié : ${data.generatedBy}`, pageWidth - 80, signY + 4);

  // Lignes de signature / cachet
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('[Signature & Visa]', 25, signY + 16);
  doc.text('[Signature & Cachet Établissement]', pageWidth - 80, signY + 16);

  // 6. Pied de page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `Institut Supérieur des Métiers du Numérique et du Management • Système de Pilotage Académique & Financier`,
    14,
    pageHeight - 6
  );
  doc.text(
    `Page 1 / 1 • Certifié conforme aux normes MESRI République du Sénégal`,
    pageWidth - 14,
    pageHeight - 6,
    { align: 'right' }
  );

  return doc;
}
