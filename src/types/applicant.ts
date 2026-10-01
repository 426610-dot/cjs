export type ApplicantStatus = '심사 중' | '최종 합격' | '예비 합격' | '불합격';

export const APPLICANT_STATUSES: ApplicantStatus[] = [
  '심사 중',
  '최종 합격',
  '예비 합격',
  '불합격',
];

export type StandardFieldKey =
  | 'name'                // 성명
  | 'phone'               // 연락처
  | 'examNumber'          // 응시번호
  | 'email'               // 이메일
  | 'address'             // 주소
  | 'recruitmentCategory' // 모집구분
  | 'supportNeeds'        // 편의지원
  | 'disabilityStatus'    // 장애인
  | 'lowIncomeStatus'     // 저소득
  | 'historyScore'        // 한국사
  | 'writtenScore'        // 필기점수
  | 'interviewScore'      // 면접점수
  | 'finalResult'         // 최종합격여부
  | 'memo';               // 비고/메모

export interface StandardFieldMeta {
  key: StandardFieldKey;
  label: string;
  required?: boolean;
  description: string;
}

export const STANDARD_FIELDS: StandardFieldMeta[] = [
  { key: 'name', label: '성명', required: true, description: '앞뒤 공백 제거 및 연속 공백 정리' },
  { key: 'phone', label: '연락처', required: true, description: '010-1234-5678 형식 통일 (+82 등 정리)' },
  { key: 'examNumber', label: '응시번호', required: true, description: '수험번호 및 접수번호' },
  { key: 'email', label: '이메일', required: true, description: '소문자 변환 및 이메일 형식 검증' },
  { key: 'address', label: '주소', description: '거주지 및 도로명/지번 주소' },
  { key: 'recruitmentCategory', label: '모집구분', required: true, description: '응시 직렬, 채용 직무, 모집 분야' },
  { key: 'supportNeeds', label: '편의지원', description: '시험 편의지원 신청 내역 (돋보기, 시간연장 등)' },
  { key: 'disabilityStatus', label: '장애인', description: '장애인 구분 (대상, 비대상, 중증, 경증)' },
  { key: 'lowIncomeStatus', label: '저소득', description: '저소득층 구분 (수급자, 차상위, 비대상 등)' },
  { key: 'historyScore', label: '한국사', description: '한국사능력검정시험 급수/점수' },
  { key: 'writtenScore', label: '필기점수', description: '필기전형 시험 점수' },
  { key: 'interviewScore', label: '면접점수', description: '면접전형 시험 점수' },
  { key: 'finalResult', label: '최종합격여부', description: '최종 합격, 예비 합격, 불합격, 심사 중' },
  { key: 'memo', label: '비고(메모)', description: '기타 특이사항 및 참고 메모' },
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
  examNumber: string;
  email: string;
  rawEmail?: string;
  emailValid: boolean;
  address: string;
  recruitmentCategory: string;
  supportNeeds: string;
  disabilityStatus: string;
  lowIncomeStatus: string;
  historyScore: string;
  writtenScore: number | null;
  rawWrittenScore?: string;
  interviewScore: number | null;
  rawInterviewScore?: string;
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

export interface FilterState {
  search: string;
  recruitmentCategory: string;
  status: ApplicantStatus | 'all';
  disabilityFilter: string;
  lowIncomeFilter: string;
  supportNeedsFilter: string;
  tag: string;
  onlyDuplicates: boolean;
  onlyFormatErrors: boolean;
}

export type SortField =
  | 'name'
  | 'phone'
  | 'examNumber'
  | 'email'
  | 'recruitmentCategory'
  | 'writtenScore'
  | 'interviewScore'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}
