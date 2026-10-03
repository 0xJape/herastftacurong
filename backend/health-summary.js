const DOMAIN_ORDER = ['checkins', 'cycles', 'sleep', 'wearable', 'nutrition', 'goals', 'interventions'];
const round = value => value == null ? null : Math.round(Number(value) * 10) / 10;
const inRange = (date, startDate, endDate) => date >= startDate && date <= endDate;

export const HEALTH_SUMMARY_DOMAINS = new Set(DOMAIN_ORDER);

export function buildVerifiedContactLinks(contact = {}) {
  const phone = typeof contact.phone === 'string' ? contact.phone.trim() : '';
  const email = typeof contact.email === 'string' ? contact.email.trim() : '';
  const website = typeof contact.website === 'string' ? contact.website.trim() : '';
  const links = [];
  if (/^[+\d][\d ()-]{5,24}$/.test(phone)) links.push({ type: 'phone', label: phone, href: `tel:${phone.replace(/[^+\d]/g, '')}` });
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) links.push({ type: 'email', label: email, href: `mailto:${email}` });
  try {
    const url = new URL(website);
    if (url.protocol === 'http:' || url.protocol === 'https:') links.push({ type: 'website', label: website, href: url.href });
  } catch {}
  return links;
}

export function buildHealthSummary({ startDate, endDate, domains, records }) {
  const sections = [], sources = [];
  const add = (domain, title, facts, refs) => {
    if (!domains.includes(domain)) return;
    sections.push({ domain, title, facts });
    sources.push(...refs.map(ref => ({ domain, ...ref })));
  };
  const checkins = (records.checkins || []).filter(item => inRange(item.date, startDate, endDate));
  add('checkins', 'Daily check-ins', checkins.length ? [`${checkins.length} recorded day${checkins.length === 1 ? '' : 's'}.`, `Average mood ${round(checkins.reduce((sum, item) => sum + item.mood, 0) / checkins.length)}/5; stress ${round(checkins.reduce((sum, item) => sum + item.stress, 0) / checkins.length)}/5; energy ${round(checkins.reduce((sum, item) => sum + item.energy, 0) / checkins.length)}/5.`] : ['No records in selected range.'], checkins.map(item => ({ type: 'daily_checkin', id: item.id, date: item.date })));
  const cycles = (records.cycles || []).filter(item => item.startDate <= endDate && (item.endDate || item.startDate) >= startDate);
  add('cycles', 'Cycle records', cycles.length ? cycles.map(item => `Cycle start recorded ${item.startDate}${item.endDate ? ` through ${item.endDate}` : ''}.`) : ['No records in selected range.'], cycles.map(item => ({ type: 'menstrual_cycle', id: item.id, date: item.startDate })));
  const sleep = (records.sleep || []).filter(item => inRange(item.date, startDate, endDate));
  const scoredSleep = sleep.filter(item => item.score != null);
  add('sleep', 'Sleep', sleep.length ? [`${sleep.length} sleep log${sleep.length === 1 ? '' : 's'}.`, scoredSleep.length ? `Average Sleep Wellness Score ${round(scoredSleep.reduce((sum, item) => sum + item.score, 0) / scoredSleep.length)}/100.` : 'Sleep Wellness Score unavailable.'] : ['No records in selected range.'], sleep.map(item => ({ type: 'sleep_record', id: item.id, date: item.date })));
  const wearable = (records.wearable || []).filter(item => inRange(item.date, startDate, endDate) && item.wornReadings > 0);
  add('wearable', 'Wearable observations', wearable.length ? [`${wearable.length} day${wearable.length === 1 ? '' : 's'} with worn-device observations.`, `Average heart rate ${round(wearable.filter(x => x.heartRate != null).reduce((sum, x) => sum + x.heartRate, 0) / wearable.filter(x => x.heartRate != null).length) || 'unavailable'} BPM; SpO₂ ${round(wearable.filter(x => x.spo2 != null).reduce((sum, x) => sum + x.spo2, 0) / wearable.filter(x => x.spo2 != null).length) || 'unavailable'}%.`] : ['No reliable worn-device observations in selected range.'], wearable.map(item => ({ type: 'wearable_daily', id: item.date, date: item.date })));
  const water = (records.water || []).filter(item => inRange(item.date, startDate, endDate));
  const meals = (records.meals || []).filter(item => inRange(item.eatenAt.slice(0, 10), startDate, endDate));
  add('nutrition', 'Nutrition and hydration', water.length || meals.length ? [`${meals.length} meal record${meals.length === 1 ? '' : 's'} and ${water.length} hydration day${water.length === 1 ? '' : 's'}.`, water.length ? `Average recorded water ${round(water.reduce((sum, item) => sum + item.milliliters, 0) / water.length)} mL/day.` : 'No hydration totals recorded.'] : ['No records in selected range.'], [...water.map(item => ({ type: 'water_intake', id: item.date, date: item.date })), ...meals.map(item => ({ type: 'meal_record', id: item.id, date: item.eatenAt.slice(0, 10) }))]);
  const goals = (records.goals || []).filter(item => item.startDate <= endDate && (!item.targetDate || item.targetDate >= startDate));
  add('goals', 'Wellness goals', goals.length ? goals.map(item => `${item.title}: ${item.status}; target ${item.direction === 'at-most' ? 'at most' : 'at least'} ${item.targetValue} ${item.unit}.`) : ['No goals overlap selected range.'], goals.map(item => ({ type: 'wellness_goal', id: item.id, date: item.startDate })));
  const interventions = (records.interventions || []).filter(item => item.startDate <= endDate && item.endDate >= startDate);
  add('interventions', 'Wellness changes', interventions.length ? interventions.map(item => `${item.title}: ${item.status}; ${item.startDate} to ${item.endDate}.`) : ['No wellness changes overlap selected range.'], interventions.map(item => ({ type: 'intervention', id: item.id, date: item.startDate })));
  sections.sort((a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain));
  const text = [`HERA Health Summary`, `Date range: ${startDate} to ${endDate}`, '', ...sections.flatMap(section => [section.title, ...section.facts.map(fact => `- ${fact}`), '']), 'Informational record summary only; not a diagnosis or medical assessment.'].join('\n').trim();
  return { startDate, endDate, domains: [...domains], sections, sources, text, disclaimer: 'Informational record summary only; not a diagnosis or medical assessment.' };
}
