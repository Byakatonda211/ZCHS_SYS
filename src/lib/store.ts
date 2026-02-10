export type Role = "Administrator" | "Teacher" | "Class Teacher" | "System Admin";

export type Student = {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: "Male" | "Female" | "Other";
  dob?: string; // yyyy-mm-dd
  className?: string; // legacy display
  stream?: string; // legacy display
  term?: string; // legacy display
  status: "Active" | "Transferred" | "Graduated";
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  religion?: string;
  nationality?: string;
  medicalNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
};

export type Session = {
  role: Role;
  username?: string;
  createdAt: string;
};

export type AcademicYear = {
  id: string;
  name: string; // e.g. "2026"
  startsOn?: string;
  endsOn?: string;
  isCurrent: boolean;
};

export type Term = {
  id: string;
  academicYearId: string;
  name: string; // Term 1, Term 2, Term 3
  startsOn?: string;
  endsOn?: string;
  isCurrent: boolean;
};

export type ClassDef = {
  id: string;
  name: string; // "S1", "S2", "S5", "S6"
  sortOrder: number;
};

export type StreamDef = {
  id: string;
  classId: string;
  name: string; // "A", "B"
};

/** =========================
 *  ENROLLMENTS (Move Student B)
 *  ========================= */
export type EnrollmentReason =
  | "Promoted"
  | "Transferred"
  | "Repeated"
  | "Stream Change"
  | "Other";

export type Enrollment = {
  id: string;
  studentId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  streamName?: string;
  reason: EnrollmentReason;
  note?: string;
  effectiveOn: string; // yyyy-mm-dd
  isCurrent: boolean;
  createdAt: string;
};

/** =========================
 *  SUBJECTS + PAPERS
 *  ========================= */
export type Subject = {
  id: string;
  classId: string;
  name: string;
  code?: string;
  category?: "Core" | "Elective";
  maxScore: number; // display/report (teachers still enter /100)
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

export type SubjectPaper = {
  id: string;
  subjectId: string;
  name: string; // "Paper 1"
  code?: string; // "P1"
  maxScore: number; // typically 100
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

/** =========================
 *  ASSESSMENTS + SCHEMES
 *  ========================= */
export type AssessmentDef = {
  id: string;
  name: string; // "CA1", "CA2", "Midterm", "End of Term"
  code: string; // "CA1", "CA2", "MID", "EOT"
  isActive: boolean;
  createdAt: string;
};

// Report “types” that later drive report card formatting
export type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

export type SchemeComponent = {
  assessmentId: string; // which assessment contributes
  weightOutOf: number; // how much it contributes on the report (e.g. 10, 80, 50...)
};

export type ReportScheme = {
  id: string;
  reportType: ReportType;
  name: string; // friendly label
  components: SchemeComponent[];
  createdAt: string;
};

// Teachers always enter /100
export type MarkEntry = {
  id: string;

  studentId: string;
  academicYearId: string;
  termId: string;

  assessmentId: string;

  // O-Level: subjectId set, paperId undefined
  subjectId: string;
  paperId?: string;

  score100: number; // 0..100
  createdAt: string;
  updatedAt: string;
};

const LS_KEYS = {
  session: "sis.session.v1",
  students: "sis.students.v1",
  academicYears: "sis.academicYears.v1",
  terms: "sis.terms.v1",
  classes: "sis.classes.v1",
  streams: "sis.streams.v1",
  enrollments: "sis.enrollments.v1",
  subjects: "sis.subjects.v1",
  subjectPapers: "sis.subjectPapers.v1",
  assessments: "sis.assessments.v1",
  schemes: "sis.schemes.v1",
  marks: "sis.marks.v1",
};

// -------------------- SESSION --------------------
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_KEYS.session);
  return raw ? (JSON.parse(raw) as Session) : null;
}
export function setSession(session: Session) {
  localStorage.setItem(LS_KEYS.session, JSON.stringify(session));
}
export function clearSession() {
  localStorage.removeItem(LS_KEYS.session);
}

// -------------------- STUDENTS --------------------
export function getStudents(): Student[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.students);
  return raw ? (JSON.parse(raw) as Student[]) : [];
}
export function saveStudents(students: Student[]) {
  localStorage.setItem(LS_KEYS.students, JSON.stringify(students));
}

export function seedStudentsIfEmpty() {
  const existing = getStudents();
  if (existing.length) return;

  const now = new Date().toISOString();
  const seeded: Student[] = [
    {
      id: crypto.randomUUID(),
      studentNo: "SCH-2026-00001",
      firstName: "Amina",
      lastName: "Nabirye",
      otherName: "",
      gender: "Female",
      dob: "2010-05-14",
      className: "S2",
      stream: "A",
      term: "Term 1",
      status: "Active",
      guardianName: "Mr. Nabirye",
      guardianPhone: "+256700000001",
      address: "Kampala",
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      studentNo: "SCH-2026-00002",
      firstName: "Brian",
      lastName: "Okello",
      otherName: "",
      gender: "Male",
      dob: "2009-11-03",
      className: "S2",
      stream: "B",
      term: "Term 1",
      status: "Active",
      guardianName: "Ms. A. Okello",
      guardianPhone: "+256700000002",
      address: "Wakiso",
      createdAt: now,
    },
  ];

  saveStudents(seeded);
}

