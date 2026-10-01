import React, { useState, useMemo } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import {
  Applicant,
  APPLICANT_STATUSES,
  ApplicantStatus,
} from '../types/applicant';
import { exportContactTargetsToExcel } from '../utils/excelService';

interface ContactExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicants: Applicant[];
}

export const ContactExportModal: React.FC<ContactExportModalProps> = ({
  isOpen,
  onClose,
  applicants,
}) => {
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicantStatus[]>([
    '최종 합격',
  ]);
  const [includeExtra, setIncludeExtra] = useState(false);
  const [copiedType, setCopiedType] = useState<'email' | 'phone' | null>(null);

  const statusCounts = useMemo(() => {
    const map: Record<ApplicantStatus, number> = {
      '심사 중': 0,
      '최종 합격': 0,
      '예비 합격': 0,
      '불합격': 0,
    };
    for (const app of applicants) {
      map[app.status] = (map[app.status] || 0) + 1;
    }
    return map;
  }, [applicants]);

  const targetList = useMemo(
    () => applicants.filter((app) => selectedStatuses.includes(app.status)),
    [applicants, selectedStatuses]
  );

  if (!isOpen) return null;

  const toggleStatus = (status: ApplicantStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleExport = () => {
    if (targetList.length === 0) return;
    exportContactTargetsToExcel(applicants, selectedStatuses, includeExtra);
    onClose();
  };

  const handleCopyField = async (type: 'email' | 'phone') => {
    const values = targetList
      .map((app) => (type === 'email' ? app.email : app.phone))
      .filter(Boolean)
      .join(type === 'email' ? ', ' : '\n');
    if (!values) return;
    try {
      await navigator.clipboard.writeText(values);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                연락 대상 명단 추출 (성명 · 연락처 · 응시번호 · 이메일 · 모집구분)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                합격 안내 또는 면접 알림을 위해 특정 합격여부 상태 응시자의 연락처만 간추려 엑셀로 저장합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. 추출할 지원자 상태 선택 (복수 선택 가능)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {APPLICANT_STATUSES.map((status) => {
                const isSelected = selectedStatuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-600 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-medium">{status}</div>
                    <div className="text-base font-semibold mt-0.5 tabular-nums">
                      {statusCounts[status]}명
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExtra}
                onChange={(e) => setIncludeExtra(e.target.checked)}
                className="rounded border-slate-300 accent-blue-600"
              />
              <span>기본 4개 항목 외 상태 · 태그 · 메모 열도 함께 포함</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={targetList.length === 0}
                onClick={() => void handleCopyField('email')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                {copiedType === 'email' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    이메일 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    이메일만 복사
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={targetList.length === 0}
                onClick={() => void handleCopyField('phone')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                {copiedType === 'phone' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    연락처 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    연락처만 복사
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>추출 대상 미리보기</span>
              <span className="font-semibold text-blue-700 tabular-nums">
                총 {targetList.length}명
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {targetList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  선택한 상태에 해당하는 지원자가 없습니다.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-white">
                      <th className="py-2 px-3">성명</th>
                      <th className="py-2 px-3">연락처</th>
                      <th className="py-2 px-3">응시번호</th>
                      <th className="py-2 px-3">이메일</th>
                      <th className="py-2 px-3">모집구분</th>
                      <th className="py-2 px-3">최종합격여부</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {targetList.map((app) => (
                      <tr key={app.id} className="hover:bg-blue-50/30">
                        <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {app.name}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {app.phone}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {app.examNumber}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {app.email}
                        </td>
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap font-medium">
                          {app.recruitmentCategory}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-medium">
                          {app.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            disabled={targetList.length === 0}
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            연락 대상 엑셀(.xlsx) 저장 ({targetList.length}명)
          </button>
        </div>
      </div>
    </div>
  );
};
