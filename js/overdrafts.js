// --- OVERDRAFTS ---
const OVERDRAFTS_BUILD = '2026-03-05.10';
const OVERDRAFT_INTEREST_RATE = 0.02;

function getOverdraftPrincipal(od) {
    const value = Number(od && od.amount);
    return Number.isFinite(value) ? value : 0;
}

function getOverdraftInterest(od) {
    const explicitInterest = Number(od && od.interest);
    if (Number.isFinite(explicitInterest)) return explicitInterest;
    return Math.round((getOverdraftPrincipal(od) * OVERDRAFT_INTEREST_RATE + Number.EPSILON) * 100) / 100;
}

function getInterestCollectionDate(od) {
    const issuedRaw = od && (od.dateIssued || od.dateTaken) ? (od.dateIssued || od.dateTaken) : new Date();
    const issuedAt = new Date(issuedRaw);
    if (Number.isNaN(issuedAt.getTime())) return new Date();
    return new Date(issuedAt.getFullYear(), issuedAt.getMonth() + 1, 1);
}

function formatCollectionMonth(od) {
    return getInterestCollectionDate(od).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function isInterestCollectible(od) {
    const dueDate = getInterestCollectionDate(od);
    const now = new Date();
    if (now.getFullYear() > dueDate.getFullYear()) return true;
    if (now.getFullYear() < dueDate.getFullYear()) return false;
    return now.getMonth() >= dueDate.getMonth();
}

function getCollectibleCeilingNow(od) {
    const principal = getOverdraftPrincipal(od);
    const interest = getOverdraftInterest(od);
    return isInterestCollectible(od) ? (principal + interest) : principal;
}

function getOverdraftTotalDue(od) {
    if (!od) return 0;
    const totalDue = Number(od.totalDue);
    if (Number.isFinite(totalDue)) return totalDue;

    const totalRepayment = Number(od.totalRepayment);
    if (Number.isFinite(totalRepayment)) return totalRepayment;

    return getOverdraftPrincipal(od) + getOverdraftInterest(od);
}

function getRemainingTotal(od) {
    return Math.max(0, getOverdraftTotalDue(od) - (Number(od && od.amountPaid) || 0));
}

function getRemainingCollectibleNow(od) {
    const totalDue = getOverdraftTotalDue(od);
    const cappedDueNow = Math.min(totalDue, getCollectibleCeilingNow(od));
    return Math.max(0, cappedDueNow - (Number(od && od.amountPaid) || 0));
}

function getOverdraftStatusLabel(od) {
    const normalized = normalizeOverdraftStatus(od && od.status);
    if (normalized === OVERDRAFT_STATUS.SETTLED) return 'Settled';
    if (normalized === OVERDRAFT_STATUS.REJECTED) return 'Rejected';

    const principal = getOverdraftPrincipal(od);
    const paid = Number(od && od.amountPaid) || 0;
    if (!isInterestCollectible(od)) return `Interest in ${formatCollectionMonth(od)}`;
    if (paid < principal) return 'Principal Due';
    return 'Interest Due';
}

function getOverdraftStatusClass(od) {
    const normalized = normalizeOverdraftStatus(od && od.status);
    if (normalized === OVERDRAFT_STATUS.SETTLED) return 'status-paid';
    if (normalized === OVERDRAFT_STATUS.REJECTED) return 'status-rejected';
    if (isInterestCollectible(od)) return 'status-active';
    return 'status-pending';
}

function openIssueOverdraftModal() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can issue overdrafts', 'error');
        return;
    }
    const select = document.getElementById('odMember');
    if (!select) return;

    const activeMembers = membersData
        .filter(m => !m.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (activeMembers.length === 0) {
        showToast('No Members', 'Add an active member before issuing an overdraft', 'warning');
        return;
    }

    select.innerHTML = '<option value="">Select Member</option>';
    activeMembers.forEach(member => {
        select.innerHTML += `<option value="${member.id}">${escapeHtml(member.name)}</option>`;
    });
    document.getElementById('issueOverdraftForm').reset();
    document.getElementById('issueOverdraftModal').classList.add('active');
}

function closeIssueOverdraftModal() {
    document.getElementById('issueOverdraftModal').classList.remove('active');
}

