/**
 * High-performance parser for IdealSoft - Shop Control 9 PDF reports
 * Handles multi-line wrapped text, multi-word manufacturers, decimal quantities and Brazilian currency format.
 */

export interface ParsedProduct {
  code: string;
  name: string;
  additionalCode: string;
  stock: number;
  manufacturer: string;
  price: number;
}

// Known multi-word and standard manufacturers from Shop Control 9 catalog (sorted by length desc)
const KNOWN_MANUFACTURERS = [
  'ALUMINIO OLIVEIRA',
  'CURVA E COBRE',
  'DE PLASTIC',
  'FUTURO BRASIL',
  'MILL INDUSTRIA',
  'ORIGINAL LINE',
  'SANTA MARINA',
  'SOFT WORKS',
  'TECNOLATINA',
  'AR DA TERRA',
  'FULL GAUGE',
  'LAR PLASTICOS',
  'MIMO STYLE',
  'R. BAIAO',
  'R BAIAO',
  'G PANIZ',
  'CP PLACAS',
  'GP CLEAR',
  'GP INOX',
  'ITA METAL',
  'EURO INOX',
  'ACM PLAST',
  'LOREN SID',
  'WHIRLPOOL',
  'ELECTROLUX',
  'DISTRIBUID',
  'CRISTALIA',
  'CRISTALACO',
  'TRAMONTINA',
  'MARCAMIX',
  'MARTIPLAST',
  'SUPERCRON',
  'MARCHESONI',
  'ESMALTEC',
  'VENTISOL',
  'VENANCIO',
  'BRALIMPIA',
  'PLASUTIL',
  'HERCULES',
  'SAMATEC',
  'SPRINGER',
  'SCHMIDT',
  'GERMER',
  'LUMINARC',
  'VITALEX',
  'BOLIVAR',
  'DIVERSOS',
  'ANODILAR',
  'ALEMTEX',
  'AQUAPLUS',
  'TOPPLAST',
  'CADENCE',
  'MONDIAL',
  'STARRET',
  'PROGAS',
  'FRICON',
  'FRIVEN',
  'POLAR',
  'BERMAR',
  'BRAESI',
  'EDANCA',
  'INVICTA',
  'SULFISA',
  'POLOFRIO',
  'ALLISSAN',
  'URUMAX',
  'RAMUZA',
  'TOLEDO',
  'BALMAK',
  'EMICOL',
  'ZUFER',
  'ALADO',
  'ELGIN',
  'GREASE',
  'GREE',
  'IBBL',
  'ILPEA',
  'IGLU',
  'KOMECO',
  'NIGRO',
  'NADIR',
  'OXFORD',
  'PRONYL',
  'RAVID',
  'BRINOX',
  'RICAELLE',
  'SIEMSEN',
  'APANOX',
  'SERVI-FIX',
  'NEW-FIX',
  'FUMIL',
  'MAGNA',
  'CISPER',
  'KABALLA',
  'LOTUS',
  'GEDEX',
  'DANFOSS',
  'HEATCRAFT',
  'ARMACELL',
  'EMMETI',
  'INDUSMACK',
  'KNOX',
  'FRISBEL',
  'LIBELL',
  'VENTECH',
  'COEL',
  'CARRIER',
  'EMBRACO',
  'TERMISSA',
  'TERMISA',
  'TEDESCO',
  'ARGE',
  'ARBEL',
  'BACKER',
  'BARPRO',
  'CIV',
  'CAMBE',
  'JAGUAR',
  'MOR',
  'MAPLAN',
  'JSN',
  'IBAP',
  'ITC',
  'INAPS',
  'INNAL',
  'IMECA',
  'APAS',
  'AGT',
  'ABC',
  'ACS',
  'AKX',
  'RIC',
  'TITA',
  'VISA',
];

function parseBrazilianNumber(val: string): number {
  if (!val) return 0;
  let s = val.trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function isHeaderOrFooter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith('Código') ||
    trimmed.startsWith('Nome do Produto') ||
    trimmed.startsWith('CAMPOS') ||
    trimmed.startsWith('Equipamentos') ||
    trimmed.startsWith('Total de Registros') ||
    trimmed.includes('IdealSoft - Shop Control') ||
    /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function isContinuationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isHeaderOrFooter(trimmed)) return false;

  const parts = trimmed.split(/\s+/);
  // Matches trailing wrapped lines like '1 PROGAS 3.462,00' or '0 ELGIN 54,10' or 'KGP44065 0 PROGAS 2.889,00'
  if (parts.length <= 4 && /\d+,\d{2,4}$/.test(parts[parts.length - 1])) {
    return true;
  }
  // Matches wrapped single tokens like '603FCH37406' or '1' or 'COBRE'
  if (parts.length === 1 && !/^\d{3,8}$/.test(parts[0])) {
    return true;
  }
  return false;
}