export function getStudentById(id: string) {
  return getStudents().find((s) => s.id === id) ?? null;
}
export function addStudent(student: Omit<Student, "id" | "createdAt">) {
  const students = getStudents();
  const next: Student = { ...student, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  students.unshift(next);
  saveStudents(students);
  return next;
}
export function updateStudent(id: string, patch: Partial<Omit<Student, "id" | "createdAt">>) {
  const students = getStudents();
  const idx = students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const updated: Student = { ...students[idx], ...patch, id: students[idx].id, createdAt: students[idx].createdAt };
  students[idx] = updated;
  saveStudents(students);
  return updated;
}

// -------------------- YEARS + TERMS --------------------
export function getAcademicYears(): AcademicYear[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.academicYears);
  return raw ? (JSON.parse(raw) as AcademicYear[]) : [];
}
export function saveAcademicYears(years: AcademicYear[]) {
  localStorage.setItem(LS_KEYS.academicYears, JSON.stringify(years));
}
export function getTerms(): Term[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.terms);
  return raw ? (JSON.parse(raw) as Term[]) : [];
}
export function saveTerms(terms: Term[]) {
  localStorage.setItem(LS_KEYS.terms, JSON.stringify(terms));
}
export function getCurrentAcademicYear(): AcademicYear | null {
  const years = getAcademicYears();
  return years.find((y) => y.isCurrent) ?? years[0] ?? null;
}

export function setCurrentAcademicYear(id: string) {
  const years = getAcademicYears().map((y) => ({ ...y, isCurrent: y.id === id }));
  saveAcademicYears(years);
}

export function addAcademicYear(name: string) {
  const n = name.trim();
  if (!n) return null;

  const years = getAcademicYears();
  const next: AcademicYear = {
    id: crypto.randomUUID(),
    name: n,
    isCurrent: years.length === 0,
  };

  years.unshift(next);
  saveAcademicYears(years);
  return next;
}

export function updateAcademicYear(id: string, patch: Partial<Omit<AcademicYear, "id">>) {
  const years = getAcademicYears();
  const idx = years.findIndex((y) => y.id === id);
  if (idx === -1) return null;
  years[idx] = { ...years[idx], ...patch, id: years[idx].id };
  saveAcademicYears(years);
  return years[idx];
}

export function deleteAcademicYear(id: string) {
  const years = getAcademicYears();
  const remainingYears = years.filter((y) => y.id !== id);
  saveAcademicYears(
    remainingYears.length
      ? remainingYears.map((y, i) => ({ ...y, isCurrent: y.isCurrent || (i === 0 && !remainingYears.some((yy) => yy.isCurrent)) }))
      : []
  );

  // Remove terms belonging to this year
  const terms = getTerms().filter((t) => t.academicYearId !== id);
  // If current term got removed, ensure a current term exists for current year
  if (terms.length) {
    const currentYear = (getAcademicYears().find((y) => y.isCurrent) ?? getAcademicYears()[0])?.id;
    const hasCurrent = terms.some((t) => t.isCurrent);
    const nextTerms = hasCurrent
      ? terms
      : terms.map((t, i) => ({ ...t, isCurrent: i === 0 && (!currentYear || t.academicYearId === currentYear) }));
    saveTerms(nextTerms);
  } else {
    saveTerms([]);
  }
}

export function getCurrentTerm(): Term | null {
  const terms = getTerms();
  return terms.find((t) => t.isCurrent) ?? terms[0] ?? null;
}

export function setCurrentTerm(id: string) {
  const terms = getTerms().map((t) => ({ ...t, isCurrent: t.id === id }));
  saveTerms(terms);
}

export function addTerm(input: { academicYearId: string; name: string; isCurrent?: boolean }) {
  const n = input.name.trim();
  if (!n) return null;

  const terms = getTerms();
  const next: Term = {
    id: crypto.randomUUID(),
    academicYearId: input.academicYearId,
    name: n,
    isCurrent: Boolean(input.isCurrent) || terms.length === 0,
  };

  const updated = next.isCurrent ? terms.map((t) => ({ ...t, isCurrent: false })) : terms;
  updated.unshift(next);
  saveTerms(updated);
  return next;
}

export function updateTerm(id: string, patch: Partial<Omit<Term, "id">>) {
  const terms = getTerms();
  const idx = terms.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  terms[idx] = { ...terms[idx], ...patch, id: terms[idx].id };
  saveTerms(terms);
  return terms[idx];
}

export function deleteTerm(id: string) {
  const terms = getTerms();
  const removed = terms.find((t) => t.id === id) ?? null;
  const remaining = terms.filter((t) => t.id !== id);

  // Ensure we still have a current term if we deleted it
  if (removed?.isCurrent && remaining.length) {
    remaining[0] = { ...remaining[0], isCurrent: true };
  }
  saveTerms(remaining);
}


// -------------------- CLASSES + STREAMS --------------------
export function getClasses(): ClassDef[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.classes);
  return raw ? (JSON.parse(raw) as ClassDef[]) : [];
}
export function saveClasses(classes: ClassDef[]) {
  localStorage.setItem(LS_KEYS.classes, JSON.stringify(classes));
}
export function getStreams(): StreamDef[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.streams);
  return raw ? (JSON.parse(raw) as StreamDef[]) : [];
}
export function saveStreams(streams: StreamDef[]) {
  localStorage.setItem(LS_KEYS.streams, JSON.stringify(streams));
}

