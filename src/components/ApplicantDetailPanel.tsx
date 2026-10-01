import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Wand2,
  GitMerge,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  Applicant,
  APPLICANT_STATUSES,
  ApplicantStatus,
} from '../types/applicant';
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeScore,
} from '../utils/normalizers';
import { getCategoryComparisonKey } from '../utils/duplicateDetector';

interface ApplicantDetailPanelProps {
  applicant: Applicant | null;
  allApplicants: Applicant[];
  orderedFilteredIds: string[];
  onClose?: () => void;
  onSelectApplicant: (id: string) => void;
  onUpdateApplicant: (id: string, updates: Partial<Applicant>) => void;
  onDeleteApplicant: (id: string) => void;
  onMergeWithRelated: (primaryId: string, secondaryId: string) => void;
  isStandaloneTab?: boolean;
}

const STATUS_BUTTON_STYLES: Record<
  ApplicantStatus,
  { active: string; inactive: string }
> = {
  '심사 중': {
    active: 'bg-slate-800 text-white border-slate-800 shadow-xs',
    inactive: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
  },
  '최종 합격': {
    active: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    inactive: 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50',
  },
  '예비 합격': {
    active: 'bg-amber-500 text-white border-amber-500 shadow-xs',
    inactive: 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50',
  },
  '불합격': {
    active: 'bg-rose-600 text-white border-rose-600 shadow-xs',
    inactive: 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50',
  },
};

