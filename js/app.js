// --- APP INITIALIZATION & DATA LOADING ---

async function initializeData() {
    setFavicon();

    // Check for URL parameters (email verification, password recovery)
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const userId = urlParams.get('userId');
    const secret = urlParams.get('secret');

    if (type === 'verification' && userId && secret) {
        completeVerification(userId, secret);
        return;
    }

    if (type === 'recovery' && userId && secret) {
        document.getElementById('resetPasswordModal').classList.add('active');
        return;
    }

    // Populate remember me
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        const loginField = document.getElementById('loginUsername');
        if (loginField) {
            loginField.value = rememberedEmail;
            const checkbox = document.getElementById('rememberMe');
            if (checkbox) checkbox.checked = true;
        }
    }

    checkLogin();
}

async function detectAvailableYears() {
    try {
        // Get distinct years from contributions
        const contribs = await databases.listDocuments(DB_ID, 'contributions', [
            Appwrite.Query.limit(1),
            Appwrite.Query.orderDesc('year')
        ]);

        const yearsSet = new Set([currentYear]);

        // Check common years
        for (let y = currentYear - 5; y <= currentYear + 1; y++) {
            const check = await databases.listDocuments(DB_ID, 'contributions', [
                Appwrite.Query.equal('year', y),
                Appwrite.Query.limit(1)
            ]);
            if (check.documents.length > 0) yearsSet.add(y);
        }

        availableYears = [...yearsSet].sort((a, b) => b - a);
    } catch (e) {
        console.log('Year detection fallback to current year');
        availableYears = [currentYear];
    }

    renderYearSelector();
}

function renderYearSelector() {
    const selector = document.getElementById('yearSelector') || document.getElementById('yearFilter');
    if (!selector) return;

    selector.innerHTML = '';
    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        selector.appendChild(option);
    });
}

async function changeYear(year) {
    currentYear = parseInt(year);
    loadYearData(currentYear);
}

async function loadYearData(year, silent = false) {
    if (!silent) {
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="15" style="text-align: center; padding: 3rem;">
                        <div class="spinner"></div>
                        <div style="margin-top: 1rem; color: #666;">Loading ${year} data...</div>
                    </td>
                </tr>
            `;
        }
    }

    try {
        // Load members
        const memberDocs = await fetchAllDocuments('members');

        // Load contributions for the selected year
        const contribDocs = await fetchAllDocuments('contributions', [
            Appwrite.Query.equal('year', year)
        ]);

        // Build contribution map: memberId -> { month: amount }
        const contribMap = {};
        contribDocs.forEach(c => {
            if (!contribMap[c.memberId]) contribMap[c.memberId] = {};
            contribMap[c.memberId][c.month] = c.amount;
        });

        // Merge into membersData
        membersData = memberDocs.map(doc => ({
            id: doc.$id,
            name: doc.name,
            accountNumber: doc.accountNumber || '0',
            isArchived: doc.isArchived || false,
            contributions: {}
        }));

        membersData.forEach(member => {
            months.forEach(month => {
                member.contributions[month] = contribMap[member.id] ? (contribMap[member.id][month] || 0) : 0;
            });
        });

        // Load overdrafts
        const odDocs = await fetchAllDocuments('overdrafts');
        overdraftsData = odDocs.map(doc => ({
            id: doc.$id,
            memberId: doc.memberId,
            memberName: doc.memberName,
            amount: doc.amount,
            interest: doc.interest,
            totalDue: doc.totalDue,
            reason: doc.reason || 'N/A',
            status: doc.status,
            dateTaken: doc.dateTaken,
            amountPaid: doc.amountPaid || 0
        }));

    } catch (error) {
        console.error('Error loading data:', error);
        if (!silent) {
            showToast('Error', 'Failed to load data: ' + error.message, 'error');
        }
    }

    renderTable();
    renderOverdraftsTable();
    updateStatistics();
    if (!silent) renderRecentActivity();
}

function refreshTable() {
    loadYearData(currentYear);
}

async function createNewYear() {
    if (!isManager()) {
        showToast('Permission Denied', 'Only managers can create a new year', 'error');
        return;
    }

    const nextYear = currentYear + 1;

    if (availableYears.includes(nextYear)) {
        showToast('Info', `Year ${nextYear} already exists`, 'info');
        return;
    }

    if (!confirm(`Create contribution records for ${nextYear}? This will carry over all active members.`)) {
        return;
    }

    showToast('Info', `Creating ${nextYear}...`, 'info');

    try {
        // Create empty contributions for all active members
        const activeMembers = membersData.filter(m => !m.isArchived);

        for (const member of activeMembers) {
            // Create at least one contribution to mark the year as active
            await databases.createDocument(DB_ID, 'contributions', 'unique()', {
                memberId: member.id,
                year: nextYear,
                month: 'January',
                amount: 0
            });
        }

        availableYears.push(nextYear);
        availableYears.sort((a, b) => b - a);
        renderYearSelector();

        showToast('Success', `Year ${nextYear} created with ${activeMembers.length} members`, 'success');
        addToAuditLog('Create Year', `Created ${nextYear} with ${activeMembers.length} members`);
    } catch (e) {
        showToast('Error', 'Failed to create year: ' + e.message, 'error');
    }
}

// --- BOOTSTRAP ---
// Setup event listeners and initialize
function bootstrap() {
    setupDropdownClose();
    setupInactivityListeners();
    setupPullToRefresh();

    // Initialize data
    try {
        initializeData();
    } catch (e) {
        console.error('Initialization failed', e);
        document.body.innerHTML = '<div style="padding: 2rem; text-align: center; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; margin: 2rem; border-radius: 8px; font-family: sans-serif;"><h3>System Error</h3><p>Failed to initialize application data. Please ensure cookies/local storage are enabled.</p><p>' + e.message + '</p></div>';
    }
}

// Run on load
bootstrap();
