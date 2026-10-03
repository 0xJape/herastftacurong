const round = value => Math.round(value * 10) / 10;

export function summarizeGoal(goal, entries = []) {
  const history = entries
    .filter(item => Number.isFinite(Number(item.value)))
    .map(item => ({ ...item, value: Number(item.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const current = history.at(-1)?.value ?? null;
  const target = Number(goal.targetValue);
  const direction = goal.direction === 'at-most' ? 'at-most' : 'at-least';
  const progressPercent = current === null || !Number.isFinite(target) || target <= 0
    ? null
    : round(Math.max(0, Math.min(100, direction === 'at-most' ? target / Math.max(current, target) * 100 : current / target * 100)));
  const previous = history.at(-2)?.value ?? null;
  const change = current === null || previous === null ? null : round(current - previous);
  const reached = current === null ? false : direction === 'at-most' ? current <= target : current >= target;
  return { current, previous, change, progressPercent, reached, entryCount: history.length };
}
