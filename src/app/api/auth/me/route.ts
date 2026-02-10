import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role, // "ADMIN" | "CLASS_TEACHER" | "SUBJECT_TEACHER"
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}