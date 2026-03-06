// --- DIVIDENDS ---

function getDividendPoolBreakdown() {
    const overdraftInterest = overdraftsData.reduce((sum, od) => sum + (od.interest || 0), 0);
    const broughtForwardInput = document.getElementById('dividendBroughtForward');
    const monthlyInterestInput = document.getElementById('dividendMonthlyInterest');
    const broughtForward = parseFloat(broughtForwardInput?.value) || 0;
    const monthlyInterest = parseFloat(monthlyInterestInput?.value) || 0;
    const totalPool = overdraftInterest + broughtForward + monthlyInterest;

    return { overdraftInterest, broughtForward, monthlyInterest, totalPool };
}

function openDividendModal() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can calculate dividends', 'error');
        return;
    }
    const { overdraftInterest } = getDividendPoolBreakdown();
    document.getElementById('systemOverdraftInterest').value = formatCurrency(overdraftInterest);
    document.getElementById('dividendBroughtForward').value = '';
    document.getElementById('dividendMonthlyInterest').value = '';
    document.getElementById('totalInterestInput').value = formatCurrency(overdraftInterest);
    document.getElementById('dividendResults').style.display = 'none';
    document.getElementById('dividendModal').classList.add('active');
}

function closeDividendModal() {
    document.getElementById('dividendModal').classList.remove('active');
}

function updateTotalDividend() {
    const { totalPool } = getDividendPoolBreakdown();
    document.getElementById('totalInterestInput').value = formatCurrency(totalPool);
}

