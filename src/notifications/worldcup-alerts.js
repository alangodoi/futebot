import { formatBotMessage } from "../brain/format.js";
import { config } from "../config.js";
import { getWorldCupMatches } from "../football/sofascore.js";
import { logger } from "../logger.js";
import { memory } from "../memory/repository.js";
import { getSocket } from "../whatsapp/client.js";
import { processWorldCupLiveCommentary } from "./worldcup-live.js";

const PREVIEW_SECONDS = 10 * 60;
const KICKOFF_GRACE_SECONDS = 5 * 60;

let timer = null;
let running = false;

function formatKickoffTime(startTimestamp) {
  return new Date(startTimestamp * 1000).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isBrazilMatch(match) {
  return match.home === "Brasil" || match.away === "Brasil";
}

function buildPreviewMessage(match) {
  const time = formatKickoffTime(match.startTimestamp);

  if (isBrazilMatch(match)) {
    return `porra falta 10 min pro BRASIL jogar caraiii ${match.home} x ${match.away} às ${time}, já abre a cerveja e prepara o coração`;
  }

  return `ei falta 10 min pra ${match.home} x ${match.away} às ${time}, copa rolando, cola no bar aí`;
}

function buildKickoffMessage(match) {
  if (isBrazilMatch(match)) {
    return `BORA BRASIL PORRAAA ${match.home} x ${match.away} COMEÇOU!! VAI VERDE E AMARELO CARAI`;
  }

  return `começou ${match.home} x ${match.away}, bora ver quem vai se foder na copa hoje`;
}

async function sendGroupAlert(groupJid, text, botId) {
  const sock = getSocket();
  if (!sock) return false;

  const message = formatBotMessage(text);
  if (!message) return false;

  await sock.sendMessage(groupJid, { text: message });
  memory.saveMessage({
    groupJid,
    userJid: botId,
    userName: config.bot.name,
    content: message,
    isFromBot: true,
  });
  return true;
}

async function processMatchAlerts(match, groups, botId, nowSec) {
  if (!match.startTimestamp) return;

  const secondsUntil = match.startTimestamp - nowSec;
  const secondsSince = nowSec - match.startTimestamp;
  const isFinished = match.statusType === "finished" || match.status === "Encerrado";

  const shouldPreview =
    secondsUntil > 0 &&
    secondsUntil <= PREVIEW_SECONDS &&
    match.statusType !== "inprogress" &&
    !isFinished;

  const shouldKickoff =
    secondsSince >= 0 &&
    secondsSince <= KICKOFF_GRACE_SECONDS &&
    !isFinished &&
    (match.statusType === "inprogress" || secondsSince <= 90);

  for (const group of groups) {
    if (shouldPreview && !memory.wasMatchAlertSent(match.id, group.jid, "preview_10m")) {
      const text = buildPreviewMessage(match);
      await sendGroupAlert(group.jid, text, botId);
      memory.recordMatchAlert(match.id, group.jid, "preview_10m");
      logger.info(
        { matchId: match.id, group: group.name ?? group.jid, type: "preview_10m" },
        "Alerta Copa enviado"
      );
    }

    if (shouldKickoff && !memory.wasMatchAlertSent(match.id, group.jid, "kickoff")) {
      const text = buildKickoffMessage(match);
      await sendGroupAlert(group.jid, text, botId);
      memory.recordMatchAlert(match.id, group.jid, "kickoff");
      logger.info(
        { matchId: match.id, group: group.name ?? group.jid, type: "kickoff" },
        "Alerta Copa enviado"
      );
    }
  }
}

async function tick(botId) {
  if (running) return;
  running = true;

  try {
    if (!config.worldCup.enabled) return;

    const sock = getSocket();
    if (!sock) return;

    const groups = memory.getAllGroups();
    if (!groups.length) return;

    const matches = await getWorldCupMatches();
    const nowSec = Math.floor(Date.now() / 1000);

    for (const match of matches) {
      await processMatchAlerts(match, groups, botId, nowSec);
    }

    await processWorldCupLiveCommentary(botId);
  } catch (error) {
    logger.error({ error }, "Falha no ciclo de alertas da Copa");
  } finally {
    running = false;
  }
}

export function startWorldCupAlerts(sock) {
  if (timer) return;
  if (!config.worldCup.enabled) {
    logger.info("Alertas da Copa desativados (fora do período)");
    return;
  }

  const botId = sock.user?.id ?? sock.authState?.creds?.me?.id;
  if (!botId) {
    logger.warn("Bot sem ID — alertas da Copa não iniciados");
    return;
  }

  const intervalMs = config.worldCup.alertPollIntervalMs;
  logger.info({ intervalSec: intervalMs / 1000 }, "Monitor da Copa iniciado (alertas + lances)");

  tick(botId);
  timer = setInterval(() => tick(botId), intervalMs);
}

export function stopWorldCupAlerts() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
