import {
  emptyInventory,
  emptyTriggers,
  type ActiveEffect,
  type DropTriggers,
  type PowerUpInventory,
} from "./powerups/types";
import { getModeConfig, type GameMode } from "./gameModes";

export type PlayerId = string;

export type MatchStatus =
  | "waiting"
  | "round_active"
  | "round_complete"
  | "match_complete";

export interface RoundState {
  roundNumber: number;
  seedLetter: string;
  chain: string[];
  currentPlayerId: PlayerId;
  roundWinnerId?: PlayerId;
  playerRoundScores: Record<PlayerId, number>;
  powerUpInventory: Record<PlayerId, PowerUpInventory>;
  activeEffects: ActiveEffect[];
  dropTriggers: DropTriggers;
}

export interface RoundEndContext {
  roundNumber: number;
  winnerId: PlayerId;
  nextRoundConfirmations: PlayerId[];
}

export interface MatchState {
  status: MatchStatus;
  player1Id: PlayerId;
  player2Id: PlayerId;
  roundWins: Record<PlayerId, number>;
  gameMode: GameMode;
  currentRound?: RoundState | undefined;
  roundEndContext?: RoundEndContext | undefined;
  matchWinnerId?: PlayerId | undefined;
}

export type MatchEvent =
  | { type: "start"; player1Id: PlayerId; player2Id: PlayerId; seedLetter: string; gameMode?: GameMode; firstPlayerId?: PlayerId }
  | { type: "wordSubmitted"; playerId: PlayerId; word: string; points: number }
  | { type: "invalidWord"; playerId: PlayerId }
  | { type: "turnTimeout"; playerId: PlayerId; secondLifeConsumed?: boolean }
  | { type: "nextRoundRequested"; playerId: PlayerId }
  | { type: "nextRoundTimeout"; absentPlayerId: PlayerId }
  | { type: "rematchRequested" }
  | { type: "inventoryUpdated"; playerId: PlayerId; inventory: PowerUpInventory }
  | { type: "scoreUpdated"; playerId: PlayerId; newRoundScore: number; newTriggers: DropTriggers }
  | { type: "effectsUpdated"; activeEffects: ActiveEffect[] };

export type Effect =
  | { type: "broadcastState" }
  | { type: "startTimer" }
  | { type: "stopTimer" }
  | { type: "startNextRoundTimeout" }
  | { type: "stopNextRoundTimeout" }
  | { type: "matchOver"; winnerId: PlayerId };

export interface TransitionResult {
  state: MatchState;
  effects: Effect[];
}

// Score gap required to win a round in Duel mode.
export const ROUND_WIN_GAP = 59;

const SEED_LETTERS = "abcdefghijklmnoprstw";

function randomSeedLetter(): string {
  return SEED_LETTERS[Math.floor(Math.random() * SEED_LETTERS.length)] ?? "a";
}

function otherPlayer(state: MatchState, playerId: PlayerId): PlayerId {
  return playerId === state.player1Id ? state.player2Id : state.player1Id;
}

function freshRound(
  roundNumber: number,
  seedLetter: string,
  firstPlayerId: PlayerId,
  player1Id: PlayerId,
  player2Id: PlayerId
): RoundState {
  return {
    roundNumber,
    seedLetter,
    chain: [],
    currentPlayerId: firstPlayerId,
    playerRoundScores: { [player1Id]: 0, [player2Id]: 0 },
    powerUpInventory: {
      [player1Id]: emptyInventory(),
      [player2Id]: emptyInventory(),
    },
    activeEffects: [],
    dropTriggers: emptyTriggers(player1Id, player2Id),
  };
}

function endRound(
  state: MatchState,
  winnerId: PlayerId
): TransitionResult {
  const newRoundWins: Record<PlayerId, number> = {
    ...state.roundWins,
    [winnerId]: (state.roundWins[winnerId] ?? 0) + 1,
  };

  const winnerRoundWins = newRoundWins[winnerId] ?? 0;
  const roundsToWin = getModeConfig(state.gameMode).roundsToWinMatch;

  if (winnerRoundWins >= roundsToWin) {
    const completedRound: RoundState | undefined = state.currentRound
      ? { ...state.currentRound, roundWinnerId: winnerId }
      : undefined;

    const newState: MatchState = completedRound
      ? {
          ...state,
          status: "match_complete",
          roundWins: newRoundWins,
          matchWinnerId: winnerId,
          currentRound: completedRound,
        }
      : {
          ...state,
          status: "match_complete",
          roundWins: newRoundWins,
          matchWinnerId: winnerId,
        };

    return {
      state: newState,
      effects: [
        { type: "broadcastState" },
        { type: "stopTimer" },
        { type: "matchOver", winnerId },
      ],
    };
  }

  const completedRound: RoundState | undefined = state.currentRound
    ? { ...state.currentRound, roundWinnerId: winnerId }
    : undefined;

  const roundNumber = completedRound?.roundNumber ?? 1;

  const newState: MatchState = {
    ...state,
    status: "round_complete",
    roundWins: newRoundWins,
    currentRound: completedRound,
    roundEndContext: {
      roundNumber,
      winnerId,
      nextRoundConfirmations: [],
    },
  };

  return {
    state: newState,
    effects: [
      { type: "broadcastState" },
      { type: "stopTimer" },
      { type: "startNextRoundTimeout" },
    ],
  };
}

