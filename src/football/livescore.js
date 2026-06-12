import { logger } from "../logger.js";
import { translateCompetitionName, translateTeamName } from "./names-pt.js";

export function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function formatLiveScoreMatch(e, comp, compParent) {
  const t1 = e.T1?.[0] || {};
  const t2 = e.T2?.[0] || {};
  const eps = e.Eps || "";
  let status = eps;

  if (eps === "HT") status = "Intervalo";
  else if (eps === "FT" || eps === "AET" || eps === "AP") status = "Encerrado";
  else if (eps === "NS" || eps === "Postp.") status = "Não iniciado";
  else if (/^\d+/.test(eps)) status = `${eps}'`;

  const competitionParent = translateCompetitionName(compParent);
  const competitionStage = translateCompetitionName(comp);
  const competition =
    competitionParent && competitionStage
      ? `${competitionParent} - ${competitionStage}`
      : competitionStage || competitionParent || "?";

  return {
    id: parseInt(e.Eid, 10) || 0,
    home: translateTeamName(t1.Nm || "?"),
    away: translateTeamName(t2.Nm || "?"),
    homeScore: e.Tr1 ?? null,
    awayScore: e.Tr2 ?? null,
    status,
    competition,
  };
}

export async function fetchLiveScoreLive() {
  try {
    const resp = await fetchWithTimeout(
      "https://prod-public-api.livescore.com/v1/api/app/live/soccer/0",
      { headers: { "User-Agent": "Mozilla/5.0" } },
      10000
    );
    if (!resp.ok) return [];

    const data = await resp.json();
    const matches = [];

    for (const stage of data.Stages || []) {
      const comp = stage.Snm || "";
      const compParent = stage.Cnm || "";
      for (const e of stage.Events || []) {
        matches.push(formatLiveScoreMatch(e, comp, compParent));
      }
    }

    logger.info({ count: matches.length }, "LiveScore live fallback");
    return matches;
  } catch (error) {
    logger.warn({ error: error.message }, "LiveScore live falhou");
    return [];
  }
}

export async function fetchLiveScoreToday(dateStr) {
  try {
    const d = dateStr.replace(/-/g, "");
    const resp = await fetchWithTimeout(
      `https://prod-public-api.livescore.com/v1/api/app/date/soccer/${d}/0`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
      10000
    );
    if (!resp.ok) return [];

    const data = await resp.json();
    const matches = [];

    for (const stage of data.Stages || []) {
      const comp = stage.Snm || "";
      const compParent = stage.Cnm || "";
      for (const e of stage.Events || []) {
        matches.push(formatLiveScoreMatch(e, comp, compParent));
      }
    }

    logger.info({ count: matches.length, date: dateStr }, "LiveScore today fallback");
    return matches;
  } catch (error) {
    logger.warn({ error: error.message }, "LiveScore today falhou");
    return [];
  }
}
