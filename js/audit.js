// --- AUDIT LOG ---

async function addToAuditLog(action, details) {
    try {
        const user = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        await databases.createDocument(DB_ID, 'audit_logs', 'unique()', {
            action: action,
            details: details,
            user: user.full_name || user.fullName || 'System',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.log('Audit log skipped:', e.message);
    }
}

async function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    try {
        const logs = await databases.listDocuments(DB_ID, 'audit_logs', [
            Appwrite.Query.orderDesc('$createdAt'),
            Appwrite.Query.limit(5)
        ]);

        if (logs.documents.length === 0) {
            container.innerHTML = `
                <div class="activity-item text-center text-muted-light" style="padding: 1rem;">
                    <i class="fas fa-history text-lg" style="display: block; margin-bottom: 0.5rem;"></i>
                    No recent activity
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        logs.documents.forEach(log => {
            const time = new Date(log.$createdAt);
            const timeAgo = getTimeAgo(time);

            let icon = 'fa-info-circle';
            let color = 'var(--brand-blue)';

            if (log.action.includes('Login')) { icon = 'fa-sign-in-alt'; color = 'var(--brand-success)'; }
            else if (log.action.includes('Add')) { icon = 'fa-plus-circle'; color = 'var(--brand-success)'; }
            else if (log.action.includes('Edit') || log.action.includes('Update')) { icon = 'fa-edit'; color = 'var(--brand-warning)'; }
            else if (log.action.includes('Delete') || log.action.includes('Archive')) { icon = 'fa-trash'; color = 'var(--brand-error)'; }
            else if (log.action.includes('Export')) { icon = 'fa-download'; color = 'var(--brand-info)'; }
            else if (log.action.includes('Import')) { icon = 'fa-upload'; color = 'var(--brand-info)'; }
            else if (log.action.includes('Backup')) { icon = 'fa-cloud-upload-alt'; color = 'var(--brand-blue)'; }
            else if (log.action.includes('Restore')) { icon = 'fa-cloud-download-alt'; color = 'var(--brand-warning)'; }
            else if (log.action.includes('Contribution')) { icon = 'fa-money-bill-wave'; color = 'var(--brand-success)'; }
            else if (log.action.includes('Overdraft')) { icon = 'fa-hand-holding-usd'; color = 'var(--brand-warning)'; }
            else if (log.action.includes('Dividend')) { icon = 'fa-chart-pie'; color = 'var(--brand-success)'; }
            else if (log.action.includes('Password')) { icon = 'fa-key'; color = 'var(--brand-warning)'; }

            container.innerHTML += `
                <div class="activity-item">
                    <div class="activity-icon" style="color: ${color};">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">${escapeHtml(log.details)}</div>
                        <div class="activity-meta">
                            <span>${escapeHtml(log.user || 'System')}</span>
                            <span>${timeAgo}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<div class="text-center text-muted-light" style="padding:1rem;">Activity log unavailable</div>';
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Full Audit Log Modal
function openAuditLogModal() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can view audit logs', 'error');
        return;
    }
    auditLogCursors = [];
    currentAuditPage = 0;
    loadAuditLogPage(0);
    document.getElementById('auditLogModal').classList.add('active');
}

function closeAuditLogModal() {
    document.getElementById('auditLogModal').classList.remove('active');
}

async function loadAuditLogPage(page) {
    const tbody = document.getElementById('auditLogTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    const pageSize = 20;

    try {
        const queries = [
            Appwrite.Query.orderDesc('$createdAt'),
            Appwrite.Query.limit(pageSize)
        ];

        if (page > 0 && auditLogCursors[page - 1]) {
            queries.push(Appwrite.Query.cursorAfter(auditLogCursors[page - 1]));
        }

        const logs = await databases.listDocuments(DB_ID, 'audit_logs', queries);

        if (logs.documents.length > 0) {
            auditLogCursors[page] = logs.documents[logs.documents.length - 1].$id;
        }

        tbody.innerHTML = '';

        if (logs.documents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No audit logs found.</td></tr>';
            return;
        }

        logs.documents.forEach(log => {
            const date = new Date(log.$createdAt);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Time" class="text-sm" style="white-space: nowrap;">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td data-label="User" class="font-bold">${escapeHtml(log.user || 'System')}</td>
                <td data-label="Action"><span class="status-badge">${escapeHtml(log.action)}</span></td>
                <td data-label="Details" class="text-sm">${escapeHtml(log.details)}</td>
            `;
            tbody.appendChild(row);
        });

        // Pagination controls
        currentAuditPage = page;
        document.getElementById('auditPageInfo').textContent = `Page ${page + 1}`;
        document.getElementById('btnAuditPrev').disabled = page === 0;
        document.getElementById('btnAuditNext').disabled = logs.documents.length < pageSize;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Error: ${e.message}</td></tr>`;
    }
}

function auditLogPrevPage() {
    if (currentAuditPage > 0) {
        loadAuditLogPage(currentAuditPage - 1);
    }
}

function auditLogNextPage() {
    loadAuditLogPage(currentAuditPage + 1);
}

async function exportAuditLog() {
    showToast('Info', 'Exporting audit log...', 'info');

    try {
        const allLogs = await fetchAllDocuments('audit_logs', [
            Appwrite.Query.orderDesc('$createdAt')
        ]);

        const wsData = [
            ['Audit Log Export'],
            ['Generated:', new Date().toLocaleString()],
            [''],
            ['Timestamp', 'User', 'Action', 'Details']
        ];

        allLogs.forEach(log => {
            const date = new Date(log.$createdAt);
            wsData.push([
                date.toLocaleString(),
                log.user || 'System',
                log.action,
                log.details
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
        XLSX.writeFile(wb, `AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`);

        showToast('Success', `Exported ${allLogs.length} audit entries`, 'success');
    } catch (e) {
        showToast('Error', 'Export failed: ' + e.message, 'error');
    }
}

async function clearOldAuditLogs() {
    if (!isAdmin()) return;
    if (!confirm('This will delete audit logs older than the configured retention period. Continue?')) return;

    const retentionDays = parseInt(localStorage.getItem('auditLogRetentionDays') || DEFAULT_AUDIT_RETENTION_DAYS);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    showToast('Info', 'Cleaning old logs...', 'info');

    try {
        const oldLogs = await fetchAllDocuments('audit_logs', [
            Appwrite.Query.lessThan('$createdAt', cutoff.toISOString())
        ]);

        let deleted = 0;
        for (const log of oldLogs) {
            try {
                await databases.deleteDocument(DB_ID, 'audit_logs', log.$id);
                deleted++;
            } catch (e) { /* skip */ }
        }

        showToast('Success', `Deleted ${deleted} old log entries`, 'success');
        if (document.getElementById('auditLogModal').classList.contains('active')) {
            loadAuditLogPage(0);
        }
        renderRecentActivity();
    } catch (e) {
        showToast('Error', 'Failed to clean logs: ' + e.message, 'error');
    }
}
