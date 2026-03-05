import type { ActivityLog } from "@/types/funds";

type RecentActivityProps = {
  logs: ActivityLog[];
};

const toneColor: Record<ActivityLog["tone"], string> = {
  success: "var(--brand-success)",
  warning: "var(--brand-warning)",
  info: "var(--brand-blue)",
};

export default function RecentActivity({ logs }: RecentActivityProps) {
  return (
    <div className="activity-widget">
      <div className="widget-header">
        <h3 className="widget-title">Recent Activity</h3>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state compact">
          <p>No recent activity yet.</p>
        </div>
      ) : (
        logs.map((log) => (
          <div className="activity-item" key={log.id}>
            <div className="activity-icon" style={{ color: toneColor[log.tone] }}>
              <i className={`fas ${log.icon}`} />
            </div>
            <div>
              <div className="activity-text">
                <strong>{log.action}:</strong> {log.detail}
              </div>
              <div className="activity-meta">{log.timestamp}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
