import type { Env } from "../index";
import {
  transition,
  type MatchState,
  type Effect,
} from "../modules/MatchStateMachine";
import { validate } from "../modules/WordValidator";
import { D1Dictionary } from "../modules/D1Dictionary";
import { score } from "../modules/ScoringEngine";
const TURN_TIMEOUT_MS = 15_000;
const SEED_LETTERS = "abcdefghijklmnoprstw";

function randomSeedLetter(): string {
  return SEED_LETTERS[Math.floor(Math.random() * SEED_LETTERS.length)] ?? "a";
}

interface RoomStorage {
  matchState: MatchState | null;
  playerIds: string[];
  scores: Record<string, number>;
  initialized?: boolean;
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
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const playerId = this.state.getTags(ws)[0];
    if (!playerId) return;

    let data: { type?: string; word?: string };
    try {
      const text =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      data = JSON.parse(text) as { type?: string; word?: string };
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (data.type === "submit_word" && typeof data.word === "string") {
      await this.handleWordSubmission(ws, playerId, data.word.trim());
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
    const validation = await validate(word, round.seedLetter, usedWords, this.dictionary);

    if (!validation.valid) {
      ws.send(
        JSON.stringify({ type: "word_result", valid: false, reason: validation.reason })
      );
      const result = transition(stored.matchState, { type: "invalidWord", playerId });
      stored.matchState = result.state;
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

    const result = transition(stored.matchState, { type: "wordSubmitted", playerId, word });
    stored.matchState = result.state;

    // Advance seed letter: next word must start with last letter of submitted word
    if (stored.matchState.currentRound) {
      stored.matchState.currentRound.seedLetter =
        word[word.length - 1] ?? round.seedLetter;
    }

    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
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
    if (
      !stored.matchState ||
      stored.matchState.status !== "round_active" ||
      !stored.matchState.currentRound
    )
      return;

    const timedOutPlayerId = stored.matchState.currentRound.currentPlayerId;
    const result = transition(stored.matchState, {
      type: "turnTimeout",
      playerId: timedOutPlayerId,
    });

    stored.matchState = result.state;
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
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
            })
          );
          break;
        case "startTimer":
          await this.state.storage.setAlarm(Date.now() + TURN_TIMEOUT_MS);
          break;
        case "stopTimer":
          await this.state.storage.deleteAlarm();
          break;
        case "matchOver":
          // Elo + persistence handled in issue #14
          break;
      }
    }
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

  private async loadRoom(): Promise<RoomStorage> {
    return (
      (await this.state.storage.get<RoomStorage>("room")) ?? {
        matchState: null,
        playerIds: [],
        scores: {},
      }
    );
  }

  private async saveRoom(stored: RoomStorage): Promise<void> {
    await this.state.storage.put("room", stored);
  }
}
