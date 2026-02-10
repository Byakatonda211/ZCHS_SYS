import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toStrOrNull(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);

    // ✅ Dashboard stats (students & teachers counts)
    // This does NOT affect normal listing; it only runs when ?stats=1 is provided.
    if ((searchParams.get("stats") || "").trim() === "1") {
      const [studentsCount, teachersCount] = await Promise.all([
        prisma.student.count(),
        prisma.user.count({
          where: { role: { in: ["CLASS_TEACHER", "SUBJECT_TEACHER"] } },
        }),
      ]);
      return NextResponse.json({ studentsCount, teachersCount });
    }

    const q = (searchParams.get("q") || "").trim();
    const classId = (searchParams.get("classId") || "").trim();
    const streamId = (searchParams.get("streamId") || "").trim();

    // ✅ NEW: subject filter (only students registered for subject)
    const subjectId = (searchParams.get("subjectId") || "").trim();

    const students = await prisma.student.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { admissionNo: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          classId
            ? {
                enrollments: {
                  some: {
                    classId,
                    isActive: true,
                  },
                },
              }
            : {},
          streamId
            ? {
                enrollments: {
                  some: {
                    streamId,
                    isActive: true,
                  },
                },
              }
            : {},
          subjectId
            ? {
                enrollments: {
                  some: {
                    isActive: true,
                    subjects: {
                      some: { subjectId },
                    },
                  },
                },
              }
            : {},
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        enrollments: {
          where: { isActive: true },
          include: {
            class: true,
            stream: true,
            academicYear: true,
            subjects: { include: { subject: true } },
          },
        },
      },
    });

    return NextResponse.json(students);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    // Student core fields
    const admissionNo = toStrOrNull(body?.admissionNo);
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const otherNames = toStrOrNull(body?.otherNames);
    const gender = toStrOrNull(body?.gender);
    const dateOfBirth = body?.dateOfBirth ? new Date(body.dateOfBirth) : null;
    const phone = toStrOrNull(body?.phone);
    const email = toStrOrNull(body?.email);
    const address = toStrOrNull(body?.address);

    const guardianName = toStrOrNull(body?.guardianName);
    const guardianPhone = toStrOrNull(body?.guardianPhone);
    const guardianEmail = toStrOrNull(body?.guardianEmail);

    const religion = toStrOrNull(body?.religion);
    const nationality = toStrOrNull(body?.nationality);
    const medicalNotes = toStrOrNull(body?.medicalNotes);

    // PLE fields
    const pleSittingYear = toIntOrNull(body?.pleSittingYear);
    const plePrimarySchool = toStrOrNull(body?.plePrimarySchool);
    const pleIndexNumber = toStrOrNull(body?.pleIndexNumber);
    const pleAggregates = toIntOrNull(body?.pleAggregates);
    const pleDivision = toStrOrNull(body?.pleDivision);

    // Residence / extras
    const village = toStrOrNull(body?.village);
    const parish = toStrOrNull(body?.parish);
    const districtOfResidence = toStrOrNull(body?.districtOfResidence);
    const homeDistrict = toStrOrNull(body?.homeDistrict);

    const emergencyContactName = toStrOrNull(body?.emergencyContactName);
    const emergencyContactPhone = toStrOrNull(body?.emergencyContactPhone);
    const medicalConditions = toStrOrNull(body?.medicalConditions);
    const recurrentMedication = toStrOrNull(body?.recurrentMedication);
    const knownDisability = toStrOrNull(body?.knownDisability);

    // NEW: Residence Section (DAY | BOARDING)
    const residenceSectionRaw = String(body?.residenceSection ?? "").trim();
    const residenceSection =
      residenceSectionRaw === "DAY" || residenceSectionRaw === "BOARDING" ? residenceSectionRaw : null;

    // Enrollment fields (required)
    const classId = String(body?.classId || "").trim();
    const streamId = toStrOrNull(body?.streamId);
    const academicYearId = String(body?.academicYearId || "").trim();

    // Selected subjects (optional)
    const enrolledSubjectIds = toStringArray(body?.enrolledSubjectIds);

    if (!firstName || !lastName || !classId || !academicYearId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (admissionNo) {
        const existing = await tx.student.findUnique({ where: { admissionNo } });
        if (existing) {
          return { error: "Admission number already exists" };
        }
      }

      const student = await tx.student.create({
        data: {
          admissionNo,
          firstName,
          lastName,
          otherNames,
          gender,
          dateOfBirth,
          phone,
          email,
          address,
          guardianName,
          guardianPhone,
          guardianEmail,
          religion,
          nationality,
          medicalNotes,
          pleSittingYear,
          plePrimarySchool,
          pleIndexNumber,
          pleAggregates,
          pleDivision,
          village,
          parish,
          districtOfResidence,
          homeDistrict,
          emergencyContactName,
          emergencyContactPhone,
          medicalConditions,
          recurrentMedication,
          knownDisability,
          ...(residenceSection ? { residenceSection: residenceSection as any } : {}),
        } as any,
      });

      // deactivate previous enrollments (should be none for new student, but safe)
      await tx.enrollment.updateMany({
        where: { studentId: student.id, isActive: true },
        data: { isActive: false },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId,
          streamId: streamId || null,
          academicYearId,
          isActive: true,
        },
      });

      // save selected subjects (optional)
      if (enrolledSubjectIds.length > 0) {
        await tx.enrollmentSubject.createMany({
          data: enrolledSubjectIds.map((subjectId) => ({
            enrollmentId: enrollment.id,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }

      return { studentId: student.id, enrollmentId: enrollment.id };
    });

    if ((created as any)?.error) {
      return NextResponse.json({ error: (created as any).error }, { status: 400 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
