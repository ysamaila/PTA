import { BehaviorCategory } from '../../common/enums/index.js';

export interface BehaviorRatingResult {
  rating: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT';
  label: string;
}

/**
 * Compute descriptive rating and label from a score out of 100
 */
export function calculateBehaviorRating(score: number): BehaviorRatingResult {
  if (score >= 90) {
    return { rating: 'EXCELLENT', label: 'Exemplary / Role Model' };
  }
  if (score >= 75) {
    return { rating: 'GOOD', label: 'Commendable' };
  }
  if (score >= 50) {
    return { rating: 'SATISFACTORY', label: 'Developing / Acceptable' };
  }
  return { rating: 'NEEDS_IMPROVEMENT', label: 'Needs Guidance' };
}

/**
 * Assign dynamic achievement and character badges based on category scores and overall average
 */
export function evaluateBehaviorBadges(
  records: { category: BehaviorCategory; score: number }[],
  overallAverage: number,
): string[] {
  const badges: string[] = [];

  for (const record of records) {
    if (record.category === BehaviorCategory.TEAMWORK && record.score >= 85) {
      badges.push('Team Player');
    }
    if (
      record.category === BehaviorCategory.COMMUNICATION &&
      record.score >= 85
    ) {
      badges.push('Clear Communicator');
    }
    if (record.category === BehaviorCategory.RESPECT && record.score >= 85) {
      badges.push('Respect Ambassador');
    }
    if (
      record.category === BehaviorCategory.RESPONSIBILITY &&
      record.score >= 85
    ) {
      badges.push('Responsible Citizen');
    }
  }

  if (overallAverage >= 90) {
    badges.push('Exemplary Conduct');
  }

  if (records.length === 4 && records.every((r) => r.score >= 80)) {
    badges.push('All-Round Role Model');
  }

  return Array.from(new Set(badges));
}
