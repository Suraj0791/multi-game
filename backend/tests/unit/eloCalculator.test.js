// ============================================================
// UNIT TEST: ELO Calculator
// ============================================================
// This tests PURE LOGIC — no database, no server, no network.
// Just: does the math work?
//
// Run with: npm test
// ============================================================

import { calculateNewRatings } from '../../src/utils/eloCalculator.js';

// describe = "I'm testing this group of things"
describe('ELO Calculator', () => {

  // it = "it should do this one specific thing"
  it('should increase winner rating and decrease loser rating', () => {
    const result = calculateNewRatings(1200, 1200);

    // expect = "I expect this value to match"
    // When both players are 1200, winner gains ~16, loser loses ~16
    expect(result.winnerNew).toBeGreaterThan(1200);
    expect(result.loserNew).toBeLessThan(1200);
  });

  it('should return the correct diff values', () => {
    const result = calculateNewRatings(1200, 1200);

    // diff = new rating - old rating
    expect(result.winnerDiff).toBe(result.winnerNew - 1200);
    expect(result.loserDiff).toBe(result.loserNew - 1200);
  });

  it('should give MORE points when underdog wins', () => {
    // Underdog (1000) beats favorite (1400)
    const upset = calculateNewRatings(1000, 1400);

    // Equal match
    const even = calculateNewRatings(1200, 1200);

    // Underdog should gain MORE than equal match winner
    expect(upset.winnerDiff).toBeGreaterThan(even.winnerDiff);
  });

  it('should give FEWER points when favorite wins', () => {
    // Favorite (1400) beats underdog (1000) — expected result
    const expected = calculateNewRatings(1400, 1000);

    // Equal match
    const even = calculateNewRatings(1200, 1200);

    // Favorite should gain LESS than equal match winner
    expect(expected.winnerDiff).toBeLessThan(even.winnerDiff);
  });

  it('should never make ratings go below 0 for reasonable inputs', () => {
    // Very low rated player loses
    const result = calculateNewRatings(1500, 100);

    expect(result.loserNew).toBeGreaterThanOrEqual(0);
  });

  it('should return all four expected fields', () => {
    const result = calculateNewRatings(1200, 1000);

    expect(result).toHaveProperty('winnerNew');
    expect(result).toHaveProperty('loserNew');
    expect(result).toHaveProperty('winnerDiff');
    expect(result).toHaveProperty('loserDiff');
  });

  it('should handle equal ratings (both 1200)', () => {
    const result = calculateNewRatings(1200, 1200);

    // With equal ratings, winner gains exactly K/2 = 16
    expect(result.winnerDiff).toBe(16);
    expect(result.loserDiff).toBe(-16);
  });

});
