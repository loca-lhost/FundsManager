// --- AUDIT LOG ---

let auditLogsCache = [];
let auditFilteredLogs = [];
let auditLogsLoaded = false;
let auditLoadingPromise = null;
const AUDIT_PAGE_SIZE = 20;

function getAuditModalEl() {
    return document.getElementById('auditModal') || document.getElementById('auditLogModal');
}

function getAuditTableBodyEl() {
    return document.getElementById('auditTableBody') || document.getElementById('auditLogTableBody');
}

function getAuditPrevBtnEl() {
    return document.getElementById('auditPrevBtn') || document.getElementById('btnAuditPrev');
}

function getAuditNextBtnEl() {
    return document.getElementById('auditNextBtn') || document.getElementById('btnAuditNext');
}

function getAuditPageInfoEl() {
    return document.getElementById('auditPageInfo');
}

function getRecentActivityContainerEl() {
    return document.getElementById('recentActivity') || document.getElementById('activityList');
}

async function addToAuditLog(action, details) {
    try {
        const user = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        await databases.createDocument(DB_ID, 'audit_logs', 'unique()', {
            action: action,
            details: details,
            user: user.full_name || user.fullName || 'System',
            timestamp: new Date().toISOString()
        });

        auditLogsLoaded = false;
    } catch (e) {
        console.log('Audit log skipped:', e.message);
    }
}

async function renderRecentActivity() {
    const container = getRecentActivityContainerEl();
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

async function ensureAuditLogsLoaded(forceReload = false) {
    if (auditLoadingPromise && !forceReload) return auditLoadingPromise;
    if (auditLogsLoaded && !forceReload) return Promise.resolve(auditLogsCache);

    auditLoadingPromise = (async () => {
        auditLogsCache = await fetchAllDocuments('audit_logs', [
            Appwrite.Query.orderDesc('$createdAt')
        ]);
        auditLogsLoaded = true;
        return auditLogsCache;
    })();

    try {
        return await auditLoadingPromise;
    } finally {
        auditLoadingPromise = null;
    }
}

function getFilteredAuditLogs() {
    const search = (document.getElementById('auditSearch')?.value || '').trim().toLowerCase();
    const startDateRaw = document.getElementById('auditStartDate')?.value || '';
    const endDateRaw = document.getElementById('auditEndDate')?.value || '';

    const startDate = startDateRaw ? new Date(`${startDateRaw}T00:00:00`) : null;
    const endDate = endDateRaw ? new Date(`${endDateRaw}T23:59:59.999`) : null;

    return auditLogsCache.filter(log => {
        const createdAt = new Date(log.$createdAt);
        if (startDate && createdAt < startDate) return false;
        if (endDate && createdAt > endDate) return false;

        if (!search) return true;

        const user = String(log.user || '').toLowerCase();
        const action = String(log.action || '').toLowerCase();
        const details = String(log.details || '').toLowerCase();

        return user.includes(search) || action.includes(search) || details.includes(search);
    });
}

function renderAuditTablePage() {
    const tbody = getAuditTableBodyEl();
    if (!tbody) return;

    tbody.innerHTML = '';

    if (auditFilteredLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No audit logs found.</td></tr>';
        updateAuditPaginationControls();
        return;
    }

    const start = currentAuditPage * AUDIT_PAGE_SIZE;
    const pageRows = auditFilteredLogs.slice(start, start + AUDIT_PAGE_SIZE);

    pageRows.forEach(log => {
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

    updateAuditPaginationControls();
}

function updateAuditPaginationControls() {
    const totalPages = Math.max(1, Math.ceil(auditFilteredLogs.length / AUDIT_PAGE_SIZE));
    const prevBtn = getAuditPrevBtnEl();
    const nextBtn = getAuditNextBtnEl();
    const pageInfo = getAuditPageInfoEl();

    if (prevBtn) prevBtn.disabled = currentAuditPage <= 0;
    if (nextBtn) nextBtn.disabled = currentAuditPage >= totalPages - 1;
    if (pageInfo) pageInfo.textContent = `Page ${currentAuditPage + 1} of ${totalPages}`;
}

async function openAuditModal() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can view audit logs', 'error');
        return;
    }

    const modal = getAuditModalEl();
    if (!modal) return;

    const tbody = getAuditTableBodyEl();
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
    }

    currentAuditPage = 0;
    modal.classList.add('active');

    try {
        await ensureAuditLogsLoaded(true);
        auditFilteredLogs = getFilteredAuditLogs();
        renderAuditTablePage();
    } catch (e) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Error loading logs: ${escapeHtml(e.message)}</td></tr>`;
        }
    }
}

function closeAuditModal() {
    const modal = getAuditModalEl();
    if (!modal) return;
    modal.classList.remove('active');
}

async function renderAuditLogs() {
    const tbody = getAuditTableBodyEl();
    if (!tbody) return;

    if (!auditLogsLoaded) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
    }

    try {
        await ensureAuditLogsLoaded();
        currentAuditPage = 0;
        auditFilteredLogs = getFilteredAuditLogs();
        renderAuditTablePage();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Error loading logs: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function changeAuditPage(direction) {
    const totalPages = Math.max(1, Math.ceil(auditFilteredLogs.length / AUDIT_PAGE_SIZE));
    const nextPage = currentAuditPage + direction;
    if (nextPage < 0 || nextPage >= totalPages) return;

    currentAuditPage = nextPage;
    renderAuditTablePage();
}

// Backward-compatible aliases for older handlers
function openAuditLogModal() {
    openAuditModal();
}

function closeAuditLogModal() {
    closeAuditModal();
}

async function loadAuditLogPage(page) {
    currentAuditPage = page;
    await ensureAuditLogsLoaded();
    auditFilteredLogs = getFilteredAuditLogs();
    renderAuditTablePage();
}

function auditLogPrevPage() {
    changeAuditPage(-1);
}

function auditLogNextPage() {
    changeAuditPage(1);
}

function downloadCsv(filename, rows) {
    const csv = rows.map(cols => cols
        .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function exportAuditLogsCSV() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can export audit logs', 'error');
        return;
    }

    await ensureAuditLogsLoaded();
    auditFilteredLogs = getFilteredAuditLogs();

    const rows = [
        ['Timestamp', 'User', 'Action', 'Details']
    ];

    auditFilteredLogs.forEach(log => {
        rows.push([
            new Date(log.$createdAt).toLocaleString(),
            log.user || 'System',
            log.action || '',
            log.details || ''
        ]);
    });

    downloadCsv(`AuditLogs_${new Date().toISOString().split('T')[0]}.csv`, rows);
    showToast('Success', `Exported ${auditFilteredLogs.length} audit entries`, 'success');
}

async function exportAuditLog() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can export audit logs', 'error');
        return;
    }

    await ensureAuditLogsLoaded();

    if (typeof XLSX === 'undefined') {
        exportAuditLogsCSV();
        return;
    }

    const rows = [
        ['Audit Log Export'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Timestamp', 'User', 'Action', 'Details']
    ];

    auditLogsCache.forEach(log => {
        rows.push([
            new Date(log.$createdAt).toLocaleString(),
            log.user || 'System',
            log.action || '',
            log.details || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, `AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Success', `Exported ${auditLogsCache.length} audit entries`, 'success');
}

