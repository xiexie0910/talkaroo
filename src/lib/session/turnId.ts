/** turnId helpers — only the latest turn may write the HUD. */

export function createTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function shouldApplyCoachResult(
  currentTurnId: string | null,
  resultTurnId: string,
): boolean {
  return currentTurnId !== null && currentTurnId === resultTurnId;
}
