// --- BACKUP & RESTORE ---

function openBackupModal() {
    document.getElementById('backupModal').classList.add('active');
}

function closeBackupModal() {
    document.getElementById('backupModal').classList.remove('active');
}
async function backupToCloud() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can backup', 'error');
        return;
    }

    showToast('Info', 'Creating backup...', 'info');

    try {
        const backupData = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            year: currentYear,
            members: membersData,
            overdrafts: overdraftsData,
            availableYears: availableYears
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const encrypted = CryptoJS.AES.encrypt(jsonString, 'welfare-backup-key').toString();

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
    const backupData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        year: currentYear,
        members: membersData,
        overdrafts: overdraftsData,
        availableYears: availableYears
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const encrypted = CryptoJS.AES.encrypt(jsonString, 'welfare-backup-key').toString();

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
                let data;
                const content = event.target.result;

                // Try decrypting first
                try {
                    const decrypted = CryptoJS.AES.decrypt(content, 'welfare-backup-key');
                    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
                    data = JSON.parse(jsonString);
                } catch (decryptError) {
                    // If decryption fails, try plain JSON
                    data = JSON.parse(content);
                }

                if (!data.members || !Array.isArray(data.members)) {
                    showToast('Error', 'Invalid backup file format', 'error');
                    return;
                }

                // Restore members
                for (const member of data.members) {
                    try {
                        // Check if member already exists
                        const existing = await databases.listDocuments(DB_ID, 'members', [
                            Appwrite.Query.equal('accountNumber', member.accountNumber)
                        ]);

                        let memberId;
                        if (existing.documents.length > 0) {
                            memberId = existing.documents[0].$id;
                            await databases.updateDocument(DB_ID, 'members', memberId, {
                                name: member.name,
                                accountNumber: member.accountNumber,
                                isArchived: member.isArchived || false
                            });
                        } else {
                            const response = await databases.createDocument(DB_ID, 'members', 'unique()', {
                                name: member.name,
                                accountNumber: member.accountNumber,
                                isArchived: member.isArchived || false
                            });
                            memberId = response.$id;
                        }

                        // Restore contributions
                        if (member.contributions) {
                            for (const month of months) {
                                const amount = member.contributions[month] || 0;
                                if (amount > 0) {
                                    const contribs = await databases.listDocuments(DB_ID, 'contributions', [
                                        Appwrite.Query.equal('memberId', memberId),
                                        Appwrite.Query.equal('year', data.year || currentYear),
                                        Appwrite.Query.equal('month', month)
                                    ]);

                                    if (contribs.documents.length > 0) {
                                        await databases.updateDocument(DB_ID, 'contributions', contribs.documents[0].$id, { amount: amount });
                                    } else {
                                        await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                                            memberId: memberId,
                                            year: data.year || currentYear,
                                            month: month,
                                            amount: amount
                                        });
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Error restoring ${member.name}:`, err);
                    }
                }

                // Restore overdrafts
                if (data.overdrafts) {
                    for (const od of data.overdrafts) {
                        try {
                            await databases.createDocument(DB_ID, 'overdrafts', 'unique()', {
                                memberId: od.memberId,
                                memberName: od.memberName,
                                amount: od.amount,
                                interest: od.interest,
                                totalDue: od.totalDue,
                                reason: od.reason || 'N/A',
                                status: od.status,
                                dateTaken: od.dateTaken,
                                amountPaid: od.amountPaid || 0
                            });
                        } catch (err) {
                            console.error(`Error restoring overdraft:`, err);
                        }
                    }
                }

                showToast('Success', 'Data restored successfully. Reloading...', 'success');
                addToAuditLog('Restore', `Restored from local backup (${data.timestamp || 'unknown date'})`);

                setTimeout(() => { loadYearData(data.year || currentYear); }, 1000);

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
            Appwrite.Query.limit(10)
        ]);

        if (filesList.files.length === 0) {
            showToast('Info', 'No cloud backups found', 'info');
            return;
        }

        // Show selection modal
        let html = '<div class="backup-list-scroll">';
        filesList.files.forEach(file => {
            const date = new Date(file.$createdAt);
            const size = (file.sizeOriginal / 1024).toFixed(1);
            html += `
                <div class="backup-list-item" 
                     onclick="performCloudRestore('${file.$id}')">
                    <div>
                        <div class="font-bold">${escapeHtml(file.name)}</div>
                        <div class="text-sm text-muted">${date.toLocaleString()} • ${size} KB</div>
                    </div>
                    <i class="fas fa-download text-brand"></i>
                </div>
            `;
        });
        html += '</div>';

        // Use a simple modal approach
        const modal = document.getElementById('cloudRestoreModal');
        if (modal) {
            document.getElementById('cloudBackupsList').innerHTML = html;
            modal.classList.add('active');
        } else {
            // Create temporary modal
            const tempModal = document.createElement('div');
            tempModal.className = 'modal active';
            tempModal.id = 'cloudRestoreModal';
            tempModal.innerHTML = `
                <div class="modal-content">
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                    <h3 class="mb-md">Cloud Backups</h3>
                    <div id="cloudBackupsList">${html}</div>
                </div>
            `;
            tempModal.onclick = function (e) { if (e.target === this) this.remove(); };
            document.body.appendChild(tempModal);
        }
    } catch (error) {
        showToast('Error', 'Failed to list backups: ' + error.message, 'error');
    }
}

async function performCloudRestore(fileId) {
    if (!confirm('This will replace current data. Are you sure?')) return;

    showToast('Info', 'Restoring backup...', 'info');

    try {
        const result = await storage.getFileDownload(BUCKET_ID, fileId);
        const response = await fetch(result);
        const content = await response.text();

        const decrypted = CryptoJS.AES.decrypt(content, 'welfare-backup-key');
        const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
        const data = JSON.parse(jsonString);

        if (!data.members) {
            showToast('Error', 'Invalid backup format', 'error');
            return;
        }

        membersData = data.members;
        overdraftsData = data.overdrafts || [];

        renderTable();
        renderOverdraftsTable();
        updateStatistics();

        showToast('Success', 'Backup restored successfully', 'success');
        addToAuditLog('Restore', `Restored from cloud backup (${data.timestamp || 'unknown'})`);

        // Close modal
        const modal = document.getElementById('cloudRestoreModal');
        if (modal) modal.classList.remove('active');
    } catch (error) {
        showToast('Error', 'Restore failed: ' + error.message, 'error');
    }
}