// -------------------- SEED SETTINGS --------------------
export function seedSettingsIfEmpty() {
  const years = getAcademicYears();
  const terms = getTerms();
  const classes = getClasses();
  const streams = getStreams();

  if (!years.length) {
    const y: AcademicYear = { id: crypto.randomUUID(), name: "2026", isCurrent: true };
    saveAcademicYears([y]);
    const t: Term[] = ["Term 1", "Term 2", "Term 3"].map((name, i) => ({
      id: crypto.randomUUID(),
      academicYearId: y.id,
      name,
      isCurrent: i === 0,
    }));
    saveTerms(t);
  }

  if (!classes.length) {
    const defaultClasses = ["P7", "S1", "S2", "S3", "S4", "S5", "S6"].map((name, idx) => ({
      id: crypto.randomUUID(),
      name,
      sortOrder: idx + 1,
    }));
    saveClasses(defaultClasses);

    const s = defaultClasses.filter((c) => c.name.startsWith("S"));
    const defaultStreams: StreamDef[] = s.flatMap((c) => [
      { id: crypto.randomUUID(), classId: c.id, name: "A" },
      { id: crypto.randomUUID(), classId: c.id, name: "B" },
    ]);
    saveStreams(defaultStreams);
  }

  if (!terms.length && getAcademicYears().length) {
    const currentYear = getAcademicYears().find((y) => y.isCurrent) ?? getAcademicYears()[0];
    if (currentYear) {
      const t: Term[] = ["Term 1", "Term 2", "Term 3"].map((name, i) => ({
        id: crypto.randomUUID(),
        academicYearId: currentYear.id,
        name,
        isCurrent: i === 0,
      }));
      saveTerms(t);
    }
  }

  if (classes.length && !streams.length) {
    const s = classes.filter((c) => c.name.startsWith("S"));
    const defaultStreams: StreamDef[] = s.flatMap((c) => [
      { id: crypto.randomUUID(), classId: c.id, name: "A" },
      { id: crypto.randomUUID(), classId: c.id, name: "B" },
    ]);
    saveStreams(defaultStreams);
  }
}

