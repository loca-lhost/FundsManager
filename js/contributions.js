// --- CONTRIBUTIONS ---

function getContributionRefs() {
    return {
        modal: document.getElementById('contributionModal'),
        form: document.getElementById('contributionForm'),
        member: document.getElementById('contribMember'),
        month: document.getElementById('contribMonth'),
        amount: document.getElementById('contribAmount'),
        deleteBtn: document.getElementById('btnDeleteContribution')
    };
}

function populateContributionMembers(select, selectedId = '') {
    if (!select) return;
    select.innerHTML = '<option value="">Select Member</option>';

    membersData
        .filter(member => !member.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            if (String(selectedId) === String(member.id)) option.selected = true;
            select.appendChild(option);
        });
}

function populateContributionMonths(select, selectedMonth = '') {
    if (!select) return;
    select.innerHTML = '<option value="">Select Month</option>';

    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        if (selectedMonth === month) option.selected = true;
        select.appendChild(option);
    });
}

function openContributionModal() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can record contributions', 'error');
        return;
    }

    const refs = getContributionRefs();
    if (!refs.modal || !refs.form || !refs.member || !refs.month || !refs.amount) return;

    refs.form.reset();
    refs.modal.dataset.mode = 'create';
    refs.member.disabled = false;
    refs.month.disabled = false;

    populateContributionMembers(refs.member);
    populateContributionMonths(refs.month, months[new Date().getMonth()]);

    if (refs.deleteBtn) refs.deleteBtn.style.display = 'none';

    refs.modal.classList.add('active');
    setTimeout(() => refs.member.focus(), 100);
}

function editContribution(memberId, month, currentAmount) {
    if (!isManager()) return;

    const refs = getContributionRefs();
    if (!refs.modal || !refs.member || !refs.month || !refs.amount) return;

    populateContributionMembers(refs.member, memberId);
    populateContributionMonths(refs.month, month);

    refs.member.disabled = true;
    refs.month.disabled = true;
    refs.amount.value = currentAmount || '';
    refs.modal.dataset.mode = 'edit';

    if (refs.deleteBtn) refs.deleteBtn.style.display = 'flex';

    refs.modal.classList.add('active');
    setTimeout(() => refs.amount.focus(), 100);
}

function openBulkContributionModal() {
    openContributionModal();
}

function closeBulkContributionModal() {
    closeContributionModal();
}

function closeContributionModal() {
    const refs = getContributionRefs();
    if (!refs.modal || !refs.form || !refs.member || !refs.month) return;

    refs.modal.classList.remove('active');
    refs.member.disabled = false;
    refs.month.disabled = false;
    refs.form.reset();
}

async function saveContribution(event) {
    event.preventDefault();
    if (!isManager()) return;

    const refs = getContributionRefs();
    if (!refs.member || !refs.month || !refs.amount) return;

    const memberId = refs.member.value;
    const month = refs.month.value;
    const amount = parseFloat(refs.amount.value) || 0;

    if (!memberId || !month) {
        showToast('Error', 'Please select member and month', 'error');
        return;
    }

    const member = membersData.find(m => String(m.id) === String(memberId));
    if (!member) {
        showToast('Error', 'Member not found', 'error');
        return;
    }

    const oldAmount = member.contributions[month] || 0;
    member.contributions[month] = amount;

    try {
        const contribs = await databases.listDocuments(DB_ID, 'contributions', [
            Appwrite.Query.equal('memberId', memberId),
            Appwrite.Query.equal('year', currentYear),
            Appwrite.Query.equal('month', month),
            Appwrite.Query.limit(1)
        ]);

        if (contribs.documents.length > 0) {
            if (amount > 0) {
                await databases.updateDocument(DB_ID, 'contributions', contribs.documents[0].$id, {
                    amount: amount
                });
            } else {
                await databases.deleteDocument(DB_ID, 'contributions', contribs.documents[0].$id);
            }
        } else if (amount > 0) {
            await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                memberId: memberId,
                year: currentYear,
                month: month,
                amount: amount
            });
        }

        const action = refs.modal && refs.modal.dataset.mode === 'edit' ? 'Edit Contribution' : 'Record Contribution';
        addToAuditLog(action, `${member.name}: ${month} ${formatCurrency(oldAmount)} -> ${formatCurrency(amount)}`);
        showToast('Success', 'Contribution saved', 'success');
    } catch (e) {
        showToast('Error', 'Failed to save contribution: ' + e.message, 'error');
        member.contributions[month] = oldAmount;
    }

    renderTable();
    updateStatistics();
    closeContributionModal();
}

async function saveBulkContribution(event) {
    await saveContribution(event);
}

async function deleteContribution() {
    if (!isManager()) return;

    const refs = getContributionRefs();
    if (!refs.member || !refs.month) return;

    const memberId = refs.member.value;
    const month = refs.month.value;

    if (!memberId || !month) {
        showToast('Error', 'Select member and month first', 'error');
        return;
    }

    const member = membersData.find(m => String(m.id) === String(memberId));
    if (!member) return;

    const oldAmount = member.contributions[month] || 0;
    member.contributions[month] = 0;

    try {
        const contribs = await databases.listDocuments(DB_ID, 'contributions', [
            Appwrite.Query.equal('memberId', memberId),
            Appwrite.Query.equal('year', currentYear),
            Appwrite.Query.equal('month', month),
            Appwrite.Query.limit(1)
        ]);

        if (contribs.documents.length > 0) {
            await databases.deleteDocument(DB_ID, 'contributions', contribs.documents[0].$id);
        }

        showToast('Success', 'Contribution deleted', 'success');
        addToAuditLog('Delete Contribution', `${member.name}: ${month} (was ${formatCurrency(oldAmount)})`);
    } catch (e) {
        showToast('Error', 'Failed to delete: ' + e.message, 'error');
        member.contributions[month] = oldAmount;
    }

    renderTable();
    updateStatistics();
    closeContributionModal();
}
