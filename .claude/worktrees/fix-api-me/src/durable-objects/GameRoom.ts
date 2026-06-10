import type { Env } from "../index";
import {
  transition,
  type MatchState,
  type Effect,
} from "../modules/MatchStateMachine";
import { validate } from "../modules/WordValidator";
import { D1Dictionary } from "../modules/D1Dictionary";
import { score } from "../modules/ScoringEngine";
import {
  persistMatch,
  type WordEntry,
  type RoundHistoryEntry,
} from "../modules/MatchPersistence";
import {
  activate as activatePowerUp,
  addToInventory,
  consumeSecondLifeOnTimeout,
  consumeLetterBomb,
  evaluateDrops,
  getLetterBombRequirement,
} from "../modules/PowerUpEngine";
import { FREEZE_DURATION_MS } from "../modules/powerups";
import type { PowerUpId } from "../modules/powerups/types";

const TURN_TIMEOUT_MS = 60_000;
const REMATCH_TIMEOUT_MS = 30_000;
const NEXT_ROUND_TIMEOUT_MS = 30_000;
const SEED_LETTERS = "abcdefghijklmnoprstw";

type AlarmKind = "turn" | "rematch" | "next_round";

function randomSeedLetter(): string {
  return SEED_LETTERS[Math.floor(Math.random() * SEED_LETTERS.length)] ?? "a";
}

interface RoomStorage {
  matchState: MatchState | null;
  playerIds: string[];
  scores: Record<string, number>;
  initialized?: boolean;
  roundHistory: RoundHistoryEntry[];
  currentRoundWords: WordEntry[];
  rematchRequests: string[];
  alarmKind?: AlarmKind | undefined;
  // Server-side per-player remaining-time tracking. Updated on each turn start
  // and adjusted when Block or Freeze affects timer state.
  turnStartAt?: number | undefined;
}

export class GameRoom implements DurableObject {
  private readonly dictionary: D1Dictionary;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    this.dictionary = new D1Dictionary(env.DB);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const stored = await this.loadRoom();
      stored.initialized = true;
      await this.saveRoom(stored);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (url.pathname === "/join") {
      return this.handleJoinCheck(request);
    }

