/**
 * Calculate grade percentage rounded to 1 decimal place
 */
export function calculatePercentage(score: number, totalPossibleMarks: number = 100): number {
  if (totalPossibleMarks <= 0) return 0;
  return Math.round((score / totalPossibleMarks) * 1000) / 10;
}

/**
 * Assign standard Nigerian / Universal letter grade based on percentage
 */
export function calculateGradeLetter(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/**
 * Evaluate dynamic achievement badges based on student subject averages (GRD-05)
 */
export function evaluateStudentBadges(
  subjectAverages: { subjectName: string; averagePercentage: number }[],
  overallAverage: number,
  hasPerfectScore: boolean = false,
): string[] {
  const badges: string[] = [];

  if (overallAverage >= 80) {
    badges.push('Honor Roll');
  }

  if (overallAverage >= 70) {
    badges.push('Consistent Achiever');
  }

  for (const s of subjectAverages) {
    const lowerName = s.subjectName.toLowerCase();
    if (lowerName.includes('math') && s.averagePercentage >= 85) {
      badges.push('Math Whiz');
    }
    if ((lowerName.includes('sci') || lowerName.includes('bio') || lowerName.includes('phys')) && s.averagePercentage >= 85) {
      badges.push('Science Explorer');
    }
    if ((lowerName.includes('eng') || lowerName.includes('lit')) && s.averagePercentage >= 85) {
      badges.push('Literacy Leader');
    }
  }

  if (hasPerfectScore) {
    badges.push('Perfect Score');
  }

  return Array.from(new Set(badges));
}
