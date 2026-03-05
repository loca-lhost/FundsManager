// --- BACKUP & RESTORE ---

const BACKUP_ENCRYPTION_KEY = 'welfare-backup-key';

function openBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('active');
}

function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.remove('active');
}

function closeCloudRestoreModal() {
    const modal = document.getElementById('cloudRestoreModal');
    if (modal) modal.classList.remove('active');
}

function openCloudRestoreModal() {
    restoreFromCloud();
}

function backupData() {
    backupToLocal();
}

function restoreData() {
    restoreFromLocal();
}

function buildBackupDataSnapshot() {
    return {
        version: '2.1',
        timestamp: new Date().toISOString(),
        year: currentYear,
        members: membersData,
        overdrafts: overdraftsData,
        availableYears: availableYears
    };
}

function encryptBackupJson(jsonString) {
    return CryptoJS.AES.encrypt(jsonString, BACKUP_ENCRYPTION_KEY).toString();
}

function parseBackupContent(content) {
    let parsedData = null;

    // Attempt encrypted backup first.
    try {
        const decrypted = CryptoJS.AES.decrypt(content, BACKUP_ENCRYPTION_KEY);
        const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
        if (jsonString) {
            parsedData = JSON.parse(jsonString);
        }
    } catch (e) {
        // Ignore and try plain JSON next.
    }

    if (!parsedData) {
        parsedData = JSON.parse(content);
    }

    return parsedData;
}

function normalizeBackupData(data) {
    if (!data || !Array.isArray(data.members)) {
        throw new Error('Invalid backup file format');
    }

    const parsedYear = parseInt(data.year, 10);
    const yearToRestore = Number.isFinite(parsedYear) ? parsedYear : currentYear;

    const normalizedYears = Array.isArray(data.availableYears)
        ? data.availableYears
            .map(y => parseInt(y, 10))
            .filter(y => Number.isFinite(y))
        : [];

    return {
        version: data.version || 'unknown',
        timestamp: data.timestamp || null,
        year: yearToRestore,
        members: data.members,
        overdrafts: Array.isArray(data.overdrafts) ? data.overdrafts : [],
        availableYears: normalizedYears
    };
}

async function deleteCollectionDocuments(collectionId) {
    const docs = await fetchAllDocuments(collectionId);
    for (const doc of docs) {
        await databases.deleteDocument(DB_ID, collectionId, doc.$id);
    }
    return docs.length;
}

function sanitizeAccountNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 13);
    return digits || '0';
}

