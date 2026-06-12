import { config } from "../config.js";
import { logger } from "../logger.js";
import {
  fetchWithTimeout,
  fetchLiveScoreLive,
  fetchLiveScoreToday,
} from "./livescore.js";
import {
  teamNamesMatch,
  translateCompetitionName,
  translateStatusName,
  translateTeamName,
} from "./names-pt.js";

const SOFASCORE_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  Referer: "https://www.sofascore.com/",
  Origin: "https://www.sofascore.com",
};

const EXTRA_SOFA_TOURNAMENTS = [19814]; // Recopa Gaúcha

const seasonCache = new Map();
const SEASON_CACHE_TTL = 24 * 60 * 60 * 1000;

async function fetchSofaScore(url) {
  try {
    const resp = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 10000);
    if (resp.ok) return resp;
    logger.debug({ status: resp.status, url: url.split("/").pop() }, "SofaScore try 1 failed");
  } catch (error) {
    logger.debug({ error: error.message, url: url.split("/").pop() }, "SofaScore try 1 error");
  }

  try {
    const resp = await fetchWithTimeout(url, { headers: SOFASCORE_HEADERS }, 10000);
    if (resp.ok) return resp;
    logger.debug({ status: resp.status, url: url.split("/").pop() }, "SofaScore try 2 failed");
  } catch (error) {
    logger.debug({ error: error.message, url: url.split("/").pop() }, "SofaScore try 2 error");
  }

  const altUrl = url.includes("api.sofascore.com")
    ? url.replace("api.sofascore.com", "www.sofascore.com")
    : url.replace("www.sofascore.com", "api.sofascore.com");

  try {
    const resp = await fetchWithTimeout(altUrl, { headers: SOFASCORE_HEADERS }, 10000);
    if (resp.ok) return resp;
    logger.debug({ status: resp.status, url: altUrl.split("/").pop() }, "SofaScore try 3 failed");
  } catch (error) {
    logger.debug({ error: error.message, url: altUrl.split("/").pop() }, "SofaScore try 3 error");
  }

  throw new Error("SofaScore blocked");
}

const WORLD_CUP_PATTERNS = [
  /\bworld\s*cup\b/i,
  /\bfifa\s*world\s*cup\b/i,
  /\bcopa\s*do\s*mundo\b/i,
  /\bmundial\b/i,
];

function isWorldCupMatch(match) {
  if (match.tournamentId === config.worldCup.tournamentId) return true;
  const comp = `${match.competition} ${match.competitionParent ?? ""}`;
  return WORLD_CUP_PATTERNS.some((p) => p.test(comp));
}

function partitionMatches(matches) {
  const worldCup = [];
  const others = [];
  const seen = new Set();

  for (const match of matches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    if (isWorldCupMatch(match)) worldCup.push(match);
    else others.push(match);
  }

  return { worldCup, others };
}

function formatMatch(e) {
  const competition = [
    translateCompetitionName(e.tournament?.uniqueTournament?.name || ""),
    translateCompetitionName(e.tournament?.name || ""),
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    id: e.id,
    home: translateTeamName(e.homeTeam?.name || "?"),
    away: translateTeamName(e.awayTeam?.name || "?"),
    homeScore: e.homeScore?.current ?? null,
    awayScore: e.awayScore?.current ?? null,
    status: translateStatusName(e.status?.description || e.status?.type || "?"),
    statusType: e.status?.type || "",
    competition: competition || "?",
    competitionParent: translateCompetitionName(e.tournament?.uniqueTournament?.name || ""),
    tournamentId: e.tournament?.uniqueTournament?.id || e.tournament?.id || 0,
    startTimestamp: e.startTimestamp || 0,
  };
}

async function getSofaSeasonId(tournamentId) {
  const cached = seasonCache.get(tournamentId);
  if (cached && Date.now() - cached.timestamp < SEASON_CACHE_TTL) return cached.seasonId;

  const resp = await fetchSofaScore(
    `https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/seasons`
  );
  if (!resp.ok) return null;

  const data = await resp.json();
  const seasonId = data?.seasons?.[0]?.id;
  if (seasonId) seasonCache.set(tournamentId, { seasonId, timestamp: Date.now() });
  return seasonId || null;
}

async function fetchExtraTournamentMatches(todayStr) {
  const seen = new Set();
  const out = [];

  await Promise.all(
    EXTRA_SOFA_TOURNAMENTS.map(async (tid) => {
      try {
        const seasonId = await getSofaSeasonId(tid);
        if (!seasonId) return;

        const resp = await fetchSofaScore(
          `https://api.sofascore.com/api/v1/unique-tournament/${tid}/season/${seasonId}/events/next/0`
        );
        if (!resp.ok) return;

        const data = await resp.json();
        for (const e of data.events || []) {
          const eventDate = new Date((e.startTimestamp - 3 * 3600) * 1000)
            .toISOString()
            .split("T")[0];
          if (eventDate === todayStr && !seen.has(e.id)) {
            seen.add(e.id);
            out.push(e);
          }
        }
      } catch (error) {
        logger.warn({ tournamentId: tid, error: error.message }, "Extra tournament fetch failed");
      }
    })
  );

  return out.map(formatMatch);
}

