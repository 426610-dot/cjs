export type ApplicantStatus = '검토 전' | '서류 통과' | '보류' | '탈락';

export const APPLICANT_STATUSES: ApplicantStatus[] = [
  '검토 전',
  '서류 통과',
  '보류',
  '탈락',
];

export type StandardFieldKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'position'
  | 'source'
  | 'experience'
  | 'appliedDate'
  | 'memo';

export interface StandardFieldMeta {
  key: StandardFieldKey;
  label: string;
  required?: boolean;
  description: string;
}

export const STANDARD_FIELDS: StandardFieldMeta[] = [
  { key: 'name', label: '이름', required: true, description: '앞뒤 공백 제거 및 연속 공백 통일' },
  { key: 'phone', label: '연락처', required: true, description: '010-1234-5678 형식 통일 (+82 등 처리)' },
  { key: 'email', label: '이메일', required: true, description: '소문자 변환 및 이메일 형식 검증' },
  { key: 'position', label: '지원 포지션', required: true, description: '지원 직무 및 모집 부문' },
  { key: 'source', label: '지원 경로', description: '채용 사이트, 추천, 자사 홈페이지 등' },
  { key: 'experience', label: '경력(년)', description: '신입→0, 3년 6개월→3.5 등 숫자 변환' },
  { key: 'appliedDate', label: '지원일', description: 'YYYY-MM-DD 날짜 형식 통일' },
  { key: 'memo', label: '기타 메모', description: '특이사항, 포트폴리오 링크, 참고 메모' },
];

export type ColumnMapping = Record<string, StandardFieldKey | 'ignore'>;

export interface ParsedFileSheet {
  id: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: ColumnMapping;
}

export interface Applicant {
  id: string;
  name: string;
  phone: string;
  rawPhone?: string;
  phoneValid: boolean;
  email: string;
  rawEmail?: string;
  emailValid: boolean;
  position: string;
  source: string;
  experience: number;
  rawExperience?: string;
  experienceValid: boolean;
  appliedDate: string;
  rawAppliedDate?: string;
  appliedDateValid: boolean;
  status: ApplicantStatus;
  tags: string[];
  memo: string;
  sourceFileName?: string;
  createdAt: string;
  warnings: string[];
  hasFormatError: boolean;
  isSamePositionDuplicate: boolean;
  isMultiPositionApplicant: boolean;
  relatedApplicantIds: string[];
}

export type DuplicateHandlingMode = 'merge' | 'skip';

export interface ImportSummary {
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  mergedCount: number;
  skippedCount: number;
  multiPositionCount: number;
  formatErrorCount: number;
  fileNames: string[];
  timestamp: string;
}

export type ExperienceFilterRange = 'all' | 'entry' | '1to3' | '3to7' | '7plus';

export interface FilterState {
  search: string;
  position: string;
  source: string;
  status: ApplicantStatus | 'all';
  experienceRange: ExperienceFilterRange;
  tag: string;
  onlyDuplicates: boolean;
  onlyFormatErrors: boolean;
}

export type SortField =
  | 'name'
  | 'phone'
  | 'email'
  | 'position'
  | 'source'
  | 'experience'
  | 'appliedDate'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}
