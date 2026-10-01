import React, { useRef, useState, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowRight,
  Download,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  Applicant,
  DuplicateHandlingMode,
  ImportSummary,
  ParsedFileSheet,
  STANDARD_FIELDS,
  StandardFieldKey,
} from '../types/applicant';
import {
  downloadSampleRawExcelForTest,
  parseExcelOrCsvFile,
} from '../utils/excelService';
import {
  buildNormalizedApplicant,
  getPositionComparisonKey,
  isSamePerson,
  RawApplicantInput,
} from '../utils/duplicateDetector';
import { generateSampleParsedFiles } from '../utils/sampleData';
import { autoRecommendColumnMapping } from '../utils/normalizers';

interface ImportViewProps {
  existingApplicants: Applicant[];
  onConfirmImport: (
    rawList: RawApplicantInput[],
    duplicateMode: DuplicateHandlingMode,
    fileNames: string[]
  ) => ImportSummary;
  onNavigateToList: () => void;
  onLoadSampleApplicants: () => void;
}

export const ImportView: React.FC<ImportViewProps> = ({
  existingApplicants,
  onConfirmImport,
  onNavigateToList,
  onLoadSampleApplicants,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedSheets, setParsedSheets] = useState<ParsedFileSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateHandlingMode>('merge');
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setErrorMessage(null);
    setLastSummary(null);
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newSheets: ParsedFileSheet[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      try {
        const parsed = await parseExcelOrCsvFile(file);
        newSheets.push(parsed);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : '파일을 읽을 수 없습니다.');
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join('\n'));
    }

    if (newSheets.length > 0) {
      setParsedSheets((prev) => {
        const next = [...prev, ...newSheets];
        if (!activeSheetId) {
          setActiveSheetId(newSheets[0].id);
        }
        return next;
      });
      if (!activeSheetId) {
        setActiveSheetId(newSheets[0].id);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSampleSheets = () => {
    setErrorMessage(null);
    setLastSummary(null);
    const samples = generateSampleParsedFiles();
    setParsedSheets(samples);
    setActiveSheetId(samples[0].id);
  };

  const handleRemoveSheet = (sheetId: string) => {
    setParsedSheets((prev) => {
      const next = prev.filter((s) => s.id !== sheetId);
      if (activeSheetId === sheetId) {
        setActiveSheetId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleMappingChange = (
    sheetId: string,
    header: string,
    targetField: StandardFieldKey | 'ignore'
  ) => {
    setParsedSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        const updatedMapping = { ...sheet.mapping };

        if (targetField !== 'ignore') {
          for (const key of Object.keys(updatedMapping)) {
            if (key !== header && updatedMapping[key] === targetField) {
              updatedMapping[key] = 'ignore';
            }
          }
        }
        updatedMapping[header] = targetField;
        return { ...sheet, mapping: updatedMapping };
      })
    );
  };

  const handleResetAutoMapping = (sheetId: string) => {
    setParsedSheets((prev) =>
      prev.map((sheet) =>
        sheet.id === sheetId
          ? { ...sheet, mapping: autoRecommendColumnMapping(sheet.headers) }
          : sheet
      )
    );
  };

  const activeSheet = useMemo(
    () => parsedSheets.find((s) => s.id === activeSheetId) || parsedSheets[0] || null,
    [parsedSheets, activeSheetId]
  );

  const allMappedRawInputs = useMemo(() => {
    const result: { raw: RawApplicantInput; sheetName: string }[] = [];
    for (const sheet of parsedSheets) {
      for (const row of sheet.rows) {
        const rawInput: RawApplicantInput = {
          sourceFileName: sheet.fileName,
        };

        for (const header of sheet.headers) {
          const field = sheet.mapping[header];
          if (!field || field === 'ignore') continue;
          const cellValue = row[header];
          rawInput[field] = cellValue;
        }

        const hasAnyValue =
          rawInput.name || rawInput.phone || rawInput.email || rawInput.position;
        if (hasAnyValue) {
          result.push({ raw: rawInput, sheetName: sheet.fileName });
        }
      }
    }
    return result;
  }, [parsedSheets]);

  const previewRows = useMemo(() => {
    if (!activeSheet) return [];
    const top10 = activeSheet.rows.slice(0, 10);
    const comparisonPool: Applicant[] = [...existingApplicants];

    return top10.map((row, idx) => {
      const rawInput: RawApplicantInput = {
        id: `preview_${idx}`,
        sourceFileName: activeSheet.fileName,
      };
      for (const header of activeSheet.headers) {
        const field = activeSheet.mapping[header];
        if (!field || field === 'ignore') continue;
        rawInput[field] = row[header];
      }

      const normalized = buildNormalizedApplicant(rawInput);
      const samePeople = comparisonPool.filter((existing) =>
        isSamePerson(existing, normalized)
      );

      let duplicateStatus: 'new' | 'same_pos_dup' | 'multi_pos' = 'new';
      if (samePeople.length > 0) {
        const posKey = getPositionComparisonKey(normalized.position);
        const samePos = samePeople.some(
          (p) => getPositionComparisonKey(p.position) === posKey
        );
        duplicateStatus = samePos ? 'same_pos_dup' : 'multi_pos';
      }

      comparisonPool.push(normalized);

      return {
        rowNumber: idx + 1,
        rawInput,
        normalized,
        duplicateStatus,
      };
    });
  }, [activeSheet, existingApplicants]);

  const handleConfirm = () => {
    if (allMappedRawInputs.length === 0) {
      setErrorMessage(
        '가져올 수 있는 유효한 지원자 행이 없습니다. 이름·연락처·이메일 등의 열 매핑을 확인해 주세요.'
      );
      return;
    }

    const fileNames = parsedSheets.map((s) => s.fileName);
    const summary = onConfirmImport(
      allMappedRawInputs.map((item) => item.raw),
      duplicateMode,
      fileNames
    );
    setLastSummary(summary);
    setParsedSheets([]);
    setActiveSheetId(null);
  };

  return (
    <div className="space-y-6">
      {/* 상단 안내 및 빠른 시작 배너 (파란색 테마) */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            <h1 className="text-lg font-semibold text-slate-900">
              지원자 엑셀·CSV 파일 가져오기
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            원티드, 사람인, 잡코리아 등 채용 사이트 엑셀을 업로드하면 이름, 연락처(010-XXXX-XXXX), 이메일, 경력, 지원일을 표준 형식으로 자동 정리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleSheets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            샘플 파일(2종)로 열 매핑 체험하기
          </button>
          <button
            type="button"
            onClick={downloadSampleRawExcelForTest}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            테스트용 원본 엑셀(.xlsx) 받기
          </button>
          {existingApplicants.length === 0 && (
            <button
              type="button"
              onClick={onLoadSampleApplicants}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              샘플 지원자 22명 바로 불러오기
            </button>
          )}
        </div>
      </div>

      {/* 오류 안내 배너 */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-900"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">파일 확인이 필요합니다</p>
            <p className="mt-1 whitespace-pre-line text-red-800">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium text-red-700 hover:text-red-900 px-2 py-1 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 가져오기 완료 요약 카드 (파란색 포인트) */}
      {lastSummary && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  지원자 데이터 가져오기가 완료되었습니다 ({lastSummary.timestamp})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  처리된 파일: {lastSummary.fileNames.join(', ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToList}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer shadow-xs"
            >
              지원자 목록에서 확인하기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-blue-200/80">
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-xs text-slate-500">전체 처리 인원</div>
              <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums">
                전체 {lastSummary.totalRows}명
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-xs text-slate-500">신규 등록 인원</div>
              <div className="text-xl font-semibold text-blue-700 mt-1 tabular-nums">
                신규 {lastSummary.newCount}명
              </div>
              {lastSummary.multiPositionCount > 0 && (
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  복수 포지션 지원 {lastSummary.multiPositionCount}명 포함
                </div>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-xs text-slate-500">동일 포지션 중복</div>
              <div className="text-xl font-semibold text-amber-700 mt-1 tabular-nums">
                중복 {lastSummary.duplicateCount}명
              </div>
              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                병합 {lastSummary.mergedCount}명 · 건너뜀 {lastSummary.skippedCount}명
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-xs text-slate-500">연락처·이메일 형식 오류</div>
              <div className="text-xl font-semibold text-red-600 mt-1 tabular-nums">
                형식 오류 {lastSummary.formatErrorCount}명
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                목록에서 즉시 수정 가능
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1단계: 드래그앤드롭 업로드 영역 (파란색 테두리/포인트) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              void handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-900">
          엑셀(.xlsx, .xls) 또는 CSV 파일을 이곳에 끌어다 놓거나 클릭하여 선택하세요
        </p>
        <p className="text-xs text-slate-500 mt-1">
          여러 개의 채용 사이트 파일을 동시에 업로드하여 하나의 표준 포맷으로 병합할 수 있습니다
        </p>
      </div>

      {/* 2단계: 파일 및 열 매핑 UI */}
      {parsedSheets.length > 0 && activeSheet && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  1. 업로드된 파일 및 열 매핑 설정
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  파일의 열 이름을 분석하여 표준 항목을 자동 추천했습니다. 필요 시 드롭다운에서 변경하세요.
                </p>
              </div>

              {/* 중복 지원 처리 방식 */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-md border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">
                  동일 포지션 중복 지원자 처리:
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === 'merge'}
                    onChange={() => setDuplicateMode('merge')}
                    className="accent-blue-600"
                  />
                  <span>기존 정보에 병합 (추천)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === 'skip'}
                    onChange={() => setDuplicateMode('skip')}
                    className="accent-blue-600"
                  />
                  <span>건너뛰기 (중복 제외)</span>
                </label>
              </div>
            </div>

            {/* 업로드 파일 탭 */}
            <div className="flex flex-wrap items-center gap-2">
              {parsedSheets.map((sheet) => {
                const isActive = sheet.id === activeSheet.id;
                return (
                  <div
                    key={sheet.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSheetId(sheet.id)}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{sheet.fileName}</span>
                      <span
                        className={`tabular-nums ${
                          isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        ({sheet.rows.length}행)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSheet(sheet.id)}
                      title="파일 제거"
                      className={`p-0.5 rounded hover:bg-white/20 cursor-pointer ${
                        isActive ? 'text-blue-100 hover:text-white' : 'text-slate-400 hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => handleResetAutoMapping(activeSheet.id)}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 border border-slate-200 rounded-md bg-white hover:bg-blue-50/50 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                자동 매핑 다시 실행
              </button>
            </div>

            {/* 열 매핑 박스 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {activeSheet.headers.map((header) => {
                const mappedValue = activeSheet.mapping[header] || 'ignore';
                const sampleValue =
                  activeSheet.rows[0]?.[header] !== undefined &&
                  activeSheet.rows[0]?.[header] !== ''
                    ? String(activeSheet.rows[0][header])
                    : '(빈 값)';

                return (
                  <div
                    key={header}
                    className={`p-3.5 rounded-md border transition-colors ${
                      mappedValue !== 'ignore'
                        ? 'bg-blue-50/40 border-blue-200'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="text-xs font-semibold text-slate-900 truncate"
                        title={header}
                      >
                        원본 열: {header}
                      </span>
                      <span
                        className={`text-[11px] shrink-0 font-medium ${
                          mappedValue !== 'ignore' ? 'text-blue-700' : 'text-slate-400'
                        }`}
                      >
                        {mappedValue !== 'ignore' ? '연결됨' : '미사용'}
                      </span>
                    </div>
                    <div
                      className="text-xs text-slate-500 truncate mb-2.5 font-mono-tabular"
                      title={sampleValue}
                    >
                      예시: {sampleValue}
                    </div>
                    <select
                      aria-label={`${header} 열 매핑 선택`}
                      value={mappedValue}
                      onChange={(e) =>
                        handleMappingChange(
                          activeSheet.id,
                          header,
                          e.target.value as StandardFieldKey | 'ignore'
                        )
                      }
                      className={`w-full text-xs font-medium rounded-md px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        mappedValue !== 'ignore'
                          ? 'bg-white border-blue-300 text-slate-900'
                          : 'bg-white border-slate-300 text-slate-500'
                      }`}
                    >
                      <option value="ignore">사용 안 함 (제외)</option>
                      {STANDARD_FIELDS.map((field) => (
                        <option key={field.key} value={field.key}>
                          표준 항목: {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3단계: 매핑 미리보기 표 */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  2. 자동 정리 및 매핑 결과 미리보기 ({activeSheet.fileName} · 상위 {previewRows.length}행)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  이름 공백 정리, 010-XXXX-XXXX 하이픈 통일, 이메일 정규화, 경력 숫자 변환, YYYY-MM-DD 날짜 서식이 적용된 미리보기입니다.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-600 tabular-nums">
                  가져올 대상: <strong className="text-slate-900">{allMappedRawInputs.length}명</strong>
                </span>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  가져오기 확정 ({allMappedRawInputs.length}명)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">이름</th>
                    <th className="py-2.5 px-3">연락처 (자동정리)</th>
                    <th className="py-2.5 px-3">이메일 (자동정리)</th>
                    <th className="py-2.5 px-3">지원 포지션</th>
                    <th className="py-2.5 px-3">지원 경로</th>
                    <th className="py-2.5 px-3 text-right">경력(년)</th>
                    <th className="py-2.5 px-3">지원일</th>
                    <th className="py-2.5 px-3">기타 메모</th>
                    <th className="py-2.5 px-3">판정 미리보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {previewRows.map(({ rowNumber, normalized, duplicateStatus }) => (
                    <tr key={rowNumber} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono-tabular">
                        {rowNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {normalized.name}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-mono-tabular whitespace-nowrap ${
                          normalized.phoneValid ? 'text-slate-800' : 'text-red-600 font-semibold'
                        }`}
                      >
                        {normalized.phone || '-'}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-mono-tabular whitespace-nowrap ${
                          normalized.emailValid ? 'text-slate-800' : 'text-red-600 font-semibold'
                        }`}
                      >
                        {normalized.email || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                        {normalized.position}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {normalized.source}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800 whitespace-nowrap">
                        {normalized.experience === 0 ? '신입(0)' : `${normalized.experience}년`}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-mono-tabular whitespace-nowrap ${
                          normalized.appliedDateValid ? 'text-slate-700' : 'text-red-600 font-semibold'
                        }`}
                      >
                        {normalized.appliedDate}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                        {normalized.memo || '-'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          {duplicateStatus === 'same_pos_dup' && (
                            <span className="text-amber-700 font-semibold">
                              중복 지원 ({duplicateMode === 'merge' ? '병합' : '제외'})
                            </span>
                          )}
                          {duplicateStatus === 'multi_pos' && (
                            <span className="text-blue-700 font-semibold">
                              복수 포지션 지원
                            </span>
                          )}
                          {duplicateStatus === 'new' && !normalized.hasFormatError && (
                            <span className="text-emerald-700">신규 정상</span>
                          )}
                          {normalized.hasFormatError && (
                            <span className="text-red-600 font-semibold">
                              {normalized.warnings.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
