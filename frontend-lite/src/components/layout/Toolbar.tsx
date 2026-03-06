"use client";

import { useEffect, useRef, useState } from "react";
import { months } from "@/lib/months";

type ToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  yearOptions: number[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  canManage: boolean;
  canAdmin: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
  onOpenAddMemberModal: () => void;
  onOpenContributionModal: () => void;
  onOpenIssueOverdraftModal: () => void;
  onOpenDividendModal: () => void;
};

export default function Toolbar({
  search,
  onSearch,
  selectedYear,
  onYearChange,
  yearOptions,
  selectedMonth,
  onMonthChange,
  canManage,
  canAdmin,
  showArchived,
  onToggleArchived,
  onOpenAddMemberModal,
  onOpenContributionModal,
  onOpenIssueOverdraftModal,
  onOpenDividendModal,
}: ToolbarProps) {
  const [operationsOpen, setOperationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!dropdownRef.current) return;
      const target = event.target as Node;
      if (!dropdownRef.current.contains(target)) {
        setOperationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="search-box search-box-wide">
          <i className="fas fa-search" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search members, account, status..."
          />
        </div>

        <div className="filter-group">
          <select className="form-select filter-select" value={selectedYear} onChange={(event) => onYearChange(Number(event.target.value))}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select className="form-select filter-select" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)}>
            <option value="">All Months</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="toolbar-right">
        {canManage && (
          <>
            <button className="btn btn-primary" onClick={onOpenAddMemberModal} type="button">
              <i className="fas fa-user-plus" /> Add Member
            </button>
            <button className="btn btn-primary" onClick={onOpenContributionModal} type="button">
              <i className="fas fa-hand-holding-usd" /> Record Contribution
            </button>
            <button className="btn btn-secondary btn-soft" onClick={onOpenIssueOverdraftModal} type="button">
              <i className="fas fa-money-check-dollar" /> Issue Overdraft
            </button>
          </>
        )}

        <div className="dropdown" ref={dropdownRef}>
          <button className="btn btn-secondary dropdown-btn" id="btnOperations" onClick={() => setOperationsOpen((current) => !current)} type="button">
            <i className="fas fa-ellipsis-v" /> Operations
          </button>
          <div className={`dropdown-content ${operationsOpen ? "show" : ""}`}>
            {canManage && (
              <button
                className="dropdown-item"
                onClick={() => {
                  onOpenDividendModal();
                  setOperationsOpen(false);
                }}
                type="button"
              >
                <i className="fas fa-calculator text-success" /> Calculate Dividends
              </button>
            )}
            {canAdmin && (
              <button
                className="dropdown-item"
                onClick={() => {
                  onToggleArchived();
                  setOperationsOpen(false);
                }}
                type="button"
              >
                <i className="fas fa-archive text-muted" />{" "}
                {showArchived ? "Hide Archived" : "Show Archived"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
