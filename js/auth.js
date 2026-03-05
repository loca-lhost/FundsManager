// --- AUTHENTICATION ---

async function checkLogin() {
    try {
        const user = await account.get();
        await handleAuthenticatedUser(user);
    } catch (error) {
        showLoginScreen();
    }
}

async function handleAuthenticatedUser(user) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('initialLoader').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';

    // Determine Role from Teams
    let role = 'viewer';
    try {
        const teamsList = await teams.list();
        const teamNames = teamsList.teams.map(t => t.name.toLowerCase());
        console.log('User Teams:', teamNames);
        if (teamNames.includes('admins') || teamNames.includes('admin')) role = 'admin';
        else if (teamNames.includes('managers') || teamNames.includes('manager')) role = 'fund_manager';
    } catch (e) {
        console.error('Error fetching teams:', e);
    }

    // Fetch Profile
    let userData = { full_name: user.name || user.email, role: role };

    try {
        const response = await databases.listDocuments(
            DB_ID,
            'profiles',
            [Appwrite.Query.equal('userId', user.$id)]
        );
        if (response.documents.length > 0) {
            userData = response.documents[0];
            // Normalize fullName to full_name for UI compatibility
            if (userData.fullName && !userData.full_name) userData.full_name = userData.fullName;

            // Check Archived Status
            if (userData.isArchived) {
                await logout();
                showToast('Access Denied', 'Your account has been archived.', 'error');
                return;
            }

            // Update Last Login
            try {
                await databases.updateDocument(DB_ID, 'profiles', userData.$id, {
                    lastLogin: new Date().toISOString()
                });
            } catch (e) { /* Ignore if attribute missing */ }

            // Ensure Team role takes precedence if privileged
            if (role !== 'viewer') {
                userData.role = role;
            }
        } else {
            // Auto-create profile if it doesn't exist
            try {
                const newProfile = await databases.createDocument(DB_ID, 'profiles', 'unique()', {
                    userId: user.$id,
                    fullName: user.name || user.email,
                    role: role
                });
                userData = newProfile;
                if (userData.fullName && !userData.full_name) userData.full_name = userData.fullName;
            } catch (err) { console.log('Auto-profile creation failed', err); }
        }
    } catch (e) {
        console.log('Profile not found, using default');
    }

    sessionStorage.setItem('welfareUser', JSON.stringify(userData)); // Keep for sync checks

    document.getElementById('headerUsername').textContent = userData.full_name.split(' ')[0];
    document.getElementById('headerAvatar').textContent = userData.full_name.charAt(0).toUpperCase();
    document.getElementById('dropdownName').textContent = userData.full_name;
    document.getElementById('dropdownRole').textContent = (userData.role || 'viewer').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Check email verification status
    if (!user.emailVerification) {
        document.getElementById('btnVerifyEmail').style.display = 'flex';
    } else {
        document.getElementById('btnVerifyEmail').style.display = 'none';
    }

    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(el => el.style.display = userData.role === 'admin' ? '' : 'none');

    // Manager-only items
    const isManagerRole = userData.role === 'admin' || userData.role === 'fund_manager';
    if (document.getElementById('btnAddMember')) document.getElementById('btnAddMember').style.display = isManagerRole ? '' : 'none';
    if (document.getElementById('btn-record-contribution')) document.getElementById('btn-record-contribution').style.display = isManagerRole ? '' : 'none';
    if (document.getElementById('btn-issue-overdraft')) document.getElementById('btn-issue-overdraft').style.display = isManagerRole ? '' : 'none';
    if (document.getElementById('fabContainer')) document.getElementById('fabContainer').style.display = isManagerRole ? '' : 'none';

    // Hide operational menus
    if (document.getElementById('btnOperations')) document.getElementById('btnOperations').style.display = isManagerRole ? '' : 'none';
    if (document.getElementById('btnDataManagement')) document.getElementById('btnDataManagement').style.display = isManagerRole ? '' : 'none';

    // Hide specific actions for viewers
    const actionsToHide = [
        'button[onclick="openDividendModal()"]',
        'button[onclick="createNewYear()"]',
        'button[onclick="importExcel()"]'
    ];

    actionsToHide.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = isManagerRole ? '' : 'none';
    });

    await detectAvailableYears();
    loadYearData(currentYear);
    renderRecentActivity();
    setupRealtime();
}