// -------------------- ENROLLMENTS --------------------
export function getEnrollments(): Enrollment[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.enrollments);
  return raw ? (JSON.parse(raw) as Enrollment[]) : [];
}
export function saveEnrollments(items: Enrollment[]) {
  localStorage.setItem(LS_KEYS.enrollments, JSON.stringify(items));
}
export function getStudentEnrollments(studentId: string): Enrollment[] {
  return getEnrollments()
    .filter((e) => e.studentId === studentId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export function getCurrentEnrollment(studentId: string): Enrollment | null {
  const list = getStudentEnrollments(studentId);
  return list.find((e) => e.isCurrent) ?? list[0] ?? null;
}
export function seedEnrollmentsIfEmpty() {
  const existing = getEnrollments();
  if (existing.length) return;

  const students = getStudents();
  if (!students.length) return;

  const years = getAcademicYears();
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  if (!currentYear) return;

  const termsForYear = getTerms().filter((t) => t.academicYearId === currentYear.id);
  const currentTerm = termsForYear.find((t) => t.isCurrent) ?? termsForYear[0];
  if (!currentTerm) return;

  const classes = getClasses();
  const streams = getStreams();
  const today = new Date().toISOString().slice(0, 10);

  const seeded: Enrollment[] = students.map((s) => {
    const classId = classes.find((c) => c.name === (s.className ?? ""))?.id ?? classes[0]?.id ?? "";
    const streamName =
      s.stream && streams.some((st) => st.classId === classId && st.name === s.stream) ? s.stream : undefined;

    return {
      id: crypto.randomUUID(),
      studentId: s.id,
      academicYearId: currentYear.id,
      termId: currentTerm.id,
      classId,
      streamName,
      reason: "Other",
      note: "Seeded from existing student record",
      effectiveOn: today,
      isCurrent: true,
      createdAt: new Date().toISOString(),
    };
  });

  saveEnrollments(seeded);
}
export function moveStudent(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  streamName?: string;
  reason: EnrollmentReason;
  note?: string;
  effectiveOn: string;
}) {
  const all = getEnrollments();
  const updated = all.map((e) => (e.studentId === args.studentId ? { ...e, isCurrent: false } : e));

  const next: Enrollment = {
    id: crypto.randomUUID(),
    studentId: args.studentId,
    academicYearId: args.academicYearId,
    termId: args.termId,
    classId: args.classId,
    streamName: args.streamName || undefined,
    reason: args.reason,
    note: args.note?.trim() || undefined,
    effectiveOn: args.effectiveOn,
    isCurrent: true,
    createdAt: new Date().toISOString(),
  };

  updated.unshift(next);
  saveEnrollments(updated);

  // keep legacy student fields updated
  const cls = getClasses().find((c) => c.id === args.classId);
  const term = getTerms().find((t) => t.id === args.termId);
  updateStudent(args.studentId, {
    className: cls?.name ?? "",
    stream: args.streamName ?? "",
    term: term?.name ?? "",
  });

  return next;
}

// Current students in class (from current enrollments)
export function getStudentsInClassCurrent(classId: string): Student[] {
  const enrollments = getEnrollments().filter((e) => e.classId === classId && e.isCurrent);
  const studentIds = new Set(enrollments.map((e) => e.studentId));
  return getStudents().filter((s) => studentIds.has(s.id));
}

// -------------------- SUBJECTS --------------------
export function getSubjects(): Subject[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.subjects);
  return raw ? (JSON.parse(raw) as Subject[]) : [];
}
export function saveSubjects(items: Subject[]) {
  localStorage.setItem(LS_KEYS.subjects, JSON.stringify(items));
}
export function getSubjectsForClass(classId: string): Subject[] {
  return getSubjects()
    .filter((s) => s.classId === classId && s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
export function addSubject(input: { classId: string; name: string; code?: string; category?: "Core" | "Elective"; maxScore?: number }) {
  const items = getSubjects();
  const sameClass = items.filter((s) => s.classId === input.classId);
  const maxOrder = sameClass.reduce((m, s) => Math.max(m, s.sortOrder), 0);

  const next: Subject = {
    id: crypto.randomUUID(),
    classId: input.classId,
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    category: input.category ?? "Core",
    maxScore: input.maxScore ?? 100,
    sortOrder: maxOrder + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  items.unshift(next);
  saveSubjects(items);
  return next;
}
export function updateSubject(subjectId: string, patch: Partial<Omit<Subject, "id" | "createdAt">>) {
  const items = getSubjects();
  const idx = items.findIndex((s) => s.id === subjectId);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, id: items[idx].id, createdAt: items[idx].createdAt };
  saveSubjects(items);
  return items[idx];
}
export function deleteSubject(subjectId: string) {
  const items = getSubjects().filter((s) => s.id !== subjectId);
  saveSubjects(items);
  // remove papers under subject
  const remainingPapers = getSubjectPapers().filter((p) => p.subjectId !== subjectId);
  saveSubjectPapers(remainingPapers);
}
export function toggleSubjectActive(subjectId: string, isActive: boolean) {
  return updateSubject(subjectId, { isActive });
}

// -------------------- SUBJECT PAPERS --------------------
export function getSubjectPapers(): SubjectPaper[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.subjectPapers);
  return raw ? (JSON.parse(raw) as SubjectPaper[]) : [];
}
export function saveSubjectPapers(items: SubjectPaper[]) {
  localStorage.setItem(LS_KEYS.subjectPapers, JSON.stringify(items));
}
export function getPapersForSubject(subjectId: string): SubjectPaper[] {
  return getSubjectPapers()
    .filter((p) => p.subjectId === subjectId && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
export function addSubjectPaper(input: { subjectId: string; name: string; code?: string; maxScore?: number }) {
  const items = getSubjectPapers();
  const same = items.filter((p) => p.subjectId === input.subjectId);
  const maxOrder = same.reduce((m, p) => Math.max(m, p.sortOrder), 0);

  const next: SubjectPaper = {
    id: crypto.randomUUID(),
    subjectId: input.subjectId,
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    maxScore: input.maxScore ?? 100,
    sortOrder: maxOrder + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  items.unshift(next);
  saveSubjectPapers(items);
  return next;
}
export function updateSubjectPaper(paperId: string, patch: Partial<Omit<SubjectPaper, "id" | "createdAt">>) {
  const items = getSubjectPapers();
  const idx = items.findIndex((p) => p.id === paperId);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, id: items[idx].id, createdAt: items[idx].createdAt };
  saveSubjectPapers(items);
  return items[idx];
}
export function deleteSubjectPaper(paperId: string) {
  const items = getSubjectPapers().filter((p) => p.id !== paperId);
  saveSubjectPapers(items);
}
export function toggleSubjectPaperActive(paperId: string, isActive: boolean) {
  return updateSubjectPaper(paperId, { isActive });
}
export function autoGenerateSubjectPapers(subjectId: string, count: number = 3) {
  const existing = getSubjectPapers().filter((p) => p.subjectId === subjectId);
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  for (let i = 1; i <= count; i++) {
    const name = `Paper ${i}`;
    if (existingNames.has(name.toLowerCase())) continue;
    addSubjectPaper({ subjectId, name, code: `P${i}`, maxScore: 100 });
  }
}

// -------------------- ASSESSMENTS --------------------
export function getAssessments(): AssessmentDef[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.assessments);
  return raw ? (JSON.parse(raw) as AssessmentDef[]) : [];
}
export function saveAssessments(items: AssessmentDef[]) {
  localStorage.setItem(LS_KEYS.assessments, JSON.stringify(items));
}
export function addAssessment(input: { name: string; code: string }) {
  const items = getAssessments();
  const next: AssessmentDef = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  items.unshift(next);
  saveAssessments(items);
  return next;
}
export function updateAssessment(id: string, patch: Partial<Omit<AssessmentDef, "id" | "createdAt">>) {
  const items = getAssessments();
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, id: items[idx].id, createdAt: items[idx].createdAt };
  saveAssessments(items);
  return items[idx];
}
export function deleteAssessment(id: string) {
  const items = getAssessments().filter((a) => a.id !== id);
  saveAssessments(items);
}
export function toggleAssessmentActive(id: string, isActive: boolean) {
  return updateAssessment(id, { isActive });
}

// Recommended defaults (run via UI button, not auto)
export function resetAssessmentsToDefaults() {
  const now = new Date().toISOString();
  const defs: AssessmentDef[] = [
    { id: crypto.randomUUID(), name: "Continuous Assessment 1", code: "CA1", isActive: true, createdAt: now },
    { id: crypto.randomUUID(), name: "Continuous Assessment 2", code: "CA2", isActive: true, createdAt: now },
    { id: crypto.randomUUID(), name: "Midterm", code: "MID", isActive: true, createdAt: now },
    { id: crypto.randomUUID(), name: "End of Term", code: "EOT", isActive: true, createdAt: now },
  ];
  saveAssessments(defs);
  return defs;
}

// -------------------- SCHEMES --------------------
export function getSchemes(): ReportScheme[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.schemes);
  return raw ? (JSON.parse(raw) as ReportScheme[]) : [];
}
export function saveSchemes(items: ReportScheme[]) {
  localStorage.setItem(LS_KEYS.schemes, JSON.stringify(items));
}
export function getSchemeByReportType(reportType: ReportType): ReportScheme | null {
  return getSchemes().find((s) => s.reportType === reportType) ?? null;
}
export function upsertScheme(reportType: ReportType, name: string, components: SchemeComponent[]) {
  const items = getSchemes();
  const idx = items.findIndex((s) => s.reportType === reportType);
  if (idx === -1) {
    const next: ReportScheme = {
      id: crypto.randomUUID(),
      reportType,
      name: name.trim(),
      components,
      createdAt: new Date().toISOString(),
    };
    items.unshift(next);
    saveSchemes(items);
    return next;
  }
  items[idx] = { ...items[idx], reportType, name: name.trim(), components };
  saveSchemes(items);
  return items[idx];
}

