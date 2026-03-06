import { currency } from "@/lib/format";
import {
  formatCollectionMonth,
  getOverdraftStatusLabel,
  getRemainingCollectibleNow,
  getRemainingTotal,
  isInterestCollectible,
  isOpenOverdraftStatus,
  sumCollectedOverdraftInterest,
} from "@/lib/overdraft-service";
import type { OverdraftRecord } from "@/types/funds";

type OverdraftSectionProps = {
  overdrafts: OverdraftRecord[];
  loading: boolean;
  canManage: boolean;
  onOpenIssueModal: () => void;
  onOpenRepayModal: (record: OverdraftRecord) => void;
};

export default function OverdraftSection({
  overdrafts,
  loading,
  canManage,
  onOpenIssueModal,
  onOpenRepayModal,
}: OverdraftSectionProps) {
  const openOverdrafts = overdrafts.filter((item) => isOpenOverdraftStatus(item.status));
  const totalOutstanding = openOverdrafts.reduce((sum, item) => sum + getRemainingTotal(item), 0);
  const collectibleNow = openOverdrafts.reduce((sum, item) => sum + getRemainingCollectibleNow(item), 0);
  const collectedInterest = sumCollectedOverdraftInterest(overdrafts);

  return (
    <div className="table-container" id="overdraftSection">
      <div className="table-header">
        <h2 className="table-title">Overdraft Management</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={onOpenIssueModal} type="button">
            <i className="fas fa-plus" /> Issue Overdraft
          </button>
        )}
      </div>

      <div className="mini-stats-grid">
        <div className="mini-stat-card">
          <span className="mini-stat-label">Open Overdrafts</span>
          <span className="mini-stat-value">{openOverdrafts.length}</span>
        </div>
        <div className="mini-stat-card">
          <span className="mini-stat-label">Outstanding Balance</span>
          <span className="mini-stat-value">{currency(totalOutstanding)}</span>
        </div>
        <div className="mini-stat-card">
          <span className="mini-stat-label">Collectible This Month</span>
          <span className="mini-stat-value">{currency(collectibleNow)}</span>
        </div>
        <div className="mini-stat-card">
          <span className="mini-stat-label">Interest Collected</span>
          <span className="mini-stat-value">{currency(collectedInterest)}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th className="th-right">Principal</th>
              <th className="th-right">Interest (2%)</th>
              <th>Collection Month</th>
              <th className="th-right">Total Repayment</th>
              <th className="th-right">Paid</th>
              <th className="th-right">Remaining</th>
              <th>Status</th>
              {canManage && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="loading-cell" colSpan={canManage ? 9 : 8}>
                  <div className="spinner" />
                  <div className="loading-text">Loading overdrafts...</div>
                </td>
              </tr>
            ) : overdrafts.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="fas fa-hand-holding-usd" />
                    </div>
                    <h3>No overdrafts issued</h3>
                    <p>Issue an overdraft to track principal, 2% interest, and repayments.</p>
                  </div>
                </td>
              </tr>
            ) : (
              overdrafts.map((item) => {
                const remaining = getRemainingTotal(item);
                const openStatus = isOpenOverdraftStatus(item.status);
                const label = getOverdraftStatusLabel(item);

                return (
                  <tr key={item.id}>
                    <td data-label="Member" className="font-bold">
                      {item.memberName}
                    </td>
                    <td data-label="Principal" className="amount-cell">
                      {currency(item.amount)}
                    </td>
                    <td data-label="Interest (2%)" className="amount-cell text-warning">
                      {currency(item.interest)}
                    </td>
                    <td data-label="Collection Month">{formatCollectionMonth(item)}</td>
                    <td data-label="Total Repayment" className="amount-cell font-extra-bold">
                      {currency(item.totalRepayment)}
                    </td>
                    <td data-label="Paid" className="amount-cell text-success">
                      {currency(item.amountPaid)}
                    </td>
                    <td data-label="Remaining" className="amount-cell text-danger">
                      {currency(remaining)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`status-badge ${
                          item.status === "settled"
                            ? "status-paid"
                            : item.status === "rejected"
                              ? "status-rejected"
                              : isInterestCollectible(item)
                                ? "status-active"
                                : "status-pending"
                        }`}
                      >
                        {label}
                      </span>
                    </td>
                    {canManage && (
                      <td data-label="Action">
                        {openStatus ? (
                          <button className="btn btn-success btn-sm" onClick={() => onOpenRepayModal(item)} type="button">
                            <i className="fas fa-money-bill-wave" /> Repay
                          </button>
                        ) : (
                          <span className="text-muted">Closed</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