function sanitizeMoney(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function restoreBackupDataToDatabase(rawData) {
    const data = normalizeBackupData(rawData);

    showToast('Info', 'Replacing current data...', 'info');

    // Clear existing transactional data first to honor "replace all" semantics.
    await deleteCollectionDocuments('contributions');
    await deleteCollectionDocuments('overdrafts');
    await deleteCollectionDocuments('members');

    const memberIdMap = new Map();
    const memberNameMap = new Map();
    const restoredMembers = [];

    for (const backupMember of data.members) {
        const name = String(backupMember.name || '').trim();
        if (!name) continue;

        const createdMember = await databases.createDocument(DB_ID, 'members', 'unique()', {
            name: name,
            accountNumber: sanitizeAccountNumber(backupMember.accountNumber),
            isArchived: !!backupMember.isArchived
        });

        const createdId = createdMember.$id;
        const sourceId = String(backupMember.id || '');
        if (sourceId) memberIdMap.set(sourceId, createdId);

        memberNameMap.set(name.toLowerCase(), createdId);
        restoredMembers.push({ id: createdId, name: name, sourceId: sourceId });
    }

    let restoredContributions = 0;

    for (const backupMember of data.members) {
        const sourceId = String(backupMember.id || '');
        const memberName = String(backupMember.name || '').trim().toLowerCase();

        let targetMemberId = memberIdMap.get(sourceId);
        if (!targetMemberId && memberName) {
            targetMemberId = memberNameMap.get(memberName);
        }
        if (!targetMemberId) continue;

        const contributions = backupMember.contributions && typeof backupMember.contributions === 'object'
            ? backupMember.contributions
            : {};

        for (const month of months) {
            const amount = sanitizeMoney(contributions[month], 0);
            if (amount <= 0) continue;

            await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                memberId: targetMemberId,
                year: data.year,
                month: month,
                amount: amount
            });
            restoredContributions++;
        }
    }

    let restoredOverdrafts = 0;
    let skippedOverdrafts = 0;

    for (const backupOverdraft of data.overdrafts) {
        const sourceMemberId = String(backupOverdraft.memberId || '');
        const sourceMemberName = String(backupOverdraft.memberName || '').trim().toLowerCase();

        let targetMemberId = memberIdMap.get(sourceMemberId);
        if (!targetMemberId && sourceMemberName) {
            targetMemberId = memberNameMap.get(sourceMemberName);
        }

        if (!targetMemberId) {
            skippedOverdrafts++;
            continue;
        }

        const restoredMember = restoredMembers.find(m => m.id === targetMemberId);
        const memberName = restoredMember ? restoredMember.name : (backupOverdraft.memberName || 'Unknown Member');
        const totalDue = sanitizeMoney(
            backupOverdraft.totalDue,
            sanitizeMoney(backupOverdraft.totalRepayment, 0)
        );

        await databases.createDocument(DB_ID, 'overdrafts', 'unique()', {
            memberId: targetMemberId,
            memberName: memberName,
            amount: sanitizeMoney(backupOverdraft.amount, 0),
            interest: sanitizeMoney(backupOverdraft.interest, 0),
            totalDue: totalDue,
            totalRepayment: totalDue,
            reason: backupOverdraft.reason || 'N/A',
            status: normalizeOverdraftStatus(backupOverdraft.status || OVERDRAFT_STATUS.APPROVED),
            dateTaken: backupOverdraft.dateTaken || new Date().toISOString(),
            amountPaid: sanitizeMoney(backupOverdraft.amountPaid, 0)
        });

        restoredOverdrafts++;
    }

    availableYears = data.availableYears.length > 0
        ? [...new Set(data.availableYears)]
        : [data.year];

    if (!availableYears.includes(data.year)) availableYears.push(data.year);
    availableYears.sort((a, b) => b - a);
    currentYear = data.year;

    renderYearSelector();
    await loadYearData(currentYear);

    return {
        year: data.year,
        members: restoredMembers.length,
        contributions: restoredContributions,
        overdrafts: restoredOverdrafts,
        skippedOverdrafts: skippedOverdrafts,
        timestamp: data.timestamp || 'unknown'
    };
}

async function backupToCloud() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can backup', 'error');
        return;
    }

    showToast('Info', 'Creating backup...', 'info');

    try {
        const backupData = buildBackupDataSnapshot();
        const jsonString = JSON.stringify(backupData, null, 2);
        const encrypted = encryptBackupJson(jsonString);

        const blob = new Blob([encrypted], { type: 'application/octet-stream' });
        const file = new File([blob], `backup_${currentYear}_${Date.now()}.wbk`, { type: 'application/octet-stream' });

        await storage.createFile(BUCKET_ID, 'unique()', file);

        showToast('Success', 'Backup saved to cloud', 'success');
        addToAuditLog('Backup', `Cloud backup created for ${currentYear}`);
    } catch (error) {
        console.error('Backup error:', error);
        showToast('Error', 'Backup failed: ' + error.message, 'error');
    }
}

