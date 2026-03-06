"use client";

import { months } from "@/lib/months";

type ToolbarProps = {
  activeView: "contributions" | "overdrafts";
  search: string;
  onSearch: (value: string) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  yearOptions: number[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
};

export default function Toolbar({
  activeView,
  search,
  onSearch,
  selectedYear,
  onYearChange,
  yearOptions,
  selectedMonth,
  onMonthChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="search-box search-box-wide">
          <i className="fas fa-search" />
          <label className="sr-only" htmlFor="toolbarSearch">
            Search records
          </label>
          <input
            onChange={(event) => onSearch(event.target.value)}
            id="toolbarSearch"
            placeholder={
              activeView === "contributions"
                ? "Search members or account number..."
                : "Search member, reason, or status..."
            }
            type="text"
            value={search}
          />
          {search.trim() && (
            <button
              aria-label="Clear search"
              className="search-clear"
              onClick={() => onSearch("")}
              type="button"
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>

        <div className="filter-group">
          <label className="sr-only" htmlFor="toolbarYear">
            Select year
          </label>
          <select
            className="form-select filter-select"
            id="toolbarYear"
            onChange={(event) => onYearChange(Number(event.target.value))}
            value={selectedYear}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {activeView === "contributions" && (
            <>
              <label className="sr-only" htmlFor="toolbarMonth">
                Filter by month
              </label>
              <select
                className="form-select filter-select"
                id="toolbarMonth"
                onChange={(event) => onMonthChange(event.target.value)}
                value={selectedMonth}
              >
                <option value="">All Months</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
