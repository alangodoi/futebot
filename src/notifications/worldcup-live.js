import { formatBotMessage } from "../brain/format.js";
import { generateIncidentComment } from "../brain/live-commentary.js";
import { config } from "../config.js";
import { normalizeIncidents } from "../football/incidents.js";
import {
  fetchMatchIncidents,
  getLiveWorldCupMatches,
  getWorldCupMatches,
} from "../football/sofascore.js";
import { logger } from "../logger.js";
import { memory } from "../memory/repository.js";
import { getSocket } from "../whatsapp/client.js";

async function broadcastToGroups(text, groups, botId) {
  const sock = getSocket();
  if (!sock) return;

  for (const group of groups) {
    const message = formatBotMessage(text);
    if (!message) continue;

    await sock.sendMessage(group.jid, { text: message });
    memory.saveMessage({
      groupJid: group.jid,
      userJid: botId,
      userName: config.bot.name,
      content: message,
      isFromBot: true,
    });
  }
}

async function processLiveMatch(match, groups, botId) {
  let rawIncidents;
  try {
    rawIncidents = await fetchMatchIncidents(match.id);
  } catch (error) {
    logger.debug({ matchId: match.id, error: error.message }, "Incidents fetch failed");
    return;
  }

  const incidents = normalizeIncidents(rawIncidents, match);

  if (!memory.isMatchLiveTracked(match.id)) {
    for (const incident of incidents) {
      memory.recordIncidentComment(match.id, incident.id);
    }
    memory.markMatchLiveTracked(match.id);
    logger.info({ matchId: match.id, seeded: incidents.length }, "Lances existentes ignorados ao iniciar monitor");
    return;
  }

  for (const incident of incidents) {
    if (memory.wasIncidentCommented(match.id, incident.id)) continue;

    const comment = await generateIncidentComment(incident);
    await broadcastToGroups(comment, groups, botId);
    memory.recordIncidentComment(match.id, incident.id);

    logger.info(
      {
        matchId: match.id,
        incidentId: incident.id,
        type: incident.incidentType,
        time: incident.time,
      },
      "Comentário de lance enviado"
    );
  }
}

export async function processWorldCupLiveCommentary(botId) {
  if (!config.worldCup.enabled) return;

  const sock = getSocket();
  if (!sock) return;

  const groups = memory.getAllGroups();
  if (!groups.length) return;

  const matches = await getWorldCupMatches();
  const liveMatches = getLiveWorldCupMatches(matches);
  if (!liveMatches.length) return;

  for (const match of liveMatches) {
    await processLiveMatch(match, groups, botId);
  }
}