function calculateDividends() {
    const activeMembers = membersData.filter(m => !m.isArchived);
    if (activeMembers.length === 0) {
        showToast('Error', 'No active members to distribute dividends', 'error');
        return;
    }

    const { totalPool } = getDividendPoolBreakdown();

    if (totalPool <= 0) {
        showToast('Error', 'Total dividend must be greater than zero', 'error');
        return;
    }

    // Time-Weighted Product Method: Jan=12pts, Feb=11pts, ... Dec=1pt
    const monthWeights = {
        January: 12, February: 11, March: 10, April: 9, May: 8, June: 7,
        July: 6, August: 5, September: 4, October: 3, November: 2, December: 1
    };

    // Calculate weighted contribution for each member
    let totalWeightedContrib = 0;
    const memberData = activeMembers.map(member => {
        let weightedContrib = 0;
        for (const [month, weight] of Object.entries(monthWeights)) {
            const amount = member.contributions[month] || 0;
            weightedContrib += amount * weight;
        }
        const totalContrib = calculateMemberTotal(member);
        totalWeightedContrib += weightedContrib;
        return { member, totalContrib, weightedContrib };
    });

    const tbody = document.getElementById('dividendTableBody');
    tbody.innerHTML = '';

    memberData
        .sort((a, b) => b.totalContrib - a.totalContrib)
        .forEach(({ member, totalContrib, weightedContrib }) => {
            const sharePercent = totalWeightedContrib > 0 ? (weightedContrib / totalWeightedContrib) * 100 : 0;
            const dividend = totalWeightedContrib > 0 ? (weightedContrib / totalWeightedContrib) * totalPool : 0;
            const totalPayout = totalContrib + dividend;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="font-bold">${escapeHtml(member.name)}</td>
                <td class="amount-cell">${formatCurrency(totalContrib)}</td>
                <td class="amount-cell">${sharePercent.toFixed(1)}%</td>
                <td class="amount-cell font-extra-bold text-success">${formatCurrency(dividend)}</td>
                <td class="amount-cell font-extra-bold">${formatCurrency(totalPayout)}</td>
            `;
            tbody.appendChild(row);
        });

    document.getElementById('dividendResults').style.display = 'block';
}

function saveDividendToHistory() {
    if (!isManager()) return;

    const activeMembers = membersData.filter(m => !m.isArchived);
    const { overdraftInterest, broughtForward, monthlyInterest, totalPool } = getDividendPoolBreakdown();
    const totalContrib = membersData.reduce((sum, m) => sum + calculateMemberTotal(m), 0);

    const dividendData = {
        year: currentYear,
        date: new Date().toISOString(),
        totalContributions: totalContrib,
        overdraftInterest: overdraftInterest,
        balanceBroughtForward: broughtForward,
        monthlyInterest: monthlyInterest,
        totalDividend: totalPool,
        savingsInterest: monthlyInterest, // Legacy compatibility for older history readers
        memberCount: activeMembers.length
    };

    let history = JSON.parse(localStorage.getItem('dividendHistory') || '[]');
    history.push(dividendData);
    localStorage.setItem('dividendHistory', JSON.stringify(history));

    showToast('Success', 'Dividend calculation saved to history', 'success');
    addToAuditLog('Dividend', `Calculated dividends for ${currentYear}. Total: ${formatCurrency(totalPool)}`);
}

function exportDividendExcel() {
    const activeMembers = membersData.filter(m => !m.isArchived);
    const { overdraftInterest, broughtForward, monthlyInterest, totalPool } = getDividendPoolBreakdown();
    const totalContrib = membersData.reduce((sum, m) => sum + calculateMemberTotal(m), 0);

    const monthWeights = {
        January: 12, February: 11, March: 10, April: 9, May: 8, June: 7,
        July: 6, August: 5, September: 4, October: 3, November: 2, December: 1
    };

    let totalWeightedContrib = 0;
    const memberData = activeMembers.map(member => {
        let weightedContrib = 0;
        for (const [month, weight] of Object.entries(monthWeights)) {
            weightedContrib += (member.contributions[month] || 0) * weight;
        }
        totalWeightedContrib += weightedContrib;
        return { member, totalContrib: calculateMemberTotal(member), weightedContrib };
    });

    const wsData = [
        ['Dividend Report', '', '', '', ''],
        ['Year:', currentYear, '', '', ''],
        ['Generated:', new Date().toLocaleDateString(), '', '', ''],
        ['Overdraft Interest:', overdraftInterest, '', '', ''],
        ['Balance B/F:', broughtForward, '', '', ''],
        ['Monthly Interest:', monthlyInterest, '', '', ''],
        ['Total Dividend Pool:', totalPool, '', '', ''],
        ['', '', '', '', ''],
        ['Member', 'Total Contrib.', 'Share %', 'Dividend', 'Total Payout']
    ];

    memberData
        .sort((a, b) => b.totalContrib - a.totalContrib)
        .forEach(({ member, totalContrib, weightedContrib }) => {
            const sharePercent = totalWeightedContrib > 0 ? (weightedContrib / totalWeightedContrib) * 100 : 0;
            const dividend = totalWeightedContrib > 0 ? (weightedContrib / totalWeightedContrib) * totalPool : 0;
            wsData.push([member.name, totalContrib, sharePercent.toFixed(1) + '%', dividend, totalContrib + dividend]);
        });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dividends');
    XLSX.writeFile(wb, `Dividends_${currentYear}.xlsx`);
    showToast('Success', 'Dividend report exported', 'success');
}

function printDividendReport() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Error', 'Popups blocked. Please allow popups.', 'error');
        return;
    }

    const dvdContent = document.getElementById('dividendModal').querySelector('.modal-content').innerHTML;

    printWindow.document.write(`
        <html>
        <head>
            <title>Dividend Report - ${currentYear}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                .close-modal, .no-print, button { display: none !important; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                th { background: #f8fafc; font-weight: 700; color: #002c63; }
                .amount-cell { text-align: right; font-family: monospace; }
                h3 { color: #002c63; }
                @page { size: portrait; margin: 1.5cm; }
            </style>
        </head>
        <body>
            <h2 class="report-header">
                Dividend Report - ${currentYear}
            </h2>
            <p class="report-meta">Generated on ${new Date().toLocaleDateString()}</p>
            ${dvdContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
}