export function transition(state: MatchState, event: MatchEvent): TransitionResult {
  switch (event.type) {
    case "start": {
      const round = freshRound(
        1,
        event.seedLetter,
        event.firstPlayerId ?? event.player1Id,
        event.player1Id,
        event.player2Id
      );

      const newState: MatchState = {
        status: "round_active",
        player1Id: event.player1Id,
        player2Id: event.player2Id,
        roundWins: {
          [event.player1Id]: 0,
          [event.player2Id]: 0,
        },
        gameMode: event.gameMode ?? state.gameMode ?? "duel",
        currentRound: round,
      };

      return {
        state: newState,
        effects: [{ type: "startTimer" }, { type: "broadcastState" }],
      };
    }

    case "wordSubmitted": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }

      const round = state.currentRound;
      const nextPlayerId = otherPlayer(state, event.playerId);
      const opponentId = nextPlayerId;

      const newPlayerScore = (round.playerRoundScores[event.playerId] ?? 0) + event.points;
      const opponentScore = round.playerRoundScores[opponentId] ?? 0;

      const updatedScores: Record<PlayerId, number> = {
        ...round.playerRoundScores,
        [event.playerId]: newPlayerScore,
      };

      const updatedRound: RoundState = {
        ...round,
        chain: [...round.chain, event.word],
        currentPlayerId: nextPlayerId,
        playerRoundScores: updatedScores,
      };

      const newState: MatchState = {
        ...state,
        currentRound: updatedRound,
      };

      // 59-point gap win condition — Duel mode only
      if (state.gameMode === "duel" && newPlayerScore - opponentScore >= ROUND_WIN_GAP) {
        return endRound(newState, event.playerId);
      }

      return {
        state: newState,
        effects: [{ type: "startTimer" }, { type: "broadcastState" }],
      };
    }

    case "invalidWord": {
      // Fault penalty (-2s alarm) is handled by GameRoom directly.
      // Faults no longer end rounds — just broadcast updated state.
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }
      return { state, effects: [{ type: "broadcastState" }] };
    }

    case "turnTimeout": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }

      // If Second Life was consumed by the caller, the round continues.
      if (event.secondLifeConsumed) {
        return {
          state,
          effects: [{ type: "stopTimer" }, { type: "startTimer" }, { type: "broadcastState" }],
        };
      }

      const winnerId = otherPlayer(state, event.playerId);
      return endRound(state, winnerId);
    }

    case "nextRoundRequested": {
      if (state.status !== "round_complete" || !state.roundEndContext) {
        return { state, effects: [] };
      }

      const ctx = state.roundEndContext;
      if (ctx.nextRoundConfirmations.includes(event.playerId)) {
        return { state, effects: [] };
      }

      const confirmations = [...ctx.nextRoundConfirmations, event.playerId];

      if (confirmations.length < 2) {
        const newState: MatchState = {
          ...state,
          roundEndContext: { ...ctx, nextRoundConfirmations: confirmations },
        };
        return {
          state: newState,
          effects: [{ type: "broadcastState" }],
        };
      }

      const nextRoundNumber = ctx.roundNumber + 1;
      const nextRound = freshRound(
        nextRoundNumber,
        randomSeedLetter(),
        ctx.winnerId,
        state.player1Id,
        state.player2Id
      );

      const newState: MatchState = {
        ...state,
        status: "round_active",
        currentRound: nextRound,
        roundEndContext: undefined,
      };

      return {
        state: newState,
        effects: [
          { type: "stopNextRoundTimeout" },
          { type: "startTimer" },
          { type: "broadcastState" },
        ],
      };
    }

    case "nextRoundTimeout": {
      if (state.status !== "round_complete" || !state.roundEndContext) {
        return { state, effects: [] };
      }
      const winnerId = otherPlayer(state, event.absentPlayerId);
      const newState: MatchState = {
        ...state,
        status: "match_complete",
        matchWinnerId: winnerId,
        roundEndContext: undefined,
      };
      return {
        state: newState,
        effects: [
          { type: "broadcastState" },
          { type: "stopNextRoundTimeout" },
          { type: "matchOver", winnerId },
        ],
      };
    }

    case "rematchRequested": {
      const newState: MatchState = {
        status: "waiting",
        player1Id: state.player1Id,
        player2Id: state.player2Id,
        roundWins: {
          [state.player1Id]: 0,
          [state.player2Id]: 0,
        },
        gameMode: state.gameMode,
      };

      return {
        state: newState,
        effects: [{ type: "broadcastState" }],
      };
    }

    case "inventoryUpdated": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }
      const round = state.currentRound;
      const updatedRound: RoundState = {
        ...round,
        powerUpInventory: {
          ...round.powerUpInventory,
          [event.playerId]: event.inventory,
        },
      };
      return {
        state: { ...state, currentRound: updatedRound },
        effects: [{ type: "broadcastState" }],
      };
    }

    case "scoreUpdated": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }
      const round = state.currentRound;
      const updatedRound: RoundState = {
        ...round,
        playerRoundScores: {
          ...round.playerRoundScores,
          [event.playerId]: event.newRoundScore,
        },
        dropTriggers: event.newTriggers,
      };
      return { state: { ...state, currentRound: updatedRound }, effects: [] };
    }

    case "effectsUpdated": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }
      const round = state.currentRound;
      const updatedRound: RoundState = { ...round, activeEffects: event.activeEffects };
      return {
        state: { ...state, currentRound: updatedRound },
        effects: [{ type: "broadcastState" }],
      };
    }
  }
}