async function resetAuditLogs() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can clear audit logs', 'error');
        return;
    }

    if (!confirm('This will permanently delete all audit logs. Continue?')) return;

    showToast('Info', 'Clearing audit logs...', 'info');

    try {
        const allLogs = await fetchAllDocuments('audit_logs');
        let deleted = 0;

        for (const log of allLogs) {
            try {
                await databases.deleteDocument(DB_ID, 'audit_logs', log.$id);
                deleted++;
            } catch (e) {
                // Skip failed records and continue deleting remaining logs.
            }
        }

        auditLogsLoaded = false;
        auditLogsCache = [];
        auditFilteredLogs = [];
        currentAuditPage = 0;

        await addToAuditLog('Audit Maintenance', `Cleared ${deleted} audit logs`);
        await renderRecentActivity();

        const modal = getAuditModalEl();
        if (modal && modal.classList.contains('active')) {
            await renderAuditLogs();
        }

        showToast('Success', `Deleted ${deleted} audit log entries`, 'success');
    } catch (e) {
        showToast('Error', 'Failed to clear logs: ' + e.message, 'error');
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
            } catch (e) {
                // Skip failed records and continue deleting remaining logs.
            }
        }

        auditLogsLoaded = false;
        showToast('Success', `Deleted ${deleted} old log entries`, 'success');

        const modal = getAuditModalEl();
        if (modal && modal.classList.contains('active')) {
            await renderAuditLogs();
        }

        renderRecentActivity();
    } catch (e) {
        showToast('Error', 'Failed to clean logs: ' + e.message, 'error');
    }
}
