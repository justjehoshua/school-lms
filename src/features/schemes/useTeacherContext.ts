import { listAssignments, type Assignment } from '@/services/peopleService';
import { listClasses, listSubjects, listSessions, listTerms, type ClassRow, type Period, type Subject, type Term } from '@/services/adminService';

export interface TeacherContext {
  assignments: Assignment[]; classes: ClassRow[]; subjects: Subject[]; sessions: Period[]; terms: Term[];
  className: Map<string, string>; subjectName: Map<string, string>;
  currentSession: Period | null; currentTerm: Term | null;
}

/** Everything a teacher page needs to label ids with names. Module-level so it is a stable loader. */
export async function loadTeacherContext(): Promise<TeacherContext> {
  const [assignments, classes, subjects, sessions, terms] = await Promise.all([
    listAssignments(), listClasses(), listSubjects(), listSessions(), listTerms(),
  ]);
  return {
    assignments, classes, subjects, sessions, terms,
    className: new Map(classes.map((c) => [c.id, c.name])),
    subjectName: new Map(subjects.map((s) => [s.id, s.name])),
    currentSession: sessions.find((s) => s.is_current) ?? null,
    currentTerm: terms.find((t) => t.is_current) ?? null,
  };
}
