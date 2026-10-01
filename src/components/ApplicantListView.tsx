import React, { useState } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Plus,
  Sparkles,
  Upload,
  CheckSquare,
} from 'lucide-react';
import {
  Applicant,
  APPLICANT_STATUSES,
  ApplicantStatus,
  FilterState,
  SortField,
  SortState,
} from '../types/applicant';
import {
  exportApplicantsToCsv,
  exportApplicantsToExcel,
} from '../utils/excelService';

interface ApplicantListViewProps {
  allApplicants: Applicant[];
  filteredApplicants: Applicant[];
  filter: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onResetFilter: () => void;
  sort: SortState;
  onToggleSort: (field: SortField) => void;
  selectedIds: Set<string>;
  onToggleSelectOne: (id: string) => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onUpdateApplicant: (id: string, updates: Partial<Applicant>) => void;
  onBulkStatusChange: (status: ApplicantStatus) => void;
  onBulkAddTag: (tag: string) => void;
  onBulkDeleteSelected: () => void;
  onOpenDetail: (id: string) => void;
  onOpenContactExport: () => void;
  onLoadSampleData: () => void;
  onGoToImport: () => void;
}

const STATUS_SELECT_STYLES: Record<ApplicantStatus, string> = {
  '심사 중': 'bg-slate-100 text-slate-800 border-slate-300',
  '최종 합격': 'bg-emerald-50 text-emerald-800 border-emerald-300',
  '예비 합격': 'bg-amber-50 text-amber-800 border-amber-300',
  '불합격': 'bg-rose-50 text-rose-800 border-rose-300',
};

