import { months } from "@/lib/months";
import { currency, memberTotal, monthlyTotal } from "@/lib/format";
import type { MemberContribution } from "@/types/funds";

type ContributionsTableProps = {
  members: MemberContribution[];
  loading?: boolean;
  canManage: boolean;
  canAdmin: boolean;
  onEditMember: (member: MemberContribution) => void;
  onArchiveMember: (memberId: string) => Promise<void>;
  onRestoreMember: (memberId: string) => Promise<void>;
};

export default function ContributionsTable({
  members,
  loading = false,
  canManage,
  canAdmin,
  onEditMember,
  onArchiveMember,
  onRestoreMember,
}: ContributionsTableProps) {
  const hasActions = canManage || canAdmin;
  const totalColumns = 2 + months.length + 1 + (hasActions ? 1 : 0);

  return (
    <div className="table-container" id="contributionsSection">
      <div className="table-header">
        <h2 className="table-title">Income Contributions</h2>
      </div>

      <div className="table-wrapper">
        <table id="dataTable">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Account Number</th>
              {months.map((month) => (
                <th className="th-right" key={month}>
                  {month}
                </th>
              ))}
              <th className="th-right">Total</th>
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>

          <tbody id="tableBody">
            {loading ? (
              <tr>
                <td className="loading-cell" colSpan={totalColumns}>
                  <div className="spinner" />
                  <div className="loading-text">Loading contribution data...</div>
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={totalColumns}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="fas fa-users" />
                    </div>
                    <h3>No matching members</h3>
                    <p>Try a different search term.</p>
                  </div>
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
                  <td className="font-bold" data-label="Member Name">
                    {member.name}
                  </td>
                  <td data-label="Account Number">{member.accountNumber}</td>
                  {months.map((month) => (
                    <td className="amount-cell" data-label={month} key={`${member.id}-${month}`}>
                      {currency(member.contributions[month] || 0)}
                    </td>
                  ))}
                  <td className="amount-cell font-extra-bold" data-label="Total">
                    {currency(memberTotal(member))}
                  </td>
                  {hasActions && (
                    <td data-label="Actions">
                      <div className="actions-row">
                        {canManage && (
                          <button className="btn btn-secondary btn-sm" onClick={() => onEditMember(member)} type="button">
                            <i className="fas fa-edit" /> <span className="btn-text">Edit</span>
                          </button>
                        )}
                        {canAdmin && !member.isArchived && (
                          <button className="btn btn-danger btn-sm" onClick={() => onArchiveMember(member.id)} type="button">
                            <i className="fas fa-archive" /> <span className="btn-text">Archive</span>
                          </button>
                        )}
                        {canAdmin && member.isArchived && (
                          <button className="btn btn-success btn-sm" onClick={() => onRestoreMember(member.id)} type="button">
                            <i className="fas fa-trash-restore" /> <span className="btn-text">Restore</span>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr className="total-row">
              <td colSpan={hasActions ? 3 : 2}>MONTHLY TOTALS</td>
              {months.map((month) => (
                <td className="amount-cell" key={`total-${month}`}>
                  {currency(monthlyTotal(members, month))}
                </td>
              ))}
              <td className="amount-cell">{currency(members.reduce((sum, member) => sum + memberTotal(member), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
