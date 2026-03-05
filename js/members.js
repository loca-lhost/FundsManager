// --- MEMBER MANAGEMENT ---

function openAddMemberModal() {
    editingMemberId = null;
    document.getElementById('modalTitle').textContent = 'Add New Member';
    document.getElementById('modalArchiveBtn').style.display = 'none';
    document.getElementById('memberForm').reset();
    document.getElementById('defaultModalButtons').style.display = 'flex';
    document.getElementById('archiveConfirmationButtons').style.display = 'none';
    document.getElementById('memberModal').classList.add('active');
    trackFormChanges('memberForm');
    setTimeout(() => document.getElementById('memberName').focus(), 100);
}

function closeMemberModal() {
    if (!checkUnsavedChanges()) return;
    hideArchiveConfirmation();
    document.getElementById('memberModal').classList.remove('active');
}

function viewMemberProfile(id) {
    viewingMemberId = id;
    const currentMember = membersData.find(m => m.id === id);
    if (!currentMember) return;

    const contentDiv = document.getElementById('memberProfileContent');

    let html = `
        <div id="printableArea">
        <div class="profile-header-section">
            <div class="profile-avatar-lg">
                <i class="fas fa-user"></i>
            </div>
            <div>
                <h2 class="mb-sm text-dark">${escapeHtml(currentMember.name)}</h2>
                <div class="text-muted font-mono">${escapeHtml(formatAccountNumber(currentMember.accountNumber))}</div>
                ${currentMember.isArchived ? '<div class="mt-xs"><span class="status-badge badge-archived">ARCHIVED</span></div>' : ''}
            </div>
        </div>
    `;

    let historyHtml = `
        <h4 class="profile-section-title">Contribution History</h4>
        <div class="table-wrapper">
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Total Contribution</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let grandTotal = 0;
    const sortedYears = [...availableYears].sort((a, b) => b - a);

    sortedYears.forEach(year => {
        let yearData = [];
        if (year === currentYear) {
            yearData = membersData;
        } else {
            const stored = localStorage.getItem(`welfareData_${year}`);
            if (stored) yearData = JSON.parse(stored);
        }

        const memberRecord = yearData.find(m => m.id === id);

        if (memberRecord) {
            const yearTotal = calculateMemberTotal(memberRecord);
            grandTotal += yearTotal;
            historyHtml += `
                <tr>
                    <td class="font-bold">${year}</td>
                    <td data-label="Total Contribution" class="amount-cell font-bold">${formatCurrency(yearTotal)}</td>
                    <td data-label="Status"><span class="status-badge status-paid">Active</span></td>
                </tr>
            `;
        } else {
            historyHtml += `
                <tr>
                    <td class="font-bold">${year}</td>
                    <td data-label="Total Contribution" class="amount-cell">-</td>
                    <td data-label="Status"><span class="status-badge">Not a Member</span></td>
                </tr>
            `;
        }
    });

    historyHtml += `
                <tr class="total-row">
                    <td>TOTAL</td>
                    <td data-label="Total" class="amount-cell text-md">${formatCurrency(grandTotal)}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    </div>
    </div>
    `;

    html += historyHtml;

    html += `
        <div class="profile-actions no-print">
            <button class="btn btn-secondary" onclick="printMemberProfile()">
                <i class="fas fa-print"></i> <span class="btn-text">Print</span>
            </button>
            ${isAdmin() ? (currentMember.isArchived ?
            `<button class="btn btn-success" onclick="closeMemberProfileModal(); restoreMember('${currentMember.id}')"><i class="fas fa-trash-restore"></i> <span class="btn-text">Restore</span></button>` :
            `<button class="btn btn-danger" onclick="closeMemberProfileModal(); deleteMember('${currentMember.id}')"><i class="fas fa-archive"></i> <span class="btn-text">Archive</span></button>`) : ''}
            ${isManager() ? `<button class="btn btn-primary" onclick="closeMemberProfileModal(); editMember('${currentMember.id}')">
                <i class="fas fa-edit"></i> <span class="btn-text">Edit</span>
            </button>` : ''}
        </div>
    `;

    contentDiv.innerHTML = html;
    document.getElementById('memberProfileModal').classList.add('active');
}

function closeMemberProfileModal() {
    document.getElementById('memberProfileModal').classList.remove('active');
}

function editMember(id) {
    const member = membersData.find(m => m.id === id);
    if (member) {
        editingMemberId = id;
        document.getElementById('modalTitle').textContent = 'Edit Member';

        if (isAdmin()) {
            const archiveBtn = document.getElementById('modalArchiveBtn');
            const btnToggle = document.getElementById('btnArchiveToggle');
            const btnText = document.getElementById('archiveBtnText');
            const btnIcon = btnToggle.querySelector('i');

            archiveBtn.style.display = 'block';

            if (member.isArchived) {
                btnText.textContent = 'Restore';
                btnIcon.className = 'fas fa-trash-restore';
                btnToggle.className = 'btn btn-success';
            } else {
                btnText.textContent = 'Archive';
                btnIcon.className = 'fas fa-archive';
                btnToggle.className = 'btn btn-danger-subtle';
            }
        } else {
            document.getElementById('modalArchiveBtn').style.display = 'none';
        }

        document.getElementById('memberName').value = member.name;
        document.getElementById('accountNumber').value = member.accountNumber;
        document.getElementById('initialMonth').value = "";
        document.getElementById('initialAmount').value = "";

        document.getElementById('defaultModalButtons').style.display = 'flex';
        document.getElementById('archiveConfirmationButtons').style.display = 'none';
        document.getElementById('memberModal').classList.add('active');
        trackFormChanges('memberForm');
    }
}

function showArchiveConfirmation() {
    if (!editingMemberId) return;
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can archive or restore members', 'error');
        return;
    }

    const member = membersData.find(m => m.id === editingMemberId);
    if (!member) return;

    const defaultButtons = document.getElementById('defaultModalButtons');
    const confirmationButtons = document.getElementById('archiveConfirmationButtons');
    const confirmMsg = document.getElementById('archiveConfirmMsg');
    const confirmBtn = document.getElementById('btnArchiveConfirm');

    if (!defaultButtons || !confirmationButtons || !confirmMsg || !confirmBtn) return;

    defaultButtons.style.display = 'none';
    confirmationButtons.style.display = 'flex';

    if (member.isArchived) {
        confirmMsg.textContent = `Restore ${member.name}?`;
        confirmBtn.textContent = 'Restore';
        confirmBtn.className = 'btn btn-success';
    } else {
        confirmMsg.textContent = `Archive ${member.name}?`;
        confirmBtn.textContent = 'Archive';
        confirmBtn.className = 'btn btn-danger';
    }
}

function hideArchiveConfirmation() {
    const defaultButtons = document.getElementById('defaultModalButtons');
    const confirmationButtons = document.getElementById('archiveConfirmationButtons');
    if (defaultButtons) defaultButtons.style.display = 'flex';
    if (confirmationButtons) confirmationButtons.style.display = 'none';
}

async function confirmArchiveFromModal() {
    if (!editingMemberId) return;
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can archive or restore members', 'error');
        return;
    }

    const member = membersData.find(m => m.id === editingMemberId);
    if (!member) return;

    if (!member.isArchived) {
        const hasActiveOverdraft = overdraftsData.some(od => od.memberId === editingMemberId && isOpenOverdraftStatus(od.status));
        if (hasActiveOverdraft) {
            showToast('Action Prevented', 'Cannot archive member with active overdrafts. Please repay them first.', 'error');
            hideArchiveConfirmation();
            return;
        }
    }

    const nextArchivedState = !member.isArchived;

    try {
        await databases.updateDocument(DB_ID, 'members', editingMemberId, {
            isArchived: nextArchivedState
        });

        member.isArchived = nextArchivedState;
        renderTable();
        renderOverdraftsTable();
        updateStatistics();

        if (nextArchivedState) {
            showToast('Success', 'Member archived successfully', 'success');
            addToAuditLog('Soft Delete', `Archived member: ${member.name}`);
        } else {
            showToast('Success', 'Member restored successfully', 'success');
            addToAuditLog('Restore Member', `Restored member: ${member.name}`);
        }

        hideArchiveConfirmation();
        closeMemberModal();
    } catch (error) {
        showToast('Error', `Failed to ${nextArchivedState ? 'archive' : 'restore'} member: ${error.message}`, 'error');
    }
}

async function saveMember(event) {
    event.preventDefault();

    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can save members', 'error');
        return;
    }

    const name = document.getElementById('memberName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const initialMonth = document.getElementById('initialMonth').value;
    const initialAmount = parseFloat(document.getElementById('initialAmount').value) || 0;

    if (!/^\d{1,13}$/.test(accountNumber)) {
        showToast('Error', 'Account number must be numeric and up to 13 digits', 'error');
        return;
    }

    const existingMember = membersData.find(m => m.accountNumber === accountNumber && m.id !== editingMemberId);
    if (existingMember) {
        showToast('Error', 'Account number already exists', 'error');
        return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-inline"></div> Saving...';

    if (editingMemberId) {
        const memberIndex = membersData.findIndex(m => m.id === editingMemberId);
        if (memberIndex !== -1) {
            membersData[memberIndex].name = name;
            membersData[memberIndex].accountNumber = accountNumber;

            try {
                await databases.updateDocument(DB_ID, 'members', editingMemberId, {
                    name: name,
                    accountNumber: accountNumber
                });

                if (initialMonth && document.getElementById('initialAmount').value !== "") {
                    membersData[memberIndex].contributions[initialMonth] = initialAmount;
                }

                showToast('Success', 'Member updated successfully', 'success');
                addToAuditLog('Edit Member', `Updated member: ${name}`);
            } catch (e) {
                showToast('Error', 'Failed to update member: ' + e.message, 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }
        }
    } else {
        const newMember = {
            id: Date.now(),
            name: name,
            accountNumber: accountNumber,
            contributions: {}
        };

        try {
            const response = await databases.createDocument(DB_ID, 'members', 'unique()', {
                name: name,
                accountNumber: accountNumber,
                isArchived: false
            });

            newMember.id = response.$id;

            months.forEach(month => {
                newMember.contributions[month] = (month === initialMonth) ? initialAmount : 0;
            });

            membersData.push(newMember);
            showToast('Success', 'Member added successfully', 'success');
            addToAuditLog('Add Member', `Added new member: ${name}`);
        } catch (e) {
            showToast('Error', 'Failed to add member: ' + e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
    }

    renderTable();
    renderOverdraftsTable();
    updateStatistics();
    hasUnsavedChanges = false;
    closeMemberModal();
    btn.disabled = false;
    btn.innerHTML = originalText;
}

function deleteMember(memberId) {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can delete members', 'error');
        return;
    }
    memberToDeleteId = memberId;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    memberToDeleteId = null;
}

async function confirmDelete() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can delete members', 'error');
        return;
    }
    if (memberToDeleteId) {
        const member = membersData.find(m => m.id === memberToDeleteId);
        const memberName = member ? member.name : 'Unknown';

        const hasActiveOverdraft = overdraftsData.some(od => od.memberId === memberToDeleteId && isOpenOverdraftStatus(od.status));
        if (hasActiveOverdraft) {
            showToast('Action Prevented', 'Cannot archive member with active overdrafts. Please repay them first.', 'error');
            closeDeleteModal();
            return;
        }

        try {
            await databases.updateDocument(DB_ID, 'members', memberToDeleteId, {
                isArchived: true
            });

            if (member) member.isArchived = true;

            renderTable();
            updateStatistics();
            showToast('Success', 'Member moved to archives', 'success');
            addToAuditLog('Soft Delete', `Archived member: ${memberName}`);
            closeDeleteModal();
        } catch (error) {
            showToast('Error', 'Failed to archive member: ' + error.message, 'error');
        }
    }
}

function restoreMember(memberId) {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can restore members', 'error');
        return;
    }
    memberToRestoreId = memberId;
    document.getElementById('restoreModal').classList.add('active');
}

function closeRestoreModal() {
    document.getElementById('restoreModal').classList.remove('active');
    memberToRestoreId = null;
}

async function confirmRestore() {
    if (memberToRestoreId) {
        const member = membersData.find(m => m.id === memberToRestoreId);
        if (member) {
            try {
                await databases.updateDocument(DB_ID, 'members', memberToRestoreId, {
                    isArchived: false
                });

                member.isArchived = false;
                renderTable();
                updateStatistics();
                showToast('Success', 'Member restored successfully', 'success');
                addToAuditLog('Restore Member', `Restored member: ${member.name}`);
                closeRestoreModal();
            } catch (error) {
                showToast('Error', 'Failed to restore member: ' + error.message, 'error');
            }
        }
    }
}

function filterByStat(type) {
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active-filter'));

    if (type === 'active') {
        statFilter = null;
        document.getElementById('searchInput').value = '';
        if (showArchived) toggleArchivedView();
        showToast('Filter Reset', 'Showing all active members');
    } else {
        if (statFilter === type) {
            statFilter = null;
            showToast('Filter Cleared', 'Showing default view');
        } else {
            statFilter = type;
            document.getElementById(`card-${type}`).classList.add('active-filter');
            if (type === 'total') showToast('Sorted', 'Sorted by total contribution');
            if (type === 'average') showToast('Filtered', 'Showing above average contributors');
            if (type === 'month') showToast('Filtered', 'Showing contributors for this month');
        }
    }
    renderTable();
}

function toggleArchivedView() {
    showArchived = !showArchived;
    const btnText = document.getElementById('archiveToggleText');
    const btnIcon = document.getElementById('archiveToggleIcon');

    if (showArchived) {
        btnText.textContent = 'Hide Archived';
        btnIcon.style.color = 'var(--brand-warning)';
    } else {
        btnText.textContent = 'Show Archived';
        btnIcon.style.color = '#666';
    }
    renderTable();
}

function toggleRow(element) {
    const row = element.closest('tr');
    row.classList.toggle('expanded');
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('searchInput');
    const monthFilterSelect = document.getElementById('monthFilter');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    const monthFilter = monthFilterSelect ? monthFilterSelect.value : '';

    tbody.innerHTML = '';

    if (membersData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-users"></i></div>
                        <h3>No members yet</h3>
                        <p>Click "Add Member" to get started.</p>
                    </div>
                </td>
            </tr>`;
        updateMonthlyTotals();
        return;
    }

    let filteredData = membersData.filter(member => {
        const isArchivedMember = member.isArchived || false;
        if (showArchived !== isArchivedMember) return false;

        const matchesSearch = member.name.toLowerCase().includes(searchTerm) ||
            member.accountNumber.includes(searchTerm);
        const matchesMonth = !monthFilter || (member.contributions[monthFilter] || 0) > 0;
        return matchesSearch && matchesMonth;
    });

    if (statFilter === 'total') {
        filteredData.sort((a, b) => calculateMemberTotal(b) - calculateMemberTotal(a));
    } else if (statFilter === 'average') {
        const totalContribs = membersData.reduce((sum, m) => sum + calculateMemberTotal(m), 0);
        const avg = membersData.length ? totalContribs / membersData.length : 0;
        filteredData = filteredData.filter(m => calculateMemberTotal(m) >= avg);
        filteredData.sort((a, b) => calculateMemberTotal(b) - calculateMemberTotal(a));
    } else if (statFilter === 'month') {
        const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
        filteredData = filteredData.filter(m => (m.contributions[currentMonthName] || 0) > 0);
        filteredData.sort((a, b) => (b.contributions[currentMonthName] || 0) - (a.contributions[currentMonthName] || 0));
    }

    if (filteredData.length === 0) {
        const emptyMessage = monthFilter
            ? `No members found with contributions in ${monthFilter}.`
            : 'Try adjusting your search terms.';
        tbody.innerHTML = `
            <tr>
                <td colspan="15">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-search"></i></div>
                        <h3>No matching members found</h3>
                        <p>${emptyMessage}</p>
                    </div>
                </td>
            </tr>`;
    }

    filteredData.forEach(member => {
        const row = document.createElement('tr');
        const memberTotal = calculateMemberTotal(member);
        const isMgr = isManager();
        const isAdm = isAdmin();

        row.innerHTML = `
            <td onclick="viewMemberProfile('${member.id}')" class="cursor-pointer text-brand font-bold">
                ${escapeHtml(member.name)} 
                ${member.isArchived ? '<span class="status-badge badge-archived-sm">ARCHIVED</span>' : ''}
                ${member.isArchived && isAdm ? `<button class="btn btn-success btn-sm" style="margin-left:10px; padding: 2px 8px; font-size: 0.7rem;" onclick="event.stopPropagation(); restoreMember('${member.id}')"><i class="fas fa-trash-restore"></i> Restore</button>` : ''}
                <i class="fas fa-chevron-down mobile-toggle-icon" onclick="event.stopPropagation(); toggleRow(this)"></i>
            </td>
            <td data-label="Account Number">${escapeHtml(formatAccountNumber(member.accountNumber))}</td>
            ${months.map(month => `
                <td data-label="${month}" 
                    class="amount-cell month-cell ${member.contributions[month] > 0 ? 'amount-positive' : 'amount-zero'} ${isMgr ? 'editable-cell' : ''}"
                    ${isMgr ? `onclick="editContribution('${member.id}', '${month}', ${member.contributions[month]})" title="Click to edit"` : ''}>
                    ${formatCurrency(member.contributions[month], false)}
                </td>
            `).join('')}
            <td data-label="Total" class="amount-cell font-extra-bold text-dark">
                ${formatCurrency(memberTotal, false)}
            </td>
        `;

        tbody.appendChild(row);
    });

    updateMonthlyTotals();
}

