import {
  Applicant,
  ApplicantStatus,
  DuplicateHandlingMode,
  ImportSummary,
} from '../types/applicant';
import {
  normalizeDate,
  normalizeEmail,
  normalizeExperience,
  normalizeName,
  normalizePhone,
} from './normalizers';

export interface RawApplicantInput {
  id?: string;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  position?: unknown;
  source?: unknown;
  experience?: unknown;
  appliedDate?: unknown;
  memo?: unknown;
  status?: ApplicantStatus;
  tags?: string[];
  sourceFileName?: string;
}

export function buildNormalizedApplicant(input: RawApplicantInput): Applicant {
  const name = normalizeName(input.name) || '이름 미기재';
  const phoneResult = normalizePhone(input.phone);
  const emailResult = normalizeEmail(input.email);
  const expResult = normalizeExperience(input.experience);
  const dateResult = normalizeDate(input.appliedDate);

  const position = normalizeName(input.position) || '미지정 포지션';
  const source = normalizeName(input.source) || '기타/직접지원';
  const memo = input.memo !== null && input.memo !== undefined ? String(input.memo).trim() : '';

  const warnings: string[] = [];
  if (!phoneResult.isValid && phoneResult.warning) warnings.push(phoneResult.warning);
  if (!emailResult.isValid && emailResult.warning) warnings.push(emailResult.warning);
  if (!expResult.isValid && expResult.warning) warnings.push(expResult.warning);
  if (!dateResult.isValid && dateResult.warning) warnings.push(dateResult.warning);

  return {
    id: input.id || `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    phone: phoneResult.value,
    rawPhone: input.phone !== undefined ? String(input.phone) : undefined,
    phoneValid: phoneResult.isValid,
    email: emailResult.value,
    rawEmail: input.email !== undefined ? String(input.email) : undefined,
    emailValid: emailResult.isValid,
    position,
    source,
    experience: expResult.value,
    rawExperience: input.experience !== undefined ? String(input.experience) : undefined,
    experienceValid: expResult.isValid,
    appliedDate: dateResult.value,
    rawAppliedDate: input.appliedDate !== undefined ? String(input.appliedDate) : undefined,
    appliedDateValid: dateResult.isValid,
    status: input.status || '검토 전',
    tags: input.tags ? [...input.tags] : [],
    memo,
    sourceFileName: input.sourceFileName,
    createdAt: new Date().toISOString(),
    warnings,
    hasFormatError: warnings.length > 0,
    isSamePositionDuplicate: false,
    isMultiPositionApplicant: false,
    relatedApplicantIds: [],
  };
}

export function getPhoneComparisonKey(phone: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    return digits;
  }
  return null;
}

export function getEmailComparisonKey(email: string): string | null {
  const clean = (email || '').trim().toLowerCase();
  if (clean.length >= 5 && clean.includes('@')) {
    return clean;
  }
  return null;
}

export function getPositionComparisonKey(position: string): string {
  return (position || '').replace(/\s+/g, '').toLowerCase();
}

export function isSamePerson(a: Applicant, b: Applicant): boolean {
  if (a.id === b.id) return false;

  const phoneA = getPhoneComparisonKey(a.phone);
  const phoneB = getPhoneComparisonKey(b.phone);
  if (phoneA && phoneB && phoneA === phoneB) {
    return true;
  }

  const emailA = getEmailComparisonKey(a.email);
  const emailB = getEmailComparisonKey(b.email);
  if (emailA && emailB && emailA === emailB) {
    return true;
  }

  return false;
}

export function recomputeApplicantsMetadata(applicants: Applicant[]): Applicant[] {
  const updated = applicants.map((app) => {
    const phoneCheck = normalizePhone(app.phone);
    const emailCheck = normalizeEmail(app.email);
    const dateCheck = normalizeDate(app.appliedDate);

    const warnings: string[] = [];
    if (!phoneCheck.isValid && phoneCheck.warning) warnings.push(phoneCheck.warning);
    if (!emailCheck.isValid && emailCheck.warning) warnings.push(emailCheck.warning);
    if (!dateCheck.isValid && dateCheck.warning) warnings.push(dateCheck.warning);

    return {
      ...app,
      phone: phoneCheck.isValid ? phoneCheck.value : app.phone,
      phoneValid: phoneCheck.isValid,
      email: emailCheck.isValid ? emailCheck.value : app.email,
      emailValid: emailCheck.isValid,
      appliedDate: dateCheck.isValid ? dateCheck.value : app.appliedDate,
      appliedDateValid: dateCheck.isValid,
      warnings,
      hasFormatError: warnings.length > 0,
      isSamePositionDuplicate: false,
      isMultiPositionApplicant: false,
      relatedApplicantIds: [] as string[],
    };
  });

  for (let i = 0; i < updated.length; i++) {
    const a = updated[i];
    const posA = getPositionComparisonKey(a.position);

    for (let j = i + 1; j < updated.length; j++) {
      const b = updated[j];
      if (isSamePerson(a, b)) {
        a.relatedApplicantIds.push(b.id);
        b.relatedApplicantIds.push(a.id);

        const posB = getPositionComparisonKey(b.position);
        if (posA === posB) {
          a.isSamePositionDuplicate = true;
          b.isSamePositionDuplicate = true;
        } else {
          a.isMultiPositionApplicant = true;
          b.isMultiPositionApplicant = true;
        }
      }
    }
  }

  return updated;
}

export function processApplicantImport(
  existingApplicants: Applicant[],
  incomingRawList: RawApplicantInput[],
  duplicateMode: DuplicateHandlingMode,
  fileNames: string[]
): {
  mergedApplicants: Applicant[];
  summary: ImportSummary;
} {
  const workingList: Applicant[] = existingApplicants.map((item) => ({
    ...item,
    tags: [...item.tags],
  }));

  let newCount = 0;
  let duplicateCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;
  let multiPositionCount = 0;
  let formatErrorCount = 0;

  for (const raw of incomingRawList) {
    const candidate = buildNormalizedApplicant(raw);
    if (candidate.hasFormatError) {
      formatErrorCount++;
    }

    const samePersonMatches = workingList.filter((existing) =>
      isSamePerson(existing, candidate)
    );

    if (samePersonMatches.length === 0) {
      workingList.push(candidate);
      newCount++;
      continue;
    }

    const candidatePosKey = getPositionComparisonKey(candidate.position);
    const samePositionTarget = samePersonMatches.find(
      (existing) => getPositionComparisonKey(existing.position) === candidatePosKey
    );

    if (samePositionTarget) {
      duplicateCount++;
      if (duplicateMode === 'merge') {
        if (!samePositionTarget.phoneValid && candidate.phoneValid) {
          samePositionTarget.phone = candidate.phone;
          samePositionTarget.phoneValid = true;
        }
        if (!samePositionTarget.emailValid && candidate.emailValid) {
          samePositionTarget.email = candidate.email;
          samePositionTarget.emailValid = true;
        }
        if (samePositionTarget.experience === 0 && candidate.experience > 0) {
          samePositionTarget.experience = candidate.experience;
        }
        if (
          candidate.source &&
          candidate.source !== '기타/직접지원' &&
          !samePositionTarget.source.includes(candidate.source)
        ) {
          samePositionTarget.source = `${samePositionTarget.source} / ${candidate.source}`;
        }
        if (candidate.memo && !samePositionTarget.memo.includes(candidate.memo)) {
          samePositionTarget.memo = samePositionTarget.memo
            ? `${samePositionTarget.memo} | [병합] ${candidate.memo}`
            : candidate.memo;
        }
        if (!samePositionTarget.tags.includes('중복병합')) {
          samePositionTarget.tags.push('중복병합');
        }
        mergedCount++;
      } else {
        skippedCount++;
      }
    } else {
      multiPositionCount++;
      newCount++;
      workingList.push(candidate);
    }
  }

  const finalApplicants = recomputeApplicantsMetadata(workingList);

  return {
    mergedApplicants: finalApplicants,
    summary: {
      totalRows: incomingRawList.length,
      newCount,
      duplicateCount,
      mergedCount,
      skippedCount,
      multiPositionCount,
      formatErrorCount,
      fileNames,
      timestamp: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    },
  };
}
