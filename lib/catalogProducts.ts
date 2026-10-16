export interface CatalogProduct {
  id: string;
  code: string;
  name: string;
  additionalCode: string;
  stock: number;
  manufacturer: string;
  price: number;
  category?: string;
}

export function inferCategory(name: string, manufacturer: string): string {
  const n = (name || '').toUpperCase();

  if (n.includes('AR CONDICIONADO') || n.includes('SPLIT') || n.includes('INVERTER') || n.includes('EVAPORADOR') || n.includes('CONDENSADORA') || n.includes('TURBINA EVAP') || n.includes('SERPENTINA')) {
    return 'Climatização & Ar';
  }
  if (n.includes('GAS REFRIGERANTE') || n.includes('R-134A') || n.includes('R-404A') || n.includes('R-410A') || n.includes('R-22') || n.includes('R-290') || n.includes('R-32') || n.includes('R-600A')) {
    return 'Gases Refrigerantes';
  }
  if (n.includes('FREEZER') || n.includes('VITRINE') || n.includes('CERVEJEIRA') || n.includes('ILHA HORIZ') || n.includes('FRIGOBAR') || n.includes('AUTO SERVICO')) {
    return 'Refrigeração Comercial';
  }
  if (n.includes('LAVADORA') || n.includes('LAVA E SECA') || n.includes('LAVA LOUCA') || n.includes('AGITADOR') || n.includes('MECANISMO') || n.includes('PRESSOSTATO') || n.includes('CAMBIO') || n.includes('ATUADOR DO FREIO') || n.includes('CORREIA')) {
    return 'Lavadoras & Secadoras';
  }
  if (n.includes('PLACA') || n.includes('TERMOSTATO') || n.includes('SENSOR') || n.includes('CAPACITOR') || n.includes('MICRO-MOTOR') || n.includes('MOTOR VENT') || n.includes('COMPRESSOR') || n.includes('RELE') || n.includes('FUSIVEL') || n.includes('MAGNETRON')) {
    return 'Componentes Elétricos';
  }
  if (n.includes('FOGAO') || n.includes('FORNO') || n.includes('CHAPA') || n.includes('FRITADOR') || n.includes('CAFETEIRA') || n.includes('AMASSADEIRA') || n.includes('BATEDEIRA') || n.includes('LIQUIDIFICADOR') || n.includes('SERRA FITA') || n.includes('CORTADOR DE FRIOS') || n.includes('PICADOR CARNE') || n.includes('MOENDA CANA') || n.includes('ESTUFA') || n.includes('BUFFET')) {
    return 'Gastronomia & Cocção';
  }
  if (n.includes('TUBO') || n.includes('MANGUEIRA') || n.includes('UNIAO') || n.includes('CONEXAO') || n.includes('VALVULA') || n.includes('PORCA') || n.includes('LOKRING') || n.includes('ADAPTADOR') || n.includes('FILTRO COBRE') || n.includes('COTOVELO')) {
    return 'Tubos, Conexões & Válvulas';
  }
  if (n.includes('FACA') || n.includes('GARFO') || n.includes('COLHER') || n.includes('PRATO') || n.includes('COPO') || n.includes('TACA') || n.includes('XICARA') || n.includes('CACAROLA') || n.includes('FRIGIDEIRA') || n.includes('CALDEIRAO') || n.includes('ASSADEIRA') || n.includes('CUBA') || n.includes('BANDEJA') || n.includes('TALHER') || n.includes('TIGELA') || n.includes('JARRA') || n.includes('SOCADOR') || n.includes('PLACA DE CORTE')) {
    return 'Utensílios & Hotelaria';
  }
  if (n.includes('BEBEDOURO') || n.includes('PURIFICADOR') || n.includes('REFIL') || n.includes('REFRESQUEIRA') || n.includes('ELEMENTO FILTRANTE') || n.includes('TORNEIRA')) {
    return 'Purificadores & Bebedouros';
  }
  if (n.includes('GAXETA') || n.includes('BORRACHA DE VEDACAO')) {
    return 'Gaxetas & Vedação';
  }
  if (n.includes('SAPATO') || n.includes('TENIS') || n.includes('MANTA') || n.includes('AVENTAL') || n.includes('LIXEIRA') || n.includes('CAIXA') || n.includes('BALDE') || n.includes('ESTRADO') || n.includes('FITA')) {
    return 'Acessórios & EPIs';
  }
  if (n.includes('ALICATE') || n.includes('CHAVE') || n.includes('MANIFOLD') || n.includes('FLANGEADOR') || n.includes('MACARICO') || n.includes('BOMBA DE VACUO') || n.includes('CURVADOR') || n.includes('BALANCA') || n.includes('SACA') || n.includes('SOLDA') || n.includes('TERMOMETRO')) {
    return 'Ferramentas & Instrumentos';
  }
  return 'Peças Gerais';
}

