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
}

export interface MatchState {
  status: MatchStatus;
  player1Id: PlayerId;
  player2Id: PlayerId;
  roundWins: Record<PlayerId, number>;
  currentRound?: RoundState;
  matchWinnerId?: PlayerId;
}

export type MatchEvent =
  | { type: "start"; player1Id: PlayerId; player2Id: PlayerId; seedLetter: string }
  | { type: "wordSubmitted"; playerId: PlayerId; word: string }
  | { type: "invalidWord"; playerId: PlayerId }
  | { type: "turnTimeout"; playerId: PlayerId }
  | { type: "rematchRequested" };

export type Effect =
  | { type: "broadcastState" }
  | { type: "startTimer" }
  | { type: "stopTimer" }
  | { type: "matchOver"; winnerId: PlayerId };

export interface TransitionResult {
  state: MatchState;
  effects: Effect[];
}

const FAULTS_TO_LOSE_ROUND = 3;
const ROUNDS_TO_WIN_MATCH = 3;

function otherPlayer(state: MatchState, playerId: PlayerId): PlayerId {
  return playerId === state.player1Id ? state.player2Id : state.player1Id;
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
    // Match complete
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

  // Start next round — winner goes first
  const currentRound = state.currentRound;
  const nextRoundNumber = currentRound ? currentRound.roundNumber + 1 : 1;

  const nextRound: RoundState = {
    roundNumber: nextRoundNumber,
    seedLetter: "?",
    chain: [],
    currentPlayerId: winnerId,
    faults: {
      [state.player1Id]: 0,
      [state.player2Id]: 0,
    },
  };

  const newState: MatchState = {
    ...state,
    status: "round_active",
    roundWins: newRoundWins,
    currentRound: nextRound,
  };

  return {
    state: newState,
    effects: [
      { type: "broadcastState" },
      { type: "stopTimer" },
      { type: "startTimer" },
    ],
  };
}

export function transition(state: MatchState, event: MatchEvent): TransitionResult {
  switch (event.type) {
    case "start": {
      const round: RoundState = {
        roundNumber: 1,
        seedLetter: event.seedLetter,
        chain: [],
        currentPlayerId: event.player1Id,
        faults: {
          [event.player1Id]: 0,
          [event.player2Id]: 0,
        },
      };

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

      const updatedRound: RoundState = {
        ...round,
        chain: [...round.chain, event.word],
        currentPlayerId: nextPlayerId,
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
        // This player loses the round
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

      // Round continues — fault recorded, same player's turn (they still submit)
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

      const winnerId = otherPlayer(state, event.playerId);
      return endRound(state, winnerId);
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
  }
}
