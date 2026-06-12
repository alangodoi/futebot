import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";

let cache = null;

function readManifest() {
  const manifestPath = path.join(config.stickers.path, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    logger.warn({ path: manifestPath }, "manifest.json de stickers não encontrado");
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return (raw.stickers ?? []).filter((s) => s.id && s.file);
  } catch (error) {
    logger.error({ error }, "Falha ao ler manifest de stickers");
    return [];
  }
}

export function getAvailableStickers() {
  if (cache) return cache;

  const entries = readManifest();
  cache = entries
    .map((entry) => {
      const filePath = path.join(config.stickers.path, entry.file);
      if (!fs.existsSync(filePath)) {
        logger.warn({ id: entry.id, file: entry.file }, "Arquivo de sticker ausente");
        return null;
      }
      return { ...entry, filePath };
    })
    .filter(Boolean);

  logger.info({ count: cache.length }, "Stickers carregados");
  return cache;
}

export function reloadStickers() {
  cache = null;
  return getAvailableStickers();
}

export function getStickerById(stickerId) {
  return getAvailableStickers().find((s) => s.id === stickerId) ?? null;
}

export function getStickersPromptSection() {
  const stickers = getAvailableStickers();
  if (!stickers.length) return "";

  const lines = stickers.map((s) => {
    const kind = s.animated ? "animado" : "estático";
    return `- ${s.id} (${kind}): ${s.when} (tags: ${(s.tags ?? []).join(", ")})`;
  });

  return `
FIGURINHAS (COM MODERAÇÃO):
- Na MAIORIA das respostas: SÓ TEXTO. Não chame pick_sticker.
- Use figurinha só em contexto MUITO específico (xingamento pesado, lesão, torcedor de ocasião, humilhação sexual) — no máximo 1 em cada 4-5 respostas.
- Pode responder SÓ com figurinha (send_text: false) quando a figurinha já diz tudo — raro, só se não precisar de texto.
- Se te fizerem PERGUNTA direta (previsão, palpite, quem ganha, imagem, etc.): responda em TEXTO. Figurinha quase nunca.
- Se for usar figurinha com texto: pick_sticker (send_text: true ou omitido) + resposta em texto.
- e1ab98 → resposta matadora, xingamento, humilhação, destruiu na zoeira.
- c0ab17 → chegou dominando, presença, confiança, entrou pistola no grupo.
- ca378 → humilhação sexual pesada: mama aqui, chupa, vai mamar.
- 3167c → torcedor de ocasião/bandeira: some quando perde, aparece quando ganha (Formiga é o principal).
- a9e21 → jogador lesionou/machucou/desfalque (Neymar, estático).
${lines.join("\n")}`;
}

const INJURY_PATTERN =
  /\b(lesionou|lesionad[oa]|les[aã]o|machucou|machucad[oa]|contus[aã]o|entorse|fraturou|fratura|desfalque|desfalques|fora\s+(?:do|da)\s+(?:jogo|copa|partida|mundial)|n[aã]o\s+joga|saiu\s+(?:chorando|manqueando|de\s+maca)|assist[eê]ncia\s+m[eé]dica|rompeu\s+(?:o\s+)?ligamento|maldi[cç][aã]o\s+do\s+neymar|neymar\s+(?:se\s+)?(?:machucou|lesionou))\b/i;

const MAMA_AQUI_PATTERN =
  /\b(mama\s+aqui|mama\s+a[ií]|chupa\s+aqui|chupa\s+essa|vai\s+mamar|vai\s+chupar|chupa\s+minha|mama\s+minha|lambe\s+minha|lambe\s+aqui)\b/i;

const TORCEDOR_OCASIAO_PATTERN =
  /\b(torcedor\s+de\s+ocasi[aã]o|torcedor\s+de\s+momento|torcedor\s+bandeira|bandeirinha|s[oó]\s+aparece\s+quando\s+ganha|sumiu\s+quando\s+perdeu|some\s+quando\s+perde|pipoqueiro|modinho|torce\s+s[oó]\s+no\s+final|fluz[aã]o\s+sumiu)\b/i;

const FORMIGA_PATTERN = /\b(formiga|tauari)\b/i;

const TEXT_ANSWER_PATTERN =
  /\b(previs[aã]o|palpite|quem\s+(?:vai\s+)?ganh|quem\s+leva|quem\s+passa|diz\s+a[ií]|fala\s+a[ií]|me\s+(?:diz|fala)|explica|analisa|como\s+vai|qual\s+(?:a\s+)?(?:chance|placar|time)|aposta|torce\s+pra\s+quem|o\s+que\s+(?:tu\s+)?acha|acha\s+disso|acha\s+nisso|olha\s+isso|v[eê]\s+isso)\b|\?/i;

