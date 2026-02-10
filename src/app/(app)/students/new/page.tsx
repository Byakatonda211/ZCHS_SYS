'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button, Card, CardHeader, Input, Label } from '@/components/ui';

type ApiClass = { id: string; name: string; level: 'O_LEVEL' | 'A_LEVEL'; order: number; streams?: ApiStream[] };
type ApiStream = { id: string; classId: string; name: string };
type ApiYear = { id: string; name: string; isCurrent: boolean };
type ApiTerm = { id: string; name: string; isCurrent: boolean; academicYearId: string };

type ApiSubject = {
  id: string;
  name: string;
  code?: string | null;
  level: 'O_LEVEL' | 'A_LEVEL';
  isActive?: boolean;
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

const schema = z.object({
  admissionNo: z.string().min(3, 'Student number is required'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  otherNames: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),

  classId: z.string().min(1, 'Class is required'),
  streamId: z.string().optional(),
  academicYearId: z.string().min(1, 'Academic year is required'),
  termId: z.string().optional(),

  // ✅ NEW: optional residence section
  residenceSection: z.enum(['DAY', 'BOARDING']).optional(),

  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  address: z.string().optional(),

  pleSittingYear: z.string().optional(),
  plePrimarySchool: z.string().optional(),
  pleIndexNumber: z.string().optional(),
  pleAggregates: z.string().optional(),
  pleDivision: z.string().optional(),

  village: z.string().optional(),
  parish: z.string().optional(),
  districtOfResidence: z.string().optional(),
  homeDistrict: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),

  medicalConditions: z.string().optional(),
  recurrentMedication: z.string().optional(),
  knownDisability: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function pad4(n: number) {
  return String(n).padStart(4, '0');
}
function generateAdmissionNo(yearLabel: string) {
  const year = (yearLabel || '').trim() || String(new Date().getFullYear());
  const num = Math.floor(Math.random() * 9999) + 1;
  return `ZCHS-${year}-${pad4(num)}`;
}

export default function NewStudentPage() {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: 'MALE',
      admissionNo: '',
      classId: '',
      streamId: '',
      academicYearId: '',
      termId: '',
      residenceSection: undefined,
    },
  });

  const { register, handleSubmit, formState, watch, setValue, getValues } = form;

  const [classes, setClasses] = React.useState<ApiClass[]>([]);
  const [streams, setStreams] = React.useState<ApiStream[]>([]);
  const [years, setYears] = React.useState<ApiYear[]>([]);
  const [terms, setTerms] = React.useState<ApiTerm[]>([]);

  const [subjects, setSubjects] = React.useState<ApiSubject[]>([]);
  const [enrolledSubjectIds, setEnrolledSubjectIds] = React.useState<string[]>([]);

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const classId = watch('classId');
  const academicYearId = watch('academicYearId');

  const selectedClass = React.useMemo(() => classes.find((c) => c.id === classId) || null, [classes, classId]);

  React.useEffect(() => {
    (async () => {
      try {
        const [c, s, y, t, subj] = await Promise.all([
          apiGet<ApiClass[]>('/api/settings/classes'),
          apiGet<ApiStream[]>('/api/settings/streams'),
          apiGet<ApiYear[]>('/api/settings/academic-years'),
          apiGet<ApiTerm[]>('/api/settings/terms'),
          apiGet<ApiSubject[]>('/api/settings/subjects'),
        ]);

        setClasses((c || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setStreams(s || []);
        setYears(y || []);
        setTerms(t || []);
        setSubjects((subj || []).filter((x: any) => x?.isActive !== false));

        const currentYear = (y || []).find((yy) => yy.isCurrent) ?? (y || [])[0];
        if (currentYear) setValue('academicYearId', currentYear.id);

        const firstClass = (c || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
        if (firstClass) setValue('classId', firstClass.id);

        const currentAdmission = String(getValues('admissionNo') || '').trim();
        if (!currentAdmission) {
          const yearName = currentYear?.name || String(new Date().getFullYear());
          setValue('admissionNo', generateAdmissionNo(yearName), { shouldDirty: true });
        }
      } catch (e: any) {
        setErr(e?.message || 'Failed to load academic setup');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streamsForClass = React.useMemo(() => streams.filter((s) => s.classId === classId), [streams, classId]);
  const termsForYear = React.useMemo(() => terms.filter((t) => t.academicYearId === academicYearId), [terms, academicYearId]);

  React.useEffect(() => {
    const currentStreamId = watch('streamId');
    if (currentStreamId && !streamsForClass.some((s) => s.id === currentStreamId)) {
      setValue('streamId', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, streamsForClass.length]);

  React.useEffect(() => {
    const current = termsForYear.find((tt) => tt.isCurrent) ?? termsForYear[0];
    if (current) setValue('termId', current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId, termsForYear.length]);

  const visibleSubjects = React.useMemo(() => {
    if (!selectedClass) return [];
    return subjects.filter((s) => s.level === selectedClass.level);
  }, [subjects, selectedClass]);

  // ✅ CHANGED: subjects selection is OPTIONAL (no auto-select)
  React.useEffect(() => {
    setEnrolledSubjectIds([]);
  }, [selectedClass?.id]);

  function toggleSubject(subjectId: string) {
    setEnrolledSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((x) => x !== subjectId) : [...prev, subjectId]));
  }

  async function onSubmit(values: FormValues) {
    setErr('');
    setBusy(true);
    try {
      await apiPost('/api/students', {
        admissionNo: values.admissionNo,
        firstName: values.firstName,
        lastName: values.lastName,
        otherNames: values.otherNames || null,
        gender: values.gender || null,
        dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : null,
        address: values.address || null,
        guardianName: values.guardianName || null,
        guardianPhone: values.guardianPhone || null,

        // ✅ NEW
        residenceSection: values.residenceSection || null,

        pleSittingYear: values.pleSittingYear || null,
        plePrimarySchool: values.plePrimarySchool || null,
        pleIndexNumber: values.pleIndexNumber || null,
        pleAggregates: values.pleAggregates || null,
        pleDivision: values.pleDivision || null,

        village: values.village || null,
        parish: values.parish || null,
        districtOfResidence: values.districtOfResidence || null,
        homeDistrict: values.homeDistrict || null,
        emergencyContactName: values.emergencyContactName || null,
        emergencyContactPhone: values.emergencyContactPhone || null,

        medicalConditions: values.medicalConditions || null,
        recurrentMedication: values.recurrentMedication || null,
        knownDisability: values.knownDisability || null,

        academicYearId: values.academicYearId,
        classId: values.classId,
        streamId: values.streamId || null,

        // ✅ Optional subjects
        enrolledSubjectIds,
      });

      router.push('/students');
    } catch (e: any) {
      setErr(e?.message || 'Failed to add student');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Add New Student</h1>
        <p className="mt-1 text-sm text-slate-600">This will create the student and enroll them into the selected class.</p>
      </div>

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader title="Student Details" subtitle="Basic biodata" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Student Number</Label>
              <Input {...register('admissionNo')} placeholder="ZCHS-2026-0001" />
              {formState.errors.admissionNo ? (
                <p className="text-xs text-red-600">{formState.errors.admissionNo.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('gender') || 'MALE'}
                onChange={(e) => setValue('gender', e.target.value as any)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register('firstName')} />
              {formState.errors.firstName ? <p className="text-xs text-red-600">{formState.errors.firstName.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
              {formState.errors.lastName ? <p className="text-xs text-red-600">{formState.errors.lastName.message}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Other Names</Label>
              <Input {...register('otherNames')} placeholder="optional" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Date of Birth</Label>
              <Input type="date" {...register('dateOfBirth')} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input {...register('address')} placeholder="optional" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Enrollment" subtitle="Academic year + class/stream" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('academicYearId') || ''}
                onChange={(e) => setValue('academicYearId', e.target.value)}
              >
                <option value="">Select year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(current)' : ''}
                  </option>
                ))}
              </select>
              {formState.errors.academicYearId ? (
                <p className="text-xs text-red-600">{formState.errors.academicYearId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Term (optional)</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('termId') || ''}
                onChange={(e) => setValue('termId', e.target.value)}
              >
                <option value="">(optional)</option>
                {termsForYear.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isCurrent ? '(current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('classId') || ''}
                onChange={(e) => setValue('classId', e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {formState.errors.classId ? <p className="text-xs text-red-600">{formState.errors.classId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>Stream</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('streamId') || ''}
                onChange={(e) => setValue('streamId', e.target.value)}
              >
                <option value="">(none)</option>
                {streamsForClass.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ NEW: Residence Section dropdown (optional) */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Residence Section (optional)</Label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={watch('residenceSection') || ''}
                onChange={(e) => setValue('residenceSection', (e.target.value || undefined) as any)}
              >
                <option value="">(optional)</option>
                <option value="DAY">Day</option>
                <option value="BOARDING">Boarding</option>
              </select>
            </div>

            {/* Subjects checklist (optional) */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <Label>Subjects Offered (optional)</Label>
                  <p className="text-xs text-slate-600">You may leave this blank (optional).</p>
                </div>

                {selectedClass ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    onClick={() => {
                      const ids = visibleSubjects.map((s) => s.id);
                      setEnrolledSubjectIds(ids);
                    }}
                  >
                    Select all
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedClass ? (
                  visibleSubjects.length ? (
                    visibleSubjects.map((sub) => {
                      const checked = enrolledSubjectIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleSubject(sub.id)}
                          />
                          <span className="flex-1">
                            {sub.name}
                            {sub.code ? <span className="text-slate-500"> ({sub.code})</span> : null}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-600">No subjects found for this level.</div>
                  )
                ) : (
                  <div className="text-sm text-slate-600">Select a class to show subjects.</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Guardian" subtitle="Optional (can be filled later)" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Guardian Name</Label>
              <Input {...register('guardianName')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>Guardian Phone</Label>
              <Input {...register('guardianPhone')} placeholder="optional" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="PLE Particulars" subtitle="Optional (can be filled later)" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>PLE Sitting Year</Label>
              <Input {...register('pleSittingYear')} placeholder="e.g. 2023" />
            </div>
            <div className="space-y-2">
              <Label>PLE Index Number</Label>
              <Input {...register('pleIndexNumber')} placeholder="optional" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Primary School</Label>
              <Input {...register('plePrimarySchool')} placeholder="optional" />
            </div>

            <div className="space-y-2">
              <Label>Aggregates</Label>
              <Input {...register('pleAggregates')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>Division</Label>
              <Input {...register('pleDivision')} placeholder="optional (e.g. 1)" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Residence & Emergency" subtitle="Optional (can be filled later)" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Village</Label>
              <Input {...register('village')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>Parish</Label>
              <Input {...register('parish')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>District of Residence</Label>
              <Input {...register('districtOfResidence')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>Home District</Label>
              <Input {...register('homeDistrict')} placeholder="optional" />
            </div>

            <div className="space-y-2">
              <Label>Emergency Contact Name</Label>
              <Input {...register('emergencyContactName')} placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact Phone</Label>
              <Input {...register('emergencyContactPhone')} placeholder="optional" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Health Details" subtitle="Optional (can be filled later)" />
          <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Known Medical Conditions</Label>
              <Input {...register('medicalConditions')} placeholder="optional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Recurrent Medication</Label>
              <Input {...register('recurrentMedication')} placeholder="optional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Known Disability</Label>
              <Input {...register('knownDisability')} placeholder="optional" />
            </div>
          </div>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save Student'}
          </Button>
        </div>
      </form>
    </div>
  );
}
