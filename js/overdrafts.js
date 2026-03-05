// --- OVERDRAFTS ---

function openIssueOverdraftModal() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can issue overdrafts', 'error');
        return;
    }
    const select = document.getElementById('odMember');
    select.innerHTML = '<option value="">Select Member</option>';
    membersData
        .filter(m => !m.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(member => {
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
    if (!member) return;

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
            status: 'Active',
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
            status: 'Active',
            dateTaken: new Date().toISOString(),
            amountPaid: 0
        });

        showToast('Success', `Overdraft of ${formatCurrency(amount)} issued to ${member.name}`, 'success');
        addToAuditLog('Issue Overdraft', `${member.name}: ${formatCurrency(amount)} (Interest: ${formatCurrency(interestAmount)})`);
        renderOverdraftsTable();
        closeIssueOverdraftModal();
    } catch (e) {
        showToast('Error', 'Failed to issue overdraft: ' + e.message, 'error');
    }
}

function openRepayOverdraftModal(overdraftId) {
    if (!isManager()) return;
    const od = overdraftsData.find(o => o.id === overdraftId);
    if (!od) return;

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
    const newStatus = newPaid >= od.totalDue ? 'Paid' : 'Active';

    try {
        await databases.updateDocument(DB_ID, 'overdrafts', odId, {
            amountPaid: newPaid,
            status: newStatus
        });

        od.amountPaid = newPaid;
        od.status = newStatus;

        showToast('Success', `Payment of ${formatCurrency(repayAmt)} recorded`, 'success');
        addToAuditLog('Repay Overdraft', `${od.memberName}: Paid ${formatCurrency(repayAmt)}. ${newStatus === 'Paid' ? 'FULLY REPAID' : `Remaining: ${formatCurrency(od.totalDue - newPaid)}`}`);
        renderOverdraftsTable();
        closeRepayOverdraftModal();
    } catch (e) {
        showToast('Error', 'Failed to record payment: ' + e.message, 'error');
    }
}

function renderOverdraftsTable() {
    const tbody = document.getElementById('overdraftsTableBody');
    if (!tbody) return;

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
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return new Date(b.dateTaken) - new Date(a.dateTaken);
    });

    sortedData.forEach(od => {
        const row = document.createElement('tr');
        const remaining = od.totalDue - (od.amountPaid || 0);
        const progress = od.totalDue > 0 ? ((od.amountPaid || 0) / od.totalDue * 100).toFixed(0) : 0;
        const dateTaken = new Date(od.dateTaken);
        const isMgr = isManager();

        row.innerHTML = `
            <td data-label="Member" class="font-bold">${escapeHtml(od.memberName)}</td>
            <td data-label="Amount" class="amount-cell">${formatCurrency(od.amount)}</td>
            <td data-label="Interest" class="amount-cell text-warning">${formatCurrency(od.interest)}</td>
            <td data-label="Total Due" class="amount-cell font-extra-bold">${formatCurrency(od.totalDue)}</td>
            <td data-label="Paid" class="amount-cell text-success">${formatCurrency(od.amountPaid || 0)}</td>
            <td data-label="Date" class="text-sm">${dateTaken.toLocaleDateString()}</td>
            <td data-label="Status">
                <span class="status-badge ${od.status === 'Active' ? 'status-pending' : 'status-paid'}">${od.status}</span>
                ${od.status === 'Active' ? `
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${progress}%;"></div>
                    </div>
                ` : ''}
            </td>
            <td data-label="Action">
                ${od.status === 'Active' && isMgr ? `<button class="btn btn-success btn-sm" onclick="openRepayOverdraftModal('${od.id}')"><i class="fas fa-money-bill-wave"></i> <span class="btn-text">Repay</span></button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}