export function parseIdealSoftPdfText(fullText: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  const lines = fullText.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    i++;

    if (isHeaderOrFooter(line)) continue;

    // A valid new product row starts with a product code (1 to 8 digits) followed by a space and product description
    const match = line.match(/^(\d{1,8})\s+(.+)$/);
    if (!match) continue;

    // Check if this line is accidentally a continuation of a previous broken line
    if (isContinuationLine(line)) continue;

    const code = match[1];
    let remainder = match[2].trim();

    // Read subsequent lines if they are continuations of this product
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (!nextLine) {
        i++;
        continue;
      }
      if (isHeaderOrFooter(nextLine)) {
        i++;
        continue;
      }

      // If next line is a continuation line or if current remainder doesn't end with a valid price
      const hasPriceAtEnd = /\s+[0-9.]+,[0-9]{2,4}\s*$/.test(remainder);
      if (!hasPriceAtEnd || isContinuationLine(nextLine)) {
        remainder += ' ' + nextLine;
        i++;
      } else {
        break;
      }
    }

    // Now extract Price (last token in remainder)
    const priceMatch = remainder.match(/\s+([0-9.]+,[0-9]{2,4})\s*$/);
    if (!priceMatch) continue;

    const price = parseBrazilianNumber(priceMatch[1]);
    let beforePrice = remainder.substring(0, remainder.length - priceMatch[0].length).trim();

    // Extract Manufacturer
    let manufacturer = 'GERAL';
    let foundMfr = '';

    for (const mfr of KNOWN_MANUFACTURERS) {
      const regex = new RegExp(`(?:\\s+|^)(${mfr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*$`, 'i');
      const m = beforePrice.match(regex);
      if (m && m.index !== undefined) {
        foundMfr = m[1].toUpperCase();
        beforePrice = beforePrice.substring(0, m.index).trim();
        break;
      }
    }

    if (foundMfr) {
      manufacturer = foundMfr;
    } else {
      const lastWordMatch = beforePrice.match(/\s+([A-Z0-9.\-_/]+)\s*$/);
      if (lastWordMatch) {
        manufacturer = lastWordMatch[1].toUpperCase();
        beforePrice = beforePrice.substring(0, beforePrice.length - lastWordMatch[0].length).trim();
      }
    }

    // Extract Stock
    let stock = 0;
    const stockMatch = beforePrice.match(/\s+(-?[0-9]+(?:,[0-9]+)?)\s*$/);
    if (stockMatch) {
      stock = parseBrazilianNumber(stockMatch[1]);
      beforePrice = beforePrice.substring(0, beforePrice.length - stockMatch[0].length).trim();
    }

    // Extract Additional Code & Product Name
    let additionalCode = '-';
    let name = '';

    const tokens = beforePrice.split(/\s+/);
    if (tokens.length >= 2) {
      const lastToken = tokens[tokens.length - 1];
      const isMixedAlphaNum = /(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9_-]{3,}/i.test(lastToken);
      const isSeparatedCode = /^[A-Za-z0-9]{1,10}[-_./][A-Za-z0-9._/-]+$/i.test(lastToken);
      const isReferenceNumber = /^\d{2,8}$/.test(lastToken) && tokens.length > 2;

      if (isMixedAlphaNum || isSeparatedCode || isReferenceNumber) {
        additionalCode = lastToken;
        name = tokens.slice(0, tokens.length - 1).join(' ').trim();
      } else {
        name = beforePrice;
      }
    } else {
      name = beforePrice;
    }

    const cleanCode = code.replace(/#/g, '').trim();
    const cleanName = name.replace(/#/g, '').trim().toUpperCase();

    if (cleanCode && cleanName) {
      products.push({
        code: cleanCode,
        name: cleanName,
        additionalCode: additionalCode.replace(/#/g, '').trim() || '-',
        stock,
        manufacturer: manufacturer.replace(/#/g, '').trim() || 'GERAL',
        price,
      });
    }
  }

  return products;
}
