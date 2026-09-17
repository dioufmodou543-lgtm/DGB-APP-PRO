import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { DiplomaCertificate, EstablishmentConfig, Program, StudentAdmission } from '../types';

interface DiplomaPdfParams {
  diploma: DiplomaCertificate;
  student: StudentAdmission;
  program?: Program;
  config: EstablishmentConfig;
}

// Generate QR Code data URL asynchronously
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 150,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}

/**
 * Generates an official Diploma (Landscape A4) or Attestation (Portrait A4)
 */
export async function generateDiplomaPdf({
  diploma,
  student,
  program,
  config,
}: DiplomaPdfParams): Promise<jsPDF> {
  const isLandscapeDiploma =
    diploma.type === 'diplome_licence' ||
    diploma.type === 'diplome_master' ||
    diploma.type === 'certificat_specialise';

  if (isLandscapeDiploma) {
    return await generateOfficialDiplomaLandscape({ diploma, student, program, config });
  } else {
    return await generateOfficialAttestationPortrait({ diploma, student, program, config });
  }
}

/**
 * 1. OFFICIAL DIPLOMA (LANDSCAPE A4 - PARCHEMIN OFFICIEL)
 */
async function generateOfficialDiplomaLandscape({
  diploma,
  student,
  program,
  config,
}: DiplomaPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // Colors
  const deepNavy = [15, 23, 42]; // #0f172a
  const goldPrimary = [180, 83, 9]; // #b45309
  const goldSecondary = [217, 119, 6]; // #d97706
  const emeraldAccent = [5, 150, 105]; // #059669
  const softSlate = [71, 85, 105]; // #475569
  const borderParchment = [245, 243, 238];

  // Background Parchment tint
  doc.setFillColor(borderParchment[0], borderParchment[1], borderParchment[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Outer Guilloche / Golden Border
  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setLineWidth(1.8);
  doc.rect(9, 9, pageWidth - 18, pageHeight - 18);

  // Inner Fine Navy Border
  doc.setDrawColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.setLineWidth(0.6);
  doc.rect(12.5, 12.5, pageWidth - 25, pageHeight - 25);

  // Decorative Corner Rosettes
  const corners = [
    { x: 12.5, y: 12.5 },
    { x: pageWidth - 12.5, y: 12.5 },
    { x: 12.5, y: pageHeight - 12.5 },
    { x: pageWidth - 12.5, y: pageHeight - 12.5 },
  ];
  corners.forEach((c) => {
    doc.setDrawColor(goldSecondary[0], goldSecondary[1], goldSecondary[2]);
    doc.setLineWidth(0.5);
    doc.circle(c.x, c.y, 3.5, 'S');
    doc.circle(c.x, c.y, 1.5, 'S');
  });

  // Top National Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.text('Un Peuple — Un But — Une Foi', pageWidth / 2, 24, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(
    'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L’INNOVATION',
    pageWidth / 2,
    28.5,
    { align: 'center' }
  );

  // Left & Right Flag Accent Lines (Green, Gold, Red)
  const drawNationalStripes = (x: number, y: number) => {
    doc.setFillColor(34, 197, 94); // Green
    doc.rect(x, y, 9, 1.2, 'F');
    doc.setFillColor(234, 179, 8); // Gold
    doc.rect(x + 9, y, 9, 1.2, 'F');
    doc.setFillColor(239, 68, 68); // Red
    doc.rect(x + 18, y, 9, 1.2, 'F');
  };
  drawNationalStripes(20, 20);
  drawNationalStripes(pageWidth - 47, 20);

  // Security & Serial Box in Top Right
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(pageWidth - 78, 25, 62, 13, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.text('SÉRIE OFFICIELLE & CONTRÔLE MESRI', pageWidth - 76, 29);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text(diploma.serialNumber, pageWidth - 76, 33.5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(`Jeton : ${diploma.securityToken}`, pageWidth - 76, 36.5);

  // Establishment Block (Center)
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT', pageWidth / 2, 38, {
    align: 'center',
  });

  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(goldSecondary[0], goldSecondary[1], goldSecondary[2]);
  doc.text('ISMNM DAKAR • Établissement d’Enseignement Supérieur Privé Agréé', pageWidth / 2, 42.5, {
    align: 'center',
  });

  const accreditationText = program?.accreditationRef || config.accreditationNumber || 'Arrêté Ministériel MESRI N° 004812/2021';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(`Agrément & Habilitation : ${accreditationText}`, pageWidth / 2, 46.5, {
    align: 'center',
  });

  // Title Ribbon / Banner
  let diplomaTitle = diploma.title.toUpperCase();
  if (diploma.type === 'diplome_licence') {
    diplomaTitle = 'DIPLÔME DE LICENCE PROFESSIONNELLE';
  } else if (diploma.type === 'diplome_master') {
    diplomaTitle = 'DIPLÔME DE MASTER PROFESSIONNEL';
  } else if (diploma.type === 'certificat_specialise') {
    diplomaTitle = 'CERTIFICAT SUPÉRIEUR DE SPÉCIALISATION';
  }

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(40, 52, pageWidth - 80, 14, 2, 2, 'F');
  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(41, 53, pageWidth - 82, 12, 1.5, 1.5, 'S');

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(250, 204, 21); // Bright Gold text
  doc.text(diplomaTitle, pageWidth / 2, 60.5, { align: 'center' });

  // Preamble Text
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(
    'Le Directeur Général et le Président du Jury de délibération de l’Institut Supérieur des Métiers du Numérique et du Management,',
    pageWidth / 2,
    72,
    { align: 'center' }
  );
  doc.text(
    `Vu la loi n° 2011-05 relative au système LMD, vu le procès-verbal de délibération du jury en date du ${diploma.deliberationDate} (Réf : ${diploma.deliberationPvNumber}),`,
    pageWidth / 2,
    76.5,
    { align: 'center' }
  );
  doc.text(
    `constatant que l’étudiant a validé l’intégralité des ${diploma.totalCreditsEarned} crédits ECTS requis par la maquette pédagogique habilitée,`,
    pageWidth / 2,
    81,
    { align: 'center' }
  );

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(10.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('Confèrent le présent diplôme à :', pageWidth / 2, 88.5, { align: 'center' });

  // Recipient Box
  const recipientName = `${student.firstName.toUpperCase()} ${student.lastName.toUpperCase()}`;
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.text(recipientName, pageWidth / 2, 97.5, { align: 'center' });

  // Thin separator under name
  doc.setDrawColor(goldSecondary[0], goldSecondary[1], goldSecondary[2]);
  doc.setLineWidth(0.5);
  doc.line(75, 100, pageWidth - 75, 100);

  // Student Details
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  const birthDetails = `Né(e) le ${student.birthDate || '—'} à ${student.birthPlace || 'Dakar'}   •   Nationalité : ${student.nationality || 'Sénégalaise'}`;
  doc.text(birthDetails, pageWidth / 2, 105.5, { align: 'center' });

  const matriculeAndCni = `Matricule Académique : ${student.matricule}   •   CNI / Passeport : ${student.cniPassport || 'Conforme dossier'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(matriculeAndCni, pageWidth / 2, 110, { align: 'center' });

  // Degree Specialization & Mention
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  const specText = diploma.specialization || program?.title || 'Informatique & Télécoms';
  doc.text(`Discipline & Spécialité : ${specText}`, pageWidth / 2, 118, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(emeraldAccent[0], emeraldAccent[1], emeraldAccent[2]);
  doc.text(
    `Mention : ${diploma.mention.toUpperCase()}   (Moyenne Générale Pondérée : ${diploma.finalAverage.toFixed(2)} / 20)`,
    pageWidth / 2,
    124,
    { align: 'center' }
  );

  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(
    'Pour en jouir avec tous les droits, prérogatives et immunités attachés aux diplômes de l’enseignement supérieur.',
    pageWidth / 2,
    130,
    { align: 'center' }
  );

  // Date and place of delivery
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text(`Délivré à Dakar, en République du Sénégal, le ${diploma.deliveryDate}`, pageWidth / 2, 137, {
    align: 'center',
  });

  // Signatures Section (3 columns)
  const signY = 145;

  // Signer 1: President of the Jury
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('Le Président du Jury', 40, signY);
  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(diploma.juryPresident, 40, signY + 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('[Signature & Visa]', 40, signY + 16);

  // Signer 2: Registrar / Scolarité
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('Le Chef des Services Académiques', pageWidth / 2 - 25, signY);
  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(diploma.registrarName, pageWidth / 2 - 25, signY + 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('[Signature & Visa]', pageWidth / 2 - 25, signY + 16);

  // Signer 3: General Director / Dean
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('La Directrice Générale de l’Institut', pageWidth - 80, signY);
  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(diploma.directorName, pageWidth - 80, signY + 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('[Signature & Grand Sceau Officiel]', pageWidth - 80, signY + 16);

  // Official Seal Vector Impression (Center Bottom)
  const sealCenterX = pageWidth / 2;
  const sealCenterY = 173;
  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setLineWidth(0.8);
  doc.circle(sealCenterX, sealCenterY, 11, 'S');
  doc.setLineWidth(0.3);
  doc.circle(sealCenterX, sealCenterY, 9.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.text('ISMNM DAKAR', sealCenterX, sealCenterY - 4.5, { align: 'center' });
  doc.text('SCEAU OFFICIEL', sealCenterX, sealCenterY - 1, { align: 'center' });
  doc.text('RÉP. DU SÉNÉGAL', sealCenterX, sealCenterY + 2.5, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('★ ★ ★', sealCenterX, sealCenterY + 6, { align: 'center' });

  // QR Code Generation in Bottom Left
  const qrDataUrl = await generateQrDataUrl(
    diploma.qrVerificationData ||
      `https://ismnm-dakar.sn/verify?sn=${diploma.serialNumber}&token=${diploma.securityToken}`
  );
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 16, pageHeight - 44, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
    doc.text('SCANNEZ POUR VÉRIFIER', 29, pageHeight - 15.5, { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
    doc.text(diploma.securityToken, 29, pageHeight - 13, { align: 'center' });
  }

  // Bottom Micro-text Anti-fraud Notice
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(softSlate[0], softSlate[1], softSlate[2]);
  doc.text(
    `Document académique original sécurisé • Réf. PV : ${diploma.deliberationPvNumber} • N° de Série Officiel : ${diploma.serialNumber}`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );
  doc.text(
    'Toute surcharge ou falsification du présent titre officiel entraîne des poursuites pénales conformément aux dispositions du Code Pénal de la République du Sénégal.',
    pageWidth / 2,
    pageHeight - 9,
    { align: 'center' }
  );

  return doc;
}

/**
 * 2. OFFICIAL ATTESTATION (PORTRAIT A4 - MESRI STANDARDS)
 */
async function generateOfficialAttestationPortrait({
  diploma,
  student,
  program,
  config,
}: DiplomaPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm

  const deepNavy = [15, 23, 42];
  const royalBlue = [30, 58, 138];
  const goldPrimary = [180, 83, 9];
  const slateGray = [71, 85, 105];

  // Subtle Border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.setLineWidth(0.25);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Top National Header
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
  doc.text('Un Peuple — Un But — Une Foi', pageWidth / 2, 24, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE ET DE L’INNOVATION',
    pageWidth / 2,
    28,
    { align: 'center' }
  );

  // Institution Logo / Letterhead
  doc.setDrawColor(226, 232, 240);
  doc.line(16, 32, pageWidth - 16, 32);

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
  doc.text('INSTITUT SUPÉRIEUR DES MÉTIERS DU NUMÉRIQUE ET DU MANAGEMENT', pageWidth / 2, 38, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `Établissement Privé d’Enseignement Supérieur Agréé MESRI • Réf. Agrément : ${config.accreditationNumber || 'MESRI/DIPES/004812'}`,
    pageWidth / 2,
    42.5,
    { align: 'center' }
  );
  doc.text(
    `${config.address} - ${config.city} (${config.country}) • Tél: ${config.phone} • Email: ${config.email}`,
    pageWidth / 2,
    46.5,
    { align: 'center' }
  );

  // Serial Number Badge
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(royalBlue[0], royalBlue[1], royalBlue[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(pageWidth - 78, 52, 64, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
  doc.text('RÉGISTRE OFFICIEL MESRI', pageWidth - 75, 56.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text(diploma.serialNumber, pageWidth - 75, 61);

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(`Jeton Sécurisé : ${diploma.securityToken}`, pageWidth - 75, 64.5);

  // Title of Attestation
  const isAttestationReussite = diploma.type === 'attestation_reussite';
  const attestationTitle = isAttestationReussite
    ? 'ATTESTATION PROVISOIRE DE RÉUSSITE'
    : 'ATTESTATION D’INSCRIPTION ET D’ASSIDUITÉ';

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(25, 74, pageWidth - 50, 13, 2, 2, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(attestationTitle, pageWidth / 2, 82, { align: 'center' });

  // Body of Attestation
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);

  let y = 98;
  doc.text(
    'Le Directeur Général de l’Institut Supérieur des Métiers du Numérique et du Management (ISMNM Dakar),',
    18,
    y
  );
  y += 6;
  doc.text('soussigné, atteste par la présente que :', 18, y);
  y += 10;

  // Student Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(18, y, pageWidth - 36, 36, 2, 2, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
  doc.text(`${student.firstName} ${student.lastName.toUpperCase()}`, 24, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text(`Né(e) le : ${student.birthDate || '—'} à ${student.birthPlace || 'Dakar'}`, 24, y + 15);
  doc.text(`Nationalité : ${student.nationality || 'Sénégalaise'}`, 24, y + 21);
  doc.text(`Matricule Étudiant : ${student.matricule}`, 24, y + 27);
  doc.text(`CNI / Passeport : ${student.cniPassport || 'Conforme'}`, 110, y + 27);

  y += 46;

  // Attestation narrative
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);

  if (isAttestationReussite) {
    doc.text(
      `A subi avec succès les examens et soutenances de fin de cycle au titre de l’année académique ${diploma.academicYearId.replace('year_', '').replace('_', '-')},`,
      18,
      y
    );
    y += 6;
    doc.text(
      `constatés par le procès-verbal de délibération du jury en date du ${diploma.deliberationDate} (Réf : ${diploma.deliberationPvNumber}).`,
      18,
      y
    );
    y += 10;

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
    doc.text(`Diplôme Postulé : ${diploma.title}`, 18, y);
    y += 6;
    doc.text(`Filière / Spécialisation : ${diploma.specialization || program?.title || 'Informatique & Télécoms'}`, 18, y);
    y += 6;
    doc.setFontSize(10.5);
    doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2]);
    doc.text(
      `Mention : ${diploma.mention.toUpperCase()}   •   Moyenne Générale : ${diploma.finalAverage.toFixed(2)} / 20   •   Crédits ECTS : ${diploma.totalCreditsEarned} / ${diploma.totalCreditsEarned}`,
      18,
      y
    );
    y += 12;

    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text(
      'La présente attestation provisoire est délivrée à l’intéressé(e) pour servir et valoir ce que de droit,',
      18,
      y
    );
    y += 5;
    doc.text('en attendant l’établissement et la délivrance définitive du parchemin du diplôme officiel.', 18, y);
    y += 5;
    doc.text('Il n’est délivré qu’un seul exemplaire original de la présente attestation.', 18, y);
  } else {
    doc.text(
      `Est régulièrement inscrit(e) et assidu(e) aux enseignements théoriques, travaux dirigés et projets pratiques`,
      18,
      y
    );
    y += 6;
    doc.text(`au sein de notre établissement pour l’année académique en cours.`, 18, y);
    y += 10;

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
    doc.text(`Programme d’Études : ${program?.title || diploma.title}`, 18, y);
    y += 6;
    doc.text(`Niveau d’Études : ${program?.yearLevel || 'En cours'} • Domaine : ${program?.domain || 'Technologies'}`, 18, y);
    y += 12;

    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text('En foi de quoi, la présente attestation lui est délivrée sur sa demande pour servir et valoir ce que de droit.', 18, y);
  }

  y += 16;
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text(`Fait à Dakar, le ${diploma.deliveryDate}`, 18, y);

  // Signatures Section
  const signY = y + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(deepNavy[0], deepNavy[1], deepNavy[2]);
  doc.text('Le Chef du Service de la Scolarité', 24, signY);
  doc.text('La Directrice Générale de l’Institut', pageWidth - 84, signY);

  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(diploma.registrarName, 24, signY + 5);
  doc.text(diploma.directorName, pageWidth - 84, signY + 5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('[Signature & Visa]', 24, signY + 20);
  doc.text('[Signature & Cachet Officiel]', pageWidth - 84, signY + 20);

  // QR Code on bottom left
  const qrDataUrl = await generateQrDataUrl(
    diploma.qrVerificationData ||
      `https://ismnm-dakar.sn/verify?sn=${diploma.serialNumber}&token=${diploma.securityToken}`
  );
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 18, pageHeight - 48, 24, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(royalBlue[0], royalBlue[1], royalBlue[2]);
    doc.text('CONTRÔLE D’AUTHENTICITÉ', 18, pageHeight - 21);
    doc.setFont('courier', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
    doc.text(`SN: ${diploma.serialNumber}`, 18, pageHeight - 18);
  }

  // Footer Note
  doc.setDrawColor(226, 232, 240);
  doc.line(16, pageHeight - 14, pageWidth - 16, pageHeight - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
  doc.text(
    `ISMNM Dakar • Système National de Certification MESRI • Exemplaire Imprimé N° ${diploma.printCount || 1}`,
    16,
    pageHeight - 9
  );
  doc.text(
    `Vérification en ligne sur www.ismnm-dakar.sn/verify`,
    pageWidth - 16,
    pageHeight - 9,
    { align: 'right' }
  );

  return doc;
}