// Reset schemes to recommended defaults using current assessment IDs by code
export function resetSchemesToDefaults() {
  const assessments = getAssessments();
  const byCode = (code: string) => assessments.find((a) => a.code === code)?.id ?? "";

  const ca1 = byCode("CA1");
  const ca2 = byCode("CA2");
  const mid = byCode("MID");
  const eot = byCode("EOT");

  // If assessments are missing, create defaults first
  if (!ca1 || !ca2 || !mid || !eot) {
    resetAssessmentsToDefaults();
    return resetSchemesToDefaults();
  }

  const now = new Date().toISOString();
  const defaults: ReportScheme[] = [
    {
      id: crypto.randomUUID(),
      reportType: "O_MID",
      name: "O-Level Midterm (Average CA1 & CA2)",
      components: [
        { assessmentId: ca1, weightOutOf: 50 },
        { assessmentId: ca2, weightOutOf: 50 },
      ],
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      reportType: "O_EOT",
      name: "O-Level Endterm (CA1/10 + CA2/10 + EOT/80)",
      components: [
        { assessmentId: ca1, weightOutOf: 10 },
        { assessmentId: ca2, weightOutOf: 10 },
        { assessmentId: eot, weightOutOf: 80 },
      ],
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      reportType: "A_MID",
      name: "A-Level Midterm (MID /100 per paper)",
      components: [{ assessmentId: mid, weightOutOf: 100 }],
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      reportType: "A_EOT",
      name: "A-Level Endterm (Average MID & EOT per paper)",
      components: [
        { assessmentId: mid, weightOutOf: 50 },
        { assessmentId: eot, weightOutOf: 50 },
      ],
      createdAt: now,
    },
  ];

  saveSchemes(defaults);
  return defaults;
}

// -------------------- MARKS --------------------
export function getMarks(): MarkEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_KEYS.marks);
  return raw ? (JSON.parse(raw) as MarkEntry[]) : [];
}
export function saveMarks(items: MarkEntry[]) {
  localStorage.setItem(LS_KEYS.marks, JSON.stringify(items));
}

export function getMark(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  assessmentId: string;
  subjectId: string;
  paperId?: string;
}): MarkEntry | null {
  return (
    getMarks().find(
      (m) =>
        m.studentId === args.studentId &&
        m.academicYearId === args.academicYearId &&
        m.termId === args.termId &&
        m.assessmentId === args.assessmentId &&
        m.subjectId === args.subjectId &&
        (m.paperId ?? "") === (args.paperId ?? "")
    ) ?? null
  );
}

export function upsertMark(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  assessmentId: string;
  subjectId: string;
  paperId?: string;
  score100: number;
}) {
  const items = getMarks();
  const idx = items.findIndex(
    (m) =>
      m.studentId === args.studentId &&
      m.academicYearId === args.academicYearId &&
      m.termId === args.termId &&
      m.assessmentId === args.assessmentId &&
      m.subjectId === args.subjectId &&
      (m.paperId ?? "") === (args.paperId ?? "")
  );

  const now = new Date().toISOString();
  const score = Math.max(0, Math.min(100, Number(args.score100)));

  if (idx === -1) {
    const next: MarkEntry = {
      id: crypto.randomUUID(),
      studentId: args.studentId,
      academicYearId: args.academicYearId,
      termId: args.termId,
      assessmentId: args.assessmentId,
      subjectId: args.subjectId,
      paperId: args.paperId || undefined,
      score100: score,
      createdAt: now,
      updatedAt: now,
    };
    items.unshift(next);
    saveMarks(items);
    return next;
  }

  items[idx] = { ...items[idx], score100: score, updatedAt: now };
  saveMarks(items);
  return items[idx];
}

// =====================
// CLASSES + STREAMS CRUD (added to satisfy settings/classes page imports)
// =====================

export function addClass(input: { name: string; sortOrder?: number }) {
  const items = getClasses();
  const name = input.name.trim();
  if (!name) return null;

  const maxOrder = items.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
  const next: ClassDef = {
    id: crypto.randomUUID(),
    name,
    sortOrder: input.sortOrder ?? (maxOrder + 1),
  };

  items.push(next);
  saveClasses(items);
  return next;
}

export function updateClass(id: string, patch: Partial<Omit<ClassDef, "id">>) {
  const items = getClasses();
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  items[idx] = { ...items[idx], ...patch, id: items[idx].id };
  saveClasses(items);
  return items[idx];
}

export function deleteClass(id: string) {
  // delete class
  const classes = getClasses().filter((c) => c.id !== id);
  saveClasses(classes);

  // delete its streams
  const streams = getStreams().filter((s) => s.classId !== id);
  saveStreams(streams);
}

export function addStream(input: { classId: string; name: string }) {
  const items = getStreams();
  const name = input.name.trim();
  if (!name) return null;

  const next: StreamDef = {
    id: crypto.randomUUID(),
    classId: input.classId,
    name,
  };

  items.push(next);
  saveStreams(items);
  return next;
}

export function updateStream(id: string, patch: Partial<Omit<StreamDef, "id">>) {
  const items = getStreams();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  items[idx] = { ...items[idx], ...patch, id: items[idx].id };
  saveStreams(items);
  return items[idx];
}

