// --- CONTRIBUTIONS ---

function editContribution(memberId, month, currentAmount) {
    if (!isManager()) return;
    document.getElementById('contribMemberId').value = memberId;
    document.getElementById('contribMonth').value = month;
    document.getElementById('contribCurrentAmount').textContent = formatCurrency(currentAmount);
    document.getElementById('contribAmount').value = currentAmount || '';
    document.getElementById('contributionModal').classList.add('active');
    setTimeout(() => document.getElementById('contribAmount').focus(), 100);
}

function openBulkContributionModal() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can record contributions', 'error');
        return;
    }

    const select = document.getElementById('bulkContribMember');
    select.innerHTML = '<option value="">Select Member</option>';
    membersData
        .filter(m => !m.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(member => {
            select.innerHTML += `<option value="${member.id}">${escapeHtml(member.name)}</option>`;
        });

    document.getElementById('bulkContribMonth').value = months[new Date().getMonth()];
    document.getElementById('bulkContribAmount').value = '';
    document.getElementById('bulkContributionModal').classList.add('active');
}

function closeBulkContributionModal() {
    document.getElementById('bulkContributionModal').classList.remove('active');
}

function closeContributionModal() {
    document.getElementById('contributionModal').classList.remove('active');
}

async function saveContribution(event) {
    event.preventDefault();
    if (!isManager()) return;

    const memberId = document.getElementById('contribMemberId').value;
    const month = document.getElementById('contribMonth').value;
    const amount = parseFloat(document.getElementById('contribAmount').value) || 0;

    const member = membersData.find(m => m.id === memberId);
    if (member) {
        const oldAmount = member.contributions[month] || 0;
        member.contributions[month] = amount;

        try {
            const contribs = await databases.listDocuments(DB_ID, 'contributions', [
                Appwrite.Query.equal('memberId', memberId),
                Appwrite.Query.equal('year', currentYear),
                Appwrite.Query.equal('month', month)
            ]);

            if (contribs.documents.length > 0) {
                await databases.updateDocument(DB_ID, 'contributions', contribs.documents[0].$id, {
                    amount: amount
                });
            } else {
                await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                    memberId: memberId,
                    year: currentYear,
                    month: month,
                    amount: amount
                });
            }

            addToAuditLog('Edit Contribution', `${member.name}: ${month} ${formatCurrency(oldAmount)} → ${formatCurrency(amount)}`);
        } catch (e) {
            showToast('Error', 'Failed to save contribution: ' + e.message, 'error');
            member.contributions[month] = oldAmount;
        }

        renderTable();
        updateStatistics();
    }

    closeContributionModal();
}

async function saveBulkContribution(event) {
    event.preventDefault();
    if (!isManager()) return;

    const memberId = document.getElementById('bulkContribMember').value;
    const month = document.getElementById('bulkContribMonth').value;
    const amount = parseFloat(document.getElementById('bulkContribAmount').value) || 0;

    if (!memberId) {
        showToast('Error', 'Please select a member', 'error');
        return;
    }

    const member = membersData.find(m => m.id === memberId);
    if (member) {
        const oldAmount = member.contributions[month] || 0;
        member.contributions[month] = amount;

        try {
            const contribs = await databases.listDocuments(DB_ID, 'contributions', [
                Appwrite.Query.equal('memberId', memberId),
                Appwrite.Query.equal('year', currentYear),
                Appwrite.Query.equal('month', month)
            ]);

            if (contribs.documents.length > 0) {
                await databases.updateDocument(DB_ID, 'contributions', contribs.documents[0].$id, {
                    amount: amount
                });
            } else {
                await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                    memberId: memberId,
                    year: currentYear,
                    month: month,
                    amount: amount
                });
            }

            showToast('Success', `Recorded ${formatCurrency(amount)} for ${member.name} (${month})`, 'success');
            addToAuditLog('Record Contribution', `${member.name}: ${month} = ${formatCurrency(amount)}`);
        } catch (e) {
            showToast('Error', 'Failed to save: ' + e.message, 'error');
            member.contributions[month] = oldAmount;
        }

        renderTable();
        updateStatistics();
    }

    closeBulkContributionModal();
}

async function deleteContribution() {
    if (!isManager()) return;

    const memberId = document.getElementById('contribMemberId').value;
    const month = document.getElementById('contribMonth').value;

    const member = membersData.find(m => m.id === memberId);
    if (member) {
        const oldAmount = member.contributions[month] || 0;
        member.contributions[month] = 0;

        try {
            const contribs = await databases.listDocuments(DB_ID, 'contributions', [
                Appwrite.Query.equal('memberId', memberId),
                Appwrite.Query.equal('year', currentYear),
                Appwrite.Query.equal('month', month)
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
    }

    closeContributionModal();
}
