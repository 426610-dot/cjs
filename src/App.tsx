import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  Applicant,
  ApplicantStatus,
  DuplicateHandlingMode,
  FilterState,
  ImportSummary,
  SortField,
  SortState,
} from './types/applicant';
import {
  processApplicantImport,
  RawApplicantInput,
  recomputeApplicantsMetadata,
} from './utils/duplicateDetector';
import { generateSampleApplicants } from './utils/sampleData';
import { ImportView } from './components/ImportView';
import { ApplicantListView } from './components/ApplicantListView';
import { ApplicantDetailPanel } from './components/ApplicantDetailPanel';
import { ContactExportModal } from './components/ContactExportModal';

const STORAGE_KEY = 'hr_applicant_unified_manager_v2';

const INITIAL_FILTER: FilterState = {
  search: '',
  recruitmentCategory: 'all',
  status: 'all',
  disabilityFilter: 'all',
  lowIncomeFilter: 'all',
  supportNeedsFilter: 'all',
  tag: 'all',
  onlyDuplicates: false,
  onlyFormatErrors: false,
};

type ActiveTab = 'list' | 'import' | 'detail';

export function App() {
  const [applicants, setApplicants] = useState<Applicant[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as Applicant[];
        if (Array.isArray(parsed)) {
          return recomputeApplicantsMetadata(parsed);
        }
      }
    } catch {
      // ignore
    }
    return generateSampleApplicants();
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('list');
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [sort, setSort] = useState<SortState>({
    field: 'examNumber',
    direction: 'asc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerApplicantId, setDrawerApplicantId] = useState<string | null>(null);
  const [detailTabApplicantId, setDetailTabApplicantId] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
    } catch {
      // ignore
    }
  }, [applicants]);

  const showNotice = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const filteredAndSortedApplicants = useMemo(() => {
    const q = filter.search.trim().toLowerCase();

    const filtered = applicants.filter((app) => {
      if (q) {
        const haystack = [
          app.name,
          app.phone,
          app.examNumber,
          app.email,
          app.address,
          app.recruitmentCategory,
          app.supportNeeds,
          app.disabilityStatus,
          app.lowIncomeStatus,
          app.historyScore,
          app.memo,
          ...app.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (
        filter.recruitmentCategory &&
        filter.recruitmentCategory !== 'all' &&
        app.recruitmentCategory !== filter.recruitmentCategory
      ) {
        return false;
      }

      if (filter.status !== 'all' && app.status !== filter.status) {
        return false;
      }

      if (
        filter.disabilityFilter &&
        filter.disabilityFilter !== 'all' &&
        app.disabilityStatus !== filter.disabilityFilter
      ) {
        return false;
      }

      if (
        filter.lowIncomeFilter &&
        filter.lowIncomeFilter !== 'all' &&
        app.lowIncomeStatus !== filter.lowIncomeFilter
      ) {
        return false;
      }

      if (filter.supportNeedsFilter && filter.supportNeedsFilter !== 'all') {
        if (
          filter.supportNeedsFilter === '신청' &&
          (!app.supportNeeds ||
            app.supportNeeds === '해당없음' ||
            app.supportNeeds === '없음')
        ) {
          return false;
        }
        if (
          filter.supportNeedsFilter === '미신청' &&
          app.supportNeeds &&
          app.supportNeeds !== '해당없음' &&
          app.supportNeeds !== '없음'
        ) {
          return false;
        }
      }

      if (filter.tag && filter.tag !== 'all' && !app.tags.includes(filter.tag)) {
        return false;
      }

      if (
        filter.onlyDuplicates &&
        !app.isSamePositionDuplicate &&
        !app.isMultiPositionApplicant
      ) {
        return false;
      }

      if (filter.onlyFormatErrors && !app.hasFormatError) {
        return false;
      }

      return true;
    });

    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const f = sort.field;
      if (f === 'writtenScore' || f === 'interviewScore') {
        const scoreA = a[f] ?? -999;
        const scoreB = b[f] ?? -999;
        return (scoreA - scoreB) * dir;
      }
      const valA = String(a[f] || '');
      const valB = String(b[f] || '');
      return valA.localeCompare(valB, 'ko-KR') * dir;
    });
  }, [applicants, filter, sort]);

  const orderedFilteredIds = useMemo(
    () => filteredAndSortedApplicants.map((a) => a.id),
    [filteredAndSortedApplicants]
  );

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilter = () => {
    setFilter(INITIAL_FILTER);
  };

  const handleToggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    );
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const allSelected =
        filteredAndSortedApplicants.length > 0 &&
        filteredAndSortedApplicants.every((a) => prev.has(a.id));
      const next = new Set(prev);
      if (allSelected) {
        filteredAndSortedApplicants.forEach((a) => next.delete(a.id));
      } else {
        filteredAndSortedApplicants.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  const handleUpdateApplicant = (id: string, updates: Partial<Applicant>) => {
    setApplicants((prev) => {
      const next = prev.map((app) =>
        app.id === id ? { ...app, ...updates } : app
      );
      return recomputeApplicantsMetadata(next);
    });
  };

  const handleDeleteApplicant = (id: string) => {
    setApplicants((prev) => {
      const next = prev.filter((app) => app.id !== id);
      return recomputeApplicantsMetadata(next);
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (drawerApplicantId === id) {
      setDrawerApplicantId(null);
    }
    if (detailTabApplicantId === id) {
      setDetailTabApplicantId(null);
    }
    showNotice('지원자 정보가 삭제되었습니다.');
  };

  const handleMergeWithRelated = (primaryId: string, secondaryId: string) => {
    setApplicants((prev) => {
      const primary = prev.find((a) => a.id === primaryId);
      const secondary = prev.find((a) => a.id === secondaryId);
      if (!primary || !secondary) return prev;

      const mergedTags = Array.from(new Set([...primary.tags, ...secondary.tags, '중복병합']));
      const mergedMemo = [primary.memo, secondary.memo]
        .filter(Boolean)
        .join(' | [병합] ');

      const updatedPrimary: Applicant = {
        ...primary,
        phone: primary.phoneValid ? primary.phone : secondary.phone,
        email: primary.emailValid ? primary.email : secondary.email,
        address: primary.address || secondary.address,
        supportNeeds:
          primary.supportNeeds && primary.supportNeeds !== '해당없음'
            ? primary.supportNeeds
            : secondary.supportNeeds,
        writtenScore: primary.writtenScore ?? secondary.writtenScore,
        interviewScore: primary.interviewScore ?? secondary.interviewScore,
        tags: mergedTags,
        memo: mergedMemo,
      };

      const remaining = prev
        .filter((a) => a.id !== secondaryId)
        .map((a) => (a.id === primaryId ? updatedPrimary : a));

      return recomputeApplicantsMetadata(remaining);
    });
    showNotice('동일인 응시 데이터가 병합되었습니다.');
  };

  const handleBulkStatusChange = (status: ApplicantStatus) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setApplicants((prev) =>
      prev.map((app) => (selectedIds.has(app.id) ? { ...app, status } : app))
    );
    showNotice(`선택한 ${count}명의 상태를 '${status}'(으)로 변경했습니다.`);
  };

  const handleBulkAddTag = (tag: string) => {
    if (selectedIds.size === 0 || !tag.trim()) return;
    const cleanTag = tag.trim();
    const count = selectedIds.size;
    setApplicants((prev) =>
      prev.map((app) => {
        if (!selectedIds.has(app.id)) return app;
        if (app.tags.includes(cleanTag)) return app;
        return { ...app, tags: [...app.tags, cleanTag] };
      })
    );
    showNotice(`선택한 ${count}명에게 '#${cleanTag}' 태그를 추가했습니다.`);
  };

  const handleBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setApplicants((prev) => {
      const remaining = prev.filter((app) => !selectedIds.has(app.id));
      return recomputeApplicantsMetadata(remaining);
    });
    setSelectedIds(new Set());
    showNotice(`선택한 ${count}명의 지원자를 삭제했습니다.`);
  };

  const handleConfirmImport = (
    rawList: RawApplicantInput[],
    duplicateMode: DuplicateHandlingMode,
    fileNames: string[]
  ): ImportSummary => {
    const { mergedApplicants, summary } = processApplicantImport(
      applicants,
      rawList,
      duplicateMode,
      fileNames
    );
    setApplicants(mergedApplicants);
    showNotice(
      `총 ${summary.totalRows}명 처리 완료 (신규 ${summary.newCount}명, 중복 ${summary.duplicateCount}명)`
    );
    return summary;
  };

  const handleLoadSampleData = () => {
    const samples = generateSampleApplicants();
    setApplicants(samples);
    setFilter(INITIAL_FILTER);
    setSelectedIds(new Set());
    setDetailTabApplicantId(samples[0]?.id || null);
    setActiveTab('list');
    showNotice('가상 지원자 22명 샘플 데이터(중복·형식 오류 포함)를 로드했습니다.');
  };

  const handleResetAllData = () => {
    setApplicants([]);
    setSelectedIds(new Set());
    setDrawerApplicantId(null);
    setDetailTabApplicantId(null);
    setFilter(INITIAL_FILTER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    setIsResetModalOpen(false);
    showNotice('모든 지원자 데이터가 초기화되었습니다.');
  };

  const drawerApplicant = useMemo(
    () => applicants.find((a) => a.id === drawerApplicantId) || null,
    [applicants, drawerApplicantId]
  );

  const activeDetailApplicant = useMemo(() => {
    if (detailTabApplicantId) {
      const found = applicants.find((a) => a.id === detailTabApplicantId);
      if (found) return found;
    }
    return filteredAndSortedApplicants[0] || applicants[0] || null;
  }, [applicants, filteredAndSortedApplicants, detailTabApplicantId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 상단 네비게이션 바 (파란색 테마) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4 shadow-xs">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('list');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span>지원자 데이터 통합 관리자</span>
        </a>

        {/* Zone 2: 3개 화면 네비게이션 탭 */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-blue-700'
            }`}
          >
            1. 파일 가져오기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-blue-700'
            }`}
          >
            2. 지원자 목록 ({applicants.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('detail')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'detail'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-blue-700'
            }`}
          >
            3. 지원자 상세
          </button>
        </nav>

        {/* Zone 3: 액션 버튼 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            샘플 데이터 불러오기
          </button>
          <button
            type="button"
            disabled={applicants.length === 0}
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            전체 초기화
          </button>
        </div>
      </header>

      {/* 알림 토스트 */}
      {toastBanner && (
        <div className="fixed bottom-14 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl border border-slate-700">
          {toastBanner}
        </div>
      )}

      {/* 메인 뷰포트 */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-6">
        {activeTab === 'import' && (
          <ImportView
            existingApplicants={applicants}
            onConfirmImport={handleConfirmImport}
            onNavigateToList={() => setActiveTab('list')}
            onLoadSampleApplicants={handleLoadSampleData}
          />
        )}

        {activeTab === 'list' && (
          <ApplicantListView
            allApplicants={applicants}
            filteredApplicants={filteredAndSortedApplicants}
            filter={filter}
            onFilterChange={handleFilterChange}
            onResetFilter={handleResetFilter}
            sort={sort}
            onToggleSort={handleToggleSort}
            selectedIds={selectedIds}
            onToggleSelectOne={handleToggleSelectOne}
            onToggleSelectAllFiltered={handleToggleSelectAllFiltered}
            onClearSelection={() => setSelectedIds(new Set())}
            onUpdateApplicant={handleUpdateApplicant}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkAddTag={handleBulkAddTag}
            onBulkDeleteSelected={handleBulkDeleteSelected}
            onOpenDetail={(id) => {
              setDrawerApplicantId(id);
              setDetailTabApplicantId(id);
            }}
            onOpenContactExport={() => setIsContactModalOpen(true)}
            onLoadSampleData={handleLoadSampleData}
            onGoToImport={() => setActiveTab('import')}
          />
        )}

        {activeTab === 'detail' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col max-h-[760px] shadow-xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  지원자 순서 목록 ({filteredAndSortedApplicants.length}명)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                >
                  전체 표로 보기
                </button>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {filteredAndSortedApplicants.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    표시할 지원자가 없습니다.
                  </div>
                ) : (
                  filteredAndSortedApplicants.map((item) => {
                    const isCurrent = activeDetailApplicant?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDetailTabApplicantId(item.id)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-slate-900 truncate">
                              {item.name}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-600 truncate">
                              {item.recruitmentCategory}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5 truncate">
                            {item.examNumber} · {item.phone}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-semibold text-slate-700 block">
                            {item.status}
                          </span>
                          {(item.hasFormatError ||
                            item.isSamePositionDuplicate ||
                            item.isMultiPositionApplicant) && (
                            <span className="text-[10px] text-blue-700 font-semibold">
                              {item.hasFormatError
                                ? '형식오류'
                                : item.isSamePositionDuplicate
                                ? '동일분야중복'
                                : '복수지원'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
              <ApplicantDetailPanel
                applicant={activeDetailApplicant}
                allApplicants={applicants}
                orderedFilteredIds={orderedFilteredIds}
                onSelectApplicant={(id) => setDetailTabApplicantId(id)}
                onUpdateApplicant={handleUpdateApplicant}
                onDeleteApplicant={handleDeleteApplicant}
                onMergeWithRelated={handleMergeWithRelated}
                isStandaloneTab
              />
            </div>
          </div>
        )}
      </main>

      {/* 행 클릭 시 열리는 슬라이드 오버 패널 */}
      {drawerApplicant && activeTab === 'list' && (
        <ApplicantDetailPanel
          applicant={drawerApplicant}
          allApplicants={applicants}
          orderedFilteredIds={orderedFilteredIds}
          onClose={() => setDrawerApplicantId(null)}
          onSelectApplicant={(id) => {
            setDrawerApplicantId(id);
            setDetailTabApplicantId(id);
          }}
          onUpdateApplicant={handleUpdateApplicant}
          onDeleteApplicant={handleDeleteApplicant}
          onMergeWithRelated={handleMergeWithRelated}
        />
      )}

      {/* 연락 대상 추출 모달 */}
      <ContactExportModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        applicants={applicants}
      />

      {/* 전체 초기화 확인 모달 */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  모든 지원자 데이터를 초기화할까요?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  현재 브라우저에 저장된 지원자 {applicants.length}명의 목록, 상태, 태그, 메모가 삭제됩니다. 초기화 후에도 샘플 데이터를 다시 불러올 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResetAllData}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer shadow-xs"
              >
                전체 데이터 초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 개인정보 보호 안내 푸터 */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>
              모든 데이터는 이 브라우저 안에서만 처리되며 외부로 전송되지 않습니다.
            </span>
          </div>
          <div className="text-slate-400">
            브라우저 로컬 저장(localStorage) 활성화됨 · 엑셀(.xlsx, .xls), CSV 지원
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
