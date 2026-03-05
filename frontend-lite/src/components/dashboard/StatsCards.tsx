import { currency, grandTotal } from "@/lib/format";
import { getRemainingTotal, isOpenOverdraftStatus } from "@/lib/overdraft-service";
import type { MemberContribution, OverdraftRecord } from "@/types/funds";

type StatsCardsProps = {
  members: MemberContribution[];
  overdrafts: OverdraftRecord[];
};

export default function StatsCards({ members, overdrafts }: StatsCardsProps) {
  const currentMonth = new Date().toLocaleString("en-US", { month: "long" });
  const activeMembers = members.filter((item) => !item.isArchived).length;
  const openOverdrafts = overdrafts.filter((item) => isOpenOverdraftStatus(item.status));
  const outstandingOverdrafts = openOverdrafts.reduce((sum, item) => sum + getRemainingTotal(item), 0);

  return (
    <div className="stats-grid">
      <div className="stat-card blue" id="card-month">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <div className="stat-card-label">Current Month</div>
            <div className="stat-card-value">{currentMonth}</div>
          </div>
          <div className="stat-card-icon">
            <i className="fas fa-calendar-check" />
          </div>
        </div>
      </div>

      <div className="stat-card green" id="card-total">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <div className="stat-card-label">Total Contributions</div>
            <div className="stat-card-value">{currency(grandTotal(members))}</div>
          </div>
          <div className="stat-card-icon">
            <i className="fas fa-hand-holding-usd" />
          </div>
        </div>
      </div>

      <div className="stat-card blue" id="card-active">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <div className="stat-card-label">Active Members</div>
            <div className="stat-card-value">{activeMembers}</div>
          </div>
          <div className="stat-card-icon">
            <i className="fas fa-users" />
          </div>
        </div>
      </div>

      <div className="stat-card red" id="card-overdraft">
        <div className="stat-card-content">
          <div className="stat-card-info">
            <div className="stat-card-label">Outstanding Overdrafts</div>
            <div className="stat-card-value">{currency(outstandingOverdrafts)}</div>
            <div className="stat-card-subtext">{openOverdrafts.length} open facilities</div>
          </div>
          <div className="stat-card-icon">
            <i className="fas fa-wallet" />
          </div>
        </div>
      </div>
    </div>
  );
}
