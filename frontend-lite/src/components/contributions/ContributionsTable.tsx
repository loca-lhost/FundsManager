import { useMemo, useState } from "react";
import { months } from "@/lib/months";
import { currency, memberTotal } from "@/lib/format";
import type { MemberContribution } from "@/types/funds";

type ContributionsTableProps = {
  members: MemberContribution[];
  loading?: boolean;
  canManage: boolean;
  onEditMember: (member: MemberContribution) => void;
  onOpenContributionModal: () => void;
};

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
        <p className="contribution-detail-kicker">Selected Member</p>
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

      <details className="contribution-breakdown" open={!compact}>
        <summary className="contribution-breakdown-summary">Monthly Contributions</summary>
        <div className="contribution-breakdown-list">
          {monthBreakdown.map((item) => (
            <div className="contribution-breakdown-row" key={`${member.id}-${item.month}`}>
              <span>{item.month}</span>
              <strong>{currency(item.amount)}</strong>
            </div>
          ))}
        </div>
      </details>

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
  const portfolioTotal = useMemo(() => members.reduce((sum, member) => sum + memberTotal(member), 0), [members]);

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
          <div className="brand-loader brand-loader-compact" role="status" aria-live="polite">
            <img alt="" aria-hidden="true" className="brand-loader-icon" src="/favicon.svg" />
            <div className="brand-loader-copy">
              <strong>Loading contribution data...</strong>
            </div>
          </div>
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
            <div className="contributions-list-pane">
              <div className="contributions-list-summary">
                <span>{members.length} members</span>
                <strong>{currency(portfolioTotal)} total pool</strong>
              </div>
              <div className="contributions-member-list" id="tableBody">
                {members.map((member) => {
                  const isSelected = selectedMember?.id === member.id;
                  const total = memberTotal(member);
                  const activeMonths = getActiveMonthsCount(member);
                  const highestMonth = getHighestContributionMonth(member);
                  return (
                    <article
                      aria-selected={isSelected}
                      className={`contribution-member-card contributions-member-item ${isSelected ? "selected" : ""}`}
                      key={member.id}
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
                        <h4>{member.name}</h4>
                        <p>{member.accountNumber}</p>
                        <p className="contribution-member-meta">
                          {activeMonths} active months • Peak {highestMonth.month}: {currency(highestMonth.amount)}
                        </p>
                      </div>
                      <div className="contribution-member-side">
                        <strong className="contribution-member-total">{currency(total)}</strong>
                        <span className="contribution-member-side-label">YTD Total</span>
                        {canManage && (
                          <button
                            className="btn btn-secondary btn-sm contribution-member-edit"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMemberId(member.id);
                              onEditMember(member);
                            }}
                            type="button"
                          >
                            <i className="fas fa-edit" /> Edit
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {selectedMember && (
              <aside className="contribution-detail-pane">
                <MemberContributionDetail canManage={canManage} member={selectedMember} onEditMember={onEditMember} />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
