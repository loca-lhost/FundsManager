// --- BACKUP & RESTORE ---

const BACKUP_FORMAT_VERSION = '3.0';
const BACKUP_KDF_ITERATIONS = 150000;
const BACKUP_SALT_BYTES = 16;
const BACKUP_IV_BYTES = 16;

function openBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.add('active');
}

function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.classList.remove('active');
}

function backupData() {
    backupToLocal();
}

function restoreData() {
    restoreFromLocal();
}

function buildBackupDataSnapshot() {
    return {
        version: BACKUP_FORMAT_VERSION,
        timestamp: new Date().toISOString(),
        year: currentYear,
        members: membersData,
        overdrafts: overdraftsData,
        availableYears: availableYears
    };
}

function parseJsonSafe(content) {
    try {
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

function createBackupError(message, code = 'BACKUP_PARSE_ERROR') {
    const error = new Error(message);
    error.code = code;
    return error;
}

function isModernEncryptedBackupPayload(value) {
    if (!value || typeof value !== 'object') return false;
    return value.encryption === 'AES-256-CBC-PBKDF2'
        && typeof value.iterations === 'number'
        && typeof value.salt === 'string'
        && typeof value.iv === 'string'
        && typeof value.ct === 'string';
}

function promptForBackupPassphrase(mode, requireConfirmation = false) {
    const intent = mode === 'restore' ? 'restore' : 'create';
    const passphrase = prompt(`Enter a backup passphrase to ${intent} this file.\nUse at least 8 characters and store it safely.`);
    if (passphrase == null) return null;

    if (passphrase.length < 8) {
        alert('Passphrase must be at least 8 characters.');
        return null;
    }

    if (!requireConfirmation) return passphrase;

    const confirmPassphrase = prompt('Re-enter the passphrase to confirm.');
    if (confirmPassphrase == null) return null;

    if (confirmPassphrase !== passphrase) {
        alert('Passphrases do not match.');
        return null;
    }

    return passphrase;
}

function deriveBackupKey(passphrase, saltHex, iterations) {
    const salt = CryptoJS.enc.Hex.parse(saltHex);
    return CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256 / 32,
        iterations: iterations,
        hasher: CryptoJS.algo.SHA256
    });
}

function encryptBackupJson(jsonString, passphrase) {
    const salt = CryptoJS.lib.WordArray.random(BACKUP_SALT_BYTES);
    const iv = CryptoJS.lib.WordArray.random(BACKUP_IV_BYTES);
    const key = CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256 / 32,
        iterations: BACKUP_KDF_ITERATIONS,
        hasher: CryptoJS.algo.SHA256
    });

    const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    const payload = {
        version: BACKUP_FORMAT_VERSION,
        encryption: 'AES-256-CBC-PBKDF2',
        iterations: BACKUP_KDF_ITERATIONS,
        salt: salt.toString(CryptoJS.enc.Hex),
        iv: iv.toString(CryptoJS.enc.Hex),
        ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64)
    };

    return JSON.stringify(payload);
}

function decryptModernEncryptedBackup(payload, passphrase) {
    const iterations = Number.isFinite(payload.iterations) ? payload.iterations : BACKUP_KDF_ITERATIONS;
    const key = deriveBackupKey(passphrase, payload.salt, iterations);
    const iv = CryptoJS.enc.Hex.parse(payload.iv);
    const ciphertext = CryptoJS.enc.Base64.parse(payload.ct);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!jsonString) {
        throw createBackupError('Invalid passphrase for this backup file.', 'BACKUP_INVALID_PASSPHRASE');
    }

    return JSON.parse(jsonString);
}

function parseBackupContent(content, passphrase = '') {
    const text = String(content || '').trim();
    if (!text) {
        throw createBackupError('Backup file is empty.');
    }

    const parsedJson = parseJsonSafe(text);

    if (parsedJson && Array.isArray(parsedJson.members)) {
        return { data: parsedJson, encryption: 'none' };
    }

    if (parsedJson && isModernEncryptedBackupPayload(parsedJson)) {
        if (!passphrase) {
            throw createBackupError('Passphrase required for this backup file.', 'BACKUP_PASSPHRASE_REQUIRED');
        }
        const decryptedData = decryptModernEncryptedBackup(parsedJson, passphrase);
        return { data: decryptedData, encryption: 'modern' };
    }

    if (parsedJson) {
        throw createBackupError('Unsupported backup file format.');
    }

    throw createBackupError('Invalid backup file or passphrase.');
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

        const restoredIssuedAt = backupOverdraft.dateIssued || backupOverdraft.dateTaken || new Date().toISOString();

        await databases.createDocument(DB_ID, 'overdrafts', 'unique()', {
            memberId: targetMemberId,
            memberName: memberName,
            amount: sanitizeMoney(backupOverdraft.amount, 0),
            interest: sanitizeMoney(backupOverdraft.interest, 0),
            totalDue: totalDue,
            totalRepayment: totalDue,
            reason: backupOverdraft.reason || 'N/A',
            status: normalizeOverdraftStatus(backupOverdraft.status || OVERDRAFT_STATUS.PENDING),
            dateTaken: restoredIssuedAt,
            dateIssued: restoredIssuedAt,
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

function backupToLocal() {
    const passphrase = promptForBackupPassphrase('create', true);
    if (!passphrase) {
        showToast('Info', 'Backup cancelled', 'info');
        return;
    }

    const backupData = buildBackupDataSnapshot();
    const jsonString = JSON.stringify(backupData, null, 2);
    const encrypted = encryptBackupJson(jsonString, passphrase);

    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FundsManager_Backup_${currentYear}_${new Date().toISOString().split('T')[0]}.wbk`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Success', 'Encrypted backup downloaded', 'success');
    addToAuditLog('Backup', `Encrypted local backup created for ${currentYear}`);
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
                let parsedResult;

                try {
                    parsedResult = parseBackupContent(content);
                } catch (parseError) {
                    if (parseError && parseError.code === 'BACKUP_PASSPHRASE_REQUIRED') {
                        const passphrase = promptForBackupPassphrase('restore', false);
                        if (!passphrase) {
                            showToast('Info', 'Restore cancelled', 'info');
                            return;
                        }
                        parsedResult = parseBackupContent(content, passphrase);
                    } else {
                        throw parseError;
                    }
                }

                const result = await restoreBackupDataToDatabase(parsedResult.data);
                const summary = `Year ${result.year}: ${result.members} members, ${result.contributions} contributions, ${result.overdrafts} overdrafts restored`;

                showToast('Success', summary, 'success');
                if (result.skippedOverdrafts > 0) {
                    showToast('Warning', `${result.skippedOverdrafts} overdrafts skipped due to missing member mapping`, 'warning');
                }
                if (parsedResult.encryption === 'none') {
                    showToast('Warning', 'Restored an unencrypted backup file.', 'warning');
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