function updateMonthlyTotals() {
    let grandTotal = 0;

    months.forEach((month, index) => {
        const total = membersData.reduce((sum, member) => sum + (member.contributions[month] || 0), 0);
        const shortMonth = month.substring(0, 3);
        document.getElementById(`total${shortMonth}`).textContent = formatCurrency(total, false);
        grandTotal += total;
    });

    document.getElementById('grandTotal').textContent = formatCurrency(grandTotal, false);
}

function updateStatistics() {
    const totalMembers = membersData.length;
    const totalContributions = membersData.reduce((sum, member) =>
        sum + calculateMemberTotal(member), 0);

    const date = new Date();
    const currentMonthIndex = date.getMonth();
    const currentMonthName = months[currentMonthIndex];

    const currentMonthTotal = membersData.reduce((sum, m) => sum + (m.contributions[currentMonthName] || 0), 0);

    let prevMonthTotal = 0;
    if (currentMonthIndex > 0) {
        const prevMonthName = months[currentMonthIndex - 1];
        prevMonthTotal = membersData.reduce((sum, m) => sum + (m.contributions[prevMonthName] || 0), 0);
    } else {
        const prevYearData = localStorage.getItem(`welfareData_${currentYear - 1}`);
        if (prevYearData) {
            const prevData = JSON.parse(prevYearData);
            prevMonthTotal = prevData.reduce((sum, m) => sum + (m.contributions['December'] || 0), 0);
        }
    }

    let trendHtml = '';
    if (currentMonthTotal > prevMonthTotal) {
        trendHtml = `<span class="trend-up" title="Up from ${formatCurrency(prevMonthTotal)}"><i class="fas fa-arrow-up"></i></span>`;
    } else if (currentMonthTotal < prevMonthTotal) {
        trendHtml = `<span class="trend-down" title="Down from ${formatCurrency(prevMonthTotal)}"><i class="fas fa-arrow-down"></i></span>`;
    } else {
        trendHtml = `<span class="trend-flat" title="Same as last month"><i class="fas fa-minus"></i></span>`;
    }

    document.getElementById('totalMembers').textContent = totalMembers;
    document.getElementById('totalContributions').textContent = formatCurrency(totalContributions);
    document.getElementById('currentMonth').innerHTML = `${currentMonthName}${trendHtml}`;
}

