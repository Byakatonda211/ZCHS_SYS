'use client';

import React from 'react';
import { Button, Card, Input, Label } from '@/components/ui';

type Level = 'O_LEVEL' | 'A_LEVEL';

type SubjectPaper = {
  id: string;
  subjectId: string;
  name: string;
  code?: string | null;
  order: number;
};

type Subject = {
  id: string;
  name: string;
  code?: string | null;
  level: Level;
  isCompulsory?: boolean;
  papers?: SubjectPaper[];
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

async function apiPatch<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}

function buildAutoPapers(n: number) {
  const papers = [];
  for (let i = 1; i <= n; i++) papers.push({ name: `Paper ${i}`, order: i });
  return papers;
}

export default function SubjectsPage() {
  const [level, setLevel] = React.useState<Level>('O_LEVEL');
  const [items, setItems] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  const [newName, setNewName] = React.useState('');
  const [newCode, setNewCode] = React.useState('');
  const [newIsCompulsory, setNewIsCompulsory] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editIsCompulsory, setEditIsCompulsory] = React.useState(false);

  const [paperName, setPaperName] = React.useState<Record<string, string>>({});
  const [paperCount, setPaperCount] = React.useState<Record<string, number>>({});

  const [editingPaperId, setEditingPaperId] = React.useState<string | null>(null);
  const [editPaperName, setEditPaperName] = React.useState('');
  const [editPaperCode, setEditPaperCode] = React.useState('');
  const [editPaperOrder, setEditPaperOrder] = React.useState<number>(1);

  async function refresh() {
    setErr('');
    setLoading(true);
    try {
      const data = await apiGet<Subject[]>(`/api/settings/subjects?level=${level}`);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, [level]);

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setEditName(subject.name || '');
    setEditCode(subject.code || '');
    setEditIsCompulsory(!!subject.isCompulsory);
    setErr('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditCode('');
    setEditIsCompulsory(false);
  }

  function startPaperEdit(paper: SubjectPaper) {
    setEditingPaperId(paper.id);
    setEditPaperName(paper.name || '');
    setEditPaperCode(paper.code || '');
    setEditPaperOrder(paper.order || 1);
    setErr('');
  }

  function cancelPaperEdit() {
    setEditingPaperId(null);
    setEditPaperName('');
    setEditPaperCode('');
    setEditPaperOrder(1);
  }

  async function addSubject() {
    setErr('');
    setBusy(true);
    try {
      const name = newName.trim();
      if (!name) throw new Error('Enter subject name');

      await apiPost('/api/settings/subjects', {
        name,
        code: newCode.trim() || undefined,
        level,
        isCompulsory: level === 'O_LEVEL' ? newIsCompulsory : false,
      });

      setNewName('');
      setNewCode('');
      setNewIsCompulsory(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to add subject');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(subjectId: string) {
    setErr('');
    setBusy(true);
    try {
      const name = editName.trim();
      if (!name) throw new Error('Enter subject name');

      await apiPatch(`/api/settings/subjects/${subjectId}`, {
        name,
        code: editCode.trim() || null,
        isCompulsory: level === 'O_LEVEL' ? editIsCompulsory : false,
      });

      cancelEdit();
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to update subject');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSubject(subjectId: string, subjectName: string) {
    const ok = window.confirm(`Delete subject "${subjectName}"?`);
    if (!ok) return;

    setErr('');
    setBusy(true);
    try {
      await apiDelete(`/api/settings/subjects/${subjectId}`);
      if (editingId === subjectId) cancelEdit();
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete subject');
    } finally {
      setBusy(false);
    }
  }

  async function addPaper(subjectId: string) {
    setErr('');
    setBusy(true);
    try {
      const name = (paperName[subjectId] || '').trim();
      if (!name) throw new Error('Enter paper name (e.g. Paper 1)');

      await apiPost(`/api/settings/subjects/${subjectId}/papers`, { name });

      setPaperName((p) => ({ ...p, [subjectId]: '' }));
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to add paper');
    } finally {
      setBusy(false);
    }
  }

  async function autoGenerate(subjectId: string) {
    setErr('');
    setBusy(true);
    try {
      const n = Math.max(1, Math.min(6, Number(paperCount[subjectId] || 3)));
      await apiPost(`/api/settings/subjects/${subjectId}/papers`, { papers: buildAutoPapers(n) });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to auto-generate papers');
    } finally {
      setBusy(false);
    }
  }

  async function savePaperEdit(subjectId: string, paperId: string) {
    setErr('');
    setBusy(true);
    try {
      const name = editPaperName.trim();
      if (!name) throw new Error('Paper name is required');

      await apiPatch(`/api/settings/subjects/${subjectId}/papers/${paperId}`, {
        name,
        code: editPaperCode.trim() || null,
        order: Math.max(1, Math.floor(Number(editPaperOrder || 1))),
      });

      cancelPaperEdit();
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to update paper');
    } finally {
      setBusy(false);
    }
  }

  async function deletePaper(subjectId: string, paperId: string, paperNameValue: string) {
    const ok = window.confirm(
      `Delete paper "${paperNameValue}"?\n\nExisting marks will not be deleted, but this paper will no longer appear as an active paper.`
    );

    if (!ok) return;

    setErr('');
    setBusy(true);
    try {
      await apiDelete(`/api/settings/subjects/${subjectId}/papers/${paperId}`);
      if (editingPaperId === paperId) cancelPaperEdit();
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete paper');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Subjects</h1>
          <p className="mt-1 text-sm text-slate-600">
            O-Level subjects are single rows. A-Level subjects can have papers under the same subject.
          </p>
        </div>

        <div className="min-w-[220px]">
          <Label>Level</Label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as Level);
              cancelEdit();
              cancelPaperEdit();
            }}
          >
            <option value="O_LEVEL">O-Level (S1–S4)</option>
            <option value="A_LEVEL">A-Level (S5–S6)</option>
          </select>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      ) : null}

      <Card className="p-6">
        <div className="text-sm font-semibold text-slate-900">Add Subject</div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mathematics" />
          </div>

          <div className="md:col-span-1">
            <Label>Code (optional)</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="MTC" />
          </div>

          <div className="md:col-span-1 flex items-end">
            <Button className="w-full" onClick={addSubject} disabled={busy}>
              Add
            </Button>
          </div>
        </div>

        {level === 'O_LEVEL' ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={newIsCompulsory}
              onChange={(e) => setNewIsCompulsory(e.target.checked)}
            />
            <span>Compulsory subject</span>
          </label>
        ) : null}

        <div className="mt-2 text-xs text-slate-500">
          Tip: Switch to <span className="font-semibold">A-Level</span> to manage papers for subjects like Physics.
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Existing Subjects</div>
            <div className="text-xs text-slate-500">
              {level === 'A_LEVEL' ? 'Includes paper management.' : 'No papers needed.'}
            </div>
          </div>

          <Button variant="secondary" onClick={refresh} disabled={loading || busy}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No subjects yet.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {items.map((s) => {
              const isEditing = editingId === s.id;

              return (
                <div key={s.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <Label>Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </div>

                          <div>
                            <Label>Code (optional)</Label>
                            <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                          </div>

                          {level === 'O_LEVEL' ? (
                            <div className="md:col-span-2">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={editIsCompulsory}
                                  onChange={(e) => setEditIsCompulsory(e.target.checked)}
                                />
                                <span>Compulsory subject</span>
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{s.name}</div>

                          {s.code ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {s.code}
                            </span>
                          ) : null}

                          {level === 'O_LEVEL' && s.isCompulsory ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              Compulsory
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {s.level === 'A_LEVEL' ? 'A-Level' : 'O-Level'}
                      </span>

                      {isEditing ? (
                        <>
                          <Button variant="secondary" onClick={() => saveEdit(s.id)} disabled={busy}>
                            Save
                          </Button>
                          <Button variant="secondary" onClick={cancelEdit} disabled={busy}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={() => startEdit(s)} disabled={busy}>
                            Edit
                          </Button>
                          <Button variant="secondary" onClick={() => deleteSubject(s.id, s.name)} disabled={busy}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {level === 'A_LEVEL' ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Papers
                          </div>
                          <div className="text-xs text-slate-500">
                            Edit, reorder, or remove papers under this subject.
                          </div>
                        </div>

                        {s.papers?.length ? (
                          <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                            {s.papers.length} paper{s.papers.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>

                      {s.papers && s.papers.length ? (
                        <div className="mt-3 space-y-2">
                          {s.papers.map((p) => {
                            const isPaperEditing = editingPaperId === p.id;

                            return (
                              <div
                                key={p.id}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                {isPaperEditing ? (
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                                    <div className="md:col-span-5">
                                      <Label>Paper name</Label>
                                      <Input
                                        value={editPaperName}
                                        onChange={(e) => setEditPaperName(e.target.value)}
                                        placeholder="Paper 1"
                                      />
                                    </div>

                                    <div className="md:col-span-3">
                                      <Label>Code</Label>
                                      <Input
                                        value={editPaperCode}
                                        onChange={(e) => setEditPaperCode(e.target.value)}
                                        placeholder="P1"
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      <Label>Order</Label>
                                      <Input
                                        value={String(editPaperOrder)}
                                        onChange={(e) => setEditPaperOrder(Number(e.target.value))}
                                        inputMode="numeric"
                                      />
                                    </div>

                                    <div className="flex items-end gap-2 md:col-span-2">
                                      <Button
                                        className="flex-1"
                                        variant="secondary"
                                        onClick={() => savePaperEdit(s.id, p.id)}
                                        disabled={busy}
                                      >
                                        Save
                                      </Button>

                                      <Button
                                        className="flex-1"
                                        variant="secondary"
                                        onClick={cancelPaperEdit}
                                        disabled={busy}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800">
                                        {p.name}
                                      </span>

                                      {p.code ? (
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                          {p.code}
                                        </span>
                                      ) : null}

                                      <span className="text-xs text-slate-500">Order: {p.order}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="secondary"
                                        onClick={() => startPaperEdit(p)}
                                        disabled={busy}
                                      >
                                        Edit Paper
                                      </Button>

                                      <Button
                                        variant="secondary"
                                        onClick={() => deletePaper(s.id, p.id, p.name)}
                                        disabled={busy}
                                      >
                                        Delete Paper
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
                          No papers yet.
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Input
                            value={paperName[s.id] || ''}
                            onChange={(e) => setPaperName((m) => ({ ...m, [s.id]: e.target.value }))}
                            placeholder="Add paper (e.g. Paper 1)"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <Button className="w-full" variant="secondary" onClick={() => addPaper(s.id)} disabled={busy}>
                            Add Paper
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="w-28">
                          <Label>Auto papers</Label>
                          <Input
                            value={String(paperCount[s.id] || 3)}
                            onChange={(e) => setPaperCount((m) => ({ ...m, [s.id]: Number(e.target.value) }))}
                            inputMode="numeric"
                          />
                        </div>

                        <Button variant="secondary" onClick={() => autoGenerate(s.id)} disabled={busy}>
                          Auto-generate
                        </Button>

                        <span className="text-xs text-slate-500">Creates Paper 1..N, up to 6.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}