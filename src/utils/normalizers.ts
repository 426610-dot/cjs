import { ColumnMapping, StandardFieldKey } from '../types/applicant';

/**
 * 1. 이름 정리 규칙
 * - 앞뒤 공백 제거
 * - 중간 연속 공백(탭, 줄바꿈 포함)을 단일 공백(' ')으로 통일
 */
export function normalizeName(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';
  return str.replace(/\s+/g, ' ');
}

/**
 * 2. 연락처 정리 규칙
 * - 숫자만 추출 후 010-1234-5678 형식으로 통일
 * - +82, 82-10, 공백, 하이픈, 점(.), 괄호 등 혼재 처리
 * - 엑셀에서 앞자리 0이 잘린 1012345678 형태도 010-1234-5678로 복원
 * - 자릿수나 시작 번호가 맞지 않으면 "연락처 형식 오류" 경고 반환
 */
export function normalizePhone(raw: unknown): {
  value: string;
  isValid: boolean;
  warning?: string;
} {
  if (raw === null || raw === undefined) {
    return { value: '', isValid: false, warning: '연락처 미입력' };
  }

  const rawStr = String(raw).trim();
  if (!rawStr) {
    return { value: '', isValid: false, warning: '연락처 미입력' };
  }

  let digits = rawStr.replace(/\D/g, '');

  if (digits.startsWith('82')) {
    const rest = digits.slice(2);
    if (
      rest.startsWith('010') ||
      rest.startsWith('011') ||
      rest.startsWith('016') ||
      rest.startsWith('017') ||
      rest.startsWith('018') ||
      rest.startsWith('019')
    ) {
      digits = rest;
    } else if (
      rest.startsWith('10') ||
      rest.startsWith('11') ||
      rest.startsWith('16') ||
      rest.startsWith('17') ||
      rest.startsWith('18') ||
      rest.startsWith('19')
    ) {
      digits = '0' + rest;
    }
  }

  if (digits.length === 10 && digits.startsWith('10')) {
    digits = '0' + digits;
  }

  if (digits.length === 11 && /^01[016789]\d{8}$/.test(digits)) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    return { value: formatted, isValid: true };
  }

  if (digits.length === 10 && /^01[16789]\d{7}$/.test(digits)) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    return { value: formatted, isValid: true };
  }

  return {
    value: rawStr,
    isValid: false,
    warning: '연락처 형식 오류',
  };
}

/**
 * 3. 이메일 정리 규칙
 * - 모든 공백 제거 및 소문자 변환
 * - 표준 이메일 정규식 검증 (오류 시 "이메일 형식 오류" 경고)
 */
export function normalizeEmail(raw: unknown): {
  value: string;
  isValid: boolean;
  warning?: string;
} {
  if (raw === null || raw === undefined) {
    return { value: '', isValid: false, warning: '이메일 미입력' };
  }

  const cleaned = String(raw).replace(/\s+/g, '').toLowerCase();
  if (!cleaned) {
    return { value: '', isValid: false, warning: '이메일 미입력' };
  }

  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  const hasDoubleDots = cleaned.includes('..');

  if (!emailRegex.test(cleaned) || hasDoubleDots) {
    return {
      value: cleaned,
      isValid: false,
      warning: '이메일 형식 오류',
    };
  }

  return { value: cleaned, isValid: true };
}

/**
 * 4. 경력(년) 정리 규칙
 * - "신입", "무관", "인턴" -> 0
 * - "3년 6개월" -> 3.5
 * - "18개월" -> 1.5
 * - "3년", "3.5" -> 3, 3.5
 */
export function normalizeExperience(raw: unknown): {
  value: number;
  isValid: boolean;
  warning?: string;
} {
  if (raw === null || raw === undefined) {
    return { value: 0, isValid: true };
  }

  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    const rounded = Math.max(0, Math.round(raw * 10) / 10);
    return { value: rounded, isValid: true };
  }

  const str = String(raw).trim();
  if (!str || str === '-') {
    return { value: 0, isValid: true };
  }

  if (/신입|초보|인턴|무관|없음|entry|new|junior/i.test(str) && !/\d/.test(str)) {
    return { value: 0, isValid: true };
  }

  const yearMonthMatch = str.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+)\s*개?월/);
  if (yearMonthMatch) {
    const years = parseFloat(yearMonthMatch[1]);
    const months = parseFloat(yearMonthMatch[2]);
    const total = Math.round((years + months / 12) * 10) / 10;
    return { value: total, isValid: true };
  }

  const monthOnlyMatch = str.match(/^약?\s*(\d+)\s*개?월$/);
  if (monthOnlyMatch) {
    const months = parseFloat(monthOnlyMatch[1]);
    const total = Math.round((months / 12) * 10) / 10;
    return { value: total, isValid: true };
  }

  const numberMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
    if (!Number.isNaN(num) && num >= 0 && num <= 60) {
      return { value: Math.round(num * 10) / 10, isValid: true };
    }
  }

  return {
    value: 0,
    isValid: false,
    warning: `경력 표기 확인 필요 (${str})`,
  };
}

