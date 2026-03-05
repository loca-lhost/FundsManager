// --- SETTINGS ---

function openSettingsModal() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can access settings', 'error');
        return;
    }
    const minutes = parseInt(localStorage.getItem('inactivityLimit') || DEFAULT_INACTIVITY_MINUTES);
    const retention = parseInt(localStorage.getItem('auditLogRetentionDays') || DEFAULT_AUDIT_RETENTION_DAYS);
    document.getElementById('settingInactivity').value = minutes;
    document.getElementById('settingAuditRetention').value = retention;
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings(e) {
    e.preventDefault();
    const minutes = parseInt(document.getElementById('settingInactivity').value);
    const retention = parseInt(document.getElementById('settingAuditRetention').value);

    if (minutes < 1) {
        showToast('Error', 'Inactivity timeout must be at least 1 minute', 'error');
        return;
    }
    if (retention < 1) {
        showToast('Error', 'Retention period must be at least 1 day', 'error');
        return;
    }

    localStorage.setItem('inactivityLimit', minutes);
    localStorage.setItem('auditLogRetentionDays', retention);
    closeSettingsModal();
    showToast('Success', 'Settings saved', 'success');
    resetInactivityTimer();
}
