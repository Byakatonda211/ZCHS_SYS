'use client';

import React from 'react';
import { Card, CardHeader, Button, Input, Label, Select } from '@/components/ui';

type ApiTeacher = {
  id: string;
  fullName: string;
  initials: string;
  username: string;
  role: 'ADMIN' | 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
  isActive: boolean;
};

type ApiClass = { id: string; name: string; level?: string | null };
type ApiStream = { id: string; name: string; classId: string };
type ApiSubject = { id: string; name: string; level?: string | null };

type Assignment = {
  id: string;
  userId?: string;
  teacherId?: string;
  classId: string;
  streamId: string | null;
  subjectId: string | null;
  isClassTeacher: boolean;
  createdAt?: string;
  user?: { id: string; fullName: string; initials?: string };
  class?: { id: string; name: string; level?: string };
  stream?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
};

type TeacherEditForm = {
  id: string;
  fullName: string;
  initials: string;
  username: string;
  role: 'ADMIN' | 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
  isActive: boolean;
  newPassword: string;
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

async function apiSend(url: string, body?: any, method: string = 'POST') {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data;
}

function toEditForm(teacher: ApiTeacher): TeacherEditForm {
  return {
    id: teacher.id,
    fullName: teacher.fullName || '',
    initials: teacher.initials || '',
    username: teacher.username || '',
    role: teacher.role,
    isActive: teacher.isActive,
    newPassword: '',
  };
}

export default function TeachersSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const [teachers, setTeachers] = React.useState<ApiTeacher[]>([]);
  const [classes, setClasses] = React.useState<ApiClass[]>([]);
  const [streams, setStreams] = React.useState<ApiStream[]>([]);
  const [subjects, setSubjects] = React.useState<ApiSubject[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);

  // Create teacher form
  const [fullName, setFullName] = React.useState('');
  const [initials, setInitials] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<ApiTeacher['role']>('SUBJECT_TEACHER');

  // Edit teacher form
  const [selectedEditTeacherId, setSelectedEditTeacherId] = React.useState('');
  const [editForm, setEditForm] = React.useState<TeacherEditForm | null>(null);
  const [showCreatePassword, setShowCreatePassword] = React.useState(false);
  const [showEditPassword, setShowEditPassword] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Assignment form
  const [teacherId, setTeacherId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');
  const [isClassTeacher, setIsClassTeacher] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [t, c, s, oSubjects, aSubjects, a] = await Promise.all([
        apiGet<ApiTeacher[]>('/api/teachers'),
        apiGet<ApiClass[]>('/api/settings/classes'),
        apiGet<ApiStream[]>('/api/settings/streams'),
        apiGet<ApiSubject[]>('/api/settings/subjects?level=O_LEVEL'),
        apiGet<ApiSubject[]>('/api/settings/subjects?level=A_LEVEL'),
        apiGet<Assignment[]>('/api/teachers/assignments'),
      ]);

      const teachersData = t || [];
      setTeachers(teachersData);
      setClasses(c || []);
      setStreams(s || []);
      setSubjects([...(oSubjects || []), ...(aSubjects || [])]);
      setAssignments(a || []);

      if (teachersData.length === 0) {
        setSelectedEditTeacherId('');
        setEditForm(null);
        return;
      }

      setSelectedEditTeacherId((prev) => {
        const stillExists = prev && teachersData.some((teacher) => teacher.id === prev);
        const nextId = stillExists ? prev : teachersData[0].id;
        const picked = teachersData.find((teacher) => teacher.id === nextId) || teachersData[0];
        setEditForm(toEditForm(picked));
        return picked.id;
      });
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function handleSelectTeacherForEdit(id: string) {
    setSelectedEditTeacherId(id);
    const teacher = teachers.find((t) => t.id === id);
    setEditForm(teacher ? toEditForm(teacher) : null);
    setShowEditPassword(false);
    setErr('');
    setSuccess('');
  }

  function updateEditForm<K extends keyof TeacherEditForm>(field: K, value: TeacherEditForm[K]) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function resetEditForm() {
    const teacher = teachers.find((t) => t.id === selectedEditTeacherId);
    if (!teacher) return;
    setEditForm(toEditForm(teacher));
    setShowEditPassword(false);
    setErr('');
    setSuccess('');
  }

  async function createTeacher() {
    setErr('');
    setSuccess('');
    try {
      await apiSend('/api/teachers', { fullName, initials, username, password, role }, 'POST');
      setFullName('');
      setInitials('');
      setUsername('');
      setPassword('');
      setRole('SUBJECT_TEACHER');
      setShowCreatePassword(false);
      setSuccess('Teacher account created successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to create teacher');
    }
  }

  async function saveTeacherChanges() {
    if (!editForm?.id) return;

    setErr('');
    setSuccess('');
    setSavingEdit(true);

    try {
      const payload: any = {
        fullName: editForm.fullName,
        initials: editForm.initials,
        username: editForm.username,
        role: editForm.role,
        isActive: editForm.isActive,
      };

      if (editForm.newPassword.trim()) {
        payload.password = editForm.newPassword.trim();
      }

      await apiSend(`/api/teachers/${editForm.id}`, payload, 'POST');
      setSuccess('Teacher details updated successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to update teacher');
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleTeacherActive(id: string, isActive: boolean) {
    setErr('');
    setSuccess('');
    try {
      await apiSend(`/api/teachers/${id}`, { isActive: !isActive }, 'POST');
      setSuccess('Teacher status updated successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to update teacher status');
    }
  }

  async function createAssignment() {
    setErr('');
    setSuccess('');
    try {
      await apiSend('/api/teachers/assignments', {
        userId: teacherId,
        teacherId,
        classId,
        streamId: streamId || null,
        subjectId: isClassTeacher ? null : subjectId || null,
        isClassTeacher,
      });
      setTeacherId('');
      setClassId('');
      setStreamId('');
      setSubjectId('');
      setIsClassTeacher(false);
      setSuccess('Assignment created successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to assign');
    }
  }

  async function deleteAssignment(id: string) {
    setErr('');
    setSuccess('');
    try {
      await apiSend(`/api/teachers/assignments/${id}`, undefined, 'DELETE');
      setSuccess('Assignment removed successfully.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Failed to remove assignment');
    }
  }

  const streamsForClass = streams.filter((s) => (classId ? s.classId === classId : true));

  const selectedClass = React.useMemo(
    () => classes.find((x) => x.id === classId) || null,
    [classId, classes]
  );

  const isALevelClass = React.useMemo(() => {
    const level = String(selectedClass?.level || '').toUpperCase();
    if (level.includes('A')) return true;
    if (level.includes('O')) return false;

    const name = String(selectedClass?.name || '').toUpperCase();
    return name.includes('S5') || name.includes('S6');
  }, [selectedClass]);

  const visibleSubjects = React.useMemo(() => {
    if (!classId) return subjects;

    return subjects.filter((s) => {
      const level = String(s.level || '').toUpperCase();
      if (isALevelClass) return level.includes('A');
      return level.includes('O');
    });
  }, [subjects, classId, isALevelClass]);

  React.useEffect(() => {
    setStreamId('');
    setSubjectId('');
  }, [classId]);

  React.useEffect(() => {
    if (isClassTeacher) setSubjectId('');
  }, [isClassTeacher]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-extrabold text-slate-900">Teachers</div>
        <div className="text-sm text-slate-600">
          Create accounts, edit login details, and assign classes/subjects.
        </div>
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}
      {success ? <div className="text-sm text-green-700">{success}</div> : null}

      <Card>
        <CardHeader title="Create Teacher Account" />
        <div className="p-5 pt-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Doe" />
          </div>

          <div>
            <Label>Initials</Label>
            <Input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="e.g. JD" />
          </div>

          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. johndoe" />
          </div>

          <div>
            <Label>Password</Label>
            <div className="flex gap-2">
              <Input
                type={showCreatePassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a password"
              />
              <Button type="button" variant="ghost" onClick={() => setShowCreatePassword((v) => !v)}>
                {showCreatePassword ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>

          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="SUBJECT_TEACHER">SUBJECT_TEACHER</option>
              <option value="CLASS_TEACHER">CLASS_TEACHER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={createTeacher} disabled={!fullName || !initials || !username || !password || loading}>
              Create
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Edit Teacher Details"
          subtitle="Select one teacher and edit their login details without making the page long."
        />
        <div className="p-5 pt-0 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : teachers.length === 0 ? (
            <div className="text-sm text-slate-600">No teacher accounts yet.</div>
          ) : (
            <>
              <div className="max-w-xl">
                <Label>Select Teacher</Label>
                <Select value={selectedEditTeacherId} onChange={(e) => handleSelectTeacherForEdit(e.target.value)}>
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName} ({teacher.username})
                    </option>
                  ))}
                </Select>
              </div>

              {editForm ? (
                <div className="rounded-2xl border border-slate-200 p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => updateEditForm('fullName', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Initials</Label>
                    <Input
                      value={editForm.initials}
                      onChange={(e) => updateEditForm('initials', e.target.value.toUpperCase())}
                    />
                  </div>

                  <div>
                    <Label>Username</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => updateEditForm('username', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Role</Label>
                    <Select
                      value={editForm.role}
                      onChange={(e) => updateEditForm('role', e.target.value as ApiTeacher['role'])}
                    >
                      <option value="SUBJECT_TEACHER">SUBJECT_TEACHER</option>
                      <option value="CLASS_TEACHER">CLASS_TEACHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Set New Password</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editForm.newPassword}
                        onChange={(e) => updateEditForm('newPassword', e.target.value)}
                        placeholder="Leave blank to keep current password"
                      />
                      <Button type="button" variant="ghost" onClick={() => setShowEditPassword((v) => !v)}>
                        {showEditPassword ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => updateEditForm('isActive', e.target.checked)}
                      />
                      Active
                    </label>
                  </div>

                  <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={saveTeacherChanges}
                      disabled={
                        savingEdit ||
                        !editForm.fullName.trim() ||
                        !editForm.initials.trim() ||
                        !editForm.username.trim()
                      }
                    >
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </Button>

                    <Button type="button" variant="ghost" onClick={resetEditForm} disabled={savingEdit}>
                      Reset
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => toggleTeacherActive(editForm.id, editForm.isActive)}
                      disabled={savingEdit}
                    >
                      {editForm.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Assign Teacher" subtitle="Assign class teacher or subject teacher roles" />
        <div className="p-5 pt-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Teacher</Label>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.username})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Class</Label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Stream (optional)</Label>
            <Select value={streamId} onChange={(e) => setStreamId(e.target.value)}>
              <option value="">—</option>
              {streamsForClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isClassTeacher}
                onChange={(e) => setIsClassTeacher(e.target.checked)}
              />
              Class Teacher
            </label>
          </div>

          <div className="lg:col-span-2">
            <Label>Subject (required if not class teacher)</Label>
            <Select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isClassTeacher}
            >
              <option value="">{isClassTeacher ? '—' : 'Select subject'}</option>
              {visibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={createAssignment}
              disabled={!teacherId || !classId || (!isClassTeacher && !subjectId) || loading}
            >
              Assign
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Assignments" />
        <div className="p-5 pt-0 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : assignments.length === 0 ? (
            <div className="text-sm text-slate-600">No assignments yet.</div>
          ) : (
            <table className="w-full text-sm text-slate-900">
              <thead>
                <tr className="text-left text-slate-700">
                  <th className="py-2">Teacher</th>
                  <th className="py-2">Class</th>
                  <th className="py-2">Stream</th>
                  <th className="py-2">Subject</th>
                  <th className="py-2">Type</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2 text-slate-900">
                      {a.user?.fullName ??
                        teachers.find((t) => t.id === (a.userId || a.teacherId))?.fullName ??
                        (a.userId || a.teacherId || '—')}
                    </td>
                    <td className="py-2 text-slate-900">
                      {a.class?.name ?? classes.find((c) => c.id === a.classId)?.name ?? a.classId}
                    </td>
                    <td className="py-2 text-slate-900">
                      {a.streamId
                        ? a.stream?.name ?? streams.find((s) => s.id === a.streamId)?.name ?? a.streamId
                        : '—'}
                    </td>
                    <td className="py-2 text-slate-900">
                      {a.isClassTeacher
                        ? '—'
                        : a.subjectId
                        ? a.subject?.name ?? subjects.find((s) => s.id === a.subjectId)?.name ?? a.subjectId
                        : '—'}
                    </td>
                    <td className="py-2 text-slate-900">
                      {a.isClassTeacher ? 'Class Teacher' : 'Subject Teacher'}
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" onClick={() => deleteAssignment(a.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}