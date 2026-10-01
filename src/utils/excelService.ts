import * as XLSX from 'xlsx';
import { Applicant, ApplicantStatus, ParsedFileSheet } from '../types/applicant';
import { autoRecommendColumnMapping } from './normalizers';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function isSupportedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function parseExcelOrCsvFile(file: File): Promise<ParsedFileSheet> {
  if (!isSupportedFile(file.name)) {
    throw new Error(
      `"${file.name}" 파일은 지원하지 않는 형식입니다. 엑셀(.xlsx, .xls) 또는 CSV(.csv) 파일만 업로드해 주세요.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;

  try {
    if (file.name.toLowerCase().endsWith('.csv')) {
      const uint8 = new Uint8Array(arrayBuffer);
      let text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
      if (text.includes('\uFFFD')) {
        try {
          text = new TextDecoder('euc-kr').decode(uint8);
        } catch {
          // ignore
        }
      }
      workbook = XLSX.read(text, { type: 'string', raw: false });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });
    }
  } catch {
    throw new Error(
      `"${file.name}" 파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 암호가 걸려 있는지 확인해 주세요.`
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`"${file.name}" 파일 안에 시트가 존재하지 않습니다.`);
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rawJson || rawJson.length === 0) {
    throw new Error(
      `"${file.name}" 파일에 데이터 행이 없습니다. 첫 번째 행에 열 제목이 있고 두 번째 행부터 지원자 정보가 있는지 확인해 주세요.`
    );
  }

  const headerSet = new Set<string>();
  for (const row of rawJson.slice(0, 10)) {
    Object.keys(row).forEach((k) => {
      if (k && !k.startsWith('__EMPTY')) {
        headerSet.add(k);
      }
    });
  }

  const headers = Array.from(headerSet);
  if (headers.length === 0) {
    throw new Error(
      `"${file.name}" 파일에서 유효한 열 이름을 찾을 수 없습니다. 첫 번째 행에 항목 이름이 있는지 확인해 주세요.`
    );
  }

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    sheetName: firstSheetName,
    headers,
    rows: rawJson,
    mapping: autoRecommendColumnMapping(headers),
  };
}

export function exportApplicantsToExcel(
  applicants: Applicant[],
  fileName = `지원자_정리목록_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const rows = applicants.map((app) => {
    const badgeNotes: string[] = [];
    if (app.isSamePositionDuplicate) badgeNotes.push('중복 지원');
    if (app.isMultiPositionApplicant) badgeNotes.push('복수 포지션 지원');
    if (app.warnings.length > 0) badgeNotes.push(...app.warnings);

    return {
      이름: app.name,
      연락처: app.phone,
      이메일: app.email,
      '지원 포지션': app.position,
      '지원 경로': app.source,
      '경력(년)': app.experience === 0 ? '신입(0)' : app.experience,
      지원일: app.appliedDate,
      상태: app.status,
      태그: app.tags.join(', '),
      메모: app.memo,
      '검증/중복 참고': badgeNotes.join(' / '),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 26 },
    { wch: 22 },
    { wch: 15 },
    { wch: 10 },
    { wch: 13 },
    { wch: 12 },
    { wch: 24 },
    { wch: 40 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '지원자목록');
  XLSX.writeFile(workbook, fileName);
}

export function exportApplicantsToCsv(
  applicants: Applicant[],
  fileName = `지원자_정리목록_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const rows = applicants.map((app) => {
    const badgeNotes: string[] = [];
    if (app.isSamePositionDuplicate) badgeNotes.push('중복 지원');
    if (app.isMultiPositionApplicant) badgeNotes.push('복수 포지션 지원');
    if (app.warnings.length > 0) badgeNotes.push(...app.warnings);

    return {
      이름: app.name,
      연락처: app.phone,
      이메일: app.email,
      '지원 포지션': app.position,
      '지원 경로': app.source,
      '경력(년)': app.experience === 0 ? '0' : String(app.experience),
      지원일: app.appliedDate,
      상태: app.status,
      태그: app.tags.join(', '),
      메모: app.memo,
      '검증/중복 참고': badgeNotes.join(' / '),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  // UTF-8 BOM (\uFEFF)
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportContactTargetsToExcel(
  applicants: Applicant[],
  selectedStatuses: ApplicantStatus[],
  includeExtraFields = false
): void {
  const filtered = applicants.filter((app) => selectedStatuses.includes(app.status));

  const rows = filtered.map((app) => {
    const base: Record<string, string> = {
      이름: app.name,
      연락처: app.phone,
      이메일: app.email,
      '지원 포지션': app.position,
    };
    if (includeExtraFields) {
      base['상태'] = app.status;
      base['태그'] = app.tags.join(', ');
      base['메모'] = app.memo;
    }
    return base;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    ...(includeExtraFields ? [{ wch: 12 }, { wch: 22 }, { wch: 35 }] : []),
  ];

  const statusLabel = selectedStatuses.join('_').replace(/\s+/g, '');
  const fileName = `연락대상_${statusLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '연락대상명단');
  XLSX.writeFile(workbook, fileName);
}

export function downloadSampleRawExcelForTest(): void {
  const sampleRows = [
    {
      '지원자 성명': '  김민준 ',
      휴대폰번호: '+82 10-3948-1920',
      'E-mail': 'MinJun.Kim@gmail.com ',
      지원직무: '프론트엔드 엔지니어',
      채용채널: '원티드',
      총경력: '4년 6개월',
      접수일시: '2026.09.18',
      비고사항: '디자인시스템 구축 리드 경험',
    },
    {
      '지원자 성명': '이서연',
      휴대폰번호: '01082714409',
      'E-mail': 'seoyeon.lee@kakao.com',
      지원직무: '프로덕트 디자이너',
      채용채널: '사람인',
      총경력: '3년',
      접수일시: '2026/09/19',
      비고사항: '핀테크 UX 리서치 및 프로토타이핑',
    },
    {
      '지원자 성명': '박도현',
      휴대폰번호: '010-592-110',
      'E-mail': 'dohyun.park@@naver.com',
      지원직무: '백엔드 엔지니어',
      채용채널: '잡코리아',
      총경력: '신입',
      접수일시: '20260925',
      비고사항: '연락처/이메일 오기재 테스트 행',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 32 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '채용사이트_원본샘플');
  XLSX.writeFile(wb, '채용사이트_지원자_샘플원본.xlsx');
}
