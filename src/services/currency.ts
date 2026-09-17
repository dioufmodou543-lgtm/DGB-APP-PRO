/**
 * Service de calcul financier et formattage monétaire en FCFA (XOF).
 * Conformément aux règles d'intégrité financière du cahier des charges :
 * - Les montants en FCFA n'ont pas de centimes et doivent être traités en nombres entiers stricts.
 * - Aucune opération à virgule flottante pour éviter les erreurs d'arrondi.
 */

export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount || 0);
  return new Intl.NumberFormat('fr-SN', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);
}

export function formatInteger(amount: number): string {
  const rounded = Math.round(amount || 0);
  return new Intl.NumberFormat('fr-SN', {
    maximumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Règle de calcul officielle :
 * Reste dû d'une facture = Montant net facturé - Paiements valides affectés - Avoirs valides
 */
export function calculateBalanceDue(
  netAmount: number,
  validPayments: number,
  validCredits: number = 0
): number {
  const net = Math.round(netAmount || 0);
  const paid = Math.round(validPayments || 0);
  const credits = Math.round(validCredits || 0);
  const balance = net - paid - credits;
  return balance > 0 ? balance : 0;
}

/**
 * Calcul du montant net facturé :
 * Montant net = Montant brut - Remise accordée validée
 */
export function calculateNetAmount(grossAmount: number, discountAmount: number = 0): number {
  const gross = Math.round(grossAmount || 0);
  const discount = Math.round(discountAmount || 0);
  return Math.max(0, gross - discount);
}

/**
 * Conversion d'un montant FCFA en lettres françaises pour les reçus officiels.
 */
export function numberToFrenchWords(n: number): string {
  const num = Math.round(Math.abs(n || 0));
  if (num === 0) return 'zéro Franc CFA';

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = [
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
    'dix-sept',
    'dix-huit',
    'dix-neuf',
  ];
  const tens = [
    '',
    'dix',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante-dix',
    'quatre-vingts',
    'quatre-vingt-dix',
  ];

  function convertGroup(val: number): string {
    let result = '';
    const hundreds = Math.floor(val / 100);
    const rem = val % 100;

    if (hundreds > 0) {
      if (hundreds === 1) {
        result += 'cent ';
      } else {
        result += units[hundreds] + ' cent ';
      }
    }

    if (rem > 0) {
      if (rem < 10) {
        result += units[rem];
      } else if (rem < 20) {
        result += teens[rem - 10];
      } else {
        const t = Math.floor(rem / 10);
        const u = rem % 10;
        if (t === 7) {
          result += 'soixante-' + (u === 1 ? 'et-onze' : teens[u]);
        } else if (t === 9) {
          result += 'quatre-vingt-' + teens[u];
        } else {
          result += tens[t];
          if (u === 1 && t !== 8) {
            result += '-et-un';
          } else if (u > 0) {
            result += '-' + units[u];
          }
        }
      }
    }

    return result.trim();
  }

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  const parts: string[] = [];

  if (millions > 0) {
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(convertGroup(millions) + ' millions');
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      parts.push(convertGroup(thousands) + ' mille');
    }
  }

  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  const rawWords = parts.join(' ').trim();
  const capitalized = rawWords.charAt(0).toUpperCase() + rawWords.slice(1);
  return `${capitalized} Francs CFA`;
}

/**
 * Calcul du solde théorique de caisse :
 * Solde théorique = Fond initial + Entrées d'espèces - Sorties d'espèces
 */
export function calculateCashTheoreticalBalance(
  initialCash: number,
  cashIn: number,
  cashOut: number
): number {
  return Math.round(initialCash || 0) + Math.round(cashIn || 0) - Math.round(cashOut || 0);
}