export function deleteStream(id: string) {
  const items = getStreams().filter((s) => s.id !== id);
  saveStreams(items);
}

// =====================================================
// REPORT CARD HELPERS (v1)
// =====================================================

export type GradeBand = { label: string; min: number; max: number };

export const DEFAULT_OLEVEL_GRADE_SCALE: GradeBand[] = [
  { label: "A", min: 80, max: 100 },
  { label: "B", min: 70, max: 79.99 },
  { label: "C", min: 60, max: 69.99 },
  { label: "D", min: 50, max: 59.99 },
  { label: "E", min: 40, max: 49.99 },
  { label: "F", min: 0, max: 39.99 },
];

export function gradeOLevel(score: number | null) {
  if (score === null) return "X";
  for (const b of DEFAULT_OLEVEL_GRADE_SCALE) {
    if (score >= b.min && score <= b.max) return b.label;
  }
  return "F";
}

export function weightedContribution(score100: number, weightOutOf: number) {
  return (score100 / 100) * weightOutOf;
}

export function computeOLevelSubjectTotal(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: "O_MID" | "O_EOT";
  subjectId: string;
}) {
  const scheme = getSchemeByReportType(args.reportType);
  if (!scheme) return { total: null, parts: [] };

  const parts = scheme.components.map((c) => {
    const mark = getMark({
      studentId: args.studentId,
      academicYearId: args.academicYearId,
      termId: args.termId,
      assessmentId: c.assessmentId,
      subjectId: args.subjectId,
    });

    if (!mark) {
      return {
        assessmentId: c.assessmentId,
        score100: null,
        contrib: null,
        weightOutOf: c.weightOutOf,
      };
    }

    return {
      assessmentId: c.assessmentId,
      score100: mark.score100,
      contrib: weightedContribution(mark.score100, c.weightOutOf),
      weightOutOf: c.weightOutOf,
    };
  });

  const any = parts.some((p) => p.score100 !== null);
  if (!any) return { total: null, parts };

  const total = parts.reduce((s, p) => s + (p.contrib ?? 0), 0);
  return { total, parts };
}

export function computeALevelPaperScore(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: "A_MID" | "A_EOT";
  subjectId: string;
  paperId: string;
}) {
  const assessments = getAssessments();
  const mid = assessments.find((a) => a.code === "MID")?.id;
  const eot = assessments.find((a) => a.code === "EOT")?.id;

  const midMark = mid
    ? getMark({
        studentId: args.studentId,
        academicYearId: args.academicYearId,
        termId: args.termId,
        assessmentId: mid,
        subjectId: args.subjectId,
        paperId: args.paperId,
      })
    : null;

  const eotMark = eot
    ? getMark({
        studentId: args.studentId,
        academicYearId: args.academicYearId,
        termId: args.termId,
        assessmentId: eot,
        subjectId: args.subjectId,
        paperId: args.paperId,
      })
    : null;

  if (args.reportType === "A_MID") {
    return {
      mid: midMark?.score100 ?? null,
      eot: null,
      final: midMark?.score100 ?? null,
      note: midMark ? "" : "X",
    };
  }

  if (!midMark || !eotMark) {
    return {
      mid: midMark?.score100 ?? null,
      eot: eotMark?.score100 ?? null,
      final: null,
      note: midMark || eotMark ? "Incomplete" : "X",
    };
  }

  return {
    mid: midMark.score100,
    eot: eotMark.score100,
    final: (midMark.score100 + eotMark.score100) / 2,
    note: "",
  };
}

// =====================================================
// TEACHERS + ASSIGNMENTS (frontend v1)
// =====================================================

export type TeacherRole = "Subject Teacher" | "Class Teacher" | "Administrator";

export type Teacher = {
  id: string;
  fullName: string;
  initials: string; // for report card use
  username: string;
  password: string; // demo only; later store hashed in backend
  roles: TeacherRole[];
  isActive: boolean;
  createdAt: string;
};

export type TeachingAssignment = {
  id: string;
  teacherId: string;
  classId: string;
  streamName?: string; // optional
  subjectId?: string; // set for subject teachers
  isClassTeacher: boolean;
  createdAt: string;
};

const __LS_TEACHERS_KEY__ = "sis.teachers.v1";
const __LS_ASSIGNMENTS_KEY__ = "sis.assignments.v1";

export function getTeachers(): Teacher[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(__LS_TEACHERS_KEY__);
  return raw ? (JSON.parse(raw) as Teacher[]) : [];
}

export function saveTeachers(items: Teacher[]) {
  localStorage.setItem(__LS_TEACHERS_KEY__, JSON.stringify(items));
}

export function addTeacher(
  input: Omit<Teacher, "id" | "createdAt" | "isActive"> & { isActive?: boolean }
) {
  const items = getTeachers();
  const next: Teacher = {
    id: crypto.randomUUID(),
    fullName: input.fullName.trim(),
    initials: input.initials.trim().toUpperCase(),
    username: input.username.trim(),
    password: input.password,
    roles: input.roles,
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };
  items.unshift(next);
  saveTeachers(items);
  return next;
}

export function updateTeacher(
  id: string,
  patch: Partial<Omit<Teacher, "id" | "createdAt">>
) {
  const items = getTeachers();
  const idx = items.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  items[idx] = {
    ...items[idx],
    ...patch,
    id: items[idx].id,
    createdAt: items[idx].createdAt,
  };
  saveTeachers(items);
  return items[idx];
}

