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
      `"${file.name}" 파일에 데이터 행이 없습니다. 첫 번째 행에 항목명이 있고 두 번째 행부터 응시자 정보가 있는지 확인해 주세요.`
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
      `"${file.name}" 파일에서 유효한 열 이름을 찾을 수 없습니다. 첫 번째 행에 항목명이 있는지 확인해 주세요.`
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
  fileName = `응시자_명단_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const rows = applicants.map((app) => {
    const badgeNotes: string[] = [];
    if (app.isSamePositionDuplicate) badgeNotes.push('동일 모집구분 중복');
    if (app.isMultiPositionApplicant) badgeNotes.push('복수 모집구분 지원');
    if (app.warnings.length > 0) badgeNotes.push(...app.warnings);

    return {
      성명: app.name,
      연락처: app.phone,
      응시번호: app.examNumber,
      이메일: app.email,
      주소: app.address,
      모집구분: app.recruitmentCategory,
      편의지원: app.supportNeeds,
      장애인: app.disabilityStatus,
      저소득: app.lowIncomeStatus,
      한국사: app.historyScore,
      필기점수: app.writtenScore !== null ? app.writtenScore : '-',
      면접점수: app.interviewScore !== null ? app.interviewScore : '-',
      최종합격여부: app.status,
      '비고(메모)': app.memo,
      '검증/중복 참고': badgeNotes.join(' / '),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 }, // 성명
    { wch: 16 }, // 연락처
    { wch: 18 }, // 응시번호
    { wch: 25 }, // 이메일
    { wch: 30 }, // 주소
    { wch: 20 }, // 모집구분
    { wch: 14 }, // 편의지원
    { wch: 12 }, // 장애인
    { wch: 12 }, // 저소득
    { wch: 14 }, // 한국사
    { wch: 12 }, // 필기점수
    { wch: 12 }, // 면접점수
    { wch: 14 }, // 최종합격여부
    { wch: 30 }, // 비고(메모)
    { wch: 22 }, // 검증/중복 참고
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '응시자명단');
  XLSX.writeFile(workbook, fileName);
}

export function exportApplicantsToCsv(
  applicants: Applicant[],
  fileName = `응시자_명단_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const rows = applicants.map((app) => {
    const badgeNotes: string[] = [];
    if (app.isSamePositionDuplicate) badgeNotes.push('동일 모집구분 중복');
    if (app.isMultiPositionApplicant) badgeNotes.push('복수 모집구분 지원');
    if (app.warnings.length > 0) badgeNotes.push(...app.warnings);

    return {
      성명: app.name,
      연락처: app.phone,
      응시번호: app.examNumber,
      이메일: app.email,
      주소: app.address,
      모집구분: app.recruitmentCategory,
      편의지원: app.supportNeeds,
      장애인: app.disabilityStatus,
      저소득: app.lowIncomeStatus,
      한국사: app.historyScore,
      필기점수: app.writtenScore !== null ? String(app.writtenScore) : '-',
      면접점수: app.interviewScore !== null ? String(app.interviewScore) : '-',
      최종합격여부: app.status,
      '비고(메모)': app.memo,
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
      성명: app.name,
      연락처: app.phone,
      응시번호: app.examNumber,
      이메일: app.email,
      모집구분: app.recruitmentCategory,
      최종합격여부: app.status,
    };
    if (includeExtraFields) {
      base['주소'] = app.address;
      base['필기점수'] = app.writtenScore !== null ? String(app.writtenScore) : '-';
      base['면접점수'] = app.interviewScore !== null ? String(app.interviewScore) : '-';
      base['비고'] = app.memo;
    }
    return base;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 14 },
    ...(includeExtraFields ? [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 30 }] : []),
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
      성명: '  김민준 ',
      연락처: '+82 10-3948-1920',
      수험번호: 'ADM-2026-0101',
      이메일: 'MinJun.Kim@gmail.com ',
      거주주소: '서울특별시 서초구 반포대로 58',
      채용분야: '일반행정 (전국)',
      편의지원: '해당없음',
      장애여부: '비대상',
      저소득여부: '비대상',
      한국사능력: '1급 (심화)',
      필기점수: 92.5,
      면접점수: 94.0,
      최종합격여부: '최종 합격',
      비고사항: '필기 및 면접 점수 최상위권',
    },
    {
      성명: '이서연',
      연락처: '01082714409',
      수험번호: 'ADM-2026-0108',
      이메일: 'seoyeon.lee@kakao.com',
      거주주소: '경기도 성남시 분당구 판교역로 166',
      채용분야: '일반행정 (지역: 경기)',
      편의지원: '해당없음',
      장애여부: '비대상',
      저소득여부: '비대상',
      한국사능력: '2급',
      필기점수: 89.5,
      면접점수: 92.0,
      최종합격여부: '최종 합격',
      비고사항: '지역 인재 추천 요건 충족',
    },
    {
      성명: '박도현',
      연락처: '010-592-110', // 연락처 자릿수 오류
      수험번호: 'TECH-2026-0044',
      이메일: 'dohyun.park@@naver.com', // 이메일 오류
      거주주소: '부산광역시 수영구 수영로 45',
      채용분야: '전산/데이터 (일반)',
      편의지원: '확대문제지',
      장애여부: '대상 (경증)',
      저소득여부: '차상위계층',
      한국사능력: '1급',
      필기점수: 85.0,
      면접점수: 83.5,
      최종합격여부: '심사 중',
      비고사항: '연락처/이메일 오기재 테스트 행',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 25 },
    { wch: 30 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '응시자_원본샘플');
  XLSX.writeFile(wb, '채용_응시자_샘플원본.xlsx');
}
