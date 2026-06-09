export function yearStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "En cours";
    case "archived":
      return "Archivée";
    case "upcoming":
      return "À venir";
    default:
      return status;
  }
}

export const GRADE_SESSIONS = ["Session 1", "Session 2"] as const;
export type GradeSession = (typeof GRADE_SESSIONS)[number];