export function deleteTeacher(id: string) {
  const items = getTeachers().filter((t) => t.id !== id);
  saveTeachers(items);
  // also remove assignments
  const asg = getTeachingAssignments().filter((a) => a.teacherId !== id);
  saveTeachingAssignments(asg);
}

export function getTeachingAssignments(): TeachingAssignment[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(__LS_ASSIGNMENTS_KEY__);
  return raw ? (JSON.parse(raw) as TeachingAssignment[]) : [];
}

export function saveTeachingAssignments(items: TeachingAssignment[]) {
  localStorage.setItem(__LS_ASSIGNMENTS_KEY__, JSON.stringify(items));
}

export function addTeachingAssignment(
  input: Omit<TeachingAssignment, "id" | "createdAt">
) {
  const items = getTeachingAssignments();
  const next: TeachingAssignment = {
    id: crypto.randomUUID(),
    teacherId: input.teacherId,
    classId: input.classId,
    streamName: input.streamName,
    subjectId: input.subjectId,
    isClassTeacher: !!input.isClassTeacher,
    createdAt: new Date().toISOString(),
  };
  items.unshift(next);
  saveTeachingAssignments(items);
  return next;
}

export function deleteTeachingAssignment(id: string) {
  const items = getTeachingAssignments().filter((a) => a.id !== id);
  saveTeachingAssignments(items);
}

export function getTeacherById(id: string) {
  return getTeachers().find((t) => t.id === id) ?? null;
}

export function getAssignmentsForTeacher(teacherId: string) {
  return getTeachingAssignments().filter((a) => a.teacherId === teacherId);
}

export function getClassTeacherAssignment(classId: string, streamName?: string) {
  const items = getTeachingAssignments().filter(
    (a) => a.classId === classId && a.isClassTeacher
  );
  if (!streamName) return items[0] ?? null;
  return (
    items.find((a) => (a.streamName ?? "") === streamName) ?? items[0] ?? null
  );
}

export function getSubjectTeacherAssignment(args: {
  classId: string;
  subjectId: string;
  streamName?: string;
}) {
  const items = getTeachingAssignments().filter(
    (a) => a.classId === args.classId && a.subjectId === args.subjectId && !a.isClassTeacher
  );
  if (!args.streamName) return items[0] ?? null;
  return (
    items.find((a) => (a.streamName ?? "") === args.streamName) ??
    items[0] ??
    null
  );
}

export function seedTeachersIfEmpty() {
  if (getTeachers().length) return;

  const t1 = addTeacher({
    fullName: "Teacher One",
    initials: "T1",
    username: "teacher1",
    password: "password",
    roles: ["Subject Teacher"],
  });

  const t2 = addTeacher({
    fullName: "Class Teacher",
    initials: "CT",
    username: "classteacher",
    password: "password",
    roles: ["Class Teacher"],
  });

  const classes = getClasses();
  const subjects = getSubjects();
  const classId = classes[0]?.id;
  if (!classId) return;

  addTeachingAssignment({
    teacherId: t2.id,
    classId,
    streamName: undefined,
    subjectId: undefined,
    isClassTeacher: true,
  });

  const sub = subjects.find((s) => s.classId === classId) ?? null;
  if (sub)
    addTeachingAssignment({
      teacherId: t1.id,
      classId,
      streamName: undefined,
      subjectId: sub.id,
      isClassTeacher: false,
    });
}

// =====================================================
// REMARK RULES + OVERRIDES (frontend v1)
// =====================================================

export type RemarkTarget = "teacher" | "headTeacher";
export type RemarkMatchType = "grade" | "range";

export type RemarkRule = {
  id: string;
  target: RemarkTarget;
  reportType: ReportType;
  matchType: RemarkMatchType;
  grade?: string;
  min?: number;
  max?: number;
  text: string;
  isActive: boolean;
  createdAt: string;
};

export type ReportRemarkOverride = {
  id: string;
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: ReportType;
  teacherRemark?: string;
  headTeacherComment?: string;
  updatedAt: string;
};

const __LS_REMARK_RULES_KEY__ = "sis.remarkRules.v1";
const __LS_REMARK_OVERRIDES_KEY__ = "sis.remarkOverrides.v1";

export function getRemarkRules(): RemarkRule[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(__LS_REMARK_RULES_KEY__);
  return raw ? (JSON.parse(raw) as RemarkRule[]) : [];
}

export function saveRemarkRules(items: RemarkRule[]) {
  localStorage.setItem(__LS_REMARK_RULES_KEY__, JSON.stringify(items));
}

export function addRemarkRule(
  input: Omit<RemarkRule, "id" | "createdAt" | "isActive"> & { isActive?: boolean }
) {
  const items = getRemarkRules();
  const next: RemarkRule = {
    id: crypto.randomUUID(),
    target: input.target,
    reportType: input.reportType,
    matchType: input.matchType,
    grade: input.grade,
    min: input.min,
    max: input.max,
    text: input.text.trim(),
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };
  items.unshift(next);
  saveRemarkRules(items);
  return next;
}

export function updateRemarkRule(
  id: string,
  patch: Partial<Omit<RemarkRule, "id" | "createdAt">>
) {
  const items = getRemarkRules();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  items[idx] = {
    ...items[idx],
    ...patch,
    id: items[idx].id,
    createdAt: items[idx].createdAt,
  };
  saveRemarkRules(items);
  return items[idx];
}

export function deleteRemarkRule(id: string) {
  const items = getRemarkRules().filter((r) => r.id !== id);
  saveRemarkRules(items);
}