export const INITIAL_CATALOG_PRODUCTS: CatalogProduct[] = [
  // Página 1
  { id: '353', code: '353', name: 'CONCHA HOTEL N.09 ABC', additionalCode: '289', stock: 2, manufacturer: 'ABC', price: 18.70 },
  { id: '616', code: '616', name: 'FRIGIDEIRA RETA DOMEST N.20 S/TAMPA ABC', additionalCode: '758', stock: 2, manufacturer: 'ABC', price: 28.40 },
  { id: '622', code: '622', name: 'FRIGIDEIRA RETA DOMEST N.24 S/TAMPA ABC', additionalCode: '764', stock: 1, manufacturer: 'ABC', price: 36.10 },
  { id: '743', code: '743', name: 'HELICE PLAST CONSUL MASTER 10/21', additionalCode: '4210646', stock: 1, manufacturer: 'WHIRLPOOL', price: 161.80 },
  { id: '911', code: '911', name: 'FRIGIDEIRA 22 FRANCESINHA ALUMINIO ABC', additionalCode: '562', stock: 2, manufacturer: 'ABC', price: 47.40 },
  { id: '956', code: '956', name: 'TUBO DE COBRE FLEXIVEL 5/16', additionalCode: '429', stock: 2.226, manufacturer: 'DISTRIBUID', price: 152.90 },
  { id: '957', code: '957', name: 'TUBO DE COBRE FLEXIVEL 1/2', additionalCode: '431', stock: 55.545, manufacturer: 'DISTRIBUID', price: 152.90 },
  { id: '958', code: '958', name: 'TUBO DE COBRE FLEXIVEL 3/8', additionalCode: '430', stock: 81.705, manufacturer: 'DISTRIBUID', price: 152.90 },
  { id: '959', code: '959', name: 'TUBO DE COBRE FLEXIVEL 3/16"', additionalCode: '3-16POL', stock: 4.177, manufacturer: 'DISTRIBUID', price: 161.90 },
  { id: '960', code: '960', name: 'TUBO DE COBRE FLEXIVEL 5/8', additionalCode: '432', stock: 32.408, manufacturer: 'DISTRIBUID', price: 152.90 },
  { id: '961', code: '961', name: 'CONDENSADOR PARA FREEZER 2 X 8', additionalCode: 'D8417', stock: 1, manufacturer: 'DISTRIBUID', price: 54.60 },
  { id: '963', code: '963', name: 'CONDENSADOR PARA FREEZER 3 X 8 1/4HP', additionalCode: 'D8418', stock: 4, manufacturer: 'DISTRIBUID', price: 81.40 },
  { id: '1007', code: '1007', name: 'TUBO DE COBRE FLEXIVEL 1/4', additionalCode: '428', stock: 97.6276, manufacturer: 'DISTRIBUID', price: 152.90 },
  { id: '1147', code: '1147', name: 'COLHER SILICONE 25CM CABO INOX LARANJA CRISTALIA', additionalCode: 'SCOL-004', stock: 2, manufacturer: 'CRISTALIA', price: 19.10 },
  { id: '1329', code: '1329', name: 'CACAROLA DOMEST N.20 C/CABO BAQUELITE ABC', additionalCode: '743', stock: 1, manufacturer: 'ABC', price: 57.20 },
  { id: '1463', code: '1463', name: 'FILTRO COBRE MOLECULAR 1" 1/4 X 3/16 C/CAPILAR', additionalCode: '20003.1720.30', stock: 64, manufacturer: 'FRIVEN', price: 14.50 },
  { id: '1607', code: '1607', name: 'BATEDOR MANUAL 30CM INOX SILICONE BRASTEMP', additionalCode: 'BI904ARONA', stock: 1, manufacturer: 'WHIRLPOOL', price: 36.30 },
  { id: '1615', code: '1615', name: 'MICRO-MOTOR ELGIN 1/40 BIVOLT C/HELICE PLASTICA', additionalCode: '45MC11B08PCA', stock: 18, manufacturer: 'ELGIN', price: 65.90 },
  { id: '1640', code: '1640', name: 'MICRO-MOTOR ELGIN 1/25 BIVOLT C/HELICE PLASTICA', additionalCode: '45MC20B10PCA', stock: 7, manufacturer: 'ELGIN', price: 80.60 },
  { id: '1953', code: '1953', name: 'CUSCUZEIRO HOTEL N.22 ABC ALUMINIO', additionalCode: '402', stock: 3, manufacturer: 'ABC', price: 100.60 },
  { id: '2070', code: '2070', name: 'HELICE CONDENSADORA CBY 18/22+ CONSUL', additionalCode: '326058512', stock: 1, manufacturer: 'WHIRLPOOL', price: 149.90 },
  { id: '2137', code: '2137', name: 'FILTRO COBRE C/SILICA TRADICIONAL 3/4 90MM', additionalCode: '1016873', stock: 96, manufacturer: 'DISTRIBUID', price: 7.60 },
  { id: '2157', code: '2157', name: 'ADAPTADOR IMPERIAL 241 F 04 - 1/4 X 1/4', additionalCode: 'GT-241F04', stock: 1, manufacturer: 'FRIVEN', price: 34.00 },
  { id: '2181', code: '2181', name: 'FRIGIDEIRA 18 FRANCESINHA ABC ALUMINIO', additionalCode: '560', stock: 1, manufacturer: 'ABC', price: 30.10 },
  { id: '2299', code: '2299', name: 'TUBO DE COBRE RIGIDO 7/8"', additionalCode: '386', stock: 5.180, manufacturer: 'DISTRIBUID', price: 161.90 },
  { id: '2467', code: '2467', name: 'CACAROLA DOMEST N.24 C/ASA BAQUELITE ABC', additionalCode: '750', stock: 1, manufacturer: 'ABC', price: 100.40 },
  { id: '2902', code: '2902', name: 'FORMA PUDIM POLIDA N.26 ABC', additionalCode: '784', stock: 2, manufacturer: 'ABC', price: 51.40 },
  { id: '2907', code: '2907', name: 'CONJ P/SOBREMESA INOX 12 PECAS MARCA MIX', additionalCode: 'GX0075', stock: 12, manufacturer: 'MARCAMIX', price: 92.60 },
  { id: '2968', code: '2968', name: 'CONJ P/SALADA INOX 3PCS MARCA MIX', additionalCode: 'GX0090', stock: 9, manufacturer: 'MARCAMIX', price: 61.10 },
  { id: '2981', code: '2981', name: 'VITRINE VERT TRIPLA ACAO 569L FRICON', additionalCode: 'VCET569-2V000', stock: 2, manufacturer: 'FRICON', price: 8369.00 },
  { id: '2982', code: '2982', name: 'FREEZER HORIZ 311L FRICON DUPLA ACAO', additionalCode: 'HCED311-2C000', stock: 2, manufacturer: 'FRICON', price: 3635.00 },
  { id: '2983', code: '2983', name: 'FREEZER HORIZ 411L FRICON DUPLA ACAO', additionalCode: 'HCED411-2C000', stock: 1, manufacturer: 'FRICON', price: 3948.00 },
  { id: '2984', code: '2984', name: 'FREEZER HORIZ 503L FRICON DUPLA ACAO', additionalCode: 'HCED503-2C000', stock: 1, manufacturer: 'FRICON', price: 4223.00 },
  { id: '2985', code: '2985', name: 'VITRINE VERT MEDIA TEMP 501L +2/+8 FRICON', additionalCode: 'VCFM501-2V000', stock: 1, manufacturer: 'FRICON', price: 6094.00 },
  { id: '2994', code: '2994', name: 'AMACIADOR DE CARNE PAC 1/2 CV 220V VISA', additionalCode: 'PAC220M60N5', stock: 1, manufacturer: 'VISA', price: 3654.00 },
  { id: '2997', code: '2997', name: 'SELADORA 40CM BQ ECONOMICA C/TERM R. BAIAO', additionalCode: '311', stock: 2, manufacturer: 'R. BAIAO', price: 957.00 },
  { id: '3019', code: '3019', name: 'TACHO FRITADOR 7L INOX A GAS PROGAS', additionalCode: 'PR-70GP38227', stock: 1, manufacturer: 'PROGAS', price: 444.00 },
  { id: '3022', code: '3022', name: 'MOLHEIRA 2 CUBAS A GAS TAMPA VIDRO PROGAS', additionalCode: 'PR-02G5731', stock: 1, manufacturer: 'PROGAS', price: 550.00 },
  { id: '3023', code: '3023', name: 'MOLHEIRA 3 CUBAS A GAS TAMPA VIDRO PROGAS', additionalCode: 'PR-03GP5578', stock: 1, manufacturer: 'PROGAS', price: 620.00 },
  { id: '3024', code: '3024', name: 'CHAPA BIFETEIRA A GAS PR-450G NEW QUEEN PROGAS', additionalCode: 'PR-450GNP24960', stock: 1, manufacturer: 'PROGAS', price: 329.00 },
  { id: '3028', code: '3028', name: 'FORNO SEMI IND FG 2/3/4 BC PINTADO FSI-500N PROGAS', additionalCode: 'FSI-500NP42710', stock: 1, manufacturer: 'PROGAS', price: 837.00 },
  { id: '3034', code: '3034', name: 'FOGAO IND C/CHAPA 6BC P5 3BS/3BDP PMSD-603N PROGAS', additionalCode: 'PMSD-603FCH37406', stock: 1, manufacturer: 'PROGAS', price: 3462.00 },
  { id: '3051', code: '3051', name: 'AMASSADOR GIGANTE DE BATATA GLOBO', additionalCode: '10801', stock: 3, manufacturer: 'GLOBO', price: 67.10 },
  { id: '3060', code: '3060', name: 'VENTILADOR PAREDE 60CM NEW PT METAL 147W VENTISOL', additionalCode: '107', stock: 19, manufacturer: 'VENTISOL', price: 288.00 },
  { id: '3062', code: '3062', name: 'EXAUSTOR 40CM PREMIUM VENTISOL', additionalCode: '33', stock: 9, manufacturer: 'VENTISOL', price: 304.00 },
  { id: '3110', code: '3110', name: 'COMPRESSOR 220V R134 1/3+ FFI12HBX EMBRACO', additionalCode: 'W10393823', stock: 3, manufacturer: 'WHIRLPOOL', price: 583.00 },
  { id: '3111', code: '3111', name: 'COMPRESSOR 220V R134 1/5 EMI70HER EMBRACO', additionalCode: 'W10393810', stock: 1, manufacturer: 'WHIRLPOOL', price: 546.00 },
  { id: '3118', code: '3118', name: 'FORNO IND P/PIZZA PRP-900S/KG INOX PROGAS', additionalCode: 'PRP-900P45129', stock: 2, manufacturer: 'PROGAS', price: 3247.00 },
  { id: '3120', code: '3120', name: 'FOGAO IND 4BC P10 4BDP PMD 40X40 PROGAS', additionalCode: 'PMD-400F38098', stock: 1, manufacturer: 'PROGAS', price: 4043.00 },
  { id: '3167', code: '3167', name: 'PRENSA ELETRICA P/06 CREPES SUICO STYLE PROGAS', additionalCode: 'PRK-06P29002', stock: 1, manufacturer: 'PROGAS', price: 1456.00 },
  { id: '3186', code: '3186', name: 'CONDENSADOR ESTATICO BRASTEMP CLEAN 440 52x120', additionalCode: 'W10221056', stock: 3, manufacturer: 'WHIRLPOOL', price: 163.80 },
  { id: '3310', code: '3310', name: 'FRITADOR A GAS RETANGULAR 2 CESTOS PROGAS', additionalCode: 'PR-20GP41550', stock: 1, manufacturer: 'PROGAS', price: 916.00 },
  { id: '3321', code: '3321', name: 'CAFETEIRA 4L CILINDRICA MASTER MARCHESONI', additionalCode: 'CF.3.402', stock: 2, manufacturer: 'MARCHESONI', price: 1317.00 },
  { id: '3322', code: '3322', name: 'CAFETEIRA 6L CILINDRICA MASTER MARCHESONI', additionalCode: 'CF.3.602', stock: 1, manufacturer: 'MARCHESONI', price: 1522.00 },
  { id: '3489', code: '3489', name: 'PRENSA ELETRICA P/12 CREPES SUICO PROGAS', additionalCode: 'PRK-12P30402', stock: 1, manufacturer: 'PROGAS', price: 1835.00 },
  { id: '3496', code: '3496', name: 'VENTILADOR PAREDE 60CM BR PREMIUM VENTISOL', additionalCode: '73', stock: 1, manufacturer: 'VENTISOL', price: 316.00 },
  { id: '3537', code: '3537', name: 'FOGAO IND 3BC P5 3BS ALTA PRESSAO C/PE VENANCIO', additionalCode: 'VAP325624', stock: 2, manufacturer: 'VENANCIO', price: 1336.00 },
  { id: '3567', code: '3567', name: 'CHAPA GAS INOX ESCOVADO MOD 650 VENANCIO', additionalCode: 'C65-14213', stock: 1, manufacturer: 'VENANCIO', price: 992.00 },
  { id: '3582', code: '3582', name: 'CAIXA 7L C/TAMPA SUPERCRON', additionalCode: 'S450', stock: 4, manufacturer: 'SUPERCRON', price: 66.40 },
  { id: '3621', code: '3621', name: 'MOENDA CANA SHOP 60L/H INOX MAQTRON', additionalCode: '05.045.6010', stock: 1, manufacturer: 'MAQTRON', price: 6849.00 },
  { id: '3642', code: '3642', name: 'XICARA CAFE C/PIRES 80ML LINHA HTE', additionalCode: 'MODBAWARIA', stock: 1, manufacturer: 'DIVERSOS', price: 3.70 },
  { id: '3646', code: '3646', name: 'CACAROLA DOMEST N.20 C/ASA BAQUELITE ABC', additionalCode: '744', stock: 1, manufacturer: 'ABC', price: 56.30 },
  { id: '3705', code: '3705', name: 'CACAROLA DOMEST N.18 C/CABO BAQUELITE ABC', additionalCode: '740', stock: 1, manufacturer: 'ABC', price: 60.50 },
  { id: '3801', code: '3801', name: 'COMPRESSOR 220V R134 1/8 EMI45HER EMBRACO', additionalCode: 'W10849359', stock: 1, manufacturer: 'WHIRLPOOL', price: 354.00 },
  { id: '3804', code: '3804', name: 'SELADORA 60CM BQ C/TERMOSTATO R. BAIAO', additionalCode: '312', stock: 1, manufacturer: 'R. BAIAO', price: 1554.00 },
  { id: '3826', code: '3826', name: 'TACHO FRITADOR 3L INOX ELET PROGAS', additionalCode: 'PR-310EP29591', stock: 1, manufacturer: 'PROGAS', price: 617.00 },
  { id: '3827', code: '3827', name: 'TACHO FRITADOR 7L INOX ELET PROGAS', additionalCode: 'PR-70EP29593', stock: 1, manufacturer: 'PROGAS', price: 652.00 },
  { id: '4050', code: '4050', name: 'FRIGIDEIRA 24 FRANCESINHA ABC ALUMINIO', additionalCode: '563', stock: 2, manufacturer: 'ABC', price: 52.90 },
  { id: '4081', code: '4081', name: 'VENTILADOR COLUNA 50CM PT 200W MX PREMIUM VENTISOL', additionalCode: '305', stock: 1, manufacturer: 'VENTISOL', price: 415.00 },
  { id: '4236', code: '4236', name: 'CUTTER 4L MAX MOTOR 1/2 CV VISA', additionalCode: 'CUT4M220M60N5', stock: 1, manufacturer: 'VISA', price: 3657.00 },
  { id: '4251', code: '4251', name: 'RASPADOR DE COCO BIVOLT BRAESI', additionalCode: 'BRC-050B12844', stock: 1, manufacturer: 'BRAESI', price: 1244.00 },
  { id: '4335', code: '4335', name: 'REFRESQUEIRA 2 CUBAS 15L IBBL', additionalCode: '17112001', stock: 3, manufacturer: 'IBBL', price: 4048.00 },
  { id: '4357', code: '4357', name: 'FRIGIDEIRA 20 FRANCESINHA ABC ALUMINIO', additionalCode: '561', stock: 2, manufacturer: 'ABC', price: 43.50 },
  { id: '4409', code: '4409', name: 'RALADOR QUEIJO E COCO RQ-10 BRAESI', additionalCode: 'RQ-10B16027', stock: 1, manufacturer: 'BRAESI', price: 2328.00 },
  { id: '4448', code: '4448', name: 'LIQUIDIFICADOR INDUSTRIAL 2L LAR VISA ALTA R', additionalCode: 'LAR2220CC5', stock: 2, manufacturer: 'VISA', price: 591.00 },
  { id: '4473', code: '4473', name: 'FORNO TURBO ELETRICO 05 TELAS PROGAS', additionalCode: 'PRP-5000NE-P36882', stock: 1, manufacturer: 'PROGAS', price: 9696.00 },
  { id: '4549', code: '4549', name: 'COLHER SILICONE 25CM CABO INOX AZUL CRISTALIA', additionalCode: 'SCOL-003', stock: 1, manufacturer: 'CRISTALIA', price: 19.10 },
  { id: '4579', code: '4579', name: 'CUSCUZEIRO DOMESTICO N.18 ABC ALUMINIO', additionalCode: '53', stock: 1, manufacturer: 'ABC', price: 84.40 },
  { id: '4662', code: '4662', name: 'ASSADEIRA HOTEL RET EXTRA FOSCA N.1 ABC', additionalCode: '235', stock: 3, manufacturer: 'ABC', price: 74.30 },
  { id: '4750', code: '4750', name: 'FRITADOR ELETRICO AGUA/OLEO 20L VISA', additionalCode: 'FIE202205', stock: 2, manufacturer: 'VISA', price: 2635.00 },
  { id: '8816', code: '8816', name: 'CHUPETA SILICONE DA REFRESQUEIRA CROYDON', additionalCode: '5306', stock: 2, manufacturer: 'ANSUTEC', price: 20.50 },
  { id: '8824', code: '8824', name: 'CHAVE RETANGULAR PEQ C/LED 3 POLOS', additionalCode: '385', stock: 1, manufacturer: 'ANSUTEC', price: 6.40 },
  { id: '8826', code: '8826', name: 'TIMER 8H 8A/AC 127V 50/60HZ BRASTEMP/CONSUL', additionalCode: 'AGT-TD8127', stock: 1, manufacturer: 'AGT', price: 57.50 },
  { id: '8832', code: '8832', name: 'TAMPA DO AGITADOR BRASTEMP BWR22C/BWH09B+', additionalCode: '418030', stock: 1, manufacturer: 'WHIRLPOOL', price: 7.60 },
  { id: '8846', code: '8846', name: 'TERMOSTATO SECADORA BRASTEMP BSI10/BSR10/BSR24+', additionalCode: '326013733', stock: 1, manufacturer: 'WHIRLPOOL', price: 60.90 },
  { id: '8848', code: '8848', name: 'ENGRENAGEM PLANETARIA LM06/08 ELECTROLUX', additionalCode: '7121110', stock: 2, manufacturer: 'ALADO', price: 2.30 },
  { id: '8850', code: '8850', name: 'VALVULA COMPLEMENTO SIMPLES BIVOLT REFRIG CRP28+', additionalCode: '326057830', stock: 1, manufacturer: 'WHIRLPOOL', price: 10.10 },
  { id: '8863', code: '8863', name: 'REGISTRO 1/4" C/ROSCA EXTERNA 1/4"', additionalCode: 'ZF5024.02', stock: 1, manufacturer: 'ZUFER', price: 44.10 },
  { id: '8876', code: '8876', name: 'INTERRUPTOR BRANCO REFRIG BRS75/BRS62/BRS70+', additionalCode: 'W10369463', stock: 1, manufacturer: 'WHIRLPOOL', price: 48.00 },
  { id: '8894', code: '8894', name: 'BASE VALVULA SIMPLES BIVOLT REFRIG CRP28/CRP34+', additionalCode: '326057832', stock: 1, manufacturer: 'WHIRLPOOL', price: 12.40 },
  { id: '8920', code: '8920', name: 'PARAFUSO SUP DOBRADIÇA BWF22/BWF24/BWG11/12', additionalCode: 'W10653705', stock: 1, manufacturer: 'WHIRLPOOL', price: 2.60 },
  { id: '8924', code: '8924', name: 'PISTAO ORIFICIO 0.100MM PAFE80/PHF/QE60/KHFE60', additionalCode: 'ARC17109059330', stock: 1, manufacturer: 'ELGIN', price: 29.90 },
  { id: '8940', code: '8940', name: 'SENSOR TEMP AMB HEFI/HEQI 09/12/18/24+ ELGIN', additionalCode: 'ARC12439000010', stock: 1, manufacturer: 'ELGIN', price: 31.10 },
  { id: '8962', code: '8962', name: 'RETENTOR TANQUE ELECTROLUX LB12Q/LBT12/LQ75+', additionalCode: 'A30556401', stock: 2, manufacturer: 'ELECTROLUX', price: 19.60 },
  { id: '8964', code: '8964', name: 'RELE EMBRACO 1/6 HP A 1/8HP 60HZ 220V', additionalCode: '506', stock: 1, manufacturer: 'DISTRIBUID', price: 31.80 },
  { id: '8968', code: '8968', name: 'PE NIVELADOR ELECTROLUX IF56B/DF56S/DF56/TC56+', additionalCode: 'A08769101', stock: 2, manufacturer: 'ELECTROLUX', price: 6.70 },
  { id: '8970', code: '8970', name: 'PASTA TERMICA HEAT SINK 340 WD10/PE11 2 GRAMAS', additionalCode: 'A12042301', stock: 2, manufacturer: 'ELECTROLUX', price: 12.00 },
  { id: '8974', code: '8974', name: 'COTOVELO 1/4 X 1/4 P/PURIFICADOR E BEBEDOURO IBBL', additionalCode: '10250093', stock: 2, manufacturer: 'IBBL', price: 6.00 },
  { id: '8976', code: '8976', name: 'PISTAO ORIFICIO 0.110MM KEFE48/KEQE48/KEQI48+', additionalCode: 'ARC17109041540', stock: 1, manufacturer: 'ELGIN', price: 24.80 },
  { id: '8978', code: '8978', name: 'PISTAO ORIFICIO 0.115MM KEQE/PEFE/PEFI60+', additionalCode: 'ARC17109041550', stock: 1, manufacturer: 'ELGIN', price: 24.80 },
  { id: '8980', code: '8980', name: 'BOTAO CHAVE SELETORA LAVADORA LTC10/LTC12/LTC15+', additionalCode: '67400343', stock: 1, manufacturer: 'ELECTROLUX', price: 17.00 },
  { id: '8982', code: '8982', name: 'SENSOR TEMP PURIFICADOR BE11/PE12/PA21+ ELECTROLUX', additionalCode: 'A12443601', stock: 1, manufacturer: 'ELECTROLUX', price: 30.40 },
  { id: '8983', code: '8983', name: 'UNIAO REDUTORA 1/2 SAE X 3/8 NPT', additionalCode: '8100010', stock: 6, manufacturer: 'RAVID', price: 10.90 },
  { id: '8984', code: '8984', name: 'SENSOR TERMOSTATICO PURIFICADOR PE10/PE11+ ELECTR', additionalCode: 'A12444401', stock: 1, manufacturer: 'ELECTROLUX', price: 17.80 },

  // Destaques Refrigeração & Equipamentos Pesados
  { id: '37209', code: '37209', name: 'AR CONDICIONADO SPLIT INVERTER 9000 G-TOP AUTO', additionalCode: 'GWC09ATA-D6DNA1A', stock: 3, manufacturer: 'GREE', price: 2449.10 },
  { id: '37323', code: '37323', name: 'AR CONDICIONADO SPLIT INVERTER 12000 G-TOP AUTO WF', additionalCode: 'GWC12ATC-D6DNA1A-I', stock: 1, manufacturer: 'GREE', price: 2089.70 },
  { id: '37907', code: '37907', name: 'AR CONDICIONADO SPLIT INVERTER 9000 ZEN TOP AGRAT', additionalCode: '19502', stock: 3, manufacturer: 'VENTISOL', price: 1999.00 },
  { id: '39210', code: '39210', name: 'AR CONDICIONADO SPLIT INVERTER 9000 ECO II R32 WIF', additionalCode: '45HJFE09C2CC', stock: 1, manufacturer: 'ELGIN', price: 2581.70 },
  { id: '39231', code: '39231', name: 'AR CONDICIONADO SPLIT INVERTER 30000 ECO II R32 W', additionalCode: '45HJFI30C2WB', stock: 1, manufacturer: 'ELGIN', price: 7462.00 },
  { id: '43001', code: '43001', name: 'FACA CHURRASCO COSMOS TRAMONTINA', additionalCode: '63950-187', stock: 3, manufacturer: 'TRAMONTINA', price: 13.50 },
  { id: '43002', code: '43002', name: 'FACA MESA COSMOS TRAMONTINA', additionalCode: '66950-031', stock: 62, manufacturer: 'TRAMONTINA', price: 13.50 },
  { id: '43030', code: '43030', name: 'FACA MESA IPANEMA AZUL TRAMONTINA', additionalCode: '23361-414', stock: 100, manufacturer: 'TRAMONTINA', price: 4.10 },
  { id: '43031', code: '43031', name: 'GARFO MESA IPANEMA AZUL TRAMONTINA', additionalCode: '23362-410', stock: 186, manufacturer: 'TRAMONTINA', price: 4.10 },
  { id: '43100', code: '43100', name: 'FACA MESA INOX PLAZA HERCULES', additionalCode: '1620-003', stock: 85, manufacturer: 'HERCULES', price: 11.50 },
  { id: '46006', code: '46006', name: 'GARRAFA TERMICA 1,9L INOX PS MARCA MIX', additionalCode: 'TP6506', stock: 4, manufacturer: 'MARCAMIX', price: 357.80 },
  { id: '46251', code: '46251', name: 'PLACA DE CORTE 1,0X25X37CM C/PEGADOR AMARELA PRON', additionalCode: '01.165', stock: 1, manufacturer: 'PRONYL', price: 90.10 },
  { id: '58001', code: '58001', name: 'GAXETA BOSCH CONTINENTAL SUP R34/RC34+ (0,38x0,55)', additionalCode: '634580007-17', stock: 2, manufacturer: 'ILPEA', price: 73.10 },
  { id: '58006', code: '58006', name: 'GAXETA ESMALTEC SUP C/ENCAIXE ER30+ (0,32 X 0,49)', additionalCode: '632030003-17', stock: 6, manufacturer: 'ILPEA', price: 67.50 },
  { id: '58046', code: '58046', name: 'GAXETA ELECTROLUX SUP C/ABA DC45/47 + (0,68x0,48)', additionalCode: '621590002-17', stock: 2, manufacturer: 'ILPEA', price: 93.80 },
  { id: '91709', code: '91709', name: 'CONDENSADORA INVERTER 9000 GREE', additionalCode: 'CB438W04900', stock: 4, manufacturer: 'GREE', price: 1115.40 },
  { id: '91710', code: '91710', name: 'EVAPORADORA INVERTER 9000 GREE', additionalCode: 'CB438N04900', stock: 4, manufacturer: 'GREE', price: 600.60 },
  { id: '107590', code: '107590', name: 'VITRINE VERT MEDIA TEMP 569L +2/+8 FRICON', additionalCode: 'VCFM569-2V000', stock: 2, manufacturer: 'FRICON', price: 6261.00 },
  { id: '108936', code: '108936', name: 'PURIFICADOR SPECIALE FR-600 BRANCO 220V IBBL', additionalCode: '52012001', stock: 2, manufacturer: 'IBBL', price: 1064.00 },
  { id: '111325', code: '111325', name: 'MAQUINA ALGODAO DOCE BRAESI', additionalCode: 'ADB-02B14183', stock: 2, manufacturer: 'BRAESI', price: 2311.00 },
  { id: '111406', code: '111406', name: 'FRIGOBAR CONSUL 76L 220V', additionalCode: 'CRC08CBBNA', stock: 1, manufacturer: 'WHIRLPOOL', price: 1914.00 },
  { id: '111422', code: '111422', name: 'FRIGOBAR CONSUL 117L 220V', additionalCode: 'CRC12CBBNA', stock: 4, manufacturer: 'WHIRLPOOL', price: 2021.00 },
  { id: '11163', code: '11163', name: 'LAMINA P/SERRA FITA 5/8" 1,63M STARRET', additionalCode: 'MKP16X6-SK-4-1-63', stock: 4, manufacturer: 'STARRET', price: 63.70 },
  { id: '11165', code: '11165', name: 'LAMINA P/SERRA FITA 5/8" 1,65M STARRET', additionalCode: 'MKP16X6-SK-4-1-65', stock: 3, manufacturer: 'STARRET', price: 65.50 },
  { id: '11707', code: '11707', name: 'CAPACITOR QUADRADO CBB61 1,5uf x 380Vac 4P', additionalCode: '51021000', stock: 2, manufacturer: 'DISTRIBUID', price: 3.90 },
  { id: '11802', code: '11802', name: 'CAPACITOR DE FASE 50uf 440Vac ALUMINIO', additionalCode: '20003.1702.70', stock: 2, manufacturer: 'FRIVEN', price: 28.40 },
  { id: '15197', code: '15197', name: 'GAS REFRIGERANTE R-134A LATA 750GR', additionalCode: '20003.0100.15', stock: 20, manufacturer: 'DISTRIBUID', price: 91.00 },
  { id: '15209', code: '15209', name: 'GAS REFRIGERANTE R-410A LATA 800 GRAMAS C/REGISTRO', additionalCode: 'G111834', stock: 5, manufacturer: 'DISTRIBUID', price: 123.90 },
  { id: '15293', code: '15293', name: 'FLANGEADOR GT278 1/8 A 3/4 C/CHAVE CATRACA/CORTAD', additionalCode: '20003.0904.22', stock: 2, manufacturer: 'FRIVEN', price: 161.80 },
  { id: '15298', code: '15298', name: 'ALICATE MANUAL LOKRING 3/16 1/4 5/16 SAMATEC', additionalCode: '954575', stock: 1, manufacturer: 'SAMATEC', price: 421.30 },
  { id: '15355', code: '15355', name: 'FILTRO SECADOR DE FERRO ELGIN AT-165 5/8" R', additionalCode: '45FSE165R580', stock: 1, manufacturer: 'ELGIN', price: 89.90 },
  { id: '160601', code: '160601', name: 'CORTADOR DE FRIOS AUT INOX 300MM BM18 BERMAR', additionalCode: 'BM18NRPF', stock: 1, manufacturer: 'BERMAR', price: 9353.00 },
  { id: '162060', code: '162060', name: 'BATEDEIRA PLANETARIA BP12 220V 1/3CV C/NR12 GASTRO', additionalCode: '9146G8117', stock: 1, manufacturer: 'GASTROMAQ', price: 6104.00 },
  { id: '163252', code: '163252', name: 'AMASSADEIRA SEMI RAPIDA 25KG MBI25 1/2CV GASTROMAQ', additionalCode: 'MBI25-4140G-30321', stock: 1, manufacturer: 'GASTROMAQ', price: 8921.00 },
  { id: '172960', code: '172960', name: 'AMACIADOR E PREPARADOR DE CARNES 1/2HP BERMAR', additionalCode: 'BM34NRPF-6153', stock: 1, manufacturer: 'BERMAR', price: 4154.00 },
  { id: '176400', code: '176400', name: 'FORNO TURBO A GAS 10 TELAS PRP-10000 STYLE PROGAS', additionalCode: 'PRP-10000ST36256', stock: 1, manufacturer: 'PROGAS', price: 11933.00 },
  { id: '178993', code: '178993', name: 'AUTO SERVICO 3,00M AR FORCADO PT B EMI CINZA FRIC', additionalCode: 'ACFM2375-2V000', stock: 1, manufacturer: 'FRICON', price: 20315.00 },
  { id: '181498', code: '181498', name: 'AMASSADEIRA ESPIRAL AE-25 380V G PANIZ', additionalCode: '90809-35831', stock: 1, manufacturer: 'G PANIZ', price: 21385.00 },
  { id: '182877', code: '182877', name: 'ILHA HORIZ BAIXA TEMP 1163L 3,00M BRANCA FRICON', additionalCode: 'ICED1163-2V000', stock: 1, manufacturer: 'FRICON', price: 10999.00 },
  { id: '188324', code: '188324', name: 'VITRINE VERT BAIXA TEMP 565L -23/-18 FRICON', additionalCode: 'VCFB569-2V000', stock: 1, manufacturer: 'FRICON', price: 12329.00 },
  { id: '188523', code: '188523', name: 'SERRA FITA 2,20M INOX BM33NR BERMAR', additionalCode: 'BM33NR', stock: 1, manufacturer: 'BERMAR', price: 10236.00 },
  { id: '188524', code: '188524', name: 'SERRA FITA 3,15M 380V 2CV INOX BERMAR', additionalCode: 'BM82NR', stock: 1, manufacturer: 'BERMAR', price: 17012.00 },
  { id: '189008', code: '189008', name: 'FRITADOR ELETRICO 6L 2 CUBAS MARCHESONI', additionalCode: 'FT.1.622.ST', stock: 3, manufacturer: 'MARCHESONI', price: 1509.00 },
  { id: '189010', code: '189010', name: 'CAFETEIRA 8L PROFISSIONAL CAFE/LEITE 2X4 MARCHESO', additionalCode: 'CF.4.422', stock: 1, manufacturer: 'MARCHESONI', price: 2305.00 },
  { id: '189141', code: '189141', name: 'BALANCA ELETR 300KG PLAT 50X50 INOX RAMUZA', additionalCode: 'DPB300-2165', stock: 2, manufacturer: 'RAMUZA', price: 1961.00 },
  { id: '189708', code: '189708', name: 'BUFFET TERM 6 CB ELET TAMPA VD EDANCA', additionalCode: 'BBMM-06-220V', stock: 1, manufacturer: 'EDANCA', price: 3113.00 },
  { id: '189711', code: '189711', name: 'BUFFET TERM 12 CB ELET TAMPA VD EDANCA', additionalCode: 'BBMM-12-220V', stock: 1, manufacturer: 'EDANCA', price: 5028.00 },
  { id: '190065', code: '190065', name: 'TENIS ANTIDERRAPANTE EVA BB80 BRANCO 34 SOFT WORKS', additionalCode: '0100337-34', stock: 1, manufacturer: 'SOFT WORKS', price: 105.40 },
  { id: '190215', code: '190215', name: 'AUTO SERVICO 1,00M AR FORCADO PT B EMI PRETO FRICO', additionalCode: 'ACFM1000-2V001', stock: 1, manufacturer: 'FRICON', price: 11138.00 },
  { id: '211227', code: '211227', name: 'VITRINE LUXO REFR. CONFEITARIA 1,50M VD RETO', additionalCode: '47254', stock: 1, manufacturer: 'IGLU', price: 9879.00 },
  { id: '211536', code: '211536', name: 'ILHA HORIZ BAIXA TEMP 820L 3,00M PRETA FRICON', additionalCode: 'ICED820-2V001', stock: 1, manufacturer: 'FRICON', price: 10490.00 },
  { id: '211736', code: '211736', name: 'SELADORA PEDAL DISPARO E TEMPORIZADO 40CM R. BAIAO', additionalCode: '3088', stock: 1, manufacturer: 'R. BAIAO', price: 1091.00 },
  { id: '212220', code: '212220', name: 'LIQUIDIFICADOR BASCULANTE 25L VISA', additionalCode: 'LQBI25220M60N5', stock: 1, manufacturer: 'VISA', price: 4088.00 },
  { id: '212317', code: '212317', name: 'ILHA HORIZ BAIXA TEMP 1163L 3,00M PRETA LED FRICON', additionalCode: 'ICED1163-2V016', stock: 1, manufacturer: 'FRICON', price: 12180.00 },
  { id: '212535', code: '212535', name: 'VITRINE LUXO AR FORCADO 1,50M VD RETO IGLU', additionalCode: '47126', stock: 1, manufacturer: 'IGLU', price: 12248.00 },
  { id: '212632', code: '212632', name: 'BALANCA ELETR 6/15/33KG EDGE33TW WI-FI BALMAK', additionalCode: 'PA2647', stock: 1, manufacturer: 'BALMAK', price: 5396.00 },
  { id: '212633', code: '212633', name: 'VITRINE LUXO AR FORCADO 1,20M VD RETO IGLU', additionalCode: '46745', stock: 1, manufacturer: 'IGLU', price: 10632.00 },
  { id: '212700', code: '212700', name: 'PROCESSADOR DE ALIMENTOS MPAE C/9 DISCOS VISA', additionalCode: 'MPAE220M60N5', stock: 1, manufacturer: 'VISA', price: 5720.00 },
  { id: '212812', code: '212812', name: 'VITRINE AR FORCADO 1,15M L7 VD RETO POLAR', additionalCode: 'L7VR-115', stock: 1, manufacturer: 'POLAR', price: 8406.00 },
  { id: '212813', code: '212813', name: 'VITRINE AR FORCADO 1,50M L7 VD RETO POLAR', additionalCode: 'L7VR-150', stock: 1, manufacturer: 'POLAR', price: 9401.00 },
  { id: '212855', code: '212855', name: 'CORTINA DE AR 2,00M C/CONTROLE FRIVEN', additionalCode: '20003.1100.03', stock: 1, manufacturer: 'FRIVEN', price: 1434.00 },
  { id: '212879', code: '212879', name: 'PLACA INTERFACE ELECTROLUX DF44/DW44S/DF54X+', additionalCode: 'A03872004', stock: 1, manufacturer: 'ELECTROLUX', price: 102.50 },
  { id: '311736', code: '311736', name: 'EXPOSITOR VERT P/CARNE 3 PORTAS 1,90M PT POLAR', additionalCode: '050200B095', stock: 1, manufacturer: 'POLAR', price: 12997.00 },
  { id: '311806', code: '311806', name: 'PICADOR DE CARNE INOX B-8 BERMAR', additionalCode: 'BM236195', stock: 1, manufacturer: 'BERMAR', price: 2836.00 },
  { id: '311807', code: '311807', name: 'FREEZER HORIZ EXPOSITOR 311L FRICON DUPLA ACAO', additionalCode: 'HCED311-2V999', stock: 2, manufacturer: 'FRICON', price: 4222.00 },
  { id: '311826', code: '311826', name: 'BOMBA DE VACUO SMART DUPLO ESTAGIO 12CFM FRIVEN', additionalCode: '20003.0302.54', stock: 1, manufacturer: 'FRIVEN', price: 1853.00 }
].map(p => ({
  ...p,
  category: inferCategory(p.name, p.manufacturer)
}));

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatStock(stock: number): string {
  if (Number.isInteger(stock)) {
    return stock.toString();
  }
  return stock.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 4 });
}

