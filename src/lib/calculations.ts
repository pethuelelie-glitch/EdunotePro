export interface GradeRow {
  student_id: string;
  module_id: string;
  score: number;
  coefficient: number;
}

export function studentAverage(grades: GradeRow[]): {
  average: number;
  totalCoef: number;
  totalPoints: number;
} {
  const totalCoef = grades.reduce((s, g) => s + g.coefficient, 0);
  const totalPoints = grades.reduce((s, g) => s + g.score * g.coefficient, 0);
  return { average: totalCoef > 0 ? totalPoints / totalCoef : 0, totalCoef, totalPoints };
}

export function mention(avg: number): string {
  if (avg >= 16) return "Très Bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez Bien";
  if (avg >= 10) return "Passable";
  return "Ajourné";
}

export function mentionColor(avg: number): string {
  if (avg >= 16) return "text-success";
  if (avg >= 14) return "text-primary";
  if (avg >= 12) return "text-foreground";
  if (avg >= 10) return "text-warning";
  return "text-destructive";
}
