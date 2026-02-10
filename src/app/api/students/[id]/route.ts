import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireUser();

    const { id } = await ctx.params;
    const cleanId = String(id || "").trim();

    if (!cleanId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: cleanId },
      include: {
        enrollments: {
          orderBy: { createdAt: "desc" },
          include: {
            class: true,
            stream: true,
            subjects: { include: { subject: true } },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireUser();

    const { id } = await ctx.params;
    const cleanId = String(id || "").trim();

    if (!cleanId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // NEW: residence section (optional)
    const residenceSectionRaw = String(body?.residenceSection ?? "").trim();
    const residenceSection =
      residenceSectionRaw === "DAY" || residenceSectionRaw === "BOARDING" ? residenceSectionRaw : null;

    // NEW: enrolled subject ids (optional)
    const enrolledSubjectIdsRaw = Array.isArray(body?.enrolledSubjectIds) ? body.enrolledSubjectIds : null;
    const enrolledSubjectIds =
      enrolledSubjectIdsRaw != null
        ? enrolledSubjectIdsRaw.map((x: any) => String(x || "").trim()).filter(Boolean)
        : null;

    const admissionNoRaw = String(body?.admissionNo ?? body?.studentNo ?? "").trim();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id: cleanId },
        data: {
          admissionNo: admissionNoRaw || null,
          firstName: body?.firstName?.toString().trim() || undefined,
          lastName: body?.lastName?.toString().trim() || undefined,
          otherNames: body?.otherNames ?? body?.otherName ?? null,

          gender:
            body?.gender === "Male"
              ? "MALE"
              : body?.gender === "Female"
              ? "FEMALE"
              : body?.gender === "Other"
              ? "OTHER"
              : body?.gender ?? null,

          dateOfBirth: body?.dateOfBirth ? new Date(body.dateOfBirth) : null,

          phone: body?.phone ?? null,
          email: body?.email ?? null,
          address: body?.address ?? null,

          guardianName: body?.guardianName ?? null,
          guardianPhone: body?.guardianPhone ?? null,
          guardianEmail: body?.guardianEmail ?? null,

          religion: body?.religion ?? null,
          nationality: body?.nationality ?? null,
          medicalNotes: body?.medicalNotes ?? null,

          pleSittingYear: body?.pleSittingYear ? Number(body.pleSittingYear) : null,
          plePrimarySchool: body?.plePrimarySchool ?? null,
          pleIndexNumber: body?.pleIndexNumber ?? null,
          pleAggregates: body?.pleAggregates ? Number(body.pleAggregates) : null,
          pleDivision: body?.pleDivision ?? null,

          village: body?.village ?? null,
          parish: body?.parish ?? null,
          districtOfResidence: body?.districtOfResidence ?? null,
          homeDistrict: body?.homeDistrict ?? null,
          emergencyContactName: body?.emergencyContactName ?? null,
          emergencyContactPhone: body?.emergencyContactPhone ?? null,

          medicalConditions: body?.medicalConditions ?? null,
          recurrentMedication: body?.recurrentMedication ?? null,
          knownDisability: body?.knownDisability ?? null,

          // NEW
          residenceSection,
        },
      });

      // NEW: if enrolledSubjectIds provided, update active enrollment subjects (optional)
      if (enrolledSubjectIds !== null) {
        const activeEnrollment = await tx.enrollment.findFirst({
          where: { studentId: cleanId, isActive: true },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (activeEnrollment) {
          await tx.enrollmentSubject.deleteMany({
            where: { enrollmentId: activeEnrollment.id },
          });

          if (enrolledSubjectIds.length > 0) {
            await tx.enrollmentSubject.createMany({
              data: enrolledSubjectIds.map((subjectId: string) => ({
                enrollmentId: activeEnrollment.id,
                subjectId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ student: result });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