async function issueOverdraft(event) {
    event.preventDefault();
    if (!isManager()) return;

    const memberId = document.getElementById('odMember').value;
    const amount = parseFloat(document.getElementById('odAmount').value);
    const reason = document.getElementById('odReason').value || 'N/A';

    if (!memberId || !amount || amount <= 0) {
        showToast('Error', 'Please fill all required fields', 'error');
        return;
    }

    const member = membersData.find(m => m.id === memberId);
    if (!member) {
        showToast('Error', 'Selected member could not be found. Please reopen the form.', 'error');
        return;
    }

    const interestAmount = Math.round((amount * OVERDRAFT_INTEREST_RATE + Number.EPSILON) * 100) / 100;
    const totalDue = Math.round((amount + interestAmount + Number.EPSILON) * 100) / 100;
    const totalRepayment = totalDue;

    if (!Number.isFinite(interestAmount) || !Number.isFinite(totalRepayment)) {
        showToast('Error', 'Failed to compute overdraft totals. Please check amount and settings.', 'error');
        return;
    }

    const issuedAt = new Date().toISOString();

    try {
        const createPayload = {
            memberId: memberId,
            memberName: member.name,
            amount: amount,
            interest: interestAmount,
            totalDue: totalDue,
            totalRepayment: totalRepayment,
            reason: reason,
            status: OVERDRAFT_STATUS.PENDING,
            dateTaken: issuedAt,
            dateIssued: issuedAt,
            amountPaid: 0
        };

        let response;
        try {
            response = await databases.createDocument(DB_ID, 'overdrafts', 'unique()', createPayload);
        } catch (firstError) {
            const firstMessage = String(firstError && firstError.message ? firstError.message : '');
            if (!firstMessage.includes('totalRepayment')) {
                throw firstError;
            }

            // Fallback for strict schemas that reject legacy alias fields.
            const retryPayload = { ...createPayload, totalRepayment: Number(totalRepayment) };
            delete retryPayload.totalDue;
            response = await databases.createDocument(DB_ID, 'overdrafts', 'unique()', retryPayload);
        }

        overdraftsData.push({
            id: response.$id,
            memberId: memberId,
            memberName: member.name,
            amount: amount,
            interest: interestAmount,
            totalDue: totalDue,
            totalRepayment: totalRepayment,
            reason: reason,
            status: OVERDRAFT_STATUS.PENDING,
            dateTaken: issuedAt,
            dateIssued: issuedAt,
            amountPaid: 0
        });

        showToast('Success', `Overdraft of ${formatCurrency(amount)} issued to ${member.name}`, 'success');
        addToAuditLog(
            'Issue Overdraft',
            `${member.name}: ${formatCurrency(amount)} (Interest: ${formatCurrency(interestAmount)} due ${formatCollectionMonth({ dateTaken: createPayload.dateTaken })})`
        );
        renderOverdraftsTable();
        closeIssueOverdraftModal();
    } catch (e) {
        console.error('Issue overdraft failed', e);
        const details = [
            e && e.message ? e.message : 'Unknown error',
            e && e.type ? `type=${e.type}` : '',
            e && typeof e.code !== 'undefined' ? `code=${e.code}` : '',
            `build=${OVERDRAFTS_BUILD}`,
            `repayment=${totalRepayment}`
        ].filter(Boolean).join(' | ');
        showToast('Error', 'Failed to issue overdraft: ' + details, 'error');
    }
}

function openRepayOverdraftModal(overdraftId) {
    if (!isManager()) return;
    const od = overdraftsData.find(o => o.id === overdraftId);
    if (!od) return;
    if (!isOpenOverdraftStatus(od.status)) {
        showToast('Action Not Allowed', 'Only pending or approved overdrafts can be repaid', 'warning');
        return;
    }

    const totalDue = getOverdraftTotalDue(od);
    const remaining = getRemainingTotal(od);
    const collectibleNow = getRemainingCollectibleNow(od);
    const collectionMonth = formatCollectionMonth(od);

    if (collectibleNow <= 0 && remaining > 0 && !isInterestCollectible(od)) {
        showToast('Interest Pending', `Interest will be collected in ${collectionMonth}`, 'info');
        return;
    }

    document.getElementById('repayOverdraftId').value = overdraftId;
    document.getElementById('repayMemberName').textContent = od.memberName;
    document.getElementById('repayPrincipal').textContent = formatCurrency(getOverdraftPrincipal(od));
    document.getElementById('repayInterest').textContent = formatCurrency(getOverdraftInterest(od));
    document.getElementById('repayCollectionMonth').textContent = collectionMonth;
    document.getElementById('repayTotalDue').textContent = formatCurrency(totalDue);
    document.getElementById('repayAmountPaid').textContent = formatCurrency(od.amountPaid || 0);
    document.getElementById('repayCollectibleNow').textContent = formatCurrency(collectibleNow);
    document.getElementById('repayRemaining').textContent = formatCurrency(remaining);
    document.getElementById('repayAmount').value = '';
    document.getElementById('repayAmount').max = collectibleNow;
    document.getElementById('repayOverdraftModal').classList.add('active');
    setTimeout(() => document.getElementById('repayAmount').focus(), 100);
}

function closeRepayOverdraftModal() {
    document.getElementById('repayOverdraftModal').classList.remove('active');
}

