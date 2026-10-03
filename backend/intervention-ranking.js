const ACTION_WEIGHT = { saved: 1, dismissed: -2, started: 2, helpful: 3, irrelevant: -3 };
const MINIMUM_EVIDENCE = 2;

export const SUGGESTIONS = Object.freeze([
  { id: 'consistent-sleep', title: 'Keep a consistent sleep schedule', description: 'Try keeping sleep and wake times consistent for one week.', metric: 'sleep-wellness' },
  { id: 'steady-hydration', title: 'Spread hydration through the day', description: 'Track water intake at regular points during the day.', metric: 'hydration' },
  { id: 'balanced-activity', title: 'Try a steady activity routine', description: 'Track a manageable, consistent amount of daily movement.', metric: 'activity-load' }
]);

export function rankSuggestions(suggestions, feedback = [], outcomes = [], userId) {
  const ownedFeedback = feedback.filter(item => item.userId === userId && ACTION_WEIGHT[item.action] !== undefined);
  const ownedOutcomes = outcomes.filter(item => item.userId === userId && item.status === 'available' && suggestions.some(suggestion => suggestion.metric === item.metric));
  const evidenceCount = ownedFeedback.length + ownedOutcomes.length;
  if (evidenceCount < MINIMUM_EVIDENCE) return {
    available: false,
    threshold: MINIMUM_EVIDENCE,
    evidenceCount,
    reason: `Ranking unavailable until ${MINIMUM_EVIDENCE} relevant feedback or outcome records exist.`,
    suggestions: suggestions.map(item => ({ ...item, rank: null, score: null, supportingEvidence: [] }))
  };
  const ranked = suggestions.map(item => {
    const actions = ownedFeedback.filter(row => row.suggestionId === item.id);
    const metricOutcomes = ownedOutcomes.filter(row => row.metric === item.metric);
    const score = actions.reduce((sum, row) => sum + ACTION_WEIGHT[row.action], 0) + metricOutcomes.reduce((sum, row) => sum + (row.change > 0 ? 2 : row.change < 0 ? -1 : 0), 0);
    return { ...item, score, supportingEvidence: [...actions.map(row => `Feedback: ${row.action}`), ...metricOutcomes.map(row => `Observed ${row.metric} change: ${row.change >= 0 ? '+' : ''}${row.change}`)] };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  ranked.forEach((item, index) => { item.rank = index && item.score === ranked[index - 1].score ? ranked[index - 1].rank : index + 1; });
  return { available: true, threshold: MINIMUM_EVIDENCE, evidenceCount, reason: `Ranked from ${evidenceCount} account-owned feedback and outcome records. Ties share rank.`, suggestions: ranked };
}
