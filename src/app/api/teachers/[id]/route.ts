import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "CLASS_TEACHER", "SUBJECT_TEACHER"] as const;

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;

    const teacher = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        initials: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    return NextResponse.json(teacher);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code =
      msg === "UNAUTHENTICATED" ? 401 :
      msg === "FORBIDDEN" ? 403 :
      500;

    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;
    const body = await req.json();

    const fullName =
      body?.fullName !== undefined ? String(body.fullName || "").trim() : undefined;

    const initials =
      body?.initials !== undefined ? String(body.initials || "").trim().toUpperCase() : undefined;

    const username =
      body?.username !== undefined ? String(body.username || "").trim() : undefined;

    const role =
      body?.role !== undefined ? String(body.role || "").trim() : undefined;

    const password =
      body?.password !== undefined ? String(body.password || "") : undefined;

    const isActive =
      body?.isActive !== undefined ? Boolean(body.isActive) : undefined;

    if (role !== undefined && !ALLOWED_ROLES.includes(role as any)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (fullName !== undefined && !fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    if (initials !== undefined && !initials) {
      return NextResponse.json({ error: "Initials are required" }, { status: 400 });
    }

    if (username !== undefined && !username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (password !== undefined && !String(password).trim()) {
      return NextResponse.json({ error: "Password cannot be empty" }, { status: 400 });
    }

    const data: any = {};

    if (fullName !== undefined) data.fullName = fullName;
    if (initials !== undefined) data.initials = initials;
    if (username !== undefined) data.username = username;
    if (role !== undefined) data.role = role as Role;
    if (isActive !== undefined) data.isActive = isActive;

    if (password !== undefined) {
      data.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        initials: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message || "Error";

    if (
      typeof msg === "string" &&
      (msg.includes("Unique constraint failed") || msg.includes("username"))
    ) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const code =
      msg === "UNAUTHENTICATED" ? 401 :
      msg === "FORBIDDEN" ? 403 :
      500;

    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;

    await prisma.teachingAssignment.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code =
      msg === "UNAUTHENTICATED" ? 401 :
      msg === "FORBIDDEN" ? 403 :
      500;

    return NextResponse.json({ error: msg }, { status: code });
  }
}