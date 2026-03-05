// --- EXPORT (Excel / CSV / PDF) ---

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Error', 'Excel library not loaded', 'error');
        return;
    }

    const wsData = [
        ['Funds Manager - ' + currentYear],
        ['', '', ...months, 'Total'],
        ['Name', 'Account No.', ...months, 'Total']
    ];

    membersData.forEach(member => {
        const total = calculateMemberTotal(member);
        wsData.push([
            member.name,
            member.accountNumber,
            ...months.map(m => member.contributions[m] || 0),
            total
        ]);
    });

    // Monthly totals row
    const totalsRow = ['TOTALS', ''];
    let grandTotal = 0;
    months.forEach(month => {
        const mTotal = membersData.reduce((s, m) => s + (m.contributions[month] || 0), 0);
        totalsRow.push(mTotal);
        grandTotal += mTotal;
    });
    totalsRow.push(grandTotal);
    wsData.push(totalsRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');

    // Overdrafts sheet
    if (overdraftsData.length > 0) {
        const odData = [
            ['Overdrafts - ' + currentYear],
            ['Member', 'Principal', 'Interest (2%)', 'Collection Month', 'Total Repayment', 'Paid', 'Remaining', 'Status', 'Date Issued', 'Reason']
        ];
        overdraftsData.forEach(od => {
            const totalRepayment = typeof getOverdraftTotalDue === 'function'
                ? getOverdraftTotalDue(od)
                : (Number(od.totalDue || od.totalRepayment || 0));
            const collectionMonth = typeof formatCollectionMonth === 'function'
                ? formatCollectionMonth(od)
                : new Date(od.dateTaken).toLocaleDateString();
            const remaining = Math.max(0, totalRepayment - (od.amountPaid || 0));
            odData.push([
                od.memberName,
                od.amount,
                od.interest,
                collectionMonth,
                totalRepayment,
                od.amountPaid || 0,
                remaining,
                typeof getOverdraftStatusLabel === 'function' ? getOverdraftStatusLabel(od) : od.status,
                new Date(od.dateTaken).toLocaleDateString(),
                od.reason
            ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(odData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Overdrafts');
    }

    XLSX.writeFile(wb, `FundsManager_${currentYear}.xlsx`);
    showToast('Success', 'Data exported to Excel', 'success');
    addToAuditLog('Export', 'Exported data to Excel');
}

function exportToCSV() {
    let csv = 'Name,Account Number,' + months.join(',') + ',Total\n';

    membersData.forEach(member => {
        const total = calculateMemberTotal(member);
        csv += `"${member.name}","${member.accountNumber}",`;
        csv += months.map(m => member.contributions[m] || 0).join(',');
        csv += `,${total}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FundsManager_${currentYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Success', 'Data exported to CSV', 'success');
}

async function importExcel() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can import data', 'error');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';

    input.onchange = async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Find the header row (contains month names)
                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
                    const row = jsonData[i];
                    if (row && row.some(cell => months.includes(String(cell)))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    showToast('Error', 'Could not find month headers in the spreadsheet. Expected headers like: Name, Account No., January, February...', 'error');
                    return;
                }

                const headers = jsonData[headerRowIndex].map(h => String(h).trim());
                const dataRows = jsonData.slice(headerRowIndex + 1);

                let imported = 0;
                let updated = 0;
                let errors = 0;

                for (const row of dataRows) {
                    if (!row || row.length < 3) continue;

                    const name = String(row[0] || '').trim();
                    const accountNumber = String(row[1] || '').trim();

                    if (!name || name === '' || name === 'TOTALS') continue;

                    const contributions = {};
                    months.forEach(month => {
                        const colIndex = headers.indexOf(month);
                        if (colIndex !== -1 && row[colIndex] !== undefined) {
                            contributions[month] = parseFloat(row[colIndex]) || 0;
                        } else {
                            contributions[month] = 0;
                        }
                    });

                    // Check if member exists (by account number or name)
                    const existingMember = membersData.find(m =>
                        m.accountNumber === accountNumber || m.name.toLowerCase() === name.toLowerCase()
                    );

                    if (existingMember) {
                        // Update existing
                        months.forEach(month => {
                            if (contributions[month] > 0) {
                                existingMember.contributions[month] = contributions[month];
                            }
                        });

                        try {
                            // Update contributions in Appwrite
                            for (const month of months) {
                                if (contributions[month] > 0) {
                                    const contribs = await databases.listDocuments(DB_ID, 'contributions', [
                                        Appwrite.Query.equal('memberId', existingMember.id),
                                        Appwrite.Query.equal('year', currentYear),
                                        Appwrite.Query.equal('month', month)
                                    ]);

                                    if (contribs.documents.length > 0) {
                                        await databases.updateDocument(DB_ID, 'contributions', contribs.documents[0].$id, {
                                            amount: contributions[month]
                                        });
                                    } else {
                                        await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                                            memberId: existingMember.id,
                                            year: currentYear,
                                            month: month,
                                            amount: contributions[month]
                                        });
                                    }
                                }
                            }
                            updated++;
                        } catch (err) {
                            console.error(`Error updating ${name}:`, err);
                            errors++;
                        }
                    } else {
                        // Create new member
                        try {
                            const response = await databases.createDocument(DB_ID, 'members', 'unique()', {
                                name: name,
                                accountNumber: accountNumber || '0',
                                isArchived: false
                            });

                            const newMember = {
                                id: response.$id,
                                name: name,
                                accountNumber: accountNumber || '0',
                                contributions: contributions,
                                isArchived: false
                            };

                            // Save contributions
                            for (const month of months) {
                                if (contributions[month] > 0) {
                                    await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                                        memberId: response.$id,
                                        year: currentYear,
                                        month: month,
                                        amount: contributions[month]
                                    });
                                }
                            }

                            membersData.push(newMember);
                            imported++;
                        } catch (err) {
                            console.error(`Error importing ${name}:`, err);
                            errors++;
                        }
                    }
                }

                renderTable();
                updateStatistics();

                let msg = `Import complete: ${imported} new, ${updated} updated`;
                if (errors > 0) msg += `, ${errors} errors`;
                showToast('Import Results', msg, errors > 0 ? 'warning' : 'success');
                addToAuditLog('Import', msg);

            } catch (error) {
                console.error('Import error:', error);
                showToast('Error', 'Failed to import: ' + error.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    input.click();
}

function generatePDF() {
    if (typeof html2pdf === 'undefined') {
        showToast('Error', 'PDF library not loaded', 'error');
        return;
    }

    const table = document.querySelector('.table-wrapper');
    if (!table) return;

    showToast('Info', 'Generating PDF...', 'info');

    const opt = {
        margin: 10,
        filename: `FundsManager_${currentYear}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(table).save().then(() => {
        showToast('Success', 'PDF generated', 'success');
        addToAuditLog('Export', 'Generated PDF report');
    });
}
