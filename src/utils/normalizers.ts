import { ApplicantStatus, ColumnMapping, StandardFieldKey } from '../types/applicant';

export function normalizeName(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';
  return str.replace(/\s+/g, ' ');
}

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

export function normalizeExamNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().toUpperCase();
}

export function normalizeScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().replace(/[점%]/g, '');
  if (!str || str === '-' || str === '미응시' || str === '결시') return null;
  const num = parseFloat(str);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

export function normalizeFinalResult(raw: unknown): ApplicantStatus {
  if (raw === null || raw === undefined) return '심사 중';
  const str = String(raw).trim().toLowerCase();
  if (/최종\s*합격|합격|pass|success/i.test(str) && !/불합격/i.test(str)) {
    return '최종 합격';
  }
  if (/예비\s*합격|예비|후보|wait/i.test(str)) {
    return '예비 합격';
  }
  if (/불합격|탈락|fail|reject/i.test(str)) {
    return '불합격';
  }
  return '심사 중';
}

const FIELD_PATTERNS: { field: StandardFieldKey; keywords: RegExp }[] = [
  {
    field: 'name',
    keywords: /^(성명|이름|지원자명|응시자명|후보자명|성함|name|full\s*name)$/i,
  },
  {
    field: 'phone',
    keywords: /(휴대폰|휴대전화|전화번호|연락처|핸드폰|전화|모바일|phone|mobile|tel|contact)/i,
  },
  {
    field: 'examNumber',
    keywords: /(응시\s*번호|수험\s*번호|접수\s*번호|응시자\s*번호|접수\s*id|exam\s*no|application\s*no|registration\s*no)/i,
  },
  {
    field: 'email',
    keywords: /(e-?mail|이메일|메일주소|메일|전자우편)/i,
  },
  {
    field: 'address',
    keywords: /(주소|주민등록\s*주소|도로명\s*주소|거주지|거주\s*주소|소재지|address)/i,
  },
  {
    field: 'recruitmentCategory',
    keywords: /(모집\s*구분|모집\s*분야|응시\s*분야|채용\s*분야|지원\s*분야|직렬|직무|지원\s*직무|채용\s*직무|포지션|category|role)/i,
  },
  {
    field: 'supportNeeds',
    keywords: /(편의\s*지원|편의\s*제공|시험\s*편의|편의\s*신청|장애\s*편의|지원\s*사항|편의)/i,
  },
  {
    field: 'disabilityStatus',
    keywords: /(장애인|장애\s*여부|장애\s*구분|장애\s*대상|장애\s*유형|장애\s*등급|장애)/i,
  },
  {
    field: 'lowIncomeStatus',
    keywords: /(저소득|저소득층|취약\s*계층|기초\s*수급|법정\s*저소득|차상위|저소득\s*여부)/i,
  },
  {
    field: 'historyScore',
    keywords: /(한국사|한국사\s*능력|한능검|한국사\s*급수|한국사\s*점수|한국사\s*자격|가산\s*자격)/i,
  },
  {
    field: 'writtenScore',
    keywords: /(필기\s*점수|필기\s*성적|필기\s*총점|1차\s*점수|1차\s*성적|필기\s*시험|필기)/i,
  },
  {
    field: 'interviewScore',
    keywords: /(면접\s*점수|면접\s*성적|면접\s*총점|2차\s*점수|2차\s*성적|면접\s*시험|면접)/i,
  },
  {
    field: 'finalResult',
    keywords: /(최종\s*합격\s*여부|최종\s*합격|최종\s*결과|합격\s*여부|합격\s*결과|전형\s*결과|결과|합불)/i,
  },
  {
    field: 'memo',
    keywords: /(비고|특이\s*사항|참고\s*사항|메모|코멘트|기타|note|remark|memo)/i,
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