async function repayOverdraft(event) {
    event.preventDefault();
    if (!isManager()) return;

    const odId = document.getElementById('repayOverdraftId').value;
    const repayAmt = parseFloat(document.getElementById('repayAmount').value);

    const od = overdraftsData.find(o => o.id === odId);
    if (!od) return;
    if (!isOpenOverdraftStatus(od.status)) {
        showToast('Error', 'This overdraft is not in a repayable status', 'error');
        return;
    }

    const totalDue = getOverdraftTotalDue(od);
    const remaining = getRemainingTotal(od);
    const remainingCollectibleNow = getRemainingCollectibleNow(od);

    if (!repayAmt || repayAmt <= 0) {
        showToast('Error', 'Please enter a valid amount', 'error');
        return;
    }
    if (repayAmt > remaining) {
        showToast('Error', `Amount exceeds remaining balance of ${formatCurrency(remaining)}`, 'error');
        return;
    }
    if (repayAmt > remainingCollectibleNow) {
        if (!isInterestCollectible(od)) {
            showToast('Error', `Only principal can be collected now. Interest is due in ${formatCollectionMonth(od)}.`, 'error');
        } else {
            showToast('Error', `Amount exceeds collectible balance of ${formatCurrency(remainingCollectibleNow)}`, 'error');
        }
        return;
    }

    const newPaid = (od.amountPaid || 0) + repayAmt;
    let newStatus = OVERDRAFT_STATUS.PENDING;
    if (newPaid >= totalDue) {
        newStatus = OVERDRAFT_STATUS.SETTLED;
    } else if (isInterestCollectible(od)) {
        newStatus = OVERDRAFT_STATUS.APPROVED;
    }

    try {
        await databases.updateDocument(DB_ID, 'overdrafts', odId, {
            totalDue: totalDue,
            totalRepayment: totalDue,
            amountPaid: newPaid,
            status: newStatus
        });

        od.totalDue = totalDue;
        od.totalRepayment = totalDue;
        od.amountPaid = newPaid;
        od.status = newStatus;

        showToast('Success', `Payment of ${formatCurrency(repayAmt)} recorded`, 'success');
        addToAuditLog(
            'Repay Overdraft',
            `${od.memberName}: Paid ${formatCurrency(repayAmt)}. ${newStatus === OVERDRAFT_STATUS.SETTLED ? 'FULLY REPAID' : `Remaining: ${formatCurrency(totalDue - newPaid)}`}`
        );
        renderOverdraftsTable();
        closeRepayOverdraftModal();
    } catch (e) {
        showToast('Error', 'Failed to record payment: ' + e.message, 'error');
    }
}

function renderOverdraftsTable() {
    const tbody = document.getElementById('overdraftsTableBody');
    if (!tbody) return;
    const searchInput = document.getElementById('searchInput');
    const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();

    tbody.innerHTML = '';

    if (overdraftsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-hand-holding-usd"></i></div>
                        <h3>No overdrafts</h3>
                        <p>No overdraft records found.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    const sortedData = [...overdraftsData].sort((a, b) => {
        const aIsOpen = isOpenOverdraftStatus(a.status);
        const bIsOpen = isOpenOverdraftStatus(b.status);
        if (aIsOpen && !bIsOpen) return -1;
        if (!aIsOpen && bIsOpen) return 1;
        return new Date(b.dateTaken || b.dateIssued || 0) - new Date(a.dateTaken || a.dateIssued || 0);
    });

    const filteredData = sortedData.filter(od => {
        if (!searchTerm) return true;

        const member = String(od.memberName || '').toLowerCase();
        const reason = String(od.reason || '').toLowerCase();
        const status = String(od.status || '').toLowerCase();
        const collectionMonth = formatCollectionMonth(od).toLowerCase();
        return member.includes(searchTerm) || reason.includes(searchTerm) || status.includes(searchTerm) || collectionMonth.includes(searchTerm);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-search"></i></div>
                        <h3>No matching overdrafts found</h3>
                        <p>Try a different search term.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    filteredData.forEach(od => {
        const row = document.createElement('tr');
        const totalDue = getOverdraftTotalDue(od);
        const remaining = getRemainingTotal(od);
        const progress = totalDue > 0 ? ((od.amountPaid || 0) / totalDue * 100).toFixed(0) : 0;
        const isMgr = isManager();
        const statusText = getOverdraftStatusLabel(od);
        const statusClass = getOverdraftStatusClass(od);
        const isOpen = isOpenOverdraftStatus(od.status);
        const collectionMonth = formatCollectionMonth(od);

        row.innerHTML = `
            <td data-label="Member" class="font-bold">${escapeHtml(od.memberName)}</td>
            <td data-label="Principal" class="amount-cell">${formatCurrency(getOverdraftPrincipal(od))}</td>
            <td data-label="Interest (2%)" class="amount-cell text-warning">${formatCurrency(getOverdraftInterest(od))}</td>
            <td data-label="Collection Month" class="text-sm">${collectionMonth}</td>
            <td data-label="Total Repayment" class="amount-cell font-extra-bold">${formatCurrency(totalDue)}</td>
            <td data-label="Paid" class="amount-cell text-success">${formatCurrency(od.amountPaid || 0)}</td>
            <td data-label="Remaining" class="amount-cell" style="color: var(--brand-error);">${formatCurrency(remaining)}</td>
            <td data-label="Status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                ${isOpen ? `
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${progress}%;"></div>
                    </div>
                ` : ''}
            </td>
            <td data-label="Action">
                ${isOpen && isMgr ? `<button class="btn btn-success btn-sm" data-onclick="openRepayOverdraftModal('${od.id}')"><i class="fas fa-money-bill-wave"></i> <span class="btn-text">Repay</span></button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

