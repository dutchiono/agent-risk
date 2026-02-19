import { AttackResult } from './types';

/** Roll N dice, return sorted descending */
export function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1)
    .sort((a, b) => b - a);
}

/**
 * Resolve one round of combat.
 * attacker: 1–3 armies committed (uses that many dice)
 * defender: armies on territory (uses min(2, armies) dice)
 */
export function resolveCombat(attackerArmies: number, defenderArmies: number): AttackResult {
  const attackDice = Math.min(attackerArmies, 3);
  const defendDice = Math.min(defenderArmies, 2);

  const attackerRolls = rollDice(attackDice);
  const defenderRolls = rollDice(defendDice);

  const comparisons = Math.min(attackDice, defendDice);
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < comparisons; i++) {
    // defender wins ties
    if (attackerRolls[i] > defenderRolls[i]) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  return {
    attackerLosses,
    defenderLosses,
    attackerDice: attackerRolls,
    defenderDice: defenderRolls,
  };
}
