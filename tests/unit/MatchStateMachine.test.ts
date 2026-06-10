import { describe, it, expect } from "vitest";
import {
  transition,
  type MatchState,
  type MatchEvent,
} from "../../src/modules/MatchStateMachine";

const P1 = "player1";
const P2 = "player2";

function waitingState(): MatchState {
  return {
    status: "waiting",
    player1Id: P1,
    player2Id: P2,
    roundWins: { [P1]: 0, [P2]: 0 },
    gameMode: "duel",
  };
}

function startEvent(seedLetter = "A"): MatchEvent {
  return { type: "start", player1Id: P1, player2Id: P2, seedLetter };
}

function activeState(seedLetter = "A"): MatchState {
  return transition(waitingState(), startEvent(seedLetter)).state;
}

describe("MatchStateMachine", () => {
  describe("start event", () => {
    it("transitions to round_active, sets up round 1, and makes player1 current", () => {
      const { state, effects } = transition(waitingState(), startEvent("B"));

      expect(state.status).toBe("round_active");
      expect(state.roundWins[P1]).toBe(0);
      expect(state.roundWins[P2]).toBe(0);

      const round = state.currentRound!;
      expect(round.roundNumber).toBe(1);
      expect(round.seedLetter).toBe("B");
      expect(round.chain).toEqual([]);
      expect(round.currentPlayerId).toBe(P1);

      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "startTimer" });
    });
  });

  describe("wordSubmitted event", () => {
    it("appends the word to the chain and switches current player", () => {
      const state0 = activeState();

      const { state: state1, effects: effects1 } = transition(state0, {
        type: "wordSubmitted",
        playerId: P1,
        word: "apple",
        points: 5,
      });

      expect(state1.currentRound!.chain).toEqual(["apple"]);
      expect(state1.currentRound!.currentPlayerId).toBe(P2);
      expect(effects1).toContainEqual({ type: "broadcastState" });
      expect(effects1).toContainEqual({ type: "startTimer" });

      const { state: state2 } = transition(state1, {
        type: "wordSubmitted",
        playerId: P2,
        word: "elephant",
        points: 13,
      });

      expect(state2.currentRound!.chain).toEqual(["apple", "elephant"]);
      expect(state2.currentRound!.currentPlayerId).toBe(P1);
    });

    it("ends the round (Duel) when a player builds a 59-point gap", () => {
      const state0 = activeState();

      // P1 scores 59, P2 scores 0 → gap is exactly 59 → P1 wins round
      const { state } = transition(state0, {
        type: "wordSubmitted",
        playerId: P1,
        word: "junction",
        points: 59,
      });

      expect(state.status).toBe("round_complete");
      expect(state.roundEndContext?.winnerId).toBe(P1);
      expect(state.roundWins[P1]).toBe(1);
    });
  });

  describe("invalidWord event", () => {
    it("does not end the round on an invalid word", () => {
      const state0 = activeState();

      const { state: state1, effects } = transition(state0, {
        type: "invalidWord",
        playerId: P1,
      });

      expect(state1.status).toBe("round_active");
      expect(effects).toContainEqual({ type: "broadcastState" });
    });

    it("keeps the same current player after an invalid word", () => {
      const state0 = activeState();
      const { state } = transition(state0, { type: "invalidWord", playerId: P1 });
      expect(state.currentRound!.currentPlayerId).toBe(P1);
    });
  });

  describe("turnTimeout event", () => {
    it("transitions to round_complete and awards the round to the other player", () => {
      const state0 = activeState();

      const { state, effects } = transition(state0, {
        type: "turnTimeout",
        playerId: P1,
      });

      expect(state.roundWins[P2]).toBe(1);
      expect(state.roundWins[P1]).toBe(0);
      expect(state.status).toBe("round_complete");
      expect(state.roundEndContext?.winnerId).toBe(P2);
      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "stopTimer" });
      expect(effects).toContainEqual({ type: "startNextRoundTimeout" });
    });
  });

  describe("nextRoundRequested event", () => {
    function intoRoundComplete(): MatchState {
      return transition(activeState(), { type: "turnTimeout", playerId: P1 }).state;
    }

    it("waits in round_complete after only one player confirms", () => {
      const state0 = intoRoundComplete();
      const { state, effects } = transition(state0, {
        type: "nextRoundRequested",
        playerId: P1,
      });
      expect(state.status).toBe("round_complete");
      expect(state.roundEndContext?.nextRoundConfirmations).toEqual([P1]);
      expect(effects).toContainEqual({ type: "broadcastState" });
    });

    it("advances to the next round once both players have confirmed", () => {
      let state = intoRoundComplete();
      state = transition(state, { type: "nextRoundRequested", playerId: P1 }).state;
      const { state: next, effects } = transition(state, {
        type: "nextRoundRequested",
        playerId: P2,
      });
      expect(next.status).toBe("round_active");
      expect(next.currentRound?.roundNumber).toBe(2);
      expect(next.currentRound?.currentPlayerId).toBe(P2);
      expect(next.roundEndContext).toBeUndefined();
      expect(effects).toContainEqual({ type: "stopNextRoundTimeout" });
      expect(effects).toContainEqual({ type: "startTimer" });
    });
  });

  describe("nextRoundTimeout event", () => {
    it("transitions to match_complete with the present player winning by forfeit", () => {
      let state = transition(activeState(), { type: "turnTimeout", playerId: P1 }).state;
      state = transition(state, { type: "nextRoundRequested", playerId: P2 }).state;
      const { state: final, effects } = transition(state, {
        type: "nextRoundTimeout",
        absentPlayerId: P1,
      });
      expect(final.status).toBe("match_complete");
      expect(final.matchWinnerId).toBe(P2);
      expect(effects).toContainEqual({ type: "matchOver", winnerId: P2 });
    });
  });

  describe("three round wins (Duel)", () => {
    function winRoundsForP2(count: number): MatchState {
      let state = activeState();
      for (let i = 0; i < count; i++) {
        state = transition(state, { type: "turnTimeout", playerId: P1 }).state;
        if (state.status === "round_complete") {
          state = transition(state, { type: "nextRoundRequested", playerId: P1 }).state;
          state = transition(state, { type: "nextRoundRequested", playerId: P2 }).state;
        }
      }
      return state;
    }

    it("transitions to match_complete when a player reaches 3 round wins", () => {
      const { state, effects } = transition(
        winRoundsForP2(2),
        { type: "turnTimeout", playerId: P1 }
      );

      expect(state.status).toBe("match_complete");
      expect(state.matchWinnerId).toBe(P2);
      expect(state.roundWins[P2]).toBe(3);
      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "stopTimer" });
      expect(effects).toContainEqual({ type: "matchOver", winnerId: P2 });
    });
  });

  describe("Classic game mode", () => {
    function classicActive(): MatchState {
      const waiting: MatchState = {
        status: "waiting",
        player1Id: P1,
        player2Id: P2,
        roundWins: { [P1]: 0, [P2]: 0 },
        gameMode: "classic",
      };
      return transition(waiting, {
        type: "start",
        player1Id: P1,
        player2Id: P2,
        seedLetter: "A",
        gameMode: "classic",
      }).state;
    }

    it("ends the match on a single timeout in Classic", () => {
      const state0 = classicActive();
      const { state, effects } = transition(state0, {
        type: "turnTimeout",
        playerId: P1,
      });

      expect(state.status).toBe("match_complete");
      expect(state.matchWinnerId).toBe(P2);
      expect(effects).toContainEqual({ type: "matchOver", winnerId: P2 });
    });

    it("does NOT end the round on gap score in Classic (timer-only win condition)", () => {
      const state0 = classicActive();
      const { state } = transition(state0, {
        type: "wordSubmitted",
        playerId: P1,
        word: "junction",
        points: 100,
      });
      // Classic: no 59-pt gap check; round stays active
      expect(state.status).toBe("round_active");
    });
  });

  describe("rematchRequested event", () => {
    it("resets status to waiting and clears roundWins", () => {
      let state = activeState();
      state = transition(state, { type: "turnTimeout", playerId: P1 }).state;

      const { state: resetState, effects } = transition(state, {
        type: "rematchRequested",
      });

      expect(resetState.status).toBe("waiting");
      expect(resetState.player1Id).toBe(P1);
      expect(resetState.player2Id).toBe(P2);
      expect(resetState.roundWins[P1]).toBe(0);
      expect(resetState.roundWins[P2]).toBe(0);
      expect(resetState.currentRound).toBeUndefined();
      expect(resetState.matchWinnerId).toBeUndefined();
      expect(effects).toContainEqual({ type: "broadcastState" });
    });
  });
});
