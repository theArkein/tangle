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
      });

      expect(state1.currentRound!.chain).toEqual(["apple"]);
      expect(state1.currentRound!.currentPlayerId).toBe(P2);
      expect(effects1).toContainEqual({ type: "broadcastState" });
      expect(effects1).toContainEqual({ type: "startTimer" });

      const { state: state2 } = transition(state1, {
        type: "wordSubmitted",
        playerId: P2,
        word: "elephant",
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

    it("ends the round on the third fault, with the other player winning", () => {
      let state = activeState();

      state = transition(state, { type: "invalidWord", playerId: P1 }).state;
      state = transition(state, { type: "invalidWord", playerId: P1 }).state;
      const { state: finalState, effects } = transition(state, {
        type: "invalidWord",
        playerId: P1,
      });

      // Round ended — P2 wins this round; P1 had 3 faults but match not yet won
      expect(finalState.roundWins[P2]).toBe(1);
      expect(finalState.roundWins[P1]).toBe(0);
      // A new round should be started (not match_complete after one round win)
      expect(finalState.status).toBe("round_active");
      expect(finalState.currentRound!.roundNumber).toBe(2);
      expect(effects).toContainEqual({ type: "broadcastState" });
    });
  });

  describe("turnTimeout event", () => {
    it("ends the round and awards the win to the other player", () => {
      const state0 = activeState();

      const { state, effects } = transition(state0, {
        type: "turnTimeout",
        playerId: P1,
      });

      // P2 wins the round; not match_complete after one win
      expect(state.roundWins[P2]).toBe(1);
      expect(state.roundWins[P1]).toBe(0);
      expect(state.status).toBe("round_active");
      expect(state.currentRound!.roundNumber).toBe(2);
      // Winner (P2) goes first in the next round
      expect(state.currentRound!.currentPlayerId).toBe(P2);
      expect(effects).toContainEqual({ type: "broadcastState" });
      expect(effects).toContainEqual({ type: "stopTimer" });
      expect(effects).toContainEqual({ type: "startTimer" });
    });
  });

  describe("three round wins", () => {
    function winRoundsForP2(count: number): MatchState {
      let state = activeState();
      for (let i = 0; i < count; i++) {
        const result = transition(state, {
          type: "turnTimeout",
          playerId: P1, // P1 times out → P2 wins the round
        });
        state = result.state;
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
      // No fresh round started — currentRound should not be a freshly reset one
      // The currentRound (if present) retains the last round's roundWinnerId
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