export const ApplicantListView: React.FC<ApplicantListViewProps> = ({
  allApplicants,
  filteredApplicants,
  filter,
  onFilterChange,
  onResetFilter,
  sort,
  onToggleSort,
  selectedIds,
  onToggleSelectOne,
  onToggleSelectAllFiltered,
  onClearSelection,
  onUpdateApplicant,
  onBulkStatusChange,
  onBulkAddTag,
  onBulkDeleteSelected,
  onOpenDetail,
  onOpenContactExport,
  onLoadSampleData,
  onGoToImport,
}) => {
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [inlineTagInputs, setInlineTagInputs] = useState<Record<string, string>>({});
  const [activeTagRowId, setActiveTagRowId] = useState<string | null>(null);

  const statusSummary = React.useMemo(() => {
    const counts: Record<ApplicantStatus, number> = {
      '심사 중': 0,
      '최종 합격': 0,
      '예비 합격': 0,
      '불합격': 0,
    };
    let duplicateSuspectCount = 0;
    let formatErrorCount = 0;

    for (const app of allApplicants) {
      counts[app.status] = (counts[app.status] || 0) + 1;
      if (app.isSamePositionDuplicate || app.isMultiPositionApplicant) {
        duplicateSuspectCount++;
      }
      if (app.hasFormatError) {
        formatErrorCount++;
      }
    }
    return { counts, duplicateSuspectCount, formatErrorCount };
  }, [allApplicants]);

  const filterOptions = React.useMemo(() => {
    const categories = new Set<string>();
    const disabilities = new Set<string>();
    const lowIncomes = new Set<string>();
    const supportNeeds = new Set<string>();
    const tags = new Set<string>();

    for (const app of allApplicants) {
      if (app.recruitmentCategory) categories.add(app.recruitmentCategory);
      if (app.disabilityStatus && app.disabilityStatus !== '비대상') {
        disabilities.add(app.disabilityStatus);
      }
      if (app.lowIncomeStatus && app.lowIncomeStatus !== '비대상') {
        lowIncomes.add(app.lowIncomeStatus);
      }
      if (app.supportNeeds && app.supportNeeds !== '해당없음') {
        supportNeeds.add(app.supportNeeds);
      }
      app.tags.forEach((t) => tags.add(t));
    }

    return {
      categories: Array.from(categories).sort(),
      disabilities: Array.from(disabilities).sort(),
      lowIncomes: Array.from(lowIncomes).sort(),
      supportNeeds: Array.from(supportNeeds).sort(),
      tags: Array.from(tags).sort(),
    };
  }, [allApplicants]);

  if (allApplicants.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          아직 등록된 응시자 데이터가 없습니다
        </h2>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          채용 사이트 및 접수대장 엑셀·CSV 파일을 업로드하거나,
          준비된 22명의 가상 응시자 샘플 데이터를 불러와 즉시 확인해 보세요.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={onLoadSampleData}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            샘플 데이터 불러오기 (응시자 22명)
          </button>
          <button
            type="button"
            onClick={onGoToImport}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            엑셀 / CSV 파일 직접 업로드
          </button>
        </div>
      </div>
    );
  }

  const allFilteredSelected =
    filteredApplicants.length > 0 &&
    filteredApplicants.every((app) => selectedIds.has(app.id));

  const hasActiveFilters =
    filter.search.trim() !== '' ||
    filter.recruitmentCategory !== 'all' ||
    filter.status !== 'all' ||
    filter.disabilityFilter !== 'all' ||
    filter.lowIncomeFilter !== 'all' ||
    filter.supportNeedsFilter !== 'all' ||
    filter.tag !== 'all' ||
    filter.onlyDuplicates ||
    filter.onlyFormatErrors;

  const renderSortIcon = (field: SortField) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  const handleInlineAddTag = (applicant: Applicant) => {
    const raw = (inlineTagInputs[applicant.id] || '').trim();
    if (!raw) {
      setActiveTagRowId(null);
      return;
    }
    if (!applicant.tags.includes(raw)) {
      onUpdateApplicant(applicant.id, {
        tags: [...applicant.tags, raw],
      });
    }
    setInlineTagInputs((prev) => ({ ...prev, [applicant.id]: '' }));
    setActiveTagRowId(null);
  };

  const handleInlineRemoveTag = (applicant: Applicant, tag: string) => {
    onUpdateApplicant(applicant.id, {
      tags: applicant.tags.filter((t) => t !== tag),
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 요약 카드 (최종합격여부별 집계) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => onFilterChange({ status: 'all' })}
          className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
            filter.status === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div
            className={`text-xs font-medium ${
              filter.status === 'all' ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            전체 응시자
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {allApplicants.length}명
          </div>
        </button>

        {APPLICANT_STATUSES.map((st) => {
          const isSelected = filter.status === st;
          const count = statusSummary.counts[st];
          return (
            <button
              key={st}
              type="button"
              onClick={() =>
                onFilterChange({ status: isSelected ? 'all' : st })
              }
              className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div
                className={`text-xs font-medium flex items-center justify-between ${
                  isSelected ? 'text-blue-100' : 'text-slate-500'
                }`}
              >
                <span>{st}</span>
                <span className="text-[11px]">
                  {isSelected ? '필터 적용됨' : '클릭하여 필터'}
                </span>
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                {count}명
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. 검색 및 컨트롤 바 */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="성명, 연락처, 응시번호, 이메일, 주소, 모집구분 통합 검색..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenContactExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              연락 대상 추출
            </button>
            <button
              type="button"
              disabled={filteredApplicants.length === 0}
              onClick={() => exportApplicantsToExcel(filteredApplicants)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              엑셀(.xlsx) 저장 ({filteredApplicants.length}명)
            </button>
            <button
              type="button"
              disabled={filteredApplicants.length === 0}
              onClick={() => exportApplicantsToCsv(filteredApplicants)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV 저장 (UTF-8 BOM)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <select
            aria-label="모집구분 필터"
            value={filter.recruitmentCategory}
            onChange={(e) => onFilterChange({ recruitmentCategory: e.target.value })}
            className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">모든 모집구분</option>
            {filterOptions.categories.map((cat) => (
              <option key={cat} value={cat}>
                구분: {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="최종합격여부 필터"
            value={filter.status}
            onChange={(e) =>
              onFilterChange({
                status: e.target.value as ApplicantStatus | 'all',
              })
            }
            className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="all">모든 최종합격여부</option>
            {APPLICANT_STATUSES.map((st) => (
              <option key={st} value={st}>
                결과: {st}
              </option>
            ))}
          </select>

          {filterOptions.disabilities.length > 0 && (
            <select
              aria-label="장애인 구분 필터"
              value={filter.disabilityFilter}
              onChange={(e) => onFilterChange({ disabilityFilter: e.target.value })}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">장애인: 전체</option>
              {filterOptions.disabilities.map((d) => (
                <option key={d} value={d}>
                  장애: {d}
                </option>
              ))}
            </select>
          )}

          {filterOptions.lowIncomes.length > 0 && (
            <select
              aria-label="저소득 구분 필터"
              value={filter.lowIncomeFilter}
              onChange={(e) => onFilterChange({ lowIncomeFilter: e.target.value })}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">저소득: 전체</option>
              {filterOptions.lowIncomes.map((li) => (
                <option key={li} value={li}>
                  저소득: {li}
                </option>
              ))}
            </select>
          )}

          {filterOptions.supportNeeds.length > 0 && (
            <select
              aria-label="편의지원 필터"
              value={filter.supportNeedsFilter}
              onChange={(e) => onFilterChange({ supportNeedsFilter: e.target.value })}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">편의지원: 전체</option>
              {filterOptions.supportNeeds.map((sn) => (
                <option key={sn} value={sn}>
                  편의지원: {sn}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() =>
              onFilterChange({ onlyDuplicates: !filter.onlyDuplicates })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              filter.onlyDuplicates
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>중복 의심만 보기</span>
            <span className="tabular-nums">
              ({statusSummary.duplicateSuspectCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onFilterChange({ onlyFormatErrors: !filter.onlyFormatErrors })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              filter.onlyFormatErrors
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>형식 오류만 보기</span>
            <span className="tabular-nums">
              ({statusSummary.formatErrorCount})
            </span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilter}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 3. 일괄 작업 바 */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 text-xs">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="font-semibold tabular-nums text-blue-100">
              {selectedIds.size}명 선택됨
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-slate-300 hover:text-white underline ml-1 cursor-pointer"
            >
              선택 해제
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-300">최종결과 일괄 변경:</span>
              {APPLICANT_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onBulkStatusChange(st)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-blue-600 text-white rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {st}
                </button>
              ))}
            </div>

            <span className="text-slate-700">|</span>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bulkTagInput.trim()) return;
                onBulkAddTag(bulkTagInput.trim());
                setBulkTagInput('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                placeholder="일괄 태그 입력..."
                className="px-2.5 py-1 text-xs bg-slate-800 text-white border border-slate-700 rounded focus:outline-none focus:border-blue-400 w-36"
              />
              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded whitespace-nowrap cursor-pointer"
              >
                태그 추가
              </button>
            </form>

            <span className="text-slate-700">|</span>

            {!confirmBulkDelete ? (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/40 rounded hover:bg-rose-600 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                선택 삭제
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-rose-300">
                  {selectedIds.size}명을 삭제할까요?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onBulkDeleteSelected();
                    setConfirmBulkDelete(false);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-500 cursor-pointer"
                >
                  확인
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-2 py-1 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. 13개 항목 응시자 메인 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            조회된 응시자{' '}
            <strong className="text-blue-700 tabular-nums">
              {filteredApplicants.length}명
            </strong>{' '}
            (전체 {allApplicants.length}명) · 행을 클릭하면 상세 패널에서 13개 전체 항목 수정 및 중복 내역을 대조할 수 있습니다.
          </div>
        </div>

        {filteredApplicants.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              조건에 맞는 응시자가 없습니다.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              검색어나 필터 조건을 변경하거나 초기화해 보세요.
            </p>
            <button
              type="button"
              onClick={onResetFilter}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              필터 전체 초기화
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 font-semibold text-slate-600 select-none whitespace-nowrap">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="현재 목록 전체 선택"
                      checked={allFilteredSelected}
                      onChange={onToggleSelectAllFiltered}
                      className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>성명</span>
                      {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSort('phone')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>연락처</span>
                      {renderSortIcon('phone')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSort('examNumber')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>응시번호</span>
                      {renderSortIcon('examNumber')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSort('email')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>이메일</span>
                      {renderSortIcon('email')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 min-w-[130px]">주소</th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onToggleSort('recruitmentCategory')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>모집구분</span>
                      {renderSortIcon('recruitmentCategory')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">편의지원</th>
                  <th className="py-2.5 px-3">장애인</th>
                  <th className="py-2.5 px-3">저소득</th>
                  <th className="py-2.5 px-3">한국사</th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleSort('writtenScore')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto cursor-pointer"
                    >
                      <span>필기점수</span>
                      {renderSortIcon('writtenScore')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleSort('interviewScore')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto cursor-pointer"
                    >
                      <span>면접점수</span>
                      {renderSortIcon('interviewScore')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>최종합격여부</span>
                      {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 min-w-[140px]">태그</th>
                  <th className="py-2.5 px-3 min-w-[150px]">비고</th>
                  <th className="py-2.5 px-3">검증·중복</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredApplicants.map((app) => {
                  const isChecked = selectedIds.has(app.id);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => onOpenDetail(app.id)}
                      className={`transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/60 hover:bg-blue-50/80'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* 체크박스 */}
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`${app.name} 선택`}
                          checked={isChecked}
                          onChange={() => onToggleSelectOne(app.id)}
                          className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* 성명 */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {app.name}
                      </td>

                      {/* 연락처 */}
                      <td
                        className={`py-2.5 px-3 font-mono-tabular whitespace-nowrap ${
                          app.phoneValid
                            ? 'text-slate-800'
                            : 'text-red-600 font-semibold'
                        }`}
                      >
                        {app.phone || '-'}
                      </td>

                      {/* 응시번호 */}
                      <td className="py-2.5 px-3 font-mono-tabular font-medium text-slate-900 whitespace-nowrap">
                        {app.examNumber}
                      </td>

                      {/* 이메일 */}
                      <td
                        className={`py-2.5 px-3 font-mono-tabular whitespace-nowrap ${
                          app.emailValid
                            ? 'text-slate-700'
                            : 'text-red-600 font-semibold'
                        }`}
                      >
                        {app.email || '-'}
                      </td>

                      {/* 주소 */}
                      <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={app.address}>
                        {app.address || '-'}
                      </td>

                      {/* 모집구분 */}
                      <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                        {app.recruitmentCategory}
                      </td>

                      {/* 편의지원 */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {app.supportNeeds}
                      </td>

                      {/* 장애인 */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {app.disabilityStatus}
                      </td>

                      {/* 저소득 */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {app.lowIncomeStatus}
                      </td>

                      {/* 한국사 */}
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                        {app.historyScore}
                      </td>

                      {/* 필기점수 */}
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800 whitespace-nowrap">
                        {app.writtenScore !== null ? app.writtenScore : '-'}
                      </td>

                      {/* 면접점수 */}
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-800 whitespace-nowrap">
                        {app.interviewScore !== null ? app.interviewScore : '-'}
                      </td>

                      {/* 최종합격여부 드롭다운 */}
                      <td
                        className="py-2 px-3 whitespace-nowrap text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          aria-label={`${app.name} 최종합격여부 변경`}
                          value={app.status}
                          onChange={(e) =>
                            onUpdateApplicant(app.id, {
                              status: e.target.value as ApplicantStatus,
                            })
                          }
                          className={`text-xs font-semibold rounded px-2 py-1 border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                            STATUS_SELECT_STYLES[app.status]
                          }`}
                        >
                          {APPLICANT_STATUSES.map((st) => (
                            <option
                              key={st}
                              value={st}
                              className="bg-white text-slate-900"
                            >
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 태그 */}
                      <td
                        className="py-2 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          {app.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap"
                            >
                              <span>#{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleInlineRemoveTag(app, tag)}
                                className="text-slate-400 hover:text-red-700 cursor-pointer"
                                title="태그 삭제"
                              >
                                ×
                              </button>
                            </span>
                          ))}

                          {activeTagRowId === app.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineTagInputs[app.id] || ''}
                              onChange={(e) =>
                                setInlineTagInputs((prev) => ({
                                  ...prev,
                                  [app.id]: e.target.value,
                                }))
                              }
                              onBlur={() => handleInlineAddTag(app)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleInlineAddTag(app);
                                } else if (e.key === 'Escape') {
                                  setActiveTagRowId(null);
                                }
                              }}
                              placeholder="태그 입력"
                              className="w-20 px-1.5 py-0.5 text-[11px] border border-blue-400 rounded focus:outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveTagRowId(app.id)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-blue-600 px-1 py-0.5 rounded hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                              title="태그 추가"
                            >
                              <Plus className="w-3 h-3" />
                              태그
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 비고(메모) */}
                      <td
                        className="py-2 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          aria-label={`${app.name} 비고 입력`}
                          value={app.memo}
                          onChange={(e) =>
                            onUpdateApplicant(app.id, { memo: e.target.value })
                          }
                          placeholder="비고 입력..."
                          className="w-full min-w-[140px] px-2 py-1 text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded focus:outline-none transition-colors"
                        />
                      </td>

                      {/* 검증 및 중복 */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          {app.isSamePositionDuplicate && (
                            <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              동일직렬 중복
                            </span>
                          )}
                          {app.isMultiPositionApplicant && (
                            <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              복수 응시
                            </span>
                          )}
                          {app.warnings.map((w) => (
                            <span
                              key={w}
                              className="text-red-600 font-semibold inline-flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-200"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {w}
                            </span>
                          ))}
                          {!app.isSamePositionDuplicate &&
                            !app.isMultiPositionApplicant &&
                            app.warnings.length === 0 && (
                              <span className="text-slate-400">-</span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