/**
 * 5. 지원일 정리 규칙
 * - 엑셀 시리얼 날짜, "2026.09.15", "2026/9/5", "26-09-15" 등을 YYYY-MM-DD로 통일
 */
export function normalizeDate(raw: unknown): {
  value: string;
  isValid: boolean;
  warning?: string;
} {
  const todayFallback = new Date().toISOString().slice(0, 10);

  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { value: todayFallback, isValid: true };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return {
      value: formatDateParts(raw.getFullYear(), raw.getMonth() + 1, raw.getDate()),
      isValid: true,
    };
  }

  if (typeof raw === 'number' || /^\d{5}(?:\.\d+)?$/.test(String(raw).trim())) {
    const serial = Number(raw);
    if (serial > 30000 && serial < 70000) {
      const utcDays = Math.floor(serial - 25569);
      const dateObj = new Date(utcDays * 86400 * 1000);
      if (!Number.isNaN(dateObj.getTime())) {
        return {
          value: formatDateParts(
            dateObj.getUTCFullYear(),
            dateObj.getUTCMonth() + 1,
            dateObj.getUTCDate()
          ),
          isValid: true,
        };
      }
    }
  }

  const str = String(raw).trim();

  const eightDigit = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (eightDigit) {
    const y = parseInt(eightDigit[1], 10);
    const m = parseInt(eightDigit[2], 10);
    const d = parseInt(eightDigit[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return { value: formatDateParts(y, m, d), isValid: true };
    }
  }

  const ymdMatch = str.match(/^(\d{2,4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (ymdMatch) {
    let y = parseInt(ymdMatch[1], 10);
    if (y < 100) {
      y += y >= 70 ? 1900 : 2000;
    }
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return { value: formatDateParts(y, m, d), isValid: true };
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    if (isValidCalendarDate(y, m, d)) {
      return { value: formatDateParts(y, m, d), isValid: true };
    }
  }

  return {
    value: str,
    isValid: false,
    warning: '지원일 형식 오류',
  };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

function formatDateParts(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

const FIELD_PATTERNS: { field: StandardFieldKey; keywords: RegExp }[] = [
  {
    field: 'name',
    keywords: /^(성명|이름|지원자명|지원자\s*성명|지원자|한글\s*이름|성함|후보자명|name|full\s*name|applicant|candidate)$/i,
  },
  {
    field: 'phone',
    keywords: /(휴대폰|휴대전화|전화번호|연락처|핸드폰|전화|모바일|phone|mobile|cell|tel|h\.?p|contact)/i,
  },
  {
    field: 'email',
    keywords: /(e-?mail|이메일|메일주소|메일|전자우편|mail)/i,
  },
  {
    field: 'position',
    keywords: /(지원\s*포지션|지원\s*직무|지원\s*부문|지원\s*분야|모집\s*부문|직무|포지션|공고명|채용\s*공고|희망\s*직무|position|role|job\s*title|department)/i,
  },
  {
    field: 'source',
    keywords: /(지원\s*경로|유입\s*경로|채용\s*사이트|채용\s*채널|플랫폼|경로|출처|채널|사이트|구분\s*채널|source|channel|platform|referrer)/i,
  },
  {
    field: 'experience',
    keywords: /(경력|총\s*경력|경력\s*기간|경력\s*연수|연차|경력\s*사항|경력\s*구분|experience|career|years)/i,
  },
  {
    field: 'appliedDate',
    keywords: /(지원\s*일시|지원\s*일자|지원일|접수\s*일시|접수\s*일자|접수일|제출\s*일시|제출일|등록일|지원\s*날짜|applied|date|timestamp)/i,
  },
  {
    field: 'memo',
    keywords: /(기타\s*메모|메모|비고|특이\s*사항|참고\s*사항|코멘트|포트폴리오|노트|첨부|한줄\s*소개|memo|note|remark|comment|portfolio)/i,
  },
];

export function autoRecommendColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const assignedFields = new Set<StandardFieldKey>();

  for (const header of headers) {
    const cleanHeader = header.trim();
    let matched: StandardFieldKey | 'ignore' = 'ignore';

    for (const { field, keywords } of FIELD_PATTERNS) {
      if (assignedFields.has(field)) continue;
      if (keywords.test(cleanHeader)) {
        matched = field;
        assignedFields.add(field);
        break;
      }
    }

    mapping[header] = matched;
  }

  if (!assignedFields.has('name')) {
    for (const header of headers) {
      if (mapping[header] === 'ignore' && /(성명|이름|name)/i.test(header)) {
        mapping[header] = 'name';
        assignedFields.add('name');
        break;
      }
    }
  }

  return mapping;
}