    const stored = await this.loadRoom();
    if (!stored.initialized) {
      return Response.json({ error: "room_not_found" }, { status: 404 });
    }
    return Response.json({
      roomId: this.state.id.name ?? this.state.id.toString(),
      status: stored.matchState?.status ?? "waiting",
      players: stored.playerIds,
    });
  }

  private async handleJoinCheck(request: Request): Promise<Response> {
    const stored = await this.loadRoom();
    if (!stored.initialized) {
      return Response.json({ error: "room_not_found" }, { status: 404 });
    }
    const playerId = request.headers.get("X-Player-Id") ?? "";
    if (!stored.playerIds.includes(playerId) && stored.playerIds.length >= 2) {
      return Response.json({ error: "room_full" }, { status: 403 });
    }
    return Response.json({
      status: stored.matchState?.status ?? "waiting",
      playersConnected: stored.playerIds.length,
    });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const playerId = request.headers.get("X-Player-Id");
    if (!playerId) return new Response("Unauthorized", { status: 401 });

    const stored = await this.loadRoom();

    if (!stored.playerIds.includes(playerId) && stored.playerIds.length >= 2) {
      return new Response("Room full", { status: 403 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server, [playerId]);

    const isNew = !stored.playerIds.includes(playerId);
    if (isNew) {
      stored.playerIds.push(playerId);
      stored.scores[playerId] = 0;
      await this.saveRoom(stored);
    }

    if (stored.playerIds.length === 2 && !stored.matchState) {
      await this.startMatch(stored);
    } else if (stored.matchState) {
      server.send(
        JSON.stringify({
          type: "state_update",
          state: stored.matchState,
          scores: stored.scores,
          roundHistory: stored.roundHistory,
        })
      );
    } else {
      server.send(
        JSON.stringify({ type: "waiting", playerCount: stored.playerIds.length })
      );
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async startMatch(stored: RoomStorage): Promise<void> {
    const [p1, p2] = stored.playerIds as [string, string];
    const seedLetter = randomSeedLetter();

    const waitingState: MatchState = {
      status: "waiting",
      player1Id: p1,
      player2Id: p2,
      roundWins: { [p1]: 0, [p2]: 0 },
    };

    const result = transition(waitingState, {
      type: "start",
      player1Id: p1,
      player2Id: p2,
      seedLetter,
    });

    stored.matchState = result.state;
    stored.scores = { [p1]: 0, [p2]: 0 };
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const playerId = this.state.getTags(ws)[0];
    if (!playerId) return;

    let data: Record<string, unknown>;
    try {
      const text =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    const type = typeof data.type === "string" ? data.type : "";

    if (type === "submit_word" && typeof data.word === "string") {
      await this.handleWordSubmission(ws, playerId, (data.word as string).trim());
      return;
    }

    if (type === "rematch_request") {
      await this.handleRematchRequest(ws, playerId);
      return;
    }

    if (type === "next_round_request") {
      await this.handleNextRoundRequest(playerId);
      return;
    }

    if (type === "use_powerup" && typeof data.powerup === "string") {
      await this.handleUsePowerUp(ws, playerId, data.powerup as PowerUpId);
      return;
    }

    if (type === "send_reaction" && typeof data.reaction === "string") {
      this.broadcastAll(
        JSON.stringify({
          type: "reaction",
          fromPlayerId: playerId,
          reaction: data.reaction,
        })
      );
      return;
    }
  }

  private async handleWordSubmission(
    ws: WebSocket,
    playerId: string,
    word: string
  ): Promise<void> {
    const stored = await this.loadRoom();
    if (!stored.matchState || stored.matchState.status !== "round_active") return;
    const round = stored.matchState.currentRound;
    if (!round) return;

    if (round.currentPlayerId !== playerId) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const usedWords = new Set(round.chain);
    const requiredContainingLetter = getLetterBombRequirement(round.activeEffects, playerId);
    const validation = await validate(
      word,
      round.seedLetter,
      usedWords,
      this.dictionary,
      { requiredContainingLetter }
    );

    if (!validation.valid) {
      ws.send(
        JSON.stringify({ type: "word_result", valid: false, reason: validation.reason })
      );

      const prevRoundNumber = round.roundNumber;
      const result = transition(stored.matchState, { type: "invalidWord", playerId });
      stored.matchState = result.state;

      this.saveRoundHistoryIfEnded(stored, prevRoundNumber);

      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);
      return;
    }

    const scoreResult = score(word);
    ws.send(
      JSON.stringify({
        type: "word_result",
        valid: true,
        points: scoreResult.points,
        breakdown: scoreResult.breakdown,
      })
    );

    stored.currentRoundWords.push({
      word,
      playerId,
      points: scoreResult.points,
      breakdown: scoreResult.breakdown,
    });

    const prevRoundScore = round.playerRoundScores[playerId] ?? 0;
    const newRoundScore = prevRoundScore + scoreResult.points;

    // Evaluate power-up drops from this word.
    const evalResult = evaluateDrops({
      playerId,
      prevRoundScore,
      newRoundScore,
      breakdown: scoreResult.breakdown,
      triggers: round.dropTriggers,
    });

    // Letter Bomb on the player whose word we just validated is consumed.
    const lbConsumption = consumeLetterBomb(round.activeEffects, playerId);

    // Move state forward by the word, then patch in score + triggers + drops + effects.
    const wordResult = transition(stored.matchState, {
      type: "wordSubmitted",
      playerId,
      word,
      points: scoreResult.points,
    });
    stored.matchState = wordResult.state;

    if (stored.matchState.currentRound) {
      stored.matchState.currentRound.seedLetter =
        word[word.length - 1] ?? round.seedLetter;
      stored.matchState.currentRound.dropTriggers = evalResult.triggers;
      stored.matchState.currentRound.activeEffects = lbConsumption.activeEffects;

      // Append drops to the earning player's inventory.
      for (const drop of evalResult.drops) {
        const playerInv = stored.matchState.currentRound.powerUpInventory[drop.playerId];
        if (playerInv) {
          stored.matchState.currentRound.powerUpInventory[drop.playerId] = addToInventory(
            playerInv,
            drop.id
          );
        }
      }
    }

    // Update lobby-visible per-player scores.
    stored.scores[playerId] = (stored.scores[playerId] ?? 0) + scoreResult.points;

    // Broadcast drops as discrete events so the UI can celebrate.
    for (const drop of evalResult.drops) {
      this.broadcastAll(
        JSON.stringify({
          type: "power_up_earned",
          playerId: drop.playerId,
          powerup: drop.id,
          source: drop.source,
        })
      );
    }

    await this.saveRoom(stored);
    await this.applyEffects(wordResult.effects, stored);
  }

  private async handleRematchRequest(ws: WebSocket, playerId: string): Promise<void> {
    const stored = await this.loadRoom();
    if (stored.matchState?.status !== "match_complete") return;
    if (stored.rematchRequests.includes(playerId)) return;

    stored.rematchRequests.push(playerId);

    if (stored.rematchRequests.length === 2) {
      await this.clearAlarm(stored);
      stored.rematchRequests = [];
      stored.roundHistory = [];
      stored.currentRoundWords = [];
      await this.startMatch(stored);
    } else {
      await this.setAlarm(stored, "rematch", Date.now() + REMATCH_TIMEOUT_MS);
      await this.saveRoom(stored);
      ws.send(JSON.stringify({ type: "rematch_pending" }));
    }
  }

  private async handleNextRoundRequest(playerId: string): Promise<void> {
    const stored = await this.loadRoom();
    if (stored.matchState?.status !== "round_complete") return;

    const result = transition(stored.matchState, {
      type: "nextRoundRequested",
      playerId,
    });
    stored.matchState = result.state;
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
  }

  private async handleUsePowerUp(
    ws: WebSocket,
    playerId: string,
    powerUpId: PowerUpId
  ): Promise<void> {
    const stored = await this.loadRoom();
    if (!stored.matchState || stored.matchState.status !== "round_active") return;
    const round = stored.matchState.currentRound;
    if (!round) return;

    const opponentId =
      playerId === stored.matchState.player1Id
        ? stored.matchState.player2Id
        : stored.matchState.player1Id;

    const inventory = round.powerUpInventory[playerId];
    if (!inventory) {
      ws.send(JSON.stringify({ type: "error", message: "No inventory" }));
      return;
    }

    const result = activatePowerUp({
      inventory,
      activeEffects: round.activeEffects,
      powerUpId,
      byPlayerId: playerId,
      opponentId,
      now: Date.now(),
    });

    if (result.error) {
      ws.send(JSON.stringify({ type: "error", message: result.error }));
      return;
    }

    // Apply inventory + effects.
    round.powerUpInventory[playerId] = result.inventory;
    round.activeEffects = result.activeEffects;

    // Block: also remove opponent's last word.
    if (powerUpId === "block") {
      const blockResult = transition(stored.matchState, {
        type: "blockApplied",
        byPlayerId: playerId,
      });
      stored.matchState = blockResult.state;
      // Preserve the latest inventory/effects we just applied.
      if (stored.matchState.currentRound) {
        stored.matchState.currentRound.powerUpInventory = round.powerUpInventory;
        stored.matchState.currentRound.activeEffects = round.activeEffects;
      }

      // Adjust the seed letter to the new chain tail.
      const newChain = stored.matchState.currentRound?.chain ?? [];
      const newLastWord = newChain[newChain.length - 1];
      if (stored.matchState.currentRound) {
        stored.matchState.currentRound.seedLetter = newLastWord
          ? newLastWord[newLastWord.length - 1] ?? round.seedLetter
          : round.seedLetter;
      }

      this.broadcastAll(
        JSON.stringify({
          type: "power_up_activated",
          powerup: "block",
          byPlayerId: playerId,
          targetPlayerId: opponentId,
        })
      );

      await this.saveRoom(stored);
      await this.applyEffects(blockResult.effects, stored);
      return;
    }

    this.broadcastAll(
      JSON.stringify({
        type: "power_up_activated",
        powerup: powerUpId,
        byPlayerId: playerId,
        targetPlayerId:
          result.effect && "onPlayerId" in result.effect
            ? result.effect.onPlayerId
            : null,
        effect: result.effect ?? null,
      })
    );

    await this.saveRoom(stored);
    // Force a broadcast so both sides see updated inventory + active effects.
    await this.applyEffects([{ type: "broadcastState" }], stored);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const playerId = this.state.getTags(ws)[0];
    if (playerId) {
      this.broadcastExcept(
        playerId,
        JSON.stringify({ type: "opponent_disconnected" })
      );
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const playerId = this.state.getTags(ws)[0];
    if (playerId) {
      this.broadcastExcept(
        playerId,
        JSON.stringify({ type: "opponent_disconnected" })
      );
    }
  }

  async alarm(): Promise<void> {
    const stored = await this.loadRoom();
    const kind = stored.alarmKind;
    stored.alarmKind = undefined;

    if (kind === "rematch") {
      if (stored.matchState?.status === "match_complete" && stored.rematchRequests.length > 0) {
        this.broadcastToPlayer(
          stored.rematchRequests[0]!,
          JSON.stringify({ type: "rematch_timeout" })
        );
      }
      stored.rematchRequests = [];
      await this.saveRoom(stored);
      return;
    }

    if (kind === "next_round") {
      if (
        stored.matchState?.status !== "round_complete" ||
        !stored.matchState.roundEndContext
      ) {
        await this.saveRoom(stored);
        return;
      }
      const ctx = stored.matchState.roundEndContext;
      // Whichever player has NOT confirmed forfeits. If both confirmed we'd
      // never get here (alarm would have been cleared).
      const absentPlayerId =
        stored.matchState.player1Id === ctx.nextRoundConfirmations[0]
          ? stored.matchState.player2Id
          : stored.matchState.player1Id;

      const result = transition(stored.matchState, {
        type: "nextRoundTimeout",
        absentPlayerId,
      });

      const prevRoundNumber = stored.matchState.currentRound?.roundNumber ?? 0;
      stored.matchState = result.state;
      this.saveRoundHistoryIfEnded(stored, prevRoundNumber);

      this.broadcastAll(
        JSON.stringify({ type: "forfeit", absentPlayerId })
      );

      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);
      return;
    }

    // Default — turn timeout.
    if (
      !stored.matchState ||
      stored.matchState.status !== "round_active" ||
      !stored.matchState.currentRound
    )
      return;

    const round = stored.matchState.currentRound;
    const timedOutPlayerId = round.currentPlayerId;

    // Check Second Life consumption first — if armed for this player, the
    // round continues and faults are not incremented.
    const slCheck = consumeSecondLifeOnTimeout(round.activeEffects, timedOutPlayerId);
    if (slCheck.consumed) {
      round.activeEffects = slCheck.activeEffects;
      this.broadcastAll(
        JSON.stringify({
          type: "second_life_consumed",
          playerId: timedOutPlayerId,
        })
      );
      const result = transition(stored.matchState, {
        type: "turnTimeout",
        playerId: timedOutPlayerId,
        secondLifeConsumed: true,
      });
      stored.matchState = result.state;
      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);
      return;
    }

    const prevRoundNumber = round.roundNumber;
    const result = transition(stored.matchState, {
      type: "turnTimeout",
      playerId: timedOutPlayerId,
    });

    stored.matchState = result.state;
    this.saveRoundHistoryIfEnded(stored, prevRoundNumber);

    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
  }

  // Checks whether the round just ended after a state transition and, if so,
  // archives the current round's words into roundHistory.
  private saveRoundHistoryIfEnded(stored: RoomStorage, prevRoundNumber: number): void {
    const newState = stored.matchState;
    if (!newState) return;

    const matchComplete = newState.status === "match_complete";
    const roundComplete = newState.status === "round_complete";
    const newRoundNumber = newState.currentRound?.roundNumber ?? prevRoundNumber;

    // Round ended if: match completed, OR we entered round_complete, OR new round started.
    const ended = matchComplete || roundComplete || newRoundNumber > prevRoundNumber;
    if (!ended) return;

    let winnerId = "";
    if (matchComplete) {
      winnerId =
        newState.currentRound?.roundWinnerId ?? newState.matchWinnerId ?? "";
    } else if (roundComplete) {
      winnerId = newState.roundEndContext?.winnerId ?? "";
    } else {
      winnerId = newState.currentRound?.currentPlayerId ?? "";
    }

    stored.roundHistory.push({
      roundNumber: prevRoundNumber,
      winnerId,
      words: [...stored.currentRoundWords],
    });
    stored.currentRoundWords = [];
  }

  private async applyEffects(
    effects: Effect[],
    stored: RoomStorage
  ): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case "broadcastState":
          this.broadcastAll(
            JSON.stringify({
              type: "state_update",
              state: stored.matchState,
              scores: stored.scores,
              roundHistory: stored.roundHistory,
            })
          );
          break;
        case "startTimer": {
          let timeoutMs = TURN_TIMEOUT_MS;
          const round = stored.matchState?.currentRound;
          if (round) {
            const idx = round.activeEffects.findIndex(
              (e) => e.kind === "freeze" && e.onPlayerId === round.currentPlayerId
            );
            if (idx >= 0) {
              // Freeze: cuts FREEZE_DURATION_MS off the affected player's turn timer.
              timeoutMs = Math.max(5_000, TURN_TIMEOUT_MS - FREEZE_DURATION_MS);
              round.activeEffects = round.activeEffects.filter((_, i) => i !== idx);
            }
          }
          await this.setAlarm(stored, "turn", Date.now() + timeoutMs);
          stored.turnStartAt = Date.now();
          break;
        }
        case "stopTimer":
          if (stored.alarmKind === "turn") {
            await this.clearAlarm(stored);
          }
          break;
        case "startNextRoundTimeout":
          await this.setAlarm(stored, "next_round", Date.now() + NEXT_ROUND_TIMEOUT_MS);
          break;
        case "stopNextRoundTimeout":
          if (stored.alarmKind === "next_round") {
            await this.clearAlarm(stored);
          }
          break;
        case "matchOver":
          await persistMatch(this.env, {
            player1Id: stored.playerIds[0] ?? "",
            player2Id: stored.playerIds[1] ?? "",
            winnerId: effect.winnerId,
            roundWins: stored.matchState?.roundWins ?? {},
            roundHistory: stored.roundHistory,
          });
          break;
      }
    }
  }

  private async setAlarm(stored: RoomStorage, kind: AlarmKind, at: number): Promise<void> {
    stored.alarmKind = kind;
    await this.state.storage.setAlarm(at);
    await this.saveRoom(stored);
  }

  private async clearAlarm(stored: RoomStorage): Promise<void> {
    stored.alarmKind = undefined;
    await this.state.storage.deleteAlarm();
    await this.saveRoom(stored);
  }

  private broadcastAll(message: string): void {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // socket already closed
      }
    }
  }

  private broadcastExcept(excludePlayerId: string, message: string): void {
    for (const ws of this.state.getWebSockets()) {
      if (this.state.getTags(ws)[0] !== excludePlayerId) {
        try {
          ws.send(message);
        } catch {
          // socket already closed
        }
      }
    }
  }

  private broadcastToPlayer(playerId: string, message: string): void {
    for (const ws of this.state.getWebSockets()) {
      if (this.state.getTags(ws)[0] === playerId) {
        try {
          ws.send(message);
        } catch {
          // socket already closed
        }
      }
    }
  }

  private async loadRoom(): Promise<RoomStorage> {
    return (
      (await this.state.storage.get<RoomStorage>("room")) ?? {
        matchState: null,
        playerIds: [],
        scores: {},
        roundHistory: [],
        currentRoundWords: [],
        rematchRequests: [],
      }
    );
  }

  private async saveRoom(stored: RoomStorage): Promise<void> {
    await this.state.storage.put("room", stored);
  }
}

