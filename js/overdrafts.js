// --- OVERDRAFTS ---

function getOverdraftStatusClass(status) {
    const normalized = normalizeOverdraftStatus(status);
    if (normalized === OVERDRAFT_STATUS.SETTLED) return 'status-paid';
    if (normalized === OVERDRAFT_STATUS.REJECTED) return 'status-rejected';
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

    const interestAmount = amount * INTEREST_RATE;
    const totalDue = amount + interestAmount;

    try {
        const response = await databases.createDocument(DB_ID, 'overdrafts', 'unique()', {
            memberId: memberId,
            memberName: member.name,
            amount: amount,
            interest: interestAmount,
            totalDue: totalDue,
            reason: reason,
            status: OVERDRAFT_STATUS.PENDING,
            dateTaken: new Date().toISOString(),
            amountPaid: 0
        });

        overdraftsData.push({
            id: response.$id,
            memberId: memberId,
            memberName: member.name,
            amount: amount,
            interest: interestAmount,
            totalDue: totalDue,
            reason: reason,
            status: OVERDRAFT_STATUS.PENDING,
            dateTaken: new Date().toISOString(),
            amountPaid: 0
        });

        showToast('Success', `Overdraft of ${formatCurrency(amount)} issued to ${member.name}`, 'success');
        addToAuditLog('Issue Overdraft', `${member.name}: ${formatCurrency(amount)} (Interest: ${formatCurrency(interestAmount)})`);
        renderOverdraftsTable();
        closeIssueOverdraftModal();
    } catch (e) {
        console.error('Issue overdraft failed', e);
        const details = [
            e && e.message ? e.message : 'Unknown error',
            e && e.type ? `type=${e.type}` : '',
            e && typeof e.code !== 'undefined' ? `code=${e.code}` : ''
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

    const remaining = od.totalDue - (od.amountPaid || 0);
    document.getElementById('repayOverdraftId').value = overdraftId;
    document.getElementById('repayMemberName').textContent = od.memberName;
    document.getElementById('repayTotalDue').textContent = formatCurrency(od.totalDue);
    document.getElementById('repayAmountPaid').textContent = formatCurrency(od.amountPaid || 0);
    document.getElementById('repayRemaining').textContent = formatCurrency(remaining);
    document.getElementById('repayAmount').value = '';
    document.getElementById('repayAmount').max = remaining;
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

    const remaining = od.totalDue - (od.amountPaid || 0);

    if (!repayAmt || repayAmt <= 0) {
        showToast('Error', 'Please enter a valid amount', 'error');
        return;
    }
    if (repayAmt > remaining) {
        showToast('Error', `Amount exceeds remaining balance of ${formatCurrency(remaining)}`, 'error');
        return;
    }

    const newPaid = (od.amountPaid || 0) + repayAmt;
    const newStatus = newPaid >= od.totalDue
        ? OVERDRAFT_STATUS.SETTLED
        : OVERDRAFT_STATUS.APPROVED;

    try {
        await databases.updateDocument(DB_ID, 'overdrafts', odId, {
            amountPaid: newPaid,
            status: newStatus
        });

        od.amountPaid = newPaid;
        od.status = newStatus;

        showToast('Success', `Payment of ${formatCurrency(repayAmt)} recorded`, 'success');
        addToAuditLog(
            'Repay Overdraft',
            `${od.memberName}: Paid ${formatCurrency(repayAmt)}. ${newStatus === OVERDRAFT_STATUS.SETTLED ? 'FULLY REPAID' : `Remaining: ${formatCurrency(od.totalDue - newPaid)}`}`
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
                <td colspan="8">
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
        return new Date(b.dateTaken) - new Date(a.dateTaken);
    });

    const filteredData = sortedData.filter(od => {
        if (!searchTerm) return true;

        const member = String(od.memberName || '').toLowerCase();
        const reason = String(od.reason || '').toLowerCase();
        const status = String(od.status || '').toLowerCase();
        return member.includes(searchTerm) || reason.includes(searchTerm) || status.includes(searchTerm);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
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
        const remaining = od.totalDue - (od.amountPaid || 0);
        const progress = od.totalDue > 0 ? ((od.amountPaid || 0) / od.totalDue * 100).toFixed(0) : 0;
        const dateTaken = new Date(od.dateTaken);
        const isMgr = isManager();
        const statusText = formatOverdraftStatus(od.status);
        const statusClass = getOverdraftStatusClass(od.status);
        const isOpen = isOpenOverdraftStatus(od.status);

        row.innerHTML = `
            <td data-label="Member" class="font-bold">${escapeHtml(od.memberName)}</td>
            <td data-label="Amount" class="amount-cell">${formatCurrency(od.amount)}</td>
            <td data-label="Interest" class="amount-cell text-warning">${formatCurrency(od.interest)}</td>
            <td data-label="Total Due" class="amount-cell font-extra-bold">${formatCurrency(od.totalDue)}</td>
            <td data-label="Paid" class="amount-cell text-success">${formatCurrency(od.amountPaid || 0)}</td>
            <td data-label="Date" class="text-sm">${dateTaken.toLocaleDateString()}</td>
            <td data-label="Status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                ${isOpen ? `
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${progress}%;"></div>
                    </div>
                ` : ''}
            </td>
            <td data-label="Action">
                ${isOpen && isMgr ? `<button class="btn btn-success btn-sm" onclick="openRepayOverdraftModal('${od.id}')"><i class="fas fa-money-bill-wave"></i> <span class="btn-text">Repay</span></button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}