export const ApplicantDetailPanel: React.FC<ApplicantDetailPanelProps> = ({
  applicant,
  allApplicants,
  orderedFilteredIds,
  onClose,
  onSelectApplicant,
  onUpdateApplicant,
  onDeleteApplicant,
  onMergeWithRelated,
  isStandaloneTab = false,
}) => {
  const [newTag, setNewTag] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    setNewTag('');
  }, [applicant?.id]);

  if (!applicant) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
        <p className="text-sm font-medium text-slate-700">
          선택된 응시자가 없습니다.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          응시자 목록에서 행을 클릭하면 이곳에 13개 전체 항목 상세 정보와 중복 지원 내역이 표시됩니다.
        </p>
      </div>
    );
  }

  const currentIndex = orderedFilteredIds.indexOf(applicant.id);
  const prevId = currentIndex > 0 ? orderedFilteredIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < orderedFilteredIds.length - 1
      ? orderedFilteredIds[currentIndex + 1]
      : null;

  const relatedApplicants = allApplicants.filter((other) =>
    applicant.relatedApplicantIds.includes(other.id)
  );

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (!applicant.tags.includes(trimmed)) {
      onUpdateApplicant(applicant.id, {
        tags: [...applicant.tags, trimmed],
      });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateApplicant(applicant.id, {
      tags: applicant.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAutoNormalizeCurrent = () => {
    const cleanName = normalizeName(applicant.name) || applicant.name;
    const phoneRes = normalizePhone(applicant.phone);
    const emailRes = normalizeEmail(applicant.email);

    onUpdateApplicant(applicant.id, {
      name: cleanName,
      phone: phoneRes.value,
      email: emailRes.value,
    });
  };

  const content = (
    <div className="flex flex-col h-full bg-white">
      {/* 상단 네비게이션 및 닫기 바 */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevId}
            onClick={() => prevId && onSelectApplicant(prevId)}
            title="이전 응시자"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            이전
          </button>
          <span className="text-xs text-slate-500 font-mono-tabular px-1">
            {currentIndex >= 0
              ? `${currentIndex + 1} / ${orderedFilteredIds.length}`
              : `- / ${orderedFilteredIds.length}`}
          </span>
          <button
            type="button"
            disabled={!nextId}
            onClick={() => nextId && onSelectApplicant(nextId)}
            title="다음 응시자"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            다음
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoNormalizeCurrent}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-blue-600" />
            성명·연락처 정제 재적용
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              aria-label="상세 화면 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              <h2 className="text-xl font-bold text-slate-900">
                {applicant.name}
              </h2>
              <span className="text-sm text-slate-400">·</span>
              <span className="text-sm font-mono-tabular font-semibold text-blue-700">
                {applicant.examNumber}
              </span>
              <span className="text-sm text-slate-400">·</span>
              <span className="text-sm font-semibold text-slate-700">
                {applicant.recruitmentCategory}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
              <span>연락처: {applicant.phone}</span>
              <span>·</span>
              <span>이메일: {applicant.email}</span>
              {applicant.sourceFileName && (
                <>
                  <span>·</span>
                  <span>파일: {applicant.sourceFileName}</span>
                </>
              )}
            </div>

            {(applicant.hasFormatError ||
              applicant.isSamePositionDuplicate ||
              applicant.isMultiPositionApplicant) && (
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                {applicant.isSamePositionDuplicate && (
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    [주의] 동일 모집구분 중복 접수 내역이 있습니다
                  </span>
                )}
                {applicant.isMultiPositionApplicant && (
                  <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    [참고] 다른 모집구분에도 복수 응시한 내역이 있습니다
                  </span>
                )}
                {applicant.warnings.map((w) => (
                  <span key={w} className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    [확인필요] {w}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0">
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              최종합격여부 설정
            </div>
            <div className="inline-flex rounded-md p-0.5 bg-slate-100 border border-slate-200 gap-1">
              {APPLICANT_STATUSES.map((st) => {
                const isSelected = applicant.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onUpdateApplicant(applicant.id, { status: st })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer border ${
                      isSelected
                        ? STATUS_BUTTON_STYLES[st].active
                        : STATUS_BUTTON_STYLES[st].inactive
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 1. 인적사항 섹션 */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            기본 인적사항 (성명 · 연락처 · 응시번호 · 이메일 · 주소)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                성명
              </label>
              <input
                type="text"
                value={applicant.name}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { name: e.target.value })
                }
                onBlur={(e) =>
                  onUpdateApplicant(applicant.id, {
                    name: normalizeName(e.target.value) || e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                응시번호 (수험번호)
              </label>
              <input
                type="text"
                value={applicant.examNumber}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { examNumber: e.target.value.trim().toUpperCase() })
                }
                placeholder="ADM-2026-0001"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">
                  연락처 (010-XXXX-XXXX)
                </label>
                {applicant.phoneValid ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" /> 정상 형식
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> 연락처 오류
                  </span>
                )}
              </div>
              <input
                type="text"
                value={applicant.phone}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { phone: e.target.value })
                }
                onBlur={(e) => {
                  const res = normalizePhone(e.target.value);
                  if (res.isValid) {
                    onUpdateApplicant(applicant.id, { phone: res.value });
                  }
                }}
                placeholder="010-1234-5678"
                className={`w-full px-3 py-2 text-sm font-mono-tabular border rounded-md focus:outline-none focus:ring-2 ${
                  applicant.phoneValid
                    ? 'border-slate-300 focus:ring-blue-500'
                    : 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">
                  이메일
                </label>
                {applicant.emailValid ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" /> 정상 형식
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> 이메일 오류
                  </span>
                )}
              </div>
              <input
                type="text"
                value={applicant.email}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { email: e.target.value })
                }
                onBlur={(e) => {
                  const res = normalizeEmail(e.target.value);
                  onUpdateApplicant(applicant.id, { email: res.value });
                }}
                placeholder="example@domain.com"
                className={`w-full px-3 py-2 text-sm font-mono-tabular border rounded-md focus:outline-none focus:ring-2 ${
                  applicant.emailValid
                    ? 'border-slate-300 focus:ring-blue-500'
                    : 'border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500'
                }`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                주소 (거주지 / 도로명주소)
              </label>
              <input
                type="text"
                value={applicant.address}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { address: e.target.value })
                }
                placeholder="서울특별시 서초구 반포대로 ..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 2. 모집 및 편의지원·자격 정보 섹션 */}
        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            모집 및 편의지원 · 가산 자격 (모집구분 · 편의지원 · 장애인 · 저소득 · 한국사)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                모집구분 (응시분야)
              </label>
              <input
                type="text"
                value={applicant.recruitmentCategory}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { recruitmentCategory: e.target.value })
                }
                className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                편의지원 신청
              </label>
              <input
                type="text"
                value={applicant.supportNeeds}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { supportNeeds: e.target.value })
                }
                placeholder="해당없음, 확대문제지, 별도시험실 등"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                한국사 (한능검 급수)
              </label>
              <input
                type="text"
                value={applicant.historyScore}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { historyScore: e.target.value })
                }
                placeholder="1급, 2급, 해당없음 등"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                장애인 구분
              </label>
              <input
                type="text"
                value={applicant.disabilityStatus}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { disabilityStatus: e.target.value })
                }
                placeholder="비대상, 대상(경증), 대상(중증)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                저소득 구분
              </label>
              <input
                type="text"
                value={applicant.lowIncomeStatus}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, { lowIncomeStatus: e.target.value })
                }
                placeholder="비대상, 수급자, 차상위, 한부모"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 3. 전형 성적 섹션 */}
        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            전형 성적 (필기점수 · 면접점수)
          </h3>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                필기점수
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={applicant.writtenScore !== null ? applicant.writtenScore : ''}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, {
                    writtenScore: normalizeScore(e.target.value),
                  })
                }
                placeholder="점수 입력 (예: 92.5)"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                면접점수
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={applicant.interviewScore !== null ? applicant.interviewScore : ''}
                onChange={(e) =>
                  onUpdateApplicant(applicant.id, {
                    interviewScore: normalizeScore(e.target.value),
                  })
                }
                placeholder="점수 입력 (예: 94.0)"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* 4. 태그 및 비고 */}
        <div className="pt-2 border-t border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              태그 관리
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {applicant.tags.length === 0 && (
                <span className="text-xs text-slate-400">
                  등록된 태그가 없습니다.
                </span>
              )}
              {applicant.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 hover:text-red-700 cursor-pointer"
                    title={`${tag} 태그 삭제`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddTag} className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="새 태그 입력 (예: 필기수석, 증빙확인)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                태그 추가
              </button>
            </form>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              비고 (특이사항 및 메모)
            </label>
            <textarea
              rows={3}
              value={applicant.memo}
              onChange={(e) =>
                onUpdateApplicant(applicant.id, { memo: e.target.value })
              }
              placeholder="자격 서류 검증, 편의제공 배정실, 비고사항 등을 기록하세요."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>
        </div>

        {/* 5. 동일인 중복 지원 내역 */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                동일인 의심 다른 접수 내역 ({relatedApplicants.length}건)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                동일한 응시번호, 연락처, 또는 이메일로 접수된 다른 내역입니다.
              </p>
            </div>
          </div>

          {relatedApplicants.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-xs text-slate-500">
              동일한 응시번호나 연락처, 이메일로 접수된 다른 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {relatedApplicants.map((rel) => {
                const isSameCat =
                  getCategoryComparisonKey(rel.recruitmentCategory) ===
                  getCategoryComparisonKey(applicant.recruitmentCategory);
                return (
                  <div
                    key={rel.id}
                    className="p-3.5 rounded-md border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          {rel.name}
                        </span>
                        <span>·</span>
                        <span className="font-mono-tabular font-semibold text-slate-800">
                          {rel.examNumber}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-slate-800">
                          {rel.recruitmentCategory}
                        </span>
                        <span>·</span>
                        <span
                          className={
                            isSameCat
                              ? 'text-amber-700 font-semibold'
                              : 'text-blue-700 font-semibold'
                          }
                        >
                          {isSameCat ? '동일 모집구분 중복' : '복수 모집구분 지원'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                        <span>필기: {rel.writtenScore !== null ? rel.writtenScore : '-'}</span>
                        <span>·</span>
                        <span>면접: {rel.interviewScore !== null ? rel.interviewScore : '-'}</span>
                        <span>·</span>
                        <span>최종결과: {rel.status}</span>
                      </div>
                      {rel.memo && (
                        <p className="text-xs text-slate-600 line-clamp-1">
                          비고: {rel.memo}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectApplicant(rel.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        이 내역 열기
                      </button>
                      <button
                        type="button"
                        onClick={() => onMergeWithRelated(applicant.id, rel.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 whitespace-nowrap cursor-pointer"
                      >
                        <GitMerge className="w-3 h-3" />
                        현재 응시자로 병합
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            이 응시자 삭제
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-700 font-semibold">
              정말 삭제하시겠습니까?
            </span>
            <button
              type="button"
              onClick={() => onDeleteApplicant(applicant.id)}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 cursor-pointer"
            >
              삭제 확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
            >
              취소
            </button>
          </div>
        )}

        <span className="text-xs text-slate-400">
          모든 변경 내용은 브라우저에 실시간 저장됩니다
        </span>
      </div>
    </div>
  );

  if (isStandaloneTab) {
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};
