"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

type ClassItem = { id: string; name: string };
type StreamItem = { id: string; name: string; classId: string };

type ApiStudent = {
  id: string;
  admissionNo?: string | null;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  gender?: string | null;
  classId?: string | null;
  className?: string | null;
  streamId?: string | null;
  streamName?: string | null;
};

type StudentsResponse = {
  items: ApiStudent[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type Me = { id: string; fullName: string; username: string; role: string };

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

async function apiGetMe(): Promise<Me | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export default function StudentsPage() {
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<ApiStudent[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [streams, setStreams] = React.useState<StreamItem[]>([]);
  const [classFilter, setClassFilter] = React.useState<string>("");
  const [streamFilter, setStreamFilter] = React.useState<string>("");

  const [debouncedQ, setDebouncedQ] = React.useState("");
  const debounceRef = React.useRef<number | null>(null);

  const [role, setRole] = React.useState<string>("");

  const [page, setPage] = React.useState(1);
  const pageSize = 25;
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [hasNextPage, setHasNextPage] = React.useState(false);
  const [hasPrevPage, setHasPrevPage] = React.useState(false);

  React.useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await apiGetMe();
      if (cancelled) return;
      setRole(me?.role || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const [cls, str] = await Promise.all([
          apiGet<ClassItem[]>("/api/classes"),
          apiGet<StreamItem[]>("/api/settings/streams"),
        ]);
        setClasses(cls);
        setStreams(str);
      } catch {
        // filters optional
      }
    })();
  }, []);

  const visibleStreams = React.useMemo(() => {
    if (!classFilter) return streams;
    return streams.filter((s) => s.classId === classFilter);
  }, [streams, classFilter]);

  React.useEffect(() => {
    if (streamFilter && classFilter) {
      const ok = visibleStreams.some((s) => s.id === streamFilter);
      if (!ok) setStreamFilter("");
    }
  }, [classFilter, streamFilter, visibleStreams]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQ, classFilter, streamFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (classFilter) params.set("classId", classFilter);
      if (streamFilter) params.set("streamId", streamFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const url = `/api/students?${params.toString()}`;
      const data = await apiGet<StudentsResponse>(url);

      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
      setHasNextPage(Boolean(data?.hasNextPage));
      setHasPrevPage(Boolean(data?.hasPrevPage));
    } catch (e: any) {
      setError(e?.message || "Failed to load students");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setHasNextPage(false);
      setHasPrevPage(false);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, classFilter, streamFilter, page]);

  async function deleteStudent(id: string, name: string) {
    const ok = window.confirm(`Delete ${name}? This cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`);

      if (rows.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await load();
      }
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  async function printClassListPdf() {
    try {
      const params = new URLSearchParams();
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (classFilter) params.set("classId", classFilter);
      if (streamFilter) params.set("streamId", streamFilter);

      const url = params.toString()
        ? `/api/print/students?${params.toString()}`
        : "/api/print/students";

      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to generate PDF (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "class_list.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert(e?.message || "Failed to generate PDF");
    }
  }

  const isAdmin = role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Students</h1>
          <p className="text-sm text-slate-600">Search and manage students</p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={printClassListPdf}>Print</Button>

          {isAdmin ? (
            <Button onClick={() => router.push("/students/new")}>+ Add Student</Button>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 w-full">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-600 placeholder:opacity-100 outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Search name or admission number..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="" className="text-black">
                  All
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id} className="text-black">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Stream</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={streamFilter}
                onChange={(e) => setStreamFilter(e.target.value)}
              >
                <option value="" className="text-black">
                  All
                </option>
                {visibleStreams.map((s) => (
                  <option key={s.id} value={s.id} className="text-black">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-sm text-slate-600">
            {loading ? "Loading..." : `${total} student(s)`}
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">ADMISSION NO</th>
                    <th className="px-4 py-3 font-medium">NAME</th>
                    <th className="px-4 py-3 font-medium">CLASS</th>
                    <th className="px-4 py-3 font-medium">STREAM</th>
                    <th className="px-4 py-3 font-medium text-right">ACTIONS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={5}>
                        Loading students...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={5}>
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((s) => {
                      const name = [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" ");
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{s.admissionNo || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{name}</td>
                          <td className="px-4 py-3 text-slate-700">{s.className || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{s.streamName || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button variant="secondary" onClick={() => router.push(`/students/${s.id}`)}>
                                View
                              </Button>
                              <Button variant="secondary" onClick={() => router.push(`/students/${s.id}/edit`)}>
                                Edit
                              </Button>
                              <Button variant="secondary" onClick={() => router.push(`/students/${s.id}/move`)}>
                                Move
                              </Button>
                              {isAdmin ? (
                                <Button variant="destructive" onClick={() => deleteStudent(s.id, name)}>
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={loading || !hasPrevPage}
                >
                  Previous
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading || !hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}