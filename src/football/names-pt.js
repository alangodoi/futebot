import { BRAZILIAN_CLUBS } from "./teams.js";

const COUNTRY_EN_TO_PT = {
  germany: "Alemanha",
  "saudi arabia": "Arábia Saudita",
  algeria: "Argélia",
  albania: "Albânia",
  armenia: "Armênia",
  australia: "Austrália",
  austria: "Áustria",
  azerbaijan: "Azerbaijão",
  bahrain: "Bahrein",
  belarus: "Bielorrússia",
  belgium: "Bélgica",
  bolivia: "Bolívia",
  "bosnia herzegovina": "Bósnia e Herzegovina",
  "bosnia  herzegovina": "Bósnia e Herzegovina",
  brazil: "Brasil",
  bulgaria: "Bulgária",
  cameroon: "Camarões",
  canada: "Canadá",
  chile: "Chile",
  "china pr": "China",
  china: "China",
  colombia: "Colômbia",
  cyprus: "Chipre",
  "korea republic": "Coreia do Sul",
  "south korea": "Coreia do Sul",
  "north korea": "Coreia do Norte",
  "cote divoire": "Costa do Marfim",
  "ivory coast": "Costa do Marfim",
  croatia: "Croácia",
  cuba: "Cuba",
  denmark: "Dinamarca",
  "dr congo": "RD Congo",
  egypt: "Egito",
  ecuador: "Equador",
  scotland: "Escócia",
  slovakia: "Eslováquia",
  slovenia: "Eslovênia",
  spain: "Espanha",
  usa: "Estados Unidos",
  "united states": "Estados Unidos",
  estonia: "Estônia",
  ethiopia: "Etiópia",
  "faroe islands": "Ilhas Faroe",
  finland: "Finlândia",
  france: "França",
  ghana: "Gana",
  georgia: "Geórgia",
  gibraltar: "Gibraltar",
  greece: "Grécia",
  netherlands: "Holanda",
  hungary: "Hungria",
  indonesia: "Indonésia",
  england: "Inglaterra",
  iran: "Irã",
  iraq: "Iraque",
  "northern ireland": "Irlanda do Norte",
  ireland: "Irlanda",
  iceland: "Islândia",
  italy: "Itália",
  japan: "Japão",
  jordan: "Jordânia",
  kazakhstan: "Cazaquistão",
  kenya: "Quênia",
  kosovo: "Kosovo",
  latvia: "Letônia",
  lebanon: "Líbano",
  libya: "Líbia",
  liechtenstein: "Liechtenstein",
  lithuania: "Lituânia",
  luxembourg: "Luxemburgo",
  "north macedonia": "Macedônia do Norte",
  malaysia: "Malásia",
  mali: "Mali",
  malta: "Malta",
  morocco: "Marrocos",
  mexico: "México",
  moldova: "Moldávia",
  montenegro: "Montenegro",
  mozambique: "Moçambique",
  namibia: "Namíbia",
  nigeria: "Nigéria",
  norway: "Noruega",
  "new zealand": "Nova Zelândia",
  oman: "Omã",
  wales: "País de Gales",
  panama: "Panamá",
  paraguay: "Paraguai",
  poland: "Polônia",
  qatar: "Catar",
  czechia: "República Tcheca",
  "czech republic": "República Tcheca",
  romania: "Romênia",
  russia: "Rússia",
  senegal: "Senegal",
  serbia: "Sérvia",
  sweden: "Suécia",
  switzerland: "Suíça",
  syria: "Síria",
  thailand: "Tailândia",
  tunisia: "Tunísia",
  turkiye: "Turquia",
  turkey: "Turquia",
  ukraine: "Ucrânia",
  uruguay: "Uruguai",
  "south africa": "África do Sul",
  "trinidad and tobago": "Trinidad e Tobago",
  uzbekistan: "Uzbequistão",
  venezuela: "Venezuela",
  vietnam: "Vietnã",
  zambia: "Zâmbia",
  zimbabwe: "Zimbábue",
  suriname: "Suriname",
  peru: "Peru",
  "costa rica": "Costa Rica",
  honduras: "Honduras",
  jamaica: "Jamaica",
  "el salvador": "El Salvador",
  haiti: "Haiti",
  guatemala: "Guatemala",
  curacao: "Curaçao",
  angola: "Angola",
  "cape verde": "Cabo Verde",
  "cabo verde": "Cabo Verde",
  guinea: "Guiné",
  congo: "Congo",
  benin: "Benin",
  gabon: "Gabão",
  togo: "Togo",
  "burkina faso": "Burkina Faso",
  uganda: "Uganda",
  tanzania: "Tanzânia",
  rwanda: "Ruanda",
  argentina: "Argentina",
  portugal: "Portugal",
  "united arab emirates": "Emirados Árabes Unidos",
  israel: "Israel",
  india: "Índia",
};

const CLUB_EN_TO_PT = {
  gremio: "Grêmio",
  "sao paulo": "São Paulo",
  "atletico mineiro": "Atlético Mineiro",
  "atletico-mg": "Atlético Mineiro",
  "atletico paranaense": "Athletico Paranaense",
  "athletico paranaense": "Athletico Paranaense",
  "athletico-pr": "Athletico Paranaense",
  "red bull bragantino": "Bragantino",
  "rb bragantino": "Bragantino",
  ceara: "Ceará",
  goias: "Goiás",
  "america mineiro": "América Mineiro",
  "america-mg": "América Mineiro",
  nautico: "Náutico",
  vitoria: "Vitória",
  cuiaba: "Cuiabá",
  flamengo: "Flamengo",
  palmeiras: "Palmeiras",
  corinthians: "Corinthians",
  santos: "Santos",
  vasco: "Vasco",
  "vasco da gama": "Vasco",
  fluminense: "Fluminense",
  internacional: "Internacional",
  cruzeiro: "Cruzeiro",
  botafogo: "Botafogo",
  bahia: "Bahia",
  fortaleza: "Fortaleza",
  sport: "Sport",
  coritiba: "Coritiba",
  chapecoense: "Chapecoense",
  juventude: "Juventude",
  avai: "Avaí",
  "ponte preta": "Ponte Preta",
  "santa cruz": "Santa Cruz",
  remo: "Remo",
  paysandu: "Paysandu",
};

const COMPETITION_EN_TO_PT = {
  "world cup": "Copa do Mundo",
  "fifa world cup": "Copa do Mundo",
  "copa do mundo": "Copa do Mundo",
  "serie a": "Brasileirão Série A",
  "brasileirao serie a": "Brasileirão Série A",
  "serie b": "Brasileirão Série B",
  "brasileirao serie b": "Brasileirão Série B",
  "copa do brasil": "Copa do Brasil",
  libertadores: "Libertadores",
  "copa libertadores": "Libertadores",
  "sudamericana": "Sul-Americana",
  "copa sudamericana": "Sul-Americana",
  "champions league": "Liga dos Campeões",
  "premier league": "Premier League",
  "la liga": "La Liga",
  "bundesliga": "Bundesliga",
  "serie a italy": "Serie A",
  "recopa gaucha": "Recopa Gaúcha",
  "recopa gaúcha": "Recopa Gaúcha",
};

const STATUS_EN_TO_PT = {
  "not started": "Não iniciado",
  ended: "Encerrado",
  finished: "Encerrado",
  halftime: "Intervalo",
  "half time": "Intervalo",
  "1st half": "1º tempo",
  "2nd half": "2º tempo",
  postponed: "Adiado",
  canceled: "Cancelado",
  cancelled: "Cancelado",
  "after penalties": "Após pênaltis",
  "after extra time": "Após prorrogação",
  live: "Ao vivo",
};

const CLUB_ASCII_TO_PT = Object.fromEntries(
  [...BRAZILIAN_CLUBS].map((club) => [normalizeKey(club), club])
);

function normalizeKey(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function translateTeamName(name) {
  if (!name || name === "?") return name;

  const key = normalizeKey(name);
  if (COUNTRY_EN_TO_PT[key]) return COUNTRY_EN_TO_PT[key];
  if (CLUB_EN_TO_PT[key]) return CLUB_EN_TO_PT[key];
  if (CLUB_ASCII_TO_PT[key]) return CLUB_ASCII_TO_PT[key];

  for (const club of BRAZILIAN_CLUBS) {
    if (normalizeKey(club) === key) return club;
  }

  return name;
}

export function translateCompetitionName(name) {
  if (!name || name === "?") return name;
  const key = normalizeKey(name);
  return COMPETITION_EN_TO_PT[key] || name;
}

export function translateStatusName(status) {
  if (!status || status === "?") return status;
  const key = normalizeKey(status);
  return STATUS_EN_TO_PT[key] || status;
}

export function teamNamesMatch(a, b) {
  if (!a || !b) return false;
  const na = normalizeKey(translateTeamName(a));
  const nb = normalizeKey(translateTeamName(b));
  return na.includes(nb) || nb.includes(na);
}