function showLoginScreen() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('initialLoader').style.display = 'none';
    document.getElementById('appContent').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing In... <div class="spinner spinner-inline-light"></div>';

    try {
        // Clear any existing stale sessions to prevent "session active" errors
        try { await account.deleteSession('current'); } catch (e) { }

        await account.createEmailSession(username, password);

        if (rememberMe) {
            localStorage.setItem('rememberedEmail', username);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        // Verify session persistence immediately (Fix for iOS ITP issues)
        try {
            await account.get();
        } catch (e) {
            throw new Error("Login successful but session failed to save. On iOS, please disable 'Block All Cookies' in Safari settings or use Chrome.");
        }

        await checkLogin(); // Refresh state
        showToast('Success', 'Logged in successfully', 'success');
        addToAuditLog('Login', `User ${username} logged in`);
    } catch (error) {
        console.error('Login Failed:', error);
        if (error.code === 404) {
            alert("Configuration Error: Project not found.\n\nPlease open index.html and replace 'fundmanager' with your actual Appwrite Project ID.");
        } else if (error.type === 'user_session_already_active') {
            showToast('Info', 'You are already logged in.', 'info');
            checkLogin();
        } else {
            showToast('Error', error.message, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

async function logout() {
    try {
        await account.deleteSession('current');
    } catch (e) { console.error(e); }

    sessionStorage.removeItem('welfareUser');
    checkLogin();
    showToast('Success', 'Logged out', 'success');
}

async function resendVerificationEmail() {
    try {
        const redirectUrl = window.location.origin + window.location.pathname + '?type=verification';
        await account.createVerification(redirectUrl);
        showToast('Success', 'Verification email sent. Please check your inbox.', 'success');
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function completeVerification(userId, secret) {
    try {
        await account.updateVerification(userId, secret);
        showToast('Success', 'Email verified successfully!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
        checkLogin();
    } catch (error) {
        showToast('Error', 'Verification failed: ' + error.message, 'error');
        checkLogin();
    }
}

// Realtime Subscription
let realtimeDebounceTimer;
function setupRealtime() {
    // Unsubscribe from previous subscription if exists
    if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
    }

    // Subscribe to all documents in the database
    realtimeUnsubscribe = client.subscribe(`databases.${DB_ID}.collections.*.documents`, response => {
        // Check if the event is relevant to our collections
        const collectionId = response.payload.$collectionId;

        if (['members', 'contributions', 'overdrafts'].includes(collectionId)) {
            // Reload data silently (without toast)
            clearTimeout(realtimeDebounceTimer);
            realtimeDebounceTimer = setTimeout(() => {
                console.log('Realtime update received:', response.events[0]);
                loadYearData(currentYear, true);
            }, 500);
        }
    });
}

// Password Management
function openPasswordModal(forced = false) {
    document.getElementById('passwordForm').reset();
    const modal = document.getElementById('passwordModal');
    modal.classList.add('active');

    const closeBtn = modal.querySelector('.close-modal');
    if (forced) {
        closeBtn.style.display = 'none';
        modal.onclick = null; // Prevent closing by clicking outside
    } else {
        closeBtn.style.display = 'flex';
        modal.onclick = function (e) { if (e.target === this) closePasswordModal(); };
    }
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const currentPass = document.getElementById('currentPassword').value;

    if (newPass !== confirmPass) {
        showToast('Error', 'New passwords do not match', 'error');
        return;
    }

    try {
        await account.updatePassword(newPass, currentPass);
        showToast('Success', 'Password updated successfully', 'success');
        closePasswordModal();
        addToAuditLog('Password Change', 'User changed their password');
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

// Forgot Password Logic
function openForgotPasswordModal() {
    document.getElementById('forgotPasswordForm').reset();
    document.getElementById('forgotPasswordModal').classList.add('active');
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.remove('active');
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('fpEmail').value;

    try {
        // Requires a URL to redirect back to
        const redirectUrl = window.location.origin + window.location.pathname + '?type=recovery';
        await account.createRecovery(email, redirectUrl);
        showToast('Success', 'Recovery email sent. Please check your inbox.', 'success');
        closeForgotPasswordModal();
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function handleCompleteRecovery(e) {
    e.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const secret = urlParams.get('secret');
    const password = document.getElementById('rpNewPassword').value;
    const confirm = document.getElementById('rpConfirmPassword').value;

    if (password !== confirm) {
        showToast('Error', 'Passwords do not match', 'error');
        return;
    }

    try {
        await account.updateRecovery(userId, secret, password, password);
        showToast('Success', 'Password updated successfully. Please login.', 'success');
        document.getElementById('resetPasswordModal').classList.remove('active');
        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

function showRecoveryCode(code, name) {
    document.getElementById('recoveryCodeDisplay').textContent = code;
    document.getElementById('recoveryCodeModal').querySelector('p').textContent = `Recovery code for ${name}. Please save this code in a safe place.`;
    document.getElementById('recoveryCodeModal').classList.add('active');
}

// User Management
function openUserModal() {
    if (!isAdmin()) {
        showToast('Permission Denied', 'Only admins can manage users', 'error');
        return;
    }
    renderUsersTable();
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function changeUserRole(selectEl, oldTeamId, membershipId) {
    const newRole = selectEl.value;
    const email = selectEl.dataset.email;
    const name = selectEl.dataset.name;

    selectEl.disabled = true;

    let targetTeamName = 'Viewers';
    if (newRole === 'admin') targetTeamName = 'Admins';
    if (newRole === 'fund_manager') targetTeamName = 'Managers';

    try {
        // 1. Find target team
        const teamsList = await teams.list();
        let targetTeam = teamsList.teams.find(t => t.name.toLowerCase() === targetTeamName.toLowerCase());

        if (!targetTeam) {
            targetTeam = await teams.create('unique()', targetTeamName);
        }

        if (targetTeam.$id === oldTeamId) {
            selectEl.disabled = false;
            return;
        }

        // 2. Add to new team
        await teams.createMembership(
            targetTeam.$id,
            ['member'],
            email,
            undefined,
            undefined,
            window.location.href,
            name
        );

        // 3. Remove from old team
        await teams.deleteMembership(oldTeamId, membershipId);

        showToast('Success', `Role updated to ${targetTeamName}`, 'success');
        addToAuditLog('User Management', `Changed role for ${email} to ${targetTeamName}`);

        // 4. Refresh table
        renderUsersTable();

    } catch (e) {
        console.error(e);
        showToast('Error', 'Failed to change role: ' + e.message, 'error');
        selectEl.disabled = false;
    }
}

async function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading users...</td></tr>';

    try {
        const teamsList = await teams.list();
        tbody.innerHTML = '';

        const currentUser = await account.get();

        // Fetch profiles for last login info
        let profiles = [];
        try {
            const profilesList = await databases.listDocuments(DB_ID, 'profiles', [Appwrite.Query.limit(100)]);
            profiles = profilesList.documents;
        } catch (e) { console.error('Failed to load profiles', e); }

        for (const team of teamsList.teams) {
            const members = await teams.listMemberships(team.$id);

            members.memberships.forEach(member => {
                const row = document.createElement('tr');
                const isSelf = member.userId === currentUser.$id;

                // Fallback for properties
                const memberName = member.userName || member.name || member.userEmail || 'Unknown';
                const memberEmail = member.userEmail || member.email || '';

                // Find profile for last login
                const profile = profiles.find(p => p.userId === member.userId);
                let lastLoginStr = 'Never';
                let isArchived = false;
                if (profile) {
                    if (profile.lastLogin) {
                        const d = new Date(profile.lastLogin);
                        lastLoginStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    if (profile.isArchived) isArchived = true;
                }

                // Determine current role for select
                let currentRole = 'viewer';
                const tName = team.name.toLowerCase();
                if (tName.includes('admin')) currentRole = 'admin';
                else if (tName.includes('manager')) currentRole = 'fund_manager';

                const roleSelect = isSelf ?
                    `<span class="status-badge ${tName === 'admins' ? 'status-active' : ''}">${escapeHtml(team.name)}</span>` :
                    `<select class="form-select text-sm" style="padding: 0.2rem 0.5rem; width: auto;" 
                        data-email="${escapeHtml(memberEmail)}"
                        data-name="${escapeHtml(memberName)}"
                        onchange="changeUserRole(this, '${team.$id}', '${member.$id}')">
                        <option value="viewer" ${currentRole === 'viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="fund_manager" ${currentRole === 'fund_manager' ? 'selected' : ''}>Fund Manager</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>`;

                row.innerHTML = `
                    <td>
                        <div class="font-bold text-dark">${escapeHtml(memberName)} ${isArchived ? '<span class="status-badge badge-archived-sm" style="font-size:0.6rem;">ARCHIVED</span>' : ''}</div>
                        <div class="text-sm text-muted">${escapeHtml(memberEmail)}</div>
                    </td>
                    <td data-label="Role">${roleSelect}</td>
                    <td data-label="Last Login" class="text-sm text-muted">${lastLoginStr}</td>
                    <td data-label="Actions" class="text-right">
                        ${!isSelf ?
                        (isArchived ?
                            `<button class="btn btn-success btn-sm btn-icon" onclick="restoreUser('${member.userId}')" title="Restore User"><i class="fas fa-trash-restore"></i></button>` :
                            `<button class="btn btn-danger btn-sm btn-icon" onclick="archiveUser('${member.userId}')" title="Archive User"><i class="fas fa-archive"></i></button>`) :
                        ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        if (tbody.innerHTML === '') {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No users found in teams.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Error loading users: ${e.message}</td></tr>`;
    }
}

async function addUser(e) {
    e.preventDefault();
    const email = document.getElementById('newEmail').value;
    const name = document.getElementById('newFullname').value;
    const role = document.getElementById('newRole').value;

    let teamName = 'Viewers';
    if (role === 'admin') teamName = 'Admins';
    if (role === 'fund_manager') teamName = 'Managers';

    try {
        const teamsList = await teams.list();
        let team = teamsList.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

        if (!team) {
            // Create team if it doesn't exist
            team = await teams.create('unique()', teamName);
        }

        // Invite User
        await teams.createMembership(
            team.$id,
            ['member'],
            email,
            undefined,
            undefined,
            window.location.href, // Redirect URL for invite
            name
        );

        document.getElementById('addUserForm').reset();
        renderUsersTable();
        showToast('Success', `Invitation sent to ${email}`, 'success');
        addToAuditLog('User Management', `Invited ${email} to ${teamName}`);
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}

function archiveUser(userId) {
    userToArchiveId = userId;
    document.getElementById('deleteUserModal').classList.add('active');
}

function closeDeleteUserModal() {
    document.getElementById('deleteUserModal').classList.remove('active');
    userToArchiveId = null;
}

async function confirmArchiveUser() {
    if (!userToArchiveId) return;

    try {
        const response = await databases.listDocuments(DB_ID, 'profiles', [
            Appwrite.Query.equal('userId', userToArchiveId)
        ]);

        if (response.documents.length > 0) {
            await databases.updateDocument(DB_ID, 'profiles', response.documents[0].$id, {
                isArchived: true
            });
            showToast('Success', 'User archived', 'success');
            addToAuditLog('User Management', 'Archived user');
            renderUsersTable();
        }
    } catch (e) {
        showToast('Error', e.message, 'error');
    }

    closeDeleteUserModal();
}

async function restoreUser(userId) {
    if (!confirm('Are you sure you want to restore this user?')) return;
    try {
        const response = await databases.listDocuments(DB_ID, 'profiles', [
            Appwrite.Query.equal('userId', userId)
        ]);

        if (response.documents.length > 0) {
            await databases.updateDocument(DB_ID, 'profiles', response.documents[0].$id, {
                isArchived: false
            });
            showToast('Success', 'User restored', 'success');
            addToAuditLog('User Management', 'Restored user');
        }
        renderUsersTable();
    } catch (e) {
        showToast('Error', e.message, 'error');
    }
}
