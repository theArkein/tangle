import {
  emptyInventory,
  emptyTriggers,
  type ActiveEffect,
  type DropTriggers,
  type PowerUpInventory,
} from "./powerups/types";

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
  faults: Record<PlayerId, number>;
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
  currentRound?: RoundState | undefined;
  roundEndContext?: RoundEndContext | undefined;
  matchWinnerId?: PlayerId | undefined;
}

export type MatchEvent =
  | { type: "start"; player1Id: PlayerId; player2Id: PlayerId; seedLetter: string }
  | { type: "wordSubmitted"; playerId: PlayerId; word: string; points: number }
  | { type: "invalidWord"; playerId: PlayerId }
  | { type: "turnTimeout"; playerId: PlayerId; secondLifeConsumed?: boolean }
  | { type: "nextRoundRequested"; playerId: PlayerId }
  | { type: "nextRoundTimeout"; absentPlayerId: PlayerId }
  | { type: "rematchRequested" }
  | { type: "blockApplied"; byPlayerId: PlayerId }
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

export const FAULTS_TO_LOSE_ROUND = 8;
const ROUNDS_TO_WIN_MATCH = 3;
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
    faults: { [player1Id]: 0, [player2Id]: 0 },
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

  if (winnerRoundWins >= ROUNDS_TO_WIN_MATCH) {
    // Match complete.
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

  // Non-terminal round end — enter round_complete and wait for Play Again confirmations.
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
        event.player1Id,
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
        currentRound: round,
      };

      return {
        state: newState,
        effects: [{ type: "broadcastState" }, { type: "startTimer" }],
      };
    }

    case "wordSubmitted": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }

      const round = state.currentRound;
      const nextPlayerId = otherPlayer(state, event.playerId);

      const updatedScores: Record<PlayerId, number> = {
        ...round.playerRoundScores,
        [event.playerId]: (round.playerRoundScores[event.playerId] ?? 0) + event.points,
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

      return {
        state: newState,
        effects: [{ type: "broadcastState" }, { type: "startTimer" }],
      };
    }

    case "invalidWord": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }

      const round = state.currentRound;
      const currentFaults = round.faults[event.playerId] ?? 0;
      const newFaultCount = currentFaults + 1;

      const updatedFaults: Record<PlayerId, number> = {
        ...round.faults,
        [event.playerId]: newFaultCount,
      };

      if (newFaultCount >= FAULTS_TO_LOSE_ROUND) {
        const winnerId = otherPlayer(state, event.playerId);
        const stateWithFault: MatchState = {
          ...state,
          currentRound: {
            ...round,
            faults: updatedFaults,
          },
        };
        return endRound(stateWithFault, winnerId);
      }

      const updatedRound: RoundState = {
        ...round,
        faults: updatedFaults,
      };

      const newState: MatchState = {
        ...state,
        currentRound: updatedRound,
      };

      return {
        state: newState,
        effects: [{ type: "broadcastState" }],
      };
    }

    case "turnTimeout": {
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }

      // If Second Life was consumed by the caller, the round continues —
      // restart the timer for the same player. Do not increment faults.
      if (event.secondLifeConsumed) {
        return {
          state,
          effects: [{ type: "broadcastState" }, { type: "stopTimer" }, { type: "startTimer" }],
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

      // Both confirmed — start the next round.
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
          { type: "broadcastState" },
          { type: "stopNextRoundTimeout" },
          { type: "startTimer" },
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
      };

      return {
        state: newState,
        effects: [{ type: "broadcastState" }],
      };
    }

    case "blockApplied": {
      // Block: remove the opponent's last word from the chain.
      // Power-up inventory decrement happens in GameRoom via PowerUpEngine.
      if (state.status !== "round_active" || !state.currentRound) {
        return { state, effects: [] };
      }
      const round = state.currentRound;
      if (round.chain.length === 0) {
        return { state, effects: [] };
      }
      const newChain = round.chain.slice(0, -1);
      // After Block, the player whose word was blocked plays again with their
      // remaining time. currentPlayerId stays as the opponent of the blocker.
      const blockedPlayerId = otherPlayer(state, event.byPlayerId);
      const updatedRound: RoundState = {
        ...round,
        chain: newChain,
        currentPlayerId: blockedPlayerId,
      };
      return {
        state: { ...state, currentRound: updatedRound },
        effects: [{ type: "broadcastState" }, { type: "stopTimer" }, { type: "startTimer" }],
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