export function seedRemarkRulesIfEmpty() {
  if (getRemarkRules().length) return;

  const addFor = (reportType: ReportType, target: RemarkTarget, grade: string, text: string) =>
    addRemarkRule({ reportType, target, matchType: "grade", grade, text });

  // O-Level (A–F)
  const oMid: Record<string, string> = {
    A: "Excellent work. Keep it up!",
    B: "Very good performance. Aim even higher.",
    C: "Good effort. Improve with more practice.",
    D: "Fair attempt. Work harder for better results.",
    E: "Below average. Seek help and revise regularly.",
    F: "Poor performance. More effort is required.",
  };
  const oEot: Record<string, string> = {
    A: "Excellent end-of-term performance. Keep it up!",
    B: "Very good results. Maintain your effort.",
    C: "Good performance. Continue improving.",
    D: "Fair result. Put in more effort next term.",
    E: "Below average. You need to improve.",
    F: "Unsatisfactory. Serious improvement needed.",
  };

  for (const [g, t] of Object.entries(oMid)) addFor("O_MID", "teacher", g, t);
  for (const [g, t] of Object.entries(oEot)) addFor("O_EOT", "teacher", g, t);

  // Head teacher defaults (simple)
  const headDefaults: Record<ReportType, Record<string, string>> = {
    O_MID: {
      A: "Outstanding performance. Keep the momentum.",
      B: "Good work. Continue aiming for excellence.",
      C: "Good progress. Keep improving steadily.",
      D: "Work harder and consult your teachers.",
      E: "More effort and consistency are needed.",
      F: "Immediate improvement is required.",
    },
    O_EOT: {
      A: "Excellent results. Congratulations!",
      B: "Very good results. Maintain your effort.",
      C: "Good. Continue working to improve.",
      D: "You can do better. Put in more effort.",
      E: "You need to improve next term.",
      F: "Serious improvement needed next term.",
    },
    A_MID: { A: "Excellent. Keep your focus.", B: "Very good. Maintain consistency.", C: "Good. Improve with more revision.", D: "Work harder and seek guidance.", E: "More effort is required." },
    A_EOT: { A: "Excellent. Keep it up.", B: "Very good. Keep improving.", C: "Good. More effort needed.", D: "Work harder next term.", E: "Immediate improvement required." },
  };

  for (const [rt, map] of Object.entries(headDefaults)) {
    for (const [g, t] of Object.entries(map)) {
      addRemarkRule({ reportType: rt as ReportType, target: "headTeacher", matchType: "grade", grade: g, text: t });
    }
  }
}

export function getRemarkOverrides(): ReportRemarkOverride[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(__LS_REMARK_OVERRIDES_KEY__);
  return raw ? (JSON.parse(raw) as ReportRemarkOverride[]) : [];
}

export function saveRemarkOverrides(items: ReportRemarkOverride[]) {
  localStorage.setItem(__LS_REMARK_OVERRIDES_KEY__, JSON.stringify(items));
}

export function getRemarkOverride(args: {
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: ReportType;
}) {
  return (
    getRemarkOverrides().find(
      (o) =>
        o.studentId === args.studentId &&
        o.academicYearId === args.academicYearId &&
        o.termId === args.termId &&
        o.reportType === args.reportType
    ) ?? null
  );
}

export function upsertRemarkOverride(input: Omit<ReportRemarkOverride, "id" | "updatedAt">) {
  const items = getRemarkOverrides();
  const idx = items.findIndex(
    (o) =>
      o.studentId === input.studentId &&
      o.academicYearId === input.academicYearId &&
      o.termId === input.termId &&
      o.reportType === input.reportType
  );
  const now = new Date().toISOString();
  if (idx === -1) {
    const next: ReportRemarkOverride = { ...input, id: crypto.randomUUID(), updatedAt: now };
    items.unshift(next);
    saveRemarkOverrides(items);
    return next;
  }
  items[idx] = { ...items[idx], ...input, updatedAt: now };
  saveRemarkOverrides(items);
  return items[idx];
}

export function pickRemark(args: {
  target: RemarkTarget;
  reportType: ReportType;
  grade?: string;
  score?: number | null;
}) {
  const rules = getRemarkRules().filter(
    (r) => r.isActive && r.target === args.target && r.reportType === args.reportType
  );

  if (args.grade) {
    const byGrade = rules.find((r) => r.matchType === "grade" && (r.grade ?? "") === args.grade);
    if (byGrade) return byGrade.text;
  }

  if (args.score !== null && args.score !== undefined) {
    const s = args.score;
    const byRange = rules.find(
      (r) =>
        r.matchType === "range" &&
        typeof r.min === "number" &&
        typeof r.max === "number" &&
        s >= r.min! &&
        s <= r.max!
    );
    if (byRange) return byRange.text;
  }

  return "";
}

// ✅ NEW: Sync a single mark to DB via /api/marks/bulk (does NOT replace localStorage saving)
// NOTE: This function is safe to call even if API fails (it will not throw).
export function syncMarkToDb(args: {
  classId: string;
  studentId: string;
  academicYearId: string;
  termId: string;
  assessmentId: string; // maps to assessmentDefinitionId in API
  subjectId: string;
  paperId?: string;
  score100: number;
}) {
  try {
    if (typeof window === "undefined") return;
    const classId = String(args.classId || "").trim();
    if (!classId) return;

    // fire-and-forget; do not block UI
    fetch("/api/marks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYearId: args.academicYearId,
        termId: args.termId,
        assessmentDefinitionId: args.assessmentId,
        classId,
        subjectId: args.subjectId,
        subjectPaperId: args.paperId ? args.paperId : null,
        marks: [{ studentId: args.studentId, scoreRaw: Number(args.score100) }],
      }),
    }).catch(() => {});
  } catch {
    // never throw from store helpers
  }
}

