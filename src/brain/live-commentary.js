import OpenAI from "openai";
import { config } from "../config.js";
import { formatBotMessage } from "./format.js";
import { logger } from "../logger.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const LIVE_SYSTEM = `Você é o ${config.bot.name} — brasileiro, torcedor da SELEÇÃO BRASILEIRA, gritando no grupo do WhatsApp do bar.

REGRAS DE TOM:
- Papo de bar, NÃO notificação. Nada de "⏰", "alerta", "placar atualizado", tom de app.
- Exemplos do estilo certo: "GOOOOL DO BRASIL CARAIOOO", "tomou no cu essa defesa", "VAR filho da puta anulou", "vermelho merecido porra".
- 1-2 frases curtas, maiúsculas quando empolgar, palavrão natural.
- PROIBIDO usar travessão (—). Use vírgula ou ponto.
- Se for gol DO BRASIL: comemora igual torcedor louco.
- Se o BRASIL tomou gol: reclama, xinga defesa/jogo.
- Em jogos SEM o Brasil: comenta lances relevantes com zueira de torcedor brasileiro — ri do rival pipocando, goleada, VAR polêmico, gol nos acréscimos.
- Pode zoar Argentina, França, Alemanha e outros candidatos quando der ruim pra eles.
- Proibido ser neutro, formal ou jornalístico.`;

function buildFallback(incident) {
  const { incidentType, brazilScored, brazilConceded, description } = incident;

  if (incidentType === "goal" && brazilScored) {
    return `GOOOOL DO BRASIL CARAIOOO PORRA!! ${description}`;
  }
  if (incidentType === "goal" && brazilConceded) {
    return `que merda é essa tomou gol caralho... ${description}`;
  }
  if (incidentType === "goal") {
    if (incident.hasRival) {
      return `gol nessa merda! ${incident.home} x ${incident.away}, bora ver quem pipoca ${description}`;
    }
    return `gol nessa porra! ${incident.home} x ${incident.away}, ${description}`;
  }
  if (incidentType === "card") {
    return `VERMELHO caralho! ${incident.home} x ${incident.away}, ${description}`;
  }
  if (incidentType === "varDecision") {
    return incident.isBrazilMatch
      ? `VAR do caralho mexe no jogo do Brasil... ${description}`
      : `VAR bagunçando ${incident.home} x ${incident.away}, ${description}`;
  }

  return description;
}

function buildCompletionOptions() {
  const model = config.openai.model;
  const isGpt5 = /^gpt-5/.test(model);
  const isChatLatest = model.includes("chat-latest");

  return {
    model,
    ...(isGpt5 ? { max_completion_tokens: 120 } : { max_tokens: 120 }),
    ...(isChatLatest
      ? {}
      : {
          temperature: 1.15,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
        }),
  };
}

export async function generateIncidentComment(incident) {
  const fallback = buildFallback(incident);

  const context = [
    incident.description,
    incident.isBrazilMatch
      ? "Jogo com a SELEÇÃO BRASILEIRA."
      : `Outro jogo da Copa: ${incident.home} x ${incident.away}. Comente porque o lance é relevante.`,
    incident.hasRival ? "Tem seleção rival/candidata — pode zoar se fizer sentido." : null,
    incident.brazilScored ? "ACABOU DE SAIR GOL DO BRASIL." : null,
    incident.brazilConceded ? "O BRASIL TOMOU GOL." : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      ...buildCompletionOptions(),
      messages: [
        { role: "system", content: LIVE_SYSTEM },
        {
          role: "user",
          content: `Lance ao vivo na Copa:\n${context}\n\nGrita no zap como torcedor brasileiro no bar.`,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return formatBotMessage(reply) || formatBotMessage(fallback);
  } catch (error) {
    logger.warn({ error: error.message }, "Falha ao gerar comentário de lance");
    return formatBotMessage(fallback);
  }
}