export function needsTextAnswer(message) {
  if (!message) return false;
  return TEXT_ANSWER_PATTERN.test(message);
}

export function isInjuryContext({ message, reply }) {
  const text = `${message ?? ""} ${reply ?? ""}`;
  return INJURY_PATTERN.test(text);
}

export function isMamaAquiContext({ message, reply }) {
  const text = `${message ?? ""} ${reply ?? ""}`;
  return MAMA_AQUI_PATTERN.test(text);
}

export function isTorcedorOcasionContext({ message, reply, userName, user }) {
  const text = `${message ?? ""} ${reply ?? ""} ${userName ?? ""} ${user?.push_name ?? ""} ${user?.personality ?? ""}`;
  if (TORCEDOR_OCASIAO_PATTERN.test(text)) return true;
  if (FORMIGA_PATTERN.test(text) && /\b(flu|fluminense|torc|time|perdeu|ganhou|sumiu|bandeira)\b/i.test(text)) {
    return true;
  }
  if (/formiga/i.test(userName ?? user?.push_name ?? "") && /\b(flu|fluminense|perdeu|ganhou|sumiu|torc)\b/i.test(text)) {
    return true;
  }
  if (/torcedor de ocasi[aã]o/i.test(user?.personality ?? "")) return true;
  return false;
}

export function pickStickerForContext({ insultDetected, mustRespond, reply, message, userName, user }) {
  const stickers = getAvailableStickers();
  if (!stickers.length) return null;

  const ids = new Set(stickers.map((s) => s.id));

  if (isMamaAquiContext({ message, reply }) && ids.has("ca378")) return "ca378";

  if (isInjuryContext({ message, reply }) && ids.has("a9e21")) return "a9e21";

  if (isTorcedorOcasionContext({ message, reply, userName, user }) && ids.has("3167c")) return "3167c";

  if (insultDetected && ids.has("e1ab98")) return "e1ab98";

  if (reply && /(destrui|acertou|matador|tomou no cu|fdp|arrombad|filho da puta)/i.test(reply) && ids.has("e1ab98")) {
    if (Math.random() < 0.45) return "e1ab98";
  }

  if (reply && /(domin|mito|cheguei|sou o cara|t[aá] aqui|presente)/i.test(reply) && ids.has("c0ab17")) {
    if (Math.random() < 0.2) return "c0ab17";
  }

  return null;
}

export function shouldAttachSticker({
  stickerId,
  insultDetected,
  message,
  reply,
  userName,
  user,
  fromAi = false,
  hasImage = false,
}) {
  if (!stickerId) return false;
  if (hasImage || needsTextAnswer(message)) {
    if (stickerId === "ca378" && isMamaAquiContext({ message, reply })) return true;
    if (stickerId === "a9e21" && isInjuryContext({ message, reply })) return true;
    if (stickerId === "3167c" && isTorcedorOcasionContext({ message, reply, userName, user })) return true;
    return false;
  }

  if (stickerId === "ca378" && isMamaAquiContext({ message, reply })) return true;
  if (stickerId === "a9e21" && isInjuryContext({ message, reply })) return true;
  if (stickerId === "3167c" && isTorcedorOcasionContext({ message, reply, userName, user })) return true;

  if (insultDetected && stickerId === "e1ab98") return Math.random() < 0.5;

  if (fromAi) return Math.random() < 0.22;

  return Math.random() < 0.12;
}

export function preferStickerOnly({ stickerId, message, mustRespond, hasImage = false }) {
  if (!stickerId) return false;
  if (needsTextAnswer(message)) return false;
  if (hasImage) return false;

  if (stickerId === "a9e21" && isInjuryContext({ message })) return Math.random() < 0.65;
  if (stickerId === "ca378" && isMamaAquiContext({ message })) return Math.random() < 0.45;
  if (stickerId === "3167c" && isTorcedorOcasionContext({ message })) return Math.random() < 0.4;

  if (mustRespond) return Math.random() < 0.12;
  return Math.random() < 0.2;
}

export function buildPickStickerTool() {
  const stickers = getAvailableStickers();
  if (!stickers.length) return null;

  return {
    type: "function",
    function: {
      name: "pick_sticker",
      description: "Escolhe figurinha para enviar — use com MODERAÇÃO (raro). Pode ser só figurinha (send_text: false) ou figurinha + texto.",
      parameters: {
        type: "object",
        properties: {
          sticker_id: {
            type: "string",
            enum: stickers.map((s) => s.id),
            description: "ID da figurinha escolhida",
          },
          send_text: {
            type: "boolean",
            description: "false = envia APENAS a figurinha, sem mensagem de texto",
          },
        },
        required: ["sticker_id"],
      },
    },
  };
}
