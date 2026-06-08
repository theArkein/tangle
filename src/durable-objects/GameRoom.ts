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
  consumeShrink,
  consumeRush,
  consumeBlitz,
  consumeSwapPending,
  decrementBlind,
  decrementPeek,
  decrementWildfire,
  evaluateDrops,
  getLetterBombRequirement,
  getShrinkMaxLength,
  getWildfireMultiplier,
  isBlinded,
  isPeekActive,
  isBlitzClaimed,
} from "../modules/PowerUpEngine";
import { FREEZE_DURATION_MS, RUSH_TIMER_FRACTION } from "../modules/powerups";
import type { PowerUpId } from "../modules/powerups/types";
import {
  pickFromCategory,
  DANGER_ZONE_CHAIN_THRESHOLD,
  DANGER_ZONE_MULTIPLIER,
} from "../modules/powerups/pools";
import {
  getModeConfig,
  isValidGameMode,
  type GameMode,
} from "../modules/gameModes";

const REMATCH_TIMEOUT_MS = 30_000;
const NEXT_ROUND_TIMEOUT_MS = 30_000;
const DANGER_ZONE_TIMER_MS = 5_000;
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
  turnStartAt?: number | undefined;
  gameMode?: GameMode | undefined;
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
      // Optional body { mode }
      try {
        const body = (await request.json()) as { mode?: unknown };
        if (isValidGameMode(body.mode)) stored.gameMode = body.mode;
      } catch {
        // No body — leave as default
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
      mode: stored.gameMode ?? "classic",
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
      mode: stored.gameMode ?? "classic",
    });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const playerId = request.headers.get("X-Player-Id");
    if (!playerId) return new Response("Unauthorized", { status: 401 });

    const stored = await this.loadRoom();

    if (!stored.playerIds.includes(playerId) && stored.playerIds.length >= 2) {
      return new Response("Room full", { status: 403 });
    }

    // If the mode wasn't already set on the room, check KV for one matchmaking
    // stashed under match:room:{roomId}:mode.
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
          mode: stored.gameMode ?? "classic",
        })
      );
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async startMatch(stored: RoomStorage): Promise<void> {
    const [p1, p2] = stored.playerIds as [string, string];
    const seedLetter = randomSeedLetter();
    const mode: GameMode = stored.gameMode ?? "classic";

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

    if (type === "swap_choose_letter" && typeof data.letter === "string") {
      await this.handleSwapChooseLetter(ws, playerId, (data.letter as string).trim());
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

    if (type === "typing_update" && typeof data.partial === "string") {
      await this.handleTypingUpdate(playerId, data.partial as string);
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
    const maxLength = getShrinkMaxLength(round.activeEffects, playerId);
    const validation = await validate(
      word,
      round.seedLetter,
      usedWords,
      this.dictionary,
      { requiredContainingLetter, maxLength }
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

    const chainLengthAfter = round.chain.length + 1;
    const isDangerZone =
      this.dangerZoneEnabled && chainLengthAfter >= DANGER_ZONE_CHAIN_THRESHOLD;
    // No-stack: DZ multiplier takes precedence over Wildfire (both are 3×).
    const multiplier = isDangerZone
      ? DANGER_ZONE_MULTIPLIER
      : getWildfireMultiplier(round.activeEffects);
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

    const evalResult = evaluateDrops({
      playerId,
      prevRoundScore,
      newRoundScore,
      breakdown: scoreResult.breakdown,
      triggers: round.dropTriggers,
      chainLength: chainLengthAfter,
      isDangerZone,
    });

    // Consume single-turn effects on the player who just played.
    let effectsAfter = round.activeEffects;
    effectsAfter = consumeLetterBomb(effectsAfter, playerId).activeEffects;
    effectsAfter = consumeShrink(effectsAfter, playerId).activeEffects;
    // Decrement per-turn counters across the board.
    effectsAfter = decrementBlind(effectsAfter);
    effectsAfter = decrementPeek(effectsAfter);
    effectsAfter = decrementWildfire(effectsAfter);

    // Blitz: if activator claimed Blitz, they get another turn — override next player.
    const blitz = isBlitzClaimed(effectsAfter, playerId);
    const nextPlayerOverride = blitz ? playerId : undefined;
    if (blitz) {
      effectsAfter = consumeBlitz(effectsAfter, playerId);
    }

    const wordResult = transition(stored.matchState, {
      type: "wordSubmitted",
      playerId,
      word,
      points: scoreResult.points,
      nextPlayerOverride,
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

      // Danger Zone entry: award one Chaos drop to both players, once per round.
      const enteringDangerZone =
        isDangerZone && !stored.matchState.currentRound.dropTriggers.dangerZoneDropped;
      if (enteringDangerZone) {
        stored.matchState.currentRound.dropTriggers.dangerZoneDropped = true;
        for (const pid of stored.playerIds) {
          const def = pickFromCategory("chaos", Math.random);
          if (def) {
            const inv = stored.matchState.currentRound.powerUpInventory[pid];
            if (inv) {
              stored.matchState.currentRound.powerUpInventory[pid] = addToInventory(inv, def.id);
            }
            evalResult.drops.push({ playerId: pid, id: def.id, source: "danger_zone" as never });
          }
        }
        this.broadcastAll(JSON.stringify({ type: "danger_zone_entered" }));
      }
    }

    stored.scores[playerId] = (stored.scores[playerId] ?? 0) + scoreResult.points;

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

    // Suppress opponent's "typing" view when their turn starts; they'll send
    // fresh partials if Peek is active.
    void opponentId;

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

    // Speed Round disables power-ups.
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

    round.powerUpInventory[playerId] = result.inventory;
    round.activeEffects = result.activeEffects;

    // Block: remove opponent's last word.
    if (powerUpId === "block") {
      const blockResult = transition(stored.matchState, {
        type: "blockApplied",
        byPlayerId: playerId,
      });
      stored.matchState = blockResult.state;
      if (stored.matchState.currentRound) {
        stored.matchState.currentRound.powerUpInventory = round.powerUpInventory;
        stored.matchState.currentRound.activeEffects = round.activeEffects;
      }

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

    // Steal: take opponent's last word + transfer its points.
    if (powerUpId === "steal") {
      // Find opponent's last word in the chain
      const oppLastIdx = [...round.chain]
        .map((w, i) => ({ w, i }))
        .reverse()
        .find(({ i }) => stored.currentRoundWords[i]?.playerId === opponentId)?.i;

      if (oppLastIdx === undefined) {
        ws.send(JSON.stringify({ type: "error", message: "no_word_to_steal" }));
        return;
      }

      const stolenEntry = stored.currentRoundWords[oppLastIdx];
      if (!stolenEntry) {
        ws.send(JSON.stringify({ type: "error", message: "no_word_to_steal" }));
        return;
      }

      // Remove the stolen word from the chain and from currentRoundWords.
      if (stored.matchState.currentRound) {
        stored.matchState.currentRound.chain.splice(oppLastIdx, 1);
        stored.currentRoundWords.splice(oppLastIdx, 1);

        // Transfer points.
        const opponentScore =
          stored.matchState.currentRound.playerRoundScores[opponentId] ?? 0;
        stored.matchState.currentRound.playerRoundScores[opponentId] = Math.max(
          0,
          opponentScore - stolenEntry.points
        );
        const myScore = stored.matchState.currentRound.playerRoundScores[playerId] ?? 0;
        stored.matchState.currentRound.playerRoundScores[playerId] =
          myScore + stolenEntry.points;
        stored.scores[opponentId] = Math.max(
          0,
          (stored.scores[opponentId] ?? 0) - stolenEntry.points
        );
        stored.scores[playerId] = (stored.scores[playerId] ?? 0) + stolenEntry.points;

        // Recalculate seed letter from new chain tail.
        const newChain = stored.matchState.currentRound.chain;
        const newLastWord = newChain[newChain.length - 1];
        stored.matchState.currentRound.seedLetter = newLastWord
          ? newLastWord[newLastWord.length - 1] ?? stored.matchState.currentRound.seedLetter
          : stored.matchState.currentRound.seedLetter;
      }

      this.broadcastAll(
        JSON.stringify({
          type: "power_up_activated",
          powerup: "steal",
          byPlayerId: playerId,
          targetPlayerId: opponentId,
          word: stolenEntry.word,
          points: stolenEntry.points,
        })
      );

      await this.saveRoom(stored);
      await this.applyEffects([{ type: "broadcastState" }], stored);
      return;
    }

    // Rush: when opponent's turn next starts, halve their timer alarm.
    // The startTimer effect handler reads the rush effect and applies it.

    // Wildfire / Blind / Peek / Blitz / Letter Bomb / Shrink / Freeze / Second Life / Swap (pending)
    // are all just effects on the activeEffects array — handled in handleWordSubmission and
    // applyEffects/startTimer. The broadcast below is enough.
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

  private async handleSwapChooseLetter(
    ws: WebSocket,
    playerId: string,
    letter: string
  ): Promise<void> {
    const stored = await this.loadRoom();
    if (!stored.matchState || stored.matchState.status !== "round_active") return;
    const round = stored.matchState.currentRound;
    if (!round) return;

    if (round.currentPlayerId !== playerId) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const consumption = consumeSwapPending(round.activeEffects, playerId);
    if (!consumption.wasPending) {
      ws.send(JSON.stringify({ type: "error", message: "No pending swap" }));
      return;
    }

    const lower = letter.trim().toLowerCase();
    if (!/^[a-z]$/.test(lower)) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid letter" }));
      return;
    }

    // Set new seed letter and end the activator's turn (advance to opponent).
    const opponentId =
      playerId === stored.matchState.player1Id
        ? stored.matchState.player2Id
        : stored.matchState.player1Id;

    if (stored.matchState.currentRound) {
      stored.matchState.currentRound.seedLetter = lower;
      stored.matchState.currentRound.currentPlayerId = opponentId;
      stored.matchState.currentRound.activeEffects = consumption.activeEffects;
    }

    this.broadcastAll(
      JSON.stringify({
        type: "swap_letter_chosen",
        byPlayerId: playerId,
        letter: lower,
      })
    );

    await this.saveRoom(stored);
    await this.applyEffects(
      [{ type: "broadcastState" }, { type: "stopTimer" }, { type: "startTimer" }],
      stored
    );
  }

  private async handleTypingUpdate(playerId: string, partial: string): Promise<void> {
    const stored = await this.loadRoom();
    if (!stored.matchState || stored.matchState.status !== "round_active") return;
    const round = stored.matchState.currentRound;
    if (!round) return;
    if (round.currentPlayerId !== playerId) return;

    const opponentId =
      playerId === stored.matchState.player1Id
        ? stored.matchState.player2Id
        : stored.matchState.player1Id;

    // Relay only if opponent has Peek active.
    if (!isPeekActive(round.activeEffects, opponentId)) return;

    this.broadcastToPlayer(
      opponentId,
      JSON.stringify({
        type: "typing_update",
        fromPlayerId: playerId,
        partial: partial.slice(0, 30), // cap to avoid abuse
      })
    );
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
          const mode = getModeConfig(stored.matchState?.gameMode ?? "classic");
          const round = stored.matchState?.currentRound;
          const inDangerZone =
            this.dangerZoneEnabled &&
            (round?.chain.length ?? 0) >= DANGER_ZONE_CHAIN_THRESHOLD;
          let timeoutMs = inDangerZone ? DANGER_ZONE_TIMER_MS : mode.turnTimeoutMs;
          if (round) {
            // Freeze: cuts FREEZE_DURATION_MS off the affected player's turn.
            const freezeIdx = round.activeEffects.findIndex(
              (e) => e.kind === "freeze" && e.onPlayerId === round.currentPlayerId
            );
            if (freezeIdx >= 0) {
              timeoutMs = Math.max(2_000, timeoutMs - FREEZE_DURATION_MS);
              round.activeEffects = round.activeEffects.filter((_, i) => i !== freezeIdx);
            }
            // Rush: halves the affected player's turn.
            const rush = consumeRush(round.activeEffects, round.currentPlayerId);
            if (rush.consumed) {
              timeoutMs = Math.max(2_000, Math.floor(timeoutMs * RUSH_TIMER_FRACTION));
              round.activeEffects = rush.activeEffects;
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
            gameMode: stored.matchState?.gameMode ?? "classic",
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

  // Broadcasts the current state — but redacts the chain for any player
  // who has Blind active on them.
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
    let state = stored.matchState;
    if (state?.currentRound && isBlinded(state.currentRound.activeEffects, playerId)) {
      // Redact: hide the chain entries from the blinded player.
      state = {
        ...state,
        currentRound: {
          ...state.currentRound,
          chain: state.currentRound.chain.map(() => "•••"),
        },
      };
    }
    try {
      ws.send(
        JSON.stringify({
          type: "state_update",
          state,
          scores: stored.scores,
          roundHistory: stored.roundHistory,
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