function backupToLocal() {
    const backupData = buildBackupDataSnapshot();
    const jsonString = JSON.stringify(backupData, null, 2);
    const encrypted = encryptBackupJson(jsonString);

    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FundsManager_Backup_${currentYear}_${new Date().toISOString().split('T')[0]}.wbk`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Success', 'Backup downloaded', 'success');
    addToAuditLog('Backup', `Local backup created for ${currentYear}`);
}

async function restoreFromLocal() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can restore backups', 'error');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wbk,.json';

    input.onchange = async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('This will replace all current data. Are you sure?')) return;

        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const content = String(event.target.result || '');
                const parsedData = parseBackupContent(content);

                const result = await restoreBackupDataToDatabase(parsedData);
                const summary = `Year ${result.year}: ${result.members} members, ${result.contributions} contributions, ${result.overdrafts} overdrafts restored`;

                showToast('Success', summary, 'success');
                if (result.skippedOverdrafts > 0) {
                    showToast('Warning', `${result.skippedOverdrafts} overdrafts skipped due to missing member mapping`, 'warning');
                }

                addToAuditLog('Restore', `Restored from local backup (${result.timestamp})`);
            } catch (error) {
                console.error('Restore error:', error);
                showToast('Error', 'Failed to restore: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

async function restoreFromCloud() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can restore', 'error');
        return;
    }

    try {
        const filesList = await storage.listFiles(BUCKET_ID, [
            Appwrite.Query.orderDesc('$createdAt'),
            Appwrite.Query.limit(20)
        ]);

        if (filesList.files.length === 0) {
            showToast('Info', 'No cloud backups found', 'info');
            return;
        }

        const modal = document.getElementById('cloudRestoreModal');
        const tableList = document.getElementById('cloudBackupList');
        const divList = document.getElementById('cloudBackupsList');

        if (tableList) {
            let rows = '';
            filesList.files.forEach(file => {
                const date = new Date(file.$createdAt);
                const size = (file.sizeOriginal / 1024).toFixed(1);
                rows += `
                    <tr>
                        <td>
                            <div class="font-bold">${escapeHtml(file.name)}</div>
                            <div class="text-sm text-muted">${date.toLocaleString()} - ${size} KB</div>
                        </td>
                        <td class="text-right">
                            <button class="btn btn-primary btn-sm" onclick="performCloudRestore('${file.$id}')" title="Restore">
                                <i class="fas fa-download"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tableList.innerHTML = rows;
        } else if (divList) {
            let html = '<div class="backup-list-scroll">';
            filesList.files.forEach(file => {
                const date = new Date(file.$createdAt);
                const size = (file.sizeOriginal / 1024).toFixed(1);
                html += `
                    <div class="backup-list-item" onclick="performCloudRestore('${file.$id}')">
                        <div>
                            <div class="font-bold">${escapeHtml(file.name)}</div>
                            <div class="text-sm text-muted">${date.toLocaleString()} - ${size} KB</div>
                        </div>
                        <i class="fas fa-download text-brand"></i>
                    </div>
                `;
            });
            html += '</div>';
            divList.innerHTML = html;
        }

        if (modal) {
            modal.classList.add('active');
        }
    } catch (error) {
        showToast('Error', 'Failed to list backups: ' + error.message, 'error');
    }
}

async function performCloudRestore(fileId) {
    if (!confirm('This will replace current data. Are you sure?')) return;

    showToast('Info', 'Restoring backup...', 'info');

    try {
        const downloadUrl = await storage.getFileDownload(BUCKET_ID, fileId);
        const response = await fetch(downloadUrl);
        const content = await response.text();

        const parsedData = parseBackupContent(content);
        const result = await restoreBackupDataToDatabase(parsedData);

        const summary = `Year ${result.year}: ${result.members} members, ${result.contributions} contributions, ${result.overdrafts} overdrafts restored`;
        showToast('Success', summary, 'success');

        if (result.skippedOverdrafts > 0) {
            showToast('Warning', `${result.skippedOverdrafts} overdrafts skipped due to missing member mapping`, 'warning');
        }

        addToAuditLog('Restore', `Restored from cloud backup (${result.timestamp})`);
        closeCloudRestoreModal();
    } catch (error) {
        showToast('Error', 'Restore failed: ' + error.message, 'error');
    }
}