/**
 * Retorna todos os produtos do catálogo (localStorage customizado ou inicial)
 */
export function getAllCatalogProducts(): CatalogProduct[] {
  if (typeof window === 'undefined') {
    return INITIAL_CATALOG_PRODUCTS;
  }
  try {
    const saved = localStorage.getItem('app_custom_catalog_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler produtos do catálogo do localStorage:', err);
  }
  return INITIAL_CATALOG_PRODUCTS;
}

/**
 * Busca um produto no catálogo pelo Código ou Código Adicional
 */
export function findProductByCode(code: string): CatalogProduct | undefined {
  if (!code || !code.trim()) return undefined;
  const target = code.trim().toLowerCase();
  const all = getAllCatalogProducts();
  
  return all.find(p => 
    p.code?.toLowerCase() === target ||
    p.additionalCode?.toLowerCase() === target ||
    p.id?.toLowerCase() === target
  );
}

/**
 * Pesquisa produtos por código, nome ou fabricante
 */
export function searchCatalogProducts(query: string, limit: number = 8): CatalogProduct[] {
  if (!query || !query.trim()) return [];
  const term = query.trim().toLowerCase();
  const all = getAllCatalogProducts();

  return all
    .filter(p => 
      p.code?.toLowerCase().includes(term) ||
      p.additionalCode?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.manufacturer?.toLowerCase().includes(term)
    )
    .slice(0, limit);
}
