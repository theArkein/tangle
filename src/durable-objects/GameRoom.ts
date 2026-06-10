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
  consumeLetterBomb,
  evaluateDrops,
  getLetterBombRequirement,
  isWildPending,
  consumeWild,
  decrementDouble,
  getDoubleScore,
  getAnchor,
  consumeAnchor,
} from "../modules/PowerUpEngine";
import type { PowerUpId } from "../modules/powerups/types";
import {
  DANGER_ZONE_CHAIN_THRESHOLD,
  DANGER_ZONE_MULTIPLIER,
  DANGER_ZONE_TIMER_MS,
} from "../modules/powerups/pools";
import {
  getModeConfig,
  isValidGameMode,
  type GameMode,
} from "../modules/gameModes";

const REMATCH_TIMEOUT_MS = 30_000;
const NEXT_ROUND_TIMEOUT_MS = 30_000;
const SEED_LETTERS = "abcdefghijklmnoprstw";

type AlarmKind = "turn" | "rematch" | "next_round" | "bot_turn";

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
  turnStartAt?: number | undefined;
  gameMode?: GameMode | undefined;
  botPlayerId?: string | undefined;
}

export class GameRoom implements DurableObject {
  private readonly dictionary: D1Dictionary;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    this.dictionary = new D1Dictionary(env.DB);
  }

  private get dangerZoneEnabled(): boolean {
    return this.env.DANGER_ZONE_ENABLED === "true";
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const stored = await this.loadRoom();
      stored.initialized = true;
      try {
        const body = (await request.json()) as { mode?: unknown };
        if (isValidGameMode(body.mode)) stored.gameMode = body.mode;
      } catch {
        // No body — leave as default
      }
      await this.saveRoom(stored);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/add-bot" && request.method === "POST") {
      const stored = await this.loadRoom();
      if (!stored.playerIds.includes("bot")) {
        stored.playerIds.push("bot");
        stored.scores["bot"] = 0;
        stored.botPlayerId = "bot";
      }
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
      mode: stored.gameMode ?? "duel",
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
      mode: stored.gameMode ?? "duel",
    });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const playerId = request.headers.get("X-Player-Id");
    if (!playerId) return new Response("Unauthorized", { status: 401 });

    const stored = await this.loadRoom();

    if (!stored.playerIds.includes(playerId) && stored.playerIds.length >= 2) {
      return new Response("Room full", { status: 403 });
    }

    if (!stored.gameMode) {
      const roomName = this.state.id.name ?? this.state.id.toString();
      const mode = await this.env.KV.get(`match:room:${roomName}:mode`);
      if (isValidGameMode(mode)) stored.gameMode = mode;
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
      this.broadcastStateToPlayer(server, playerId, stored);
    } else {
      server.send(
        JSON.stringify({
          type: "waiting",
          playerCount: stored.playerIds.length,
          mode: stored.gameMode ?? "duel",
        })
      );
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async startMatch(stored: RoomStorage): Promise<void> {
    const [p1, p2] = stored.playerIds as [string, string];
    const seedLetter = randomSeedLetter();
    const mode: GameMode = stored.gameMode ?? "duel";

    const waitingState: MatchState = {
      status: "waiting",
      player1Id: p1,
      player2Id: p2,
      roundWins: { [p1]: 0, [p2]: 0 },
      gameMode: mode,
    };

    const result = transition(waitingState, {
      type: "start",
      player1Id: p1,
      player2Id: p2,
      seedLetter,
      gameMode: mode,
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

    const opponentId =
      playerId === stored.matchState.player1Id
        ? stored.matchState.player2Id
        : stored.matchState.player1Id;

    const usedWords = new Set(round.chain);
    const requiredContainingLetter = getLetterBombRequirement(round.activeEffects, playerId);
    const anchorEffect = getAnchor(round.activeEffects, playerId);
    const minLength = anchorEffect?.minLength;
    const skipLetterCheck = isWildPending(round.activeEffects, playerId);

    const validation = await validate(
      word,
      round.seedLetter,
      usedWords,
      this.dictionary,
      { requiredContainingLetter, minLength, skipLetterCheck }
    );

    if (!validation.valid) {
      ws.send(
        JSON.stringify({ type: "word_result", valid: false, reason: validation.reason })
      );

      const result = transition(stored.matchState, { type: "invalidWord", playerId });
      stored.matchState = result.state;

      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);

      // Deduct 2 seconds from the remaining turn time for an invalid word.
      if (stored.matchState?.status === "round_active" && stored.turnStartAt !== undefined) {
        const currentAlarm = await this.state.storage.getAlarm();
        if (currentAlarm !== null) {
          const newAlarm = Math.max(Date.now() + 1_000, currentAlarm - 2_000);
          await this.state.storage.setAlarm(newAlarm);
          stored.turnStartAt -= 2_000;
          await this.saveRoom(stored);
          this.broadcastStateAll(stored);
        }
      }
      return;
    }

    const chainLengthAfter = round.chain.length + 1;
    const wasDangerZone = this.dangerZoneEnabled && round.chain.length >= DANGER_ZONE_CHAIN_THRESHOLD;
    const isDangerZone = this.dangerZoneEnabled && chainLengthAfter >= DANGER_ZONE_CHAIN_THRESHOLD;
    const justEnteredDangerZone = isDangerZone && !wasDangerZone;

    // Determine multiplier: DZ takes precedence over doubleScore — they do not stack.
    const doubleEffect = getDoubleScore(round.activeEffects, playerId);
    const multiplier = isDangerZone
      ? DANGER_ZONE_MULTIPLIER
      : doubleEffect
      ? 2
      : 1;

    const scoreResult = score(word, { multiplier });
    ws.send(
      JSON.stringify({
        type: "word_result",
        valid: true,
        points: scoreResult.points,
        breakdown: scoreResult.breakdown,
        multiplier: scoreResult.multiplier,
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

    // Consume single-turn effects.
    let effectsAfter = round.activeEffects;
    effectsAfter = consumeLetterBomb(effectsAfter, playerId).activeEffects;
    if (anchorEffect) effectsAfter = consumeAnchor(effectsAfter, playerId);
    if (skipLetterCheck) effectsAfter = consumeWild(effectsAfter, playerId);
    if (doubleEffect && !isDangerZone) effectsAfter = decrementDouble(effectsAfter, playerId);

    // Evaluate deterministic power-up drops.
    const evalResult = evaluateDrops({
      playerId,
      opponentId,
      word,
      scoreResult,
      prevRoundScore,
      newRoundScore,
      triggers: round.dropTriggers,
      isDangerZone,
      justEnteredDangerZone,
    });

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
      stored.matchState.currentRound.activeEffects = effectsAfter;

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

    stored.scores[playerId] = (stored.scores[playerId] ?? 0) + scoreResult.points;

    if (justEnteredDangerZone) {
      this.broadcastAll(JSON.stringify({ type: "danger_zone_entered" }));
    }

    for (const drop of evalResult.drops) {
      this.broadcastAll(
        JSON.stringify({
          type: "power_up_earned",
          playerId: drop.playerId,
          powerup: drop.id,
        })
      );
    }

    this.saveRoundHistoryIfEnded(stored, round.roundNumber);

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

    const modeConfig = getModeConfig(stored.matchState.gameMode);
    if (!modeConfig.powerUpsEnabled) {
      ws.send(JSON.stringify({ type: "error", message: "powerups_disabled" }));
      return;
    }

    const opponentId =
      playerId === stored.matchState.player1Id
        ? stored.matchState.player2Id
        : stored.matchState.player1Id;

    const inventory = round.powerUpInventory[playerId];
    if (!inventory) {
      ws.send(JSON.stringify({ type: "error", message: "No inventory" }));
      return;
    }

    // Second Life — instant timer reset; handled separately (no ActiveEffect needed).
    if (powerUpId === "secondLife") {
      if ((inventory.secondLife ?? 0) <= 0) {
        ws.send(JSON.stringify({ type: "error", message: "not_in_inventory" }));
        return;
      }
      round.powerUpInventory[playerId] = {
        ...inventory,
        secondLife: inventory.secondLife - 1,
      };
      const inDZ =
        this.dangerZoneEnabled &&
        (round.chain.length) >= DANGER_ZONE_CHAIN_THRESHOLD;
      const resetMs = inDZ ? DANGER_ZONE_TIMER_MS : modeConfig.turnTimeoutMs;
      stored.turnStartAt = Date.now();
      await this.saveRoom(stored);
      await this.state.storage.setAlarm(Date.now() + resetMs);
      this.broadcastAll(
        JSON.stringify({
          type: "second_life_consumed",
          playerId,
          byPlayerId: playerId,
        })
      );
      this.broadcastStateAll(stored);
      return;
    }

    const result = activatePowerUp({
      inventory,
      activeEffects: round.activeEffects,
      powerUpId,
      byPlayerId: playerId,
      opponentId,
    });

    if (result.error) {
      ws.send(JSON.stringify({ type: "error", message: result.error }));
      return;
    }

    round.powerUpInventory[playerId] = result.inventory;
    round.activeEffects = result.activeEffects;

    // Freeze — extend current alarm by 5 seconds.
    if (result.alarmDeltaMs) {
      const currentAlarm = await this.state.storage.getAlarm();
      if (currentAlarm !== null) {
        await this.state.storage.setAlarm(currentAlarm + result.alarmDeltaMs);
        stored.turnStartAt = (stored.turnStartAt ?? Date.now()) + result.alarmDeltaMs;
      }
    }

    // Tax — deduct 10 from opponent's round score and match score (floor at 0).
    if (result.taxOpponent) {
      const opponentRoundScore = round.playerRoundScores[opponentId] ?? 0;
      round.playerRoundScores[opponentId] = Math.max(0, opponentRoundScore - 10);
      stored.scores[opponentId] = Math.max(0, (stored.scores[opponentId] ?? 0) - 10);
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

    if (kind === "bot_turn") {
      await this.handleBotTurn(stored);
      return;
    }

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

    if (
      !stored.matchState ||
      stored.matchState.status !== "round_active" ||
      !stored.matchState.currentRound
    )
      return;

    const round = stored.matchState.currentRound;
    const timedOutPlayerId = round.currentPlayerId;

    // Second Life — auto-activates on timeout if player has one in inventory.
    const inventory = round.powerUpInventory[timedOutPlayerId];
    if ((inventory?.secondLife ?? 0) > 0) {
      round.powerUpInventory[timedOutPlayerId] = {
        ...inventory!,
        secondLife: inventory!.secondLife - 1,
      };
      this.broadcastAll(
        JSON.stringify({
          type: "second_life_consumed",
          playerId: timedOutPlayerId,
        })
      );
      const inDZ =
        this.dangerZoneEnabled &&
        round.chain.length >= DANGER_ZONE_CHAIN_THRESHOLD;
      const modeConfig = getModeConfig(stored.matchState.gameMode);
      const resetMs = inDZ ? DANGER_ZONE_TIMER_MS : modeConfig.turnTimeoutMs;
      stored.turnStartAt = Date.now();
      await this.saveRoom(stored);
      await this.state.storage.setAlarm(Date.now() + resetMs);
      const slResult = transition(stored.matchState, {
        type: "turnTimeout",
        playerId: timedOutPlayerId,
        secondLifeConsumed: true,
      });
      stored.matchState = slResult.state;
      await this.saveRoom(stored);
      await this.applyEffects(slResult.effects, stored);
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

  private async handleBotTurn(stored: RoomStorage): Promise<void> {
    if (!stored.matchState || stored.matchState.status !== "round_active") return;
    const round = stored.matchState.currentRound;
    if (!round || round.currentPlayerId !== stored.botPlayerId) return;

    const word = await this.dictionary.pickWord(round.seedLetter, new Set(round.chain));
    if (!word) {
      const prevRound = round.roundNumber;
      const result = transition(stored.matchState, {
        type: "turnTimeout",
        playerId: stored.botPlayerId!,
      });
      stored.matchState = result.state;
      this.saveRoundHistoryIfEnded(stored, prevRound);
      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);
      await this.maybeAutoConfirmNextRound();
      return;
    }

    await this.submitWordForBot(stored, word);
  }

  private async submitWordForBot(stored: RoomStorage, word: string): Promise<void> {
    const botId = stored.botPlayerId!;
    const state = stored.matchState!;
    const round = state.currentRound!;

    const validation = await validate(
      word,
      round.seedLetter,
      new Set(round.chain),
      this.dictionary,
      {}
    );

    if (!validation.valid) {
      const result = transition(state, { type: "invalidWord", playerId: botId });
      const prevRound = round.roundNumber;
      stored.matchState = result.state;
      this.saveRoundHistoryIfEnded(stored, prevRound);
      await this.saveRoom(stored);
      await this.applyEffects(result.effects, stored);
      await this.maybeAutoConfirmNextRound();
      return;
    }

    const scoreResult = score(word, { multiplier: 1 });
    stored.currentRoundWords.push({
      word,
      playerId: botId,
      points: scoreResult.points,
      breakdown: scoreResult.breakdown,
    });

    const opponentId = botId === state.player1Id ? state.player2Id : state.player1Id;
    const prevRoundScore = round.playerRoundScores[botId] ?? 0;
    const newRoundScore = prevRoundScore + scoreResult.points;
    const evalResult = evaluateDrops({
      playerId: botId,
      opponentId,
      word,
      scoreResult,
      prevRoundScore,
      newRoundScore,
      triggers: round.dropTriggers,
      isDangerZone: false,
      justEnteredDangerZone: false,
    });

    const wordResult = transition(state, {
      type: "wordSubmitted",
      playerId: botId,
      word,
      points: scoreResult.points,
    });
    stored.matchState = wordResult.state;

    if (stored.matchState.currentRound) {
      stored.matchState.currentRound.seedLetter = word[word.length - 1] ?? round.seedLetter;
      stored.matchState.currentRound.dropTriggers = evalResult.triggers;

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

    stored.scores[botId] = (stored.scores[botId] ?? 0) + scoreResult.points;

    for (const drop of evalResult.drops) {
      this.broadcastAll(
        JSON.stringify({
          type: "power_up_earned",
          playerId: drop.playerId,
          powerup: drop.id,
        })
      );
    }

    await this.saveRoom(stored);
    await this.applyEffects(wordResult.effects, stored);
    await this.maybeAutoConfirmNextRound();
  }

  private async maybeAutoConfirmNextRound(): Promise<void> {
    const stored = await this.loadRoom();
    if (!stored.botPlayerId || stored.matchState?.status !== "round_complete") return;
    const ctx = stored.matchState.roundEndContext;
    if (!ctx || ctx.nextRoundConfirmations.includes(stored.botPlayerId)) return;
    await this.handleNextRoundRequest(stored.botPlayerId);
  }

  private saveRoundHistoryIfEnded(stored: RoomStorage, prevRoundNumber: number): void {
    const newState = stored.matchState;
    if (!newState) return;

    const matchComplete = newState.status === "match_complete";
    const roundComplete = newState.status === "round_complete";
    const newRoundNumber = newState.currentRound?.roundNumber ?? prevRoundNumber;

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
          this.broadcastStateAll(stored);
          break;
        case "startTimer": {
          const mode = getModeConfig(stored.matchState?.gameMode ?? "duel");
          const round = stored.matchState?.currentRound;
          // Bot turn: schedule a short bot-move delay instead of the full timer.
          if (stored.botPlayerId && round?.currentPlayerId === stored.botPlayerId) {
            const delay = 2500 + Math.floor(Math.random() * 2000);
            stored.turnStartAt = Date.now();
            await this.setAlarm(stored, "bot_turn", Date.now() + delay);
            break;
          }
          const inDangerZone =
            this.dangerZoneEnabled &&
            (round?.chain.length ?? 0) >= DANGER_ZONE_CHAIN_THRESHOLD;
          const timeoutMs = inDangerZone ? DANGER_ZONE_TIMER_MS : mode.turnTimeoutMs;
          stored.turnStartAt = Date.now();
          await this.setAlarm(stored, "turn", Date.now() + timeoutMs);
          break;
        }
        case "stopTimer":
          if (stored.alarmKind === "turn" || stored.alarmKind === "bot_turn") {
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
          if (!stored.botPlayerId) {
            await persistMatch(this.env, {
              player1Id: stored.playerIds[0] ?? "",
              player2Id: stored.playerIds[1] ?? "",
              winnerId: effect.winnerId,
              roundWins: stored.matchState?.roundWins ?? {},
              roundHistory: stored.roundHistory,
              gameMode: stored.matchState?.gameMode ?? "duel",
            });
          }
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

  private broadcastStateAll(stored: RoomStorage): void {
    for (const ws of this.state.getWebSockets()) {
      const tag = this.state.getTags(ws)[0];
      if (!tag) continue;
      this.broadcastStateToPlayer(ws, tag, stored);
    }
  }

  private broadcastStateToPlayer(
    ws: WebSocket,
    playerId: string,
    stored: RoomStorage
  ): void {
    void playerId;
    try {
      ws.send(
        JSON.stringify({
          type: "state_update",
          state: stored.matchState,
          scores: stored.scores,
          roundHistory: stored.roundHistory,
          turnStartAt: stored.turnStartAt,
          serverNow: Date.now(),
        })
      );
    } catch {
      // socket already closed
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
