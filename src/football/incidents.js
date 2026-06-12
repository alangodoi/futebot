import { translateTeamName } from "./names-pt.js";

const VAR_CLASS_PT = {
  goalAwarded: "gol confirmado",
  goalCancelled: "gol anulado",
  goalNotAwarded: "gol não concedido",
  penaltyAwarded: "pênalti marcado",
  penaltyCancelled: "pênalti cancelado",
  penaltyNotAwarded: "pênalti não marcado",
  redCardGiven: "cartão vermelho confirmado",
  redCardCancelled: "cartão vermelho cancelado",
  cardUpgrade: "cartão virou vermelho",
  mistakenIdentity: "erro de identidade",
  other: "lance revisado",
};

const GOAL_CLASS_PT = {
  regular: "gol",
  penalty: "gol de pênalti",
  ownGoal: "gol contra",
};

const RIVAL_SELECTIONS = new Set([
  "Argentina",
  "França",
  "Alemanha",
  "Espanha",
  "Inglaterra",
  "Portugal",
  "Holanda",
  "Itália",
  "Uruguai",
  "Colômbia",
  "México",
]);

export function isRelevantIncident(incident) {
  if (!incident?.incidentType) return false;

  if (incident.incidentType === "goal") return true;
  if (incident.incidentType === "varDecision") return true;
  if (incident.incidentType === "card") {
    return incident.incidentClass === "red" || incident.incidentClass === "yellowRed";
  }

  return false;
}

export function isCommentWorthy(normalized) {
  if (normalized.isBrazilMatch) return true;

  const { incidentType, incidentClass, time, home, away, homeScore, awayScore } = normalized;

  if (incidentType === "card" || incidentType === "varDecision") return true;

  if (incidentType === "goal") {
    if (incidentClass === "penalty" || incidentClass === "ownGoal") return true;
    if (time >= 80) return true;

    const homeGoals = homeScore ?? 0;
    const awayGoals = awayScore ?? 0;
    const total = homeGoals + awayGoals;
    const diff = Math.abs(homeGoals - awayGoals);

    if (RIVAL_SELECTIONS.has(home) || RIVAL_SELECTIONS.has(away)) return true;
    if (total >= 5 || diff >= 3) return true;
    if (total >= 2 && diff <= 1) return true;
  }

  return false;
}

export function getIncidentId(incident, matchId) {
  if (incident.id) return String(incident.id);

  const player = incident.playerName || incident.player?.name || "";
  return `${matchId}-${incident.time}-${incident.incidentType}-${incident.incidentClass || ""}-${player}`;
}

function formatTime(incident) {
  if (incident.addedTime) return `${incident.time}+${incident.addedTime}'`;
  return `${incident.time}'`;
}

function teamSide(match, isHome) {
  return isHome ? match.home : match.away;
}

function isBrazil(team) {
  return team === "Brasil";
}

export function describeIncident(incident, match) {
  const time = formatTime(incident);
  const side = teamSide(match, incident.isHome);
  const player = incident.playerName || incident.player?.name || "jogador";
  const score = formatScore(match);

  if (incident.incidentType === "goal") {
    const kind = GOAL_CLASS_PT[incident.incidentClass] || "gol";
    if (isBrazil(side)) {
      return `${time} GOL DO BRASIL! ${player} (${kind}). ${score}`;
    }
    if (isBrazil(match.home) || isBrazil(match.away)) {
      return `${time} gol do ${side} contra o Brasil, ${player} (${kind}). ${score}`;
    }
    return `${time} gol do ${side}, ${player} (${kind}). ${score}`;
  }

  if (incident.incidentType === "card") {
    const reason = incident.reason ? ` — ${incident.reason}` : "";
    return `${time} vermelho pro ${side}, ${player} foi expulso${reason}. ${match.home} x ${match.away}`;
  }

  if (incident.incidentType === "varDecision") {
    const decision = VAR_CLASS_PT[incident.incidentClass] || incident.incidentClass || "revisão";
    return `${time} VAR no ${match.home} x ${match.away}: ${decision}`;
  }

  return `${time} lance no ${match.home} x ${match.away}`;
}

function formatScore(match) {
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  return `${match.home} ${home} x ${away} ${match.away}`;
}

export function normalizeIncidents(rawIncidents, match) {
  const home = translateTeamName(match.home);
  const away = translateTeamName(match.away);

  return (rawIncidents ?? [])
    .filter(isRelevantIncident)
    .map((incident) => {
      const scoringTeam = incident.isHome ? home : away;
      const brazilScored = incident.incidentType === "goal" && scoringTeam === "Brasil";
      const brazilConceded =
        incident.incidentType === "goal" &&
        (home === "Brasil" || away === "Brasil") &&
        scoringTeam !== "Brasil";

      return {
        id: getIncidentId(incident, match.id),
        incidentType: incident.incidentType,
        incidentClass: incident.incidentClass || "",
        time: incident.time ?? 0,
        description: describeIncident(incident, { ...match, home, away }),
        matchId: match.id,
        home,
        away,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        isBrazilMatch: home === "Brasil" || away === "Brasil",
        brazilScored,
        brazilConceded,
        hasRival: RIVAL_SELECTIONS.has(home) || RIVAL_SELECTIONS.has(away),
      };
    })
    .filter(isCommentWorthy);
}
