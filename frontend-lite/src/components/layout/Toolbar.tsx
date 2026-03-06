"use client";

import { months } from "@/lib/months";

type ToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  yearOptions: number[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
};

export default function Toolbar({
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

    </div>
  );
}
