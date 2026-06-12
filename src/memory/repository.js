import { translateTeamName } from "../football/names-pt.js";
import { deduceSelectionFromClub } from "../football/teams.js";
import { getDb } from "./db.js";

export class MemoryRepository {
  ensureGroup(jid, name) {
    const db = getDb();
    db.prepare(
      `INSERT INTO groups (jid, name) VALUES (?, ?)
       ON CONFLICT(jid) DO UPDATE SET
         name = COALESCE(excluded.name, groups.name),
         updated_at = datetime('now')`
    ).run(jid, name ?? null);
  }

  ensureUser(jid, pushName) {
    const db = getDb();
    db.prepare(
      `INSERT INTO users (jid, push_name) VALUES (?, ?)
       ON CONFLICT(jid) DO UPDATE SET
         push_name = COALESCE(excluded.push_name, users.push_name),
         updated_at = datetime('now')`
    ).run(jid, pushName ?? null);
  }

  linkMember(groupJid, userJid) {
    getDb();
    this.ensureGroup(groupJid);
    this.ensureUser(userJid);
    getDb()
      .prepare(`INSERT OR IGNORE INTO group_members (group_jid, user_jid) VALUES (?, ?)`)
      .run(groupJid, userJid);
  }

  saveMessage(params) {
    const db = getDb();
    this.linkMember(params.groupJid, params.userJid);

    const result = db
      .prepare(
        `INSERT INTO messages (group_jid, user_jid, user_name, content, is_from_bot)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        params.groupJid,
        params.userJid,
        params.userName ?? null,
        params.content,
        params.isFromBot ? 1 : 0
      );

    db.prepare(
      `UPDATE groups SET message_count = message_count + 1, updated_at = datetime('now')
       WHERE jid = ?`
    ).run(params.groupJid);

    if (!params.isFromBot) {
      db.prepare(
        `UPDATE users SET interaction_count = interaction_count + 1, updated_at = datetime('now')
         WHERE jid = ?`
      ).run(params.userJid);
    }

    return Number(result.lastInsertRowid);
  }

  getRecentMessages(groupJid, limit) {
    return getDb()
      .prepare(
        `SELECT user_name, user_jid, content, is_from_bot, created_at
         FROM messages WHERE group_jid = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(groupJid, limit);
  }

  getGroup(jid) {
    return getDb().prepare(`SELECT * FROM groups WHERE jid = ?`).get(jid);
  }

  getUser(jid) {
    return getDb().prepare(`SELECT * FROM users WHERE jid = ?`).get(jid);
  }

  addFact(entityType, entityJid, fact, sourceMessageId) {
    getDb()
      .prepare(
        `INSERT INTO facts (entity_type, entity_jid, fact, source_message_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(entityType, entityJid, fact, sourceMessageId ?? null);
  }

  getFacts(entityType, entityJid, limit = 10) {
    const rows = getDb()
      .prepare(
        `SELECT fact FROM facts
         WHERE entity_type = ? AND entity_jid = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(entityType, entityJid, limit);

    return rows.map((r) => r.fact);
  }

  updateUserClub(jid, club) {
    if (!club || club.length < 2) return;
    this.ensureUser(jid);
    club = translateTeamName(club);
    const selection = deduceSelectionFromClub(club);
    getDb()
      .prepare(
        `UPDATE users SET favorite_team = ?, favorite_selection = COALESCE(?, favorite_selection),
         updated_at = datetime('now') WHERE jid = ?`
      )
      .run(club, selection, jid);
  }

  updateUserSelection(jid, selection) {
    if (!selection) return;
    this.ensureUser(jid);
    selection = translateTeamName(selection);
    getDb()
      .prepare(
        `UPDATE users SET favorite_selection = ?, updated_at = datetime('now') WHERE jid = ?`
      )
      .run(selection, jid);
  }

  updateUserTeam(jid, team, isRival = false) {
    if (isRival) {
      this.ensureUser(jid);
      getDb()
        .prepare(`UPDATE users SET rival_team = ?, updated_at = datetime('now') WHERE jid = ?`)
        .run(team, jid);
      return;
    }
    this.updateUserClub(jid, team);
  }

  updateUserPersonality(jid, personality) {
    this.ensureUser(jid);
    getDb()
      .prepare(`UPDATE users SET personality = ?, updated_at = datetime('now') WHERE jid = ?`)
      .run(personality, jid);
  }

  updateGroupVibe(jid, vibe) {
    this.ensureGroup(jid);
    getDb()
      .prepare(`UPDATE groups SET vibe = ?, updated_at = datetime('now') WHERE jid = ?`)
      .run(vibe, jid);
  }

  incrementInsultCount(jid) {
    this.ensureUser(jid);
    getDb()
      .prepare(
        `UPDATE users SET insult_count = insult_count + 1, updated_at = datetime('now')
         WHERE jid = ?`
      )
      .run(jid);
  }

  getGroupMembers(groupJid) {
    return getDb()
      .prepare(
        `SELECT u.* FROM users u
         JOIN group_members gm ON gm.user_jid = u.jid
         WHERE gm.group_jid = ?
         ORDER BY u.interaction_count DESC`
      )
      .all(groupJid);
  }

  getAllGroups() {
    return getDb()
      .prepare(`SELECT jid, name FROM groups ORDER BY message_count DESC`)
      .all();
  }

  wasMatchAlertSent(matchId, groupJid, alertType) {
    const row = getDb()
      .prepare(
        `SELECT 1 FROM match_alerts
         WHERE match_id = ? AND group_jid = ? AND alert_type = ?`
      )
      .get(matchId, groupJid, alertType);
    return Boolean(row);
  }

  recordMatchAlert(matchId, groupJid, alertType) {
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO match_alerts (match_id, group_jid, alert_type)
         VALUES (?, ?, ?)`
      )
      .run(matchId, groupJid, alertType);
  }

  wasIncidentCommented(matchId, incidentId) {
    const row = getDb()
      .prepare(
        `SELECT 1 FROM incident_comments WHERE match_id = ? AND incident_id = ?`
      )
      .get(matchId, incidentId);
    return Boolean(row);
  }

  recordIncidentComment(matchId, incidentId) {
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO incident_comments (match_id, incident_id)
         VALUES (?, ?)`
      )
      .run(matchId, incidentId);
  }

  isMatchLiveTracked(matchId) {
    const row = getDb()
      .prepare(`SELECT 1 FROM match_live_tracking WHERE match_id = ?`)
      .get(matchId);
    return Boolean(row);
  }

  markMatchLiveTracked(matchId) {
    getDb()
      .prepare(`INSERT OR IGNORE INTO match_live_tracking (match_id) VALUES (?)`)
      .run(matchId);
  }
}

export const memory = new MemoryRepository();