function printMemberProfile() {
    const printContent = document.getElementById('printableArea').innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Error', 'Popups blocked. Please allow popups to print.', 'error');
        return;
    }
    printWindow.document.write(`
        <html>
        <head>
            <title>Member Profile</title>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root { --brand-blue: #003087; }
                body { font-family: 'Inter', sans-serif; padding: 40px; padding-bottom: 60px; color: #1e293b; }
                .report-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid var(--brand-blue); padding-bottom: 20px; }
                .header-left { display: flex; align-items: center; gap: 20px; }
                .logo { width: 60px; height: 60px; background: var(--brand-blue) !important; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white !important; font-size: 24px; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .company-info h1 { font-family: 'Montserrat', sans-serif; color: var(--brand-blue); margin: 0 0 5px 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                .company-info p { color: #64748b; margin: 0; font-size: 14px; font-weight: 500; }
                .table-wrapper { overflow: visible !important; border: none !important; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                th { background-color: #f8fafc; color: var(--brand-blue); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-top: 2px solid #e2e8f0; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .amount-cell { text-align: right; font-family: 'Inter', monospace; font-weight: 500; }
                .total-row { font-weight: 800; background-color: #f0f9ff !important; }
                .total-row td { border-top: 2px solid var(--brand-blue); color: var(--brand-blue); font-size: 13px; }
                .status-badge { padding: 4px 12px; border-radius: 50px; font-size: 10px; font-weight: 700; display: inline-block; text-transform: uppercase; }
                .status-paid { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
                h2 { font-family: 'Montserrat', sans-serif; font-size: 24px; margin: 0; color: #0f172a; }
                h4 { font-family: 'Montserrat', sans-serif; font-size: 16px; color: var(--brand-blue); margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                .report-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 40px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; background: white; }
                @page { size: portrait; margin: 1cm; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div class="header-left">
                    <div class="logo">₵</div>
                    <div class="company-info">
                        <h1>Funds Manager</h1>
                        <p>Funds Management Systems</p>
                    </div>
                </div>
                <div class="text-right text-xs text-slate">
                    <div>Profile Report</div>
                    <div>${new Date().toLocaleDateString()}</div>
                </div>
            </div>
            
            ${printContent}
            
            <div class="report-footer">
                <span>Funds Manager &copy; ${currentYear}</span>
                <span>${new Date().toLocaleDateString()}</span>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
}
