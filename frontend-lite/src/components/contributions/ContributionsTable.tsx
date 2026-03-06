import { useMemo, useState } from "react";
import { months } from "@/lib/months";
import { currency, memberTotal, monthlyTotal } from "@/lib/format";
import type { MemberContribution } from "@/types/funds";

type ContributionsTableProps = {
  members: MemberContribution[];
  loading?: boolean;
  canManage: boolean;
  onEditMember: (member: MemberContribution) => void;
  onOpenContributionModal: () => void;
};

function monthToken(month: string): string {
  return month.toLowerCase();
}

function getActiveMonthsCount(member: MemberContribution): number {
  return months.reduce((count, month) => count + ((member.contributions[month] || 0) > 0 ? 1 : 0), 0);
}

function getHighestContributionMonth(member: MemberContribution): { month: string; amount: number } {
  return months.reduce<{ month: string; amount: number }>(
    (current, month) => {
      const amount = member.contributions[month] || 0;
      if (amount > current.amount) {
        return { month, amount };
      }
      return current;
    },
    { month: months[0], amount: member.contributions[months[0]] || 0 },
  );
}

type MemberContributionDetailProps = {
  member: MemberContribution;
  canManage: boolean;
  compact?: boolean;
  onEditMember: (member: MemberContribution) => void;
};

function MemberContributionDetail({ member, canManage, compact = false, onEditMember }: MemberContributionDetailProps) {
  const total = memberTotal(member);
  const activeMonths = getActiveMonthsCount(member);
  const average = activeMonths > 0 ? total / activeMonths : 0;
  const highestMonth = getHighestContributionMonth(member);
  const monthBreakdown = months.map((month) => ({ month, amount: member.contributions[month] || 0 }));

  return (
    <section className={`contribution-detail ${compact ? "compact" : ""}`}>
      <div className="contribution-detail-head">
        <h3>{member.name}</h3>
        <p>{member.accountNumber}</p>
      </div>

      <div className="contribution-metrics-grid">
        <div className="contribution-metric-card">
          <span>YTD Contribution</span>
          <strong>{currency(total)}</strong>
        </div>
        <div className="contribution-metric-card">
          <span>Active Months</span>
          <strong>{activeMonths}</strong>
        </div>
        <div className="contribution-metric-card">
          <span>Average / Active Month</span>
          <strong>{currency(average)}</strong>
        </div>
        <div className="contribution-metric-card">
          <span>Highest Month</span>
          <strong>
            {highestMonth.month} ({currency(highestMonth.amount)})
          </strong>
        </div>
      </div>

      <div className="contribution-breakdown">
        <p className="contribution-breakdown-label">Monthly Breakdown</p>
        <div className="contribution-breakdown-list">
          {monthBreakdown.map((item) => (
            <div className="contribution-breakdown-row" key={`${member.id}-${item.month}`}>
              <span>{item.month}</span>
              <strong>{currency(item.amount)}</strong>
            </div>
          ))}
        </div>
      </div>

      {canManage && (
        <div className="contribution-detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => onEditMember(member)} type="button">
            <i className="fas fa-edit" /> Edit Member
          </button>
        </div>
      )}
    </section>
  );
}

export default function ContributionsTable({
  members,
  loading = false,
  canManage,
  onEditMember,
  onOpenContributionModal,
}: ContributionsTableProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = useMemo(() => {
    if (members.length === 0) return null;
    if (selectedMemberId && members.some((member) => member.id === selectedMemberId)) {
      return members.find((member) => member.id === selectedMemberId) || members[0];
    }
    return members[0];
  }, [members, selectedMemberId]);

  return (
    <div className="table-container contributions-container" id="contributionsSection">
      <div className="table-header">
        <h2 className="table-title">Income Contributions</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={onOpenContributionModal} type="button">
            <i className="fas fa-hand-holding-usd" /> Record Contribution
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-cell">
          <div className="spinner" />
          <div className="loading-text">Loading contribution data...</div>
        </div>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fas fa-users" />
          </div>
          <h3>No matching members</h3>
          <p>Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className="contributions-layout">
            <div className="table-wrapper contributions-table-pane">
              <table id="dataTable" className="contributions-table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Account Number</th>
                    {months.map((month) => (
                      <th className={`th-right month-col month-${monthToken(month)}`} key={month}>
                        {month}
                      </th>
                    ))}
                    <th className="th-right">Total</th>
                  </tr>
                </thead>

                <tbody id="tableBody">
                  {members.map((member) => {
                    const isSelected = selectedMember?.id === member.id;
                    return (
                      <tr className={isSelected ? "selected-row" : ""} key={member.id} onClick={() => setSelectedMemberId(member.id)}>
                        <td className="font-bold" data-label="Member Name">
                          {canManage ? (
                            <button
                              className="member-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedMemberId(member.id);
                                onEditMember(member);
                              }}
                              type="button"
                            >
                              {member.name}
                            </button>
                          ) : (
                            <span className="member-link-static">{member.name}</span>
                          )}
                        </td>
                        <td data-label="Account Number">{member.accountNumber}</td>
                        {months.map((month) => (
                          <td
                            className={`amount-cell month-col month-${monthToken(month)}`}
                            data-label={month}
                            key={`${member.id}-${month}`}
                          >
                            {currency(member.contributions[month] || 0)}
                          </td>
                        ))}
                        <td className="amount-cell font-extra-bold" data-label="Total">
                          {currency(memberTotal(member))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="total-row">
                    <td colSpan={2}>MONTHLY TOTALS</td>
                    {months.map((month) => (
                      <td className={`amount-cell month-col month-${monthToken(month)}`} key={`total-${month}`}>
                        {currency(monthlyTotal(members, month))}
                      </td>
                    ))}
                    <td className="amount-cell">{currency(members.reduce((sum, member) => sum + memberTotal(member), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedMember && (
              <aside className="contribution-detail-pane">
                <MemberContributionDetail canManage={canManage} member={selectedMember} onEditMember={onEditMember} />
              </aside>
            )}
          </div>

          <div className="contributions-mobile">
            <div className="contributions-mobile-list">
              {members.map((member) => {
                const isSelected = selectedMember?.id === member.id;
                return (
                  <article
                    className={`contribution-member-card ${isSelected ? "selected" : ""}`}
                    key={`mobile-${member.id}`}
                    onClick={() => setSelectedMemberId(member.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedMemberId(member.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="contribution-member-copy">
                      {canManage ? (
                        <button
                          className="member-link contribution-card-name"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMemberId(member.id);
                            onEditMember(member);
                          }}
                          type="button"
                        >
                          {member.name}
                        </button>
                      ) : (
                        <h4>{member.name}</h4>
                      )}
                      <p>{member.accountNumber}</p>
                    </div>
                    <strong className="contribution-member-total">{currency(memberTotal(member))}</strong>
                  </article>
                );
              })}
            </div>

            {selectedMember && (
              <div className="contribution-mobile-sheet">
                <div className="contribution-sheet-grabber" />
                <MemberContributionDetail canManage={canManage} compact member={selectedMember} onEditMember={onEditMember} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
