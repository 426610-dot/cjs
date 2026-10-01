import {
  Applicant,
  ApplicantStatus,
  DuplicateHandlingMode,
  ImportSummary,
} from '../types/applicant';
import {
  normalizeEmail,
  normalizeExamNumber,
  normalizeFinalResult,
  normalizeName,
  normalizePhone,
  normalizeScore,
} from './normalizers';

export interface RawApplicantInput {
  id?: string;
  name?: unknown;
  phone?: unknown;
  examNumber?: unknown;
  email?: unknown;
  address?: unknown;
  recruitmentCategory?: unknown;
  supportNeeds?: unknown;
  disabilityStatus?: unknown;
  lowIncomeStatus?: unknown;
  historyScore?: unknown;
  writtenScore?: unknown;
  interviewScore?: unknown;
  finalResult?: unknown;
  status?: ApplicantStatus;
  tags?: string[];
  memo?: unknown;
  sourceFileName?: string;
}

export function buildNormalizedApplicant(input: RawApplicantInput): Applicant {
  const name = normalizeName(input.name) || '성명 미기재';
  const phoneResult = normalizePhone(input.phone);
  const emailResult = normalizeEmail(input.email);
  const examNumber = normalizeExamNumber(input.examNumber) || '-';

  const address = input.address !== null && input.address !== undefined ? String(input.address).trim() : '';
  const recruitmentCategory = normalizeName(input.recruitmentCategory) || '일반행정';
  const supportNeeds = input.supportNeeds !== null && input.supportNeeds !== undefined ? String(input.supportNeeds).trim() : '해당없음';
  const disabilityStatus = input.disabilityStatus !== null && input.disabilityStatus !== undefined ? String(input.disabilityStatus).trim() : '비대상';
  const lowIncomeStatus = input.lowIncomeStatus !== null && input.lowIncomeStatus !== undefined ? String(input.lowIncomeStatus).trim() : '비대상';
  const historyScore = input.historyScore !== null && input.historyScore !== undefined ? String(input.historyScore).trim() : '해당없음';

  const writtenScore = normalizeScore(input.writtenScore);
  const interviewScore = normalizeScore(input.interviewScore);

  let status: ApplicantStatus = input.status || '심사 중';
  if (input.finalResult !== undefined && input.finalResult !== null) {
    status = normalizeFinalResult(input.finalResult);
  }

  const memo = input.memo !== null && input.memo !== undefined ? String(input.memo).trim() : '';

  const warnings: string[] = [];
  if (!phoneResult.isValid && phoneResult.warning) warnings.push(phoneResult.warning);
  if (!emailResult.isValid && emailResult.warning) warnings.push(emailResult.warning);
  if (examNumber === '-' || !examNumber) warnings.push('응시번호 미기재');

  return {
    id: input.id || `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    phone: phoneResult.value,
    rawPhone: input.phone !== undefined ? String(input.phone) : undefined,
    phoneValid: phoneResult.isValid,
    examNumber,
    email: emailResult.value,
    rawEmail: input.email !== undefined ? String(input.email) : undefined,
    emailValid: emailResult.isValid,
    address,
    recruitmentCategory,
    supportNeeds,
    disabilityStatus,
    lowIncomeStatus,
    historyScore,
    writtenScore,
    rawWrittenScore: input.writtenScore !== undefined ? String(input.writtenScore) : undefined,
    interviewScore,
    rawInterviewScore: input.interviewScore !== undefined ? String(input.interviewScore) : undefined,
    status,
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

export function getExamNumberComparisonKey(examNumber: string): string | null {
  const clean = (examNumber || '').trim().toUpperCase();
  if (clean && clean !== '-') {
    return clean;
  }
  return null;
}

export function getCategoryComparisonKey(category: string): string {
  return (category || '').replace(/\s+/g, '').toLowerCase();
}

export function isSamePerson(a: Applicant, b: Applicant): boolean {
  if (a.id === b.id) return false;

  const examA = getExamNumberComparisonKey(a.examNumber);
  const examB = getExamNumberComparisonKey(b.examNumber);
  if (examA && examB && examA === examB) {
    return true;
  }

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

    const warnings: string[] = [];
    if (!phoneCheck.isValid && phoneCheck.warning) warnings.push(phoneCheck.warning);
    if (!emailCheck.isValid && emailCheck.warning) warnings.push(emailCheck.warning);
    if (!app.examNumber || app.examNumber === '-') warnings.push('응시번호 미기재');

    return {
      ...app,
      phone: phoneCheck.isValid ? phoneCheck.value : app.phone,
      phoneValid: phoneCheck.isValid,
      email: emailCheck.isValid ? emailCheck.value : app.email,
      emailValid: emailCheck.isValid,
      warnings,
      hasFormatError: warnings.length > 0,
      isSamePositionDuplicate: false,
      isMultiPositionApplicant: false,
      relatedApplicantIds: [] as string[],
    };
  });

  for (let i = 0; i < updated.length; i++) {
    const a = updated[i];
    const catA = getCategoryComparisonKey(a.recruitmentCategory);

    for (let j = i + 1; j < updated.length; j++) {
      const b = updated[j];
      if (isSamePerson(a, b)) {
        a.relatedApplicantIds.push(b.id);
        b.relatedApplicantIds.push(a.id);

        const catB = getCategoryComparisonKey(b.recruitmentCategory);
        if (catA === catB) {
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

    const candidateCatKey = getCategoryComparisonKey(candidate.recruitmentCategory);
    const samePositionTarget = samePersonMatches.find(
      (existing) => getCategoryComparisonKey(existing.recruitmentCategory) === candidateCatKey
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
        if ((!samePositionTarget.examNumber || samePositionTarget.examNumber === '-') && candidate.examNumber) {
          samePositionTarget.examNumber = candidate.examNumber;
        }
        if (!samePositionTarget.address && candidate.address) {
          samePositionTarget.address = candidate.address;
        }
        if (samePositionTarget.writtenScore === null && candidate.writtenScore !== null) {
          samePositionTarget.writtenScore = candidate.writtenScore;
        }
        if (samePositionTarget.interviewScore === null && candidate.interviewScore !== null) {
          samePositionTarget.interviewScore = candidate.interviewScore;
        }
        if (candidate.status !== '심사 중' && samePositionTarget.status === '심사 중') {
          samePositionTarget.status = candidate.status;
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
