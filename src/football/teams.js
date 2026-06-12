export const BRAZILIAN_CLUBS = new Set([
  "Flamengo",
  "Palmeiras",
  "Corinthians",
  "São Paulo",
  "Santos",
  "Vasco",
  "Fluminense",
  "Grêmio",
  "Internacional",
  "Atlético Mineiro",
  "Cruzeiro",
  "Botafogo",
  "Bahia",
  "Fortaleza",
  "Athletico Paranaense",
  "Bragantino",
  "Ceará",
  "Sport",
  "Vitória",
  "Goiás",
  "Coritiba",
  "Avaí",
  "Chapecoense",
  "Juventude",
  "Cuiabá",
  "América Mineiro",
  "Ponte Preta",
  "Náutico",
  "Santa Cruz",
  "Remo",
  "Paysandu",
]);

const CLUB_PATTERNS = [
  { pattern: /\b(flamengo|flamenguista|mengão|mengao|fla)\b/i, team: "Flamengo" },
  { pattern: /\b(palmeiras|palmeirense|palmeirano|verdão|verdao|pal)\b/i, team: "Palmeiras" },
  { pattern: /\b(corinthians|timão|timao|corinthiano)\b/i, team: "Corinthians" },
  { pattern: /\b(são paulo|sao paulo|s[aã]o[- ]?paulino|tricolor paulista|spfc)\b/i, team: "São Paulo" },
  { pattern: /\b(santos|santista|peixe)\b/i, team: "Santos" },
  { pattern: /\b(vasco|vasca[ií]no|vascão|vascao)\b/i, team: "Vasco" },
  { pattern: /\b(fluminense|flu|tricolor carioca)\b/i, team: "Fluminense" },
  { pattern: /\b(grêmio|gremio|gremista)\b/i, team: "Grêmio" },
  { pattern: /\b(internacional|colorado)\b/i, team: "Internacional" },
  { pattern: /\b(atlético mineiro|atletico mineiro|atleticano|galo|cam)\b/i, team: "Atlético Mineiro" },
  { pattern: /\b(cruzeiro|cruzeirense|raposa)\b/i, team: "Cruzeiro" },
  { pattern: /\b(botafogo|botafoguense|fogão|fogao)\b/i, team: "Botafogo" },
  { pattern: /\b(bahia|tricolor baiano)\b/i, team: "Bahia" },
  { pattern: /\b(fortaleza|leão|leao)\b/i, team: "Fortaleza" },
  { pattern: /\b(athletico|atletico paranaense|furacão|furacao|cap)\b/i, team: "Athletico Paranaense" },
  { pattern: /\b(bragantino|massa bruta|red bull)\b/i, team: "Bragantino" },
  { pattern: /\b(ceará|ceara|vozão|vozao)\b/i, team: "Ceará" },
  { pattern: /\b(sport|leão do norte|leao do norte)\b/i, team: "Sport" },
  { pattern: /\b(vitória|vitoria|negrão|negrao)\b/i, team: "Vitória" },
  { pattern: /\b(goiás|goias|esmeraldino)\b/i, team: "Goiás" },
  { pattern: /\b(coritiba|coxa)\b/i, team: "Coritiba" },
  { pattern: /\b(chapecoense|chape)\b/i, team: "Chapecoense" },
  { pattern: /\b(juventude)\b/i, team: "Juventude" },
  { pattern: /\b(cuiabá|cuiaba|dourado)\b/i, team: "Cuiabá" },
  { pattern: /\b(américa mineiro|america mineiro|coelho)\b/i, team: "América Mineiro" },
  { pattern: /\b(ponte preta|ponte)\b/i, team: "Ponte Preta" },
  { pattern: /\b(náutico|nautico|timbu)\b/i, team: "Náutico" },
  { pattern: /\b(santa cruz|tricolor pernambucano)\b/i, team: "Santa Cruz" },
  { pattern: /\b(remo|filho da enseada)\b/i, team: "Remo" },
  { pattern: /\b(paysandu|papão|papao)\b/i, team: "Paysandu" },
];

const SELECTION_PATTERNS = [
  { pattern: /\b(brasil|sele[cç][aã]o brasileira|canarinho|verde e amarelo)\b/i, team: "Brasil" },
  { pattern: /\b(argentina|albiceleste|sele[cç][aã]o argentina)\b/i, team: "Argentina" },
  { pattern: /\b(fran[cç]a|france|les bleus)\b/i, team: "França" },
  { pattern: /\b(alemanha|germany|die mannschaft)\b/i, team: "Alemanha" },
  { pattern: /\b(espanha|spain|la roja)\b/i, team: "Espanha" },
  { pattern: /\b(portugal|sele[cç][aã]o portuguesa)\b/i, team: "Portugal" },
  { pattern: /\b(inglaterra|england|three lions)\b/i, team: "Inglaterra" },
  { pattern: /\b(it[aá]lia|italy|azzurri)\b/i, team: "Itália" },
  { pattern: /\b(uruguai|uruguay|celeste)\b/i, team: "Uruguai" },
  { pattern: /\b(col[oô]mbia|colombia)\b/i, team: "Colômbia" },
  { pattern: /\b(m[eé]xico|mexico)\b/i, team: "México" },
  { pattern: /\b(holanda|netherlands|pa[ií]ses baixos)\b/i, team: "Holanda" },
  { pattern: /\b(b[eé]lgica|belgium)\b/i, team: "Bélgica" },
  { pattern: /\b(cro[aá]cia|croatia)\b/i, team: "Croácia" },
];

const DECLARE_CLUB =
  /(?:eu\s+)?(?:tor[çc]o|sou|vou com|meu time [ée]|sou fan[aá]tico(?:\s+do)?)\s+(?:no\s+|na\s+|do\s+|de\s+|para\s+|pro\s+|pra\s+)?/i;

export function isBrazilianClub(club) {
  return BRAZILIAN_CLUBS.has(club);
}

export function deduceSelectionFromClub(club) {
  if (!club) return null;
  if (isBrazilianClub(club)) return "Brasil";
  return null;
}

function matchPatterns(text, patterns) {
  for (const { pattern, team } of patterns) {
    if (pattern.test(text)) return team;
  }
  return null;
}

export function extractClubMention(text) {
  const declared = text.match(
    new RegExp(`${DECLARE_CLUB.source}(.+)`, "i")
  );
  if (declared?.[1]) {
    const club = matchPatterns(declared[1], CLUB_PATTERNS);
    if (club) return club;
  }

  return matchPatterns(text, CLUB_PATTERNS);
}

export function extractSelectionMention(text) {
  const declared = text.match(
    /(?:tor[çc]o|sou|vou com|na)\s+(?:na\s+|pela\s+|para\s+)?(?:sele[cç][aã]o\s+)?/i
  );
  if (declared) {
    const team = matchPatterns(text, SELECTION_PATTERNS);
    if (team) return team;
  }

  if (/\b(tor[çc]o|sou)\s+(?:da\s+)?sele[cç][aã]o\b/i.test(text)) {
    return matchPatterns(text, SELECTION_PATTERNS);
  }

  return null;
}

export function extractTeamMention(text) {
  return extractClubMention(text);
}
