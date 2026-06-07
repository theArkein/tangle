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
      expect(round.faults[P1]).toBe(0);
      expect(round.faults[P2]).toBe(0);

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
  });

  describe("invalidWord event", () => {
    it("increments the fault counter but does not end the round at fault 1", () => {
      const state0 = activeState();

      const { state: state1, effects } = transition(state0, {
        type: "invalidWord",
        playerId: P1,
      });

      expect(state1.status).toBe("round_active");
      expect(state1.currentRound!.faults[P1]).toBe(1);
      expect(effects).toContainEqual({ type: "broadcastState" });
    });

    it("increments the fault counter but does not end the round at fault 2", () => {
      let state = activeState();

      state = transition(state, { type: "invalidWord", playerId: P1 }).state;
      const { state: state2 } = transition(state, {
        type: "invalidWord",
        playerId: P1,
      });

      expect(state2.status).toBe("round_active");
      expect(state2.currentRound!.faults[P1]).toBe(2);
    });

    it("ends the round on the eighth fault, with the other player winning", () => {
      let state = activeState();

      for (let i = 0; i < 7; i++) {
        state = transition(state, { type: "invalidWord", playerId: P1 }).state;
      }
      const { state: finalState, effects } = transition(state, {
        type: "invalidWord",
        playerId: P1,
      });

      // Round ended — P2 wins this round; P1 had 8 faults but match not yet won
      expect(finalState.roundWins[P2]).toBe(1);
      expect(finalState.roundWins[P1]).toBe(0);
      // We transition into round_complete to await Play Again confirmation,
      // not directly into the next round.
      expect(finalState.status).toBe("round_complete");
      expect(finalState.roundEndContext?.winnerId).toBe(P2);
      expect(finalState.roundEndContext?.roundNumber).toBe(1);
      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "stopTimer" });
      expect(effects).toContainEqual({ type: "startNextRoundTimeout" });
    });
  });

  describe("turnTimeout event", () => {
    it("transitions to round_complete and awards the round to the other player", () => {
      const state0 = activeState();

      const { state, effects } = transition(state0, {
        type: "turnTimeout",
        playerId: P1,
      });

      // P2 wins the round; we wait in round_complete for Play Again
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
      // Get into round_complete after P2 wins round 1
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
      // Winner of the previous round (P2) goes first
      expect(next.currentRound?.currentPlayerId).toBe(P2);
      expect(next.roundEndContext).toBeUndefined();
      expect(effects).toContainEqual({ type: "stopNextRoundTimeout" });
      expect(effects).toContainEqual({ type: "startTimer" });
    });
  });

  describe("nextRoundTimeout event", () => {
    it("transitions to match_complete with the present player winning by forfeit", () => {
      let state = transition(activeState(), { type: "turnTimeout", playerId: P1 }).state;
      // Only P2 confirmed; P1 is absent
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

  describe("three round wins", () => {
    function winRoundsForP2(count: number): MatchState {
      let state = activeState();
      for (let i = 0; i < count; i++) {
        // P1 times out → into round_complete with P2 as round winner
        state = transition(state, { type: "turnTimeout", playerId: P1 }).state;
        // Both confirm Play Again to start the next round (no-ops if match_complete)
        if (state.status === "round_complete") {
          state = transition(state, { type: "nextRoundRequested", playerId: P1 }).state;
          state = transition(state, { type: "nextRoundRequested", playerId: P2 }).state;
        }
      }
      return state;
    }

    it("transitions to match_complete when a player reaches 3 round wins", () => {
      const { state, effects } = transition(
        winRoundsForP2(2), // P2 has 2 wins
        { type: "turnTimeout", playerId: P1 } // P2 wins 3rd round
      );

      expect(state.status).toBe("match_complete");
      expect(state.matchWinnerId).toBe(P2);
      expect(state.roundWins[P2]).toBe(3);
      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "stopTimer" });
      expect(effects).toContainEqual({ type: "matchOver", winnerId: P2 });
    });

    it("does not start a new round after match_complete (status stays match_complete)", () => {
      const { state } = transition(
        winRoundsForP2(2),
        { type: "turnTimeout", playerId: P1 }
      );

      expect(state.status).toBe("match_complete");
      // No fresh round started — currentRound retains the last round's roundWinnerId
      if (state.currentRound) {
        expect(state.currentRound.roundWinnerId).toBe(P2);
      }
    });
  });

  describe("rematchRequested event", () => {
    it("resets status to waiting and clears roundWins", () => {
      // Build a state where some rounds have been played
      let state = activeState();
      state = transition(state, { type: "turnTimeout", playerId: P1 }).state; // P2 wins round 1

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