export async function getLiveMatches() {
  try {
    const resp = await fetchSofaScore(
      "https://www.sofascore.com/api/v1/sport/football/events/live"
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.events?.length) {
        logger.info({ count: data.events.length }, "SofaScore live");
        return data.events.map(formatMatch);
      }
    }
  } catch (error) {
    logger.warn({ error: error.message }, "SofaScore live failed");
  }

  return fetchLiveScoreLive();
}

export async function getTodayMatches() {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];

  let mainMatches = null;

  try {
    const resp = await fetchSofaScore(
      `https://www.sofascore.com/api/v1/sport/football/scheduled-events/${today}`
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.events?.length) {
        logger.info({ count: data.events.length, date: today }, "SofaScore today");
        mainMatches = data.events.map(formatMatch);
      }
    }
  } catch (error) {
    logger.warn({ error: error.message }, "SofaScore today failed");
  }

  if (!mainMatches) {
    return fetchLiveScoreToday(today);
  }

  try {
    const extras = await fetchExtraTournamentMatches(today);
    if (extras.length > 0) {
      const seen = new Set(mainMatches.map((m) => m.id));
      const fresh = extras.filter((m) => !seen.has(m.id));
      if (fresh.length > 0) {
        logger.info({ count: fresh.length }, "Merged extra-tournament matches");
        return mainMatches.concat(fresh);
      }
    }
  } catch (error) {
    logger.warn({ error: error.message }, "Extra tournaments merge failed");
  }

  return mainMatches;
}

export async function searchTeamMatches(teamName) {
  const live = await getLiveMatches();
  const today = await getTodayMatches();
  const all = [...live, ...today];
  const query = translateTeamName(teamName);

  return all.filter((m) => teamNamesMatch(m.home, query) || teamNamesMatch(m.away, query));
}

function formatMatchLine(m) {
  const hasScore =
    m.homeScore !== null && m.homeScore !== "-" && m.awayScore !== null && m.awayScore !== "-";
  const score = hasScore ? `${m.homeScore} x ${m.awayScore}` : "vs";
  return `• ${m.home} ${score} ${m.away} — ${m.status} (${m.competition})`;
}

export function formatMatchesForPrompt(matches, limit = 15) {
  if (!matches.length) {
    return "Nenhum jogo encontrado no momento.";
  }

  return matches.slice(0, limit).map(formatMatchLine).join("\n");
}

function buildFocusedContext(matches, query) {
  const { worldCup, others } = partitionMatches(matches);
  const parts = [];

  if (config.worldCup.enabled) {
    parts.push("MODO COPA DO MUNDO ATIVO — priorize zueira sobre estes jogos.");
  }

  if (query) {
    parts.push(`Busca por "${query}":`);
  }

  if (worldCup.length) {
    parts.push(`COPA DO MUNDO:\n${formatMatchesForPrompt(worldCup, 12)}`);
  } else if (config.worldCup.enabled) {
    parts.push("COPA DO MUNDO: nenhum jogo da Copa no momento.");
  }

  if (others.length) {
    parts.push(`OUTROS JOGOS:\n${formatMatchesForPrompt(others, 8)}`);
  }

  if (!worldCup.length && !others.length) {
    return "Nenhum jogo encontrado no momento.";
  }

  return parts.join("\n\n");
}

async function fetchTournamentEvents(tournamentId, direction = "next") {
  try {
    const seasonId = await getSofaSeasonId(tournamentId);
    if (!seasonId) return [];

    const resp = await fetchSofaScore(
      `https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/events/${direction}/0`
    );
    if (!resp.ok) return [];

    const data = await resp.json();
    return (data.events || []).map(formatMatch);
  } catch (error) {
    logger.warn({ tournamentId, direction, error: error.message }, "Tournament events fetch failed");
    return [];
  }
}

function dedupeMatches(matches) {
  const seen = new Set();
  const out = [];

  for (const match of matches) {
    if (!match?.id || seen.has(match.id)) continue;
    seen.add(match.id);
    out.push(match);
  }

  return out;
}

export async function fetchMatchIncidents(eventId) {
  const resp = await fetchSofaScore(
    `https://api.sofascore.com/api/v1/event/${eventId}/incidents`
  );
  if (!resp.ok) throw new Error(`Incidents HTTP ${resp.status}`);

  const data = await resp.json();
  return data.incidents ?? [];
}

export function getLiveWorldCupMatches(matches) {
  return matches.filter(
    (m) => m.statusType === "inprogress" || m.status === "Ao vivo" || /^\d/.test(m.status)
  );
}

export async function getWorldCupMatches() {
  const [live, today, upcoming, recent] = await Promise.all([
    getLiveMatches(),
    getTodayMatches(),
    fetchTournamentEvents(config.worldCup.tournamentId, "next"),
    fetchTournamentEvents(config.worldCup.tournamentId, "last"),
  ]);

  return dedupeMatches([...live, ...today, ...upcoming, ...recent]).filter(isWorldCupMatch);
}

export async function getFootballContext(query) {
  const live = await getLiveMatches();
  const today = await getTodayMatches();
  const all = [...live, ...today];

  if (query) {
    const teamMatches = await searchTeamMatches(query);
    if (teamMatches.length) {
      return buildFocusedContext(teamMatches, query);
    }
  }

  if (all.length) {
    const label = live.length ? "Jogos agora (ao vivo + hoje)" : "Jogos de hoje";
    return `${label}:\n\n${buildFocusedContext(all)}`;
  }

  return "Dados de futebol indisponíveis no momento.";
}
