/**
 * Mahjong Scoring Rules
 * Implements scoring for tile matches and game completion
 */

/**
 * Base points for matching two tiles
 */
const BASE_MATCH_POINTS = 10;

/**
 * Bonus points for consecutive matches (combo system)
 */
const COMBO_MULTIPLIER = 1.5;

/**
 * Time bonus threshold (seconds) - faster matches get bonus
 */
const TIME_BONUS_THRESHOLD = 10;

/**
 * Bonus for matching within the time threshold
 */
const TIME_BONUS_POINTS = 20;

/**
 * Bonus points for clearing the board
 */
const BOARD_CLEAR_BONUS = 500;

/**
 * Calculate points for a match between two tiles
 * @param {Object} tile1 - First tile
 * @param {Object} tile2 - Second tile
 * @param {number} comboCount - Number of consecutive matches before this one
 * @param {number} timeSinceLastMatch - Time in seconds since last match
 */
function calculateMatchPoints(tile1, tile2, comboCount = 0, timeSinceLastMatch = 0) {
  let points = BASE_MATCH_POINTS;
  
  // Apply combo multiplier if applicable
  if (comboCount > 0) {
    points = Math.floor(points * Math.pow(COMBO_MULTIPLIER, comboCount));
  }
  
  // Add time bonus for quick matches
  if (timeSinceLastMatch <= TIME_BONUS_THRESHOLD) {
    points += TIME_BONUS_POINTS;
  }
  
  // Bonus for matching identical tiles (same id, from same original position)
  if (tile1.id === tile2.id) {
    points += 5;
  }
  
  return points;
}

/**
 * Calculate bonus points for board completion
 * @param {number} timeElapsed - Total game time in seconds
 * @param {number} totalMatches - Total number of matches made
 */
function calculateBoardClearBonus(timeElapsed, totalMatches) {
  let bonus = BOARD_CLEAR_BONUS;
  
  // Time efficiency bonus
  const expectedTimePerMatch = 5; // seconds
  const expectedTotalTime = totalMatches * expectedTimePerMatch;
  
  if (timeElapsed < expectedTotalTime) {
    const timeEfficiency = (expectedTotalTime - timeElapsed) / expectedTotalTime;
    bonus += Math.floor(bonus * timeEfficiency);
  }
  
  return bonus;
}

/**
 * Calculate final score based on all game events
 * @param {Array} matchHistory - History of all matches with timestamps
 * @param {number} timeElapsed - Total game time in seconds
 */
function calculateFinalScore(matchHistory, timeElapsed) {
  let totalPoints = 0;
  let comboCount = 0;
  let lastMatchTime = 0;
  
  matchHistory.forEach((match, index) => {
    const timeSinceLastMatch = index === 0 ? 0 : match.timestamp - lastMatchTime;
    
    if (timeSinceLastMatch > 30) {
      // Reset combo if more than 30 seconds since last match
      comboCount = 0;
    }
    
    const points = calculateMatchPoints(
      match.tile1,
      match.tile2,
      comboCount,
      timeSinceLastMatch
    );
    
    totalPoints += points;
    comboCount++;
    lastMatchTime = match.timestamp;
  });
  
  // Add board clear bonus if board was cleared
  if (matchHistory.length > 0) {
    totalPoints += calculateBoardClearBonus(timeElapsed, matchHistory.length);
  }
  
  return totalPoints;
}

/**
 * Determine ranking based on score
 * @param {number} score - Final score
 * @param {Array} allPlayers - Array of player scores
 */
function calculateRank(score, allPlayers) {
  const sortedScores = [...allPlayers].sort((a, b) => b - a);
  const rank = sortedScores.indexOf(score) + 1;
  
  return {
    rank,
    totalPlayers: allPlayers.length,
    percentile: Math.floor((1 - (rank - 1) / allPlayers.length) * 100)
  };
}

module.exports = {
  BASE_MATCH_POINTS,
  COMBO_MULTIPLIER,
  TIME_BONUS_THRESHOLD,
  TIME_BONUS_POINTS,
  BOARD_CLEAR_BONUS,
  calculateMatchPoints,
  calculateBoardClearBonus,
  calculateFinalScore,
  calculateRank
};
