document.addEventListener('DOMContentLoaded', () => {
    // --- LOGIN LOGIC ---
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const appContainer = document.querySelector('.app-container');

    const currentUser = localStorage.getItem('grs_user');
    let userObj = null;
    try {
        if (currentUser) userObj = JSON.parse(currentUser);
    } catch(e) {}

    function isUserAdmin() {
        let u = userObj;
        if (!u) {
            try {
                const raw = localStorage.getItem('grs_user');
                if (raw) u = JSON.parse(raw);
            } catch(e){}
        }
        return !u || !u.role || (u.role || '').toLowerCase() === 'admin' || (u.username || '').toLowerCase() === 'admin';
    }
    window.isUserAdmin = isUserAdmin;

    function checkAdminAccess() {
        if (!isUserAdmin()) {
            alert('Access Denied: Only Admin users are authorized to delete records.');
            return false;
        }
        return true;
    }
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    window.escapeHtml = escapeHtml;

    function formatExcelDate(val) {
        if (!val) return new Date().toISOString().slice(0, 10);
        const str = String(val).trim();
        if (!str) return new Date().toISOString().slice(0, 10);

        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.slice(0, 10);
        }

        const num = Number(str);
        if (!isNaN(num) && num > 20000 && num < 70000) {
            const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getUTCFullYear();
                const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getUTCDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        }

        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                    const d = parts[0].padStart(2, '0');
                    const m = parts[1].padStart(2, '0');
                    const y = parts[2];
                    return `${y}-${m}-${d}`;
                }
            }
        }
        if (str.includes('-')) {
            const parts = str.split('-');
            if (parts.length === 3 && parts[2].length === 4) {
                const d = parts[0].padStart(2, '0');
                const m = parts[1].padStart(2, '0');
                const y = parts[2];
                return `${y}-${m}-${d}`;
            }
        }

        return str.slice(0, 10);
    }
    window.formatExcelDate = formatExcelDate;

    if (!userObj) {
        appContainer.style.display = 'none';
        loginOverlay.style.display = 'flex';
    } else {
        loginOverlay.style.display = 'none';
        appContainer.style.display = '';

        // Restrict Delete Access across all screens to Admin only
        if (userObj.role !== 'admin') {
            const deleteStyle = document.createElement('style');
            deleteStyle.id = 'admin-only-delete-style';
            deleteStyle.innerHTML = `
                .delete-btn, .delete-part-btn, .delete-machine-btn, .delete-operator-btn, .delete-dept-btn,
                .delete-shift-btn, .delete-vendor-btn, .delete-setter-btn, .delete-supplier-btn, .delete-rm-btn,
                .delete-ht-btn, .delete-insert-btn, .delete-drill-btn, .delete-receipt-btn, .delete-issue-btn,
                .delete-prodlog-btn, .delete-debur-btn, .delete-inspection-btn, .delete-bdslip-btn, .delete-user-btn,
                .delete-insp-log-btn, .delete-service-btn,
                #deleteAllPartMasterBtn, #deleteAllOperatorsBtn, #bulkDeleteLogsBtn, #deleteAllSchedulesBtn,
                button[class*="delete"], button[id*="delete"], button[onclick*="delete"] {
                    display: none !important;
                }
            `;
            document.head.appendChild(deleteStyle);
        }
        
        // Access Control Logic
        const isAdminUser = !userObj || !userObj.role || (userObj.role || '').toLowerCase() === 'admin' || (userObj.username || '').toLowerCase() === 'admin';
        const allTabs = document.querySelectorAll('[data-screen]');
        let firstAvailableTab = null;
        let accessibleScreens = [];
        try {
            accessibleScreens = JSON.parse(userObj.accessible_screens || '[]');
        } catch(e) {}
        
        allTabs.forEach(tab => {
            const screen = tab.getAttribute('data-screen');
            const isAllowed = isAdminUser || (!accessibleScreens || accessibleScreens.length === 0) || accessibleScreens.includes(screen) || ((screen === 'rfq' || screen === 'quote') && (accessibleScreens.includes('sales') || accessibleScreens.includes('mfe') || accessibleScreens.includes('rfq') || accessibleScreens.includes('quote'))) || ((screen === 'rawmaterial' || screen === 'ht' || screen === 'pc') && (accessibleScreens.includes('inventory') || accessibleScreens.includes('rawmaterial'))) || (screen === 'attendance' && accessibleScreens.includes('hr')) || ((screen === 'bdslip' || screen === 'servicedetails') && (accessibleScreens.includes('maintenance') || accessibleScreens.includes('bdslip') || accessibleScreens.includes('servicedetails'))) || ((screen === 'insertmaster' || screen === 'drillmaster' || screen === 'tapmaster' || screen === 'insertreceipt' || screen === 'tapreceipt' || screen === 'insertissue' || screen === 'tapissue' || screen === 'insertcpc' || screen === 'insertstock') && (accessibleScreens.includes('products') || accessibleScreens.includes('toolcrib'))) || ((screen === 'rm_requirement' || screen === 'mc_util' || screen === 'oper_eff' || screen === 'reports') && accessibleScreens.includes('reports'));
            if (isAllowed) {
                tab.style.display = 'inline-block';
                if (!firstAvailableTab) firstAvailableTab = tab;
            } else {
                tab.style.display = 'none';
            }
        });

        // Main tabs access control
        document.querySelectorAll('.main-tab[data-group]').forEach(tab => {
            const group = tab.getAttribute('data-group');
            if (isAdminUser) {
                tab.style.display = 'inline-block';
            } else {
                const groupScreens = {
                    'master': ['partmaster', 'machines', 'operators', 'dept', 'shift', 'vendors', 'setters', 'suppliers', 'db_backup'],
                    'sales': ['rfq', 'quote', 'mfe', 'sales'],
                    'mfe': ['rfq', 'quote', 'mfe', 'sales'],
                    'inventory': ['inventory', 'rawmaterial', 'ht', 'pc'],
                    'production': ['schedule', 'status', 'prodlog', 'debur'],
                    'toolcrib': ['insertmaster', 'drillmaster', 'products', 'insertreceipt', 'insertissue', 'insertcpc', 'insertstock'],
                    'reports': ['reports', 'rm_requirement', 'mc_util', 'oper_eff', 'bc_prod', 'att_vs_login'],
                    'maintenance': ['maintenance', 'bdslip', 'servicedetails'],
                    'hr': ['hr', 'attendance']
                };
                const allowed = (!accessibleScreens || accessibleScreens.length === 0) || (groupScreens[group] ? groupScreens[group].some(s => accessibleScreens.includes(s) || accessibleScreens.includes(group)) : false);
                tab.style.display = allowed ? 'inline-block' : 'none';
            }
        });
        
        // Special case for Users tab
        const sidebarUsers = document.getElementById('sidebarUsers');
        if (sidebarUsers) {
            if (isAdminUser) {
                sidebarUsers.style.display = 'inline-block';
            } else {
                sidebarUsers.style.display = 'none';
            }
        }

        // Special case for Add Part tab and Clear All Parts tab (visible in Part Master sub menu)
        const addPartTab = document.getElementById('addPartTab');
        if (addPartTab) {
            addPartTab.onclick = () => {
                closePartModal();
                openPartModal(false);
            };
            addPartTab.style.display = 'none';
        }

        const clearAllPartsTab = document.getElementById('clearAllPartsTab');
        if (clearAllPartsTab) {
            clearAllPartsTab.onclick = async () => {
                if (!confirm("⚠️ Are you sure you want to CLEAR ALL PARTS and Part Master records?\n\nThis action cannot be undone.")) {
                    return;
                }
                try {
                    const res = await fetch('/api/partmaster/clear-all', { method: 'DELETE' });
                    const data = await res.json();
                    alert(data.message || "All parts cleared successfully!");
                    fetchPartMasters();
                } catch(err) {
                    alert("Error clearing parts: " + err);
                }
            };
            clearAllPartsTab.style.display = 'none';
        }

        // Inventory Submenu Action Tabs
        const addReceiptTab = document.getElementById('addReceiptTab');
        if (addReceiptTab) {
            addReceiptTab.onclick = () => {
                currentTab = 'rm_receipt';
                if (addBtn) addBtn.click();
            };
            addReceiptTab.style.display = 'none';
        }

        const addDespatchTab = document.getElementById('addDespatchTab');
        if (addDespatchTab) {
            addDespatchTab.onclick = () => {
                currentTab = 'rm_despatch';
                if (addBtn) addBtn.click();
            };
            addDespatchTab.style.display = 'none';
        }

        const addRmTab = document.getElementById('addRmTab');
        if (addRmTab) {
            addRmTab.onclick = () => {
                currentTab = 'rawmaterial';
                if (addBtn) addBtn.click();
            };
            addRmTab.style.display = 'none';
        }

        const sendToHtTab = document.getElementById('sendToHtTab');
        if (sendToHtTab) {
            sendToHtTab.onclick = () => {
                currentTab = 'ht';
                if (addBtn) addBtn.click();
            };
            sendToHtTab.style.display = 'none';
        }

        const sendToPcTab = document.getElementById('sendToPcTab');
        if (sendToPcTab) {
            sendToPcTab.onclick = () => {
                currentTab = 'pc';
                if (addBtn) addBtn.click();
            };
            sendToPcTab.style.display = 'none';
        }

        // Add logout button to header actions div
        const actionDiv = document.getElementById('headerActions');
        if (actionDiv && !document.getElementById('logoutBtn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'btn btn-secondary';
            logoutBtn.textContent = `Logout (${userObj.username})`;
            logoutBtn.onclick = () => {
                localStorage.removeItem('grs_user');
                window.location.reload();
            };
            actionDiv.appendChild(logoutBtn);
        }

        // Auto-click target initial tab on login (prioritize Insert Issue for shopfloor/toolcrib users)
        let targetInitialTab = null;
        if (accessibleScreens.includes('insertissue') || accessibleScreens.includes('toolcrib')) {
            targetInitialTab = document.getElementById('sidebarInsertIssue');
        }
        if (!targetInitialTab) {
            targetInitialTab = firstAvailableTab;
        }

        if (targetInitialTab) {
            setTimeout(() => {
                targetInitialTab.click();
            }, 100);
        } else {
            const masterTab = document.getElementById('sidebarMaster');
            if (masterTab) {
                setTimeout(() => {
                    masterTab.click();
                }, 100);
            }
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginError) loginError.style.display = 'none';
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            const username = usernameInput ? usernameInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('grs_user', JSON.stringify(data));
                    window.location.reload();
                } else {
                    if (loginError) loginError.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                if (loginError) loginError.style.display = 'block';
            }
        });
    }

    // Shared
    const addBtn = document.getElementById('addBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    let currentTab = 'products';
    let availableMachines = [];
    let allRawMaterials = [];
    let rmLogForgePnSelect = null;
    let rmLogFinishPartNoSelect = null;
    let globalPartMasters = [];
    let allShifts = [];
    let currentOperatorSessionHours = 0;

    // Tabs
    const tabRawMaterial = document.getElementById('tabRawMaterial');
    const sidebarRmMaster = document.getElementById('sidebarRmMaster');
    const sidebarRmReceipt = document.getElementById('sidebarRmReceipt');
    const sidebarRmDespatch = document.getElementById('sidebarRmDespatch');
    
    const sidebarProducts = document.getElementById('sidebarProducts');
    const sidebarPartMaster = document.getElementById('sidebarPartMaster');
    const sidebarMachines = document.getElementById('sidebarMachines');
    const sidebarOperators = document.getElementById('sidebarOperators');
    const sidebarDept = document.getElementById('sidebarDept');
    const sidebarShift = document.getElementById('sidebarShift');
    const sidebarVendors = document.getElementById('sidebarVendors');
    const sidebarSetters = document.getElementById('sidebarSetters');
    const tabSchedule = document.getElementById('tabSchedule');
    const sidebarScheduleCreate = document.getElementById('sidebarScheduleCreate');
    const sidebarScheduleRun = document.getElementById('sidebarScheduleRun');
    const sidebarStatus = document.getElementById('sidebarStatus');
    const sidebarProdLog = document.getElementById('sidebarProdLog');
    const sidebarDebur = document.getElementById('sidebarDebur');
    const sidebarInspection = document.getElementById('sidebarInspection');
    
    const rawMaterialsSection = document.getElementById('rawMaterialsSection');
    const rmReceiptSection = document.getElementById('rmReceiptSection');
    const rmDespatchSection = document.getElementById('rmDespatchSection');
    const productsSection = document.getElementById('productsSection');
    const partMasterSection = document.getElementById('partMasterSection');
    const machinesSection = document.getElementById('machinesSection');
    const operatorsSection = document.getElementById('operatorsSection');
    const departmentsSection = document.getElementById('departmentsSection');
    const shiftsSection = document.getElementById('shiftsSection');
    const vendorsSection = document.getElementById('vendorsSection');
    const settersSection = document.getElementById('settersSection');
    const htSection = document.getElementById('htSection');
    const scheduleCreateSection = document.getElementById('scheduleCreateSection');
    const scheduleRunSection = document.getElementById('scheduleRunSection');
    const scheduleStatusSection = document.getElementById('scheduleStatusSection');
    const prodLogSection = document.getElementById('prodLogSection');
    const deburSection = document.getElementById('deburSection');
    const inspectionSection = document.getElementById('inspectionSection');

    // Products Elements
    const productsBody = document.getElementById('productsBody');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const closeProductBtn = document.getElementById('closeModalBtn');
    const cancelProductBtn = document.getElementById('cancelBtn');
    const productModalTitle = document.getElementById('modalTitle');

    // Part Master Elements
    const partMasterBody = document.getElementById('partMasterBody');
    const partModal = document.getElementById('partModal');
    const partForm = document.getElementById('partForm');
    const closePartBtn = document.getElementById('closePartModalBtn');
    const cancelPartBtn = document.getElementById('cancelPartBtn');
    const partModalTitle = document.getElementById('partModalTitle');

    // Operations Elements
    const operationsModal = document.getElementById('operationsModal');
    const closeOperationsModalBtn = document.getElementById('closeOperationsModalBtn');
    const cancelOperationsBtn = document.getElementById('cancelOperationsBtn');
    const saveOperationsBtn = document.getElementById('saveOperationsBtn');
    const operationsBody = document.getElementById('operationsBody');
    const operationsPartId = document.getElementById('operationsPartId');

    // Machine Elements
    const machinesBody = document.getElementById('machinesBody');
    const machineModal = document.getElementById('machineModal');
    const machineForm = document.getElementById('machineForm');
    const closeMachineBtn = document.getElementById('closeMachineModalBtn');
    const cancelMachineBtn = document.getElementById('cancelMachineBtn');
    const machineModalTitle = document.getElementById('machineModalTitle');

    // Operator Elements
    const operatorsBody = document.getElementById('operatorsBody');
    const operatorModal = document.getElementById('operatorModal');
    const operatorForm = document.getElementById('operatorForm');
    const closeOperatorBtn = document.getElementById('closeOperatorModalBtn');
    const cancelOperatorBtn = document.getElementById('cancelOperatorBtn');
    const operatorModalTitle = document.getElementById('operatorModalTitle');

    const deptModal = document.getElementById('deptModal');
    const deptForm = document.getElementById('deptForm');
    const cancelDeptBtn = document.getElementById('cancelDeptBtn');
    const deptIdInput = document.getElementById('deptId');
    const deptNameInput = document.getElementById('deptName');
    const deptModalTitle = document.getElementById('deptModalTitle');

    const shiftModal = document.getElementById('shiftModal');
    const shiftForm = document.getElementById('shiftForm');
    const cancelShiftBtn = document.getElementById('cancelShiftBtn');
    const shiftIdInput = document.getElementById('shiftId');
    const shiftNameInput = document.getElementById('shiftName');
    const shiftHoursInput = document.getElementById('shiftHours');
    const shiftModalTitle = document.getElementById('shiftModalTitle');


    function hideAllSections() {
        const sections = [
            'usersSection', 'reportsSection', 'rmRequirementSection', 'mcUtilSection', 'operEffSection', 'bcProdSection', 'attVsLoginSection',
            'rawMaterialsSection', 'rmReceiptSection', 'rmDespatchSection',
            'productsSection', 'insertMasterSection', 'drillMasterSection', 'tapMasterSection', 'insertReceiptSection', 'tapReceiptSection', 'insertIssueSection', 'tapIssueSection', 'insertCpcSection', 'insertStockSection', 'partMasterSection', 'machinesSection',
            'operatorsSection', 'departmentsSection', 'shiftsSection', 'vendorsSection', 'settersSection', 'suppliersSection', 'dbBackupSection', 'htSection', 'pcSection', 'scheduleCreateSection', 'resourceReqdSection', 'scheduleRunSection',
            'scheduleStatusSection', 'prodLogSection', 'deburSection',
            'inspectionSection', 'maintenanceSection', 'bdSlipSection', 'serviceDetailsSection', 'hrSection', 'attendanceSection', 'rfqSection', 'quoteSection'
        ];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        document.querySelectorAll('.main-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.sub-tab').forEach(btn => btn.classList.remove('active'));
        ['addPartTab', 'clearAllPartsTab', 'addReceiptTab', 'addDespatchTab', 'addRmTab', 'sendToHtTab', 'sendToPcTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function hideAllSubmenus() {
        document.querySelectorAll('.sub-group').forEach(grp => {
            grp.style.display = 'none';
        });
    }

    // Main Menu Click Handler
    document.querySelectorAll('.main-tab').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllSections();
            document.querySelectorAll('.main-tab').forEach(btn => btn.classList.remove('active'));
            item.classList.add('active');
            
            const group = item.getAttribute('data-group');
            const screen = item.getAttribute('data-screen');
            
            if (group) {
                hideAllSubmenus();
                let submenu = document.getElementById('submenu' + group.charAt(0).toUpperCase() + group.slice(1));
                if (!submenu) {
                    submenu = Array.from(document.querySelectorAll('.sub-group')).find(el => el.id.toLowerCase() === ('submenu' + group).toLowerCase());
                }
                if (submenu) {
                    submenu.style.display = 'flex';
                    // Auto-click first visible tab in submenu (ignore action tabs)
                    const visibleTabs = Array.from(submenu.querySelectorAll('.sub-tab:not(.action-tab)')).filter(t => t.style.display !== 'none');
                    if (visibleTabs.length > 0) {
                        visibleTabs[0].click();
                    }
                }
            } else if (screen) {
                hideAllSubmenus();
                hideAllSections();
                
                // Specific direct links
                if (screen === 'products') {
                    currentTab = 'products';
                    productsSection.style.display = 'block';
                    addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Tool';
                    addBtn.style.display = 'inline-flex';
                    fetchProducts();
                } else if (screen === 'users') {
                    currentTab = 'users';
                    const usersSection = document.getElementById('usersSection');
                    if (usersSection) usersSection.style.display = 'block';
                    addBtn.style.display = 'none';
                    fetchUsers();
                } else if (screen === 'inspection') {
                    currentTab = 'inspection';
                    inspectionSection.style.display = 'block';
                    addBtn.style.display = 'none';
                    initInspection();
                } else if (screen === 'maintenance') {
                    currentTab = 'maintenance';
                    const mSec = document.getElementById('maintenanceSection');
                    if (mSec) mSec.style.display = 'block';
                    addBtn.style.display = 'none';
                } else if (screen === 'hr') {
                    currentTab = 'hr';
                    const hrSec = document.getElementById('hrSection');
                    if (hrSec) hrSec.style.display = 'block';
                    addBtn.style.display = 'none';
                }
            }
        });
    });

    // Sub-tab Click Handlers
    const subTabs = {
        'sidebarRfq': { tab: 'rfq', action: () => {
            const sec = document.getElementById('rfqSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Create RFQ';
            initRfqSection();
        }},
        'sidebarQuote': { tab: 'quote', action: () => {
            const sec = document.getElementById('quoteSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Create Quote';
            initQuoteSection();
        }},
        'sidebarPartMaster': { tab: 'partmaster', action: () => { 
            partMasterSection.style.display = 'block'; 
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Part';
            const addPartBtnTab = document.getElementById('addPartTab');
            if (addPartBtnTab) addPartBtnTab.style.display = 'inline-block';
            const clearBtn = document.getElementById('clearAllPartsTab');
            if (clearBtn) clearBtn.style.display = isUserAdmin() ? 'inline-block' : 'none';
            fetchPartMasters(); 
        }},
        'sidebarMachines': { tab: 'machines', action: () => { 
            machinesSection.style.display = 'block'; 
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Machine';
            fetchMachines(); 
        }},
        'sidebarOperators': { tab: 'operators', action: () => { 
            operatorsSection.style.display = 'block'; 
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Operator';
            fetchOperators(); 
        }},
        'sidebarDept': { tab: 'dept', action: () => {
            departmentsSection.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Dept';
            fetchDepartments();
        }},
        'sidebarShift': { tab: 'shift', action: () => {
            if (shiftsSection) shiftsSection.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Shift';
            fetchShifts();
        }},
        'sidebarVendors': { tab: 'vendors', action: () => {
            if (vendorsSection) vendorsSection.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Vendor';
            fetchVendors();
        }},
        'sidebarSetters': { tab: 'setters', action: () => {
            if (settersSection) settersSection.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Setter';
            fetchSetters();
        }},
        'sidebarSuppliers': { tab: 'suppliers', action: () => {
            const suppliersSection = document.getElementById('suppliersSection');
            if (suppliersSection) suppliersSection.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Supplier';
            fetchSuppliers();
        }},
        'sidebarDbBackup': { tab: 'db_backup', action: () => {
            const sec = document.getElementById('dbBackupSection');
            if (sec) sec.style.display = 'block';
            addBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
        }},
        'sidebarHt': { tab: 'ht', action: () => {
            if (htSection) htSection.style.display = 'block';
            importBtn.style.display = 'none';
            const sendToHtBtnTab = document.getElementById('sendToHtTab');
            if (sendToHtBtnTab) sendToHtBtnTab.style.display = 'inline-block';
            fetchHtData();
        }},
        'sidebarPc': { tab: 'pc', action: () => {
            const pcSection = document.getElementById('pcSection');
            if (pcSection) pcSection.style.display = 'block';
            importBtn.style.display = 'none';
            const sendToPcBtnTab = document.getElementById('sendToPcTab');
            if (sendToPcBtnTab) sendToPcBtnTab.style.display = 'inline-block';
            fetchPcData();
        }},
        'sidebarRmReceipt': { tab: 'rm_receipt', action: () => { 
            if (rmReceiptSection) rmReceiptSection.style.display = 'block';
            const addReceiptBtnTab = document.getElementById('addReceiptTab');
            if (addReceiptBtnTab) addReceiptBtnTab.style.display = 'inline-block';
            importBtn.style.display = 'inline-flex';
            fetchRmLogs('receipt');
        }},
        'sidebarRmDespatch': { tab: 'rm_despatch', action: () => { 
            if (rmDespatchSection) rmDespatchSection.style.display = 'block';
            const addDespatchBtnTab = document.getElementById('addDespatchTab');
            if (addDespatchBtnTab) addDespatchBtnTab.style.display = 'inline-block';
            importBtn.style.display = 'inline-flex';
            fetchRmLogs('despatch');
        }},
        'sidebarRmMaster': { tab: 'rawmaterial', action: () => { 
            if (rawMaterialsSection) rawMaterialsSection.style.display = 'block';
            const addRmBtnTab = document.getElementById('addRmTab');
            if (addRmBtnTab) addRmBtnTab.style.display = 'inline-block';
            importBtn.style.display = 'inline-flex';
            fetchRawMaterials();
        }},
        'sidebarRmRequirement': { tab: 'rm_requirement', action: () => { 
            const rmReqSec = document.getElementById('rmRequirementSection');
            if (rmReqSec) {
                rmReqSec.style.display = 'block';
                rmReqSec.querySelectorAll('.table-container').forEach(tc => tc.style.display = 'block');
            }
            addBtn.style.display = 'none';
            if (typeof fetchDepartments === 'function') fetchDepartments();
            fetchRmRequirement();
        }},
        'sidebarScheduleCreate': { tab: 'schedule_create', action: () => {
            if (scheduleCreateSection) scheduleCreateSection.style.display = 'block';
            addBtn.style.display = 'none';
            fetchSchedulesForList();
        }},
        'sidebarResourceReqd': { tab: 'resource_reqd', action: () => {
            const sec = document.getElementById('resourceReqdSection');
            if (sec) sec.style.display = 'block';
            addBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
            initResourceReqd();
        }},
        'sidebarMcUtil': { tab: 'mc_util', action: () => { 
            const mcUtilSec = document.getElementById('mcUtilSection');
            if (mcUtilSec) {
                mcUtilSec.style.display = 'block';
                mcUtilSec.querySelectorAll('.table-container').forEach(tc => tc.style.display = 'block');
            }
            addBtn.style.display = 'none';
            if (typeof fetchDepartments === 'function') fetchDepartments();
            const fromEl = document.getElementById('mcUtilFromDate');
            const toEl = document.getElementById('mcUtilToDate');
            const today = new Date().toISOString().split('T')[0];
            if (toEl && !toEl.value) toEl.value = today;
            if (fromEl && !fromEl.value) fromEl.value = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
            document.getElementById('generateMcUtilBtn')?.click();
        }},
        'sidebarBcProd': { tab: 'bc_prod', action: () => {
            const sec = document.getElementById('bcProdSection');
            if (sec) sec.style.display = 'block';
            addBtn.style.display = 'none';
            initBcProdReport();
        }},
        'sidebarAttVsLogin': { tab: 'att_vs_login', action: () => {
            const sec = document.getElementById('attVsLoginSection');
            if (sec) sec.style.display = 'block';
            addBtn.style.display = 'none';
            if (importBtn) importBtn.style.display = 'none';
            const mInput = document.getElementById('attVsLoginMonth');
            if (mInput && !mInput.value) {
                mInput.value = new Date().toISOString().slice(0, 7);
            }
            if (typeof fetchDepartments === 'function') fetchDepartments();
            fetchAttVsLoginReport();
        }},
        'sidebarInsertMaster': { tab: 'insertmaster', action: () => {
            const sec = document.getElementById('insertMasterSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchInsertMasters();
        }},
        'sidebarDrillMaster': { tab: 'drillmaster', action: () => {
            const sec = document.getElementById('drillMasterSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchDrillMasters();
        }},
        'sidebarTapMaster': { tab: 'tapmaster', action: () => {
            const sec = document.getElementById('tapMasterSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchTapMasters();
        }},
        'sidebarInsertReceipt': { tab: 'insertreceipt', action: () => {
            const sec = document.getElementById('insertReceiptSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchInsertReceipts();
        }},
        'sidebarTapReceipt': { tab: 'tapreceipt', action: () => {
            const sec = document.getElementById('tapReceiptSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchTapReceipts();
        }},
        'sidebarInsertIssue': { tab: 'insertissue', action: () => {
            const sec = document.getElementById('insertIssueSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchInsertIssues();
        }},
        'sidebarTapIssue': { tab: 'tapissue', action: () => {
            const sec = document.getElementById('tapIssueSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'inline-block';
            addBtn.style.display = 'none';
            fetchTapIssues();
        }},
        'sidebarInsertCpc': { tab: 'insertcpc', action: () => {
            const sec = document.getElementById('insertCpcSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'none';
            fetchInsertCpcReport();
        }},
        'sidebarInsertStock': { tab: 'insertstock', action: () => {
            const sec = document.getElementById('insertStockSection');
            if (sec) sec.style.display = 'block';
            importBtn.style.display = 'none';
            addBtn.style.display = 'none';
            fetchInsertStockReport();
        }},
        'sidebarOperEff': { tab: 'oper_eff', action: () => {
            const operEffSec = document.getElementById('operEffSection');
            if (operEffSec) {
                operEffSec.style.display = 'block';
                operEffSec.querySelectorAll('.table-container').forEach(tc => tc.style.display = 'block');
            }
            addBtn.style.display = 'none';
            if (typeof fetchDepartments === 'function') fetchDepartments();
            const dateEl = document.getElementById('operEffDate');
            if (dateEl && !dateEl.value) {
                dateEl.value = new Date().toISOString().split('T')[0];
            }
            if (typeof fetchOperEffReport === 'function') fetchOperEffReport();
        }},
        'sidebarScheduleCreate': { tab: 'schedule_create', action: () => { 
            scheduleCreateSection.style.display = 'block'; 
            addBtn.style.display = 'none'; 
            fetchScheduleOptions(); 
        }},
        'sidebarScheduleRun': { tab: 'schedule_run', action: () => { 
            scheduleRunSection.style.display = 'block'; 
            addBtn.style.display = 'none'; 
            fetchRunSchedule(); 
        }},
        'sidebarStatus': { tab: 'status', action: () => { 
            scheduleStatusSection.style.display = 'block'; 
            addBtn.style.display = 'none'; 
            initScheduleStatus(); 
        }},
        'sidebarProdLog': { tab: 'prodlog', action: () => { 
            prodLogSection.style.display = 'block'; 
            addBtn.style.display = 'none'; 
            initProdLog(); 
        }},
        'sidebarDebur': { tab: 'debur', action: () => { 
            deburSection.style.display = 'block'; 
            addBtn.style.display = 'none'; 
            initDebur(); 
        }},
        'sidebarAttendance': { tab: 'attendance', action: () => {
            const attSec = document.getElementById('attendanceSection');
            if (attSec) attSec.style.display = 'block';
            addBtn.style.display = 'none';
            initAttendance();
        }},
        'sidebarBdSlip': { tab: 'bdslip', action: () => {
            const bdSec = document.getElementById('bdSlipSection');
            if (bdSec) bdSec.style.display = 'block';
            addBtn.style.display = 'none';
            fetchBdSlips();
        }},
        'sidebarServiceDetails': { tab: 'servicedetails', action: () => {
            const sdSec = document.getElementById('serviceDetailsSection');
            if (sdSec) sdSec.style.display = 'block';
            addBtn.style.display = 'none';
            initServiceDetails();
        }}
    };

    document.querySelectorAll('.sub-tab:not(.action-tab)').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllSections();
            document.querySelectorAll('.sub-tab:not(.action-tab)').forEach(btn => btn.classList.remove('active'));
            tab.classList.add('active');
            
            const config = subTabs[tab.id];
            if (config) {
                currentTab = config.tab;
                config.action();
            }
        });
    });

    addBtn.addEventListener('click', async () => {
        if (currentTab === 'products') openProductModal(false);
        else if (currentTab === 'partmaster') openPartModal(false);
        else if (currentTab === 'machines') openMachineModal(false);
        else if (currentTab === 'operators') openOperatorModal(false);
        else if (currentTab === 'dept') openDeptModal();
        else if (currentTab === 'shift') openShiftModal();
        else if (currentTab === 'vendors') openVendorModal();
        else if (currentTab === 'setters') openSetterModal(false);
        else if (currentTab === 'suppliers') openSupplierModal();
        else if (currentTab === 'ht') openHtModal();
        else if (currentTab === 'pc') openPcModal();
        else if (currentTab === 'rfq') openRfqModal();
        else if (currentTab === 'quote') openQuoteModal();
        else if (currentTab === 'rawmaterial') {
            document.getElementById('rmModalTitle').innerText = 'Add Raw Material';
            document.getElementById('rawMaterialForm').reset();
            document.getElementById('rmId').value = '';
            document.getElementById('rawMaterialModal').classList.add('show');
        }
        else if (currentTab === 'rm_receipt' || currentTab === 'rm_despatch') {
            const isReceipt = currentTab === 'rm_receipt';
            document.getElementById('rmLogModalTitle').innerText = isReceipt ? 'Add Receipt' : 'Add Despatch';
            const savedDate = document.getElementById('rmLogDate').value;
            document.getElementById('rmLogForm').reset();
            document.getElementById('rmLogId').value = '';
            if (savedDate) document.getElementById('rmLogDate').value = savedDate;
            else document.getElementById('rmLogDate').valueAsDate = new Date();
            document.getElementById('rmLogType').value = isReceipt ? 'receipt' : 'despatch';
            
            // Fetch if empty
            if (allRawMaterials.length === 0) {
                const rRes = await fetch('/api/rawmaterials');
                allRawMaterials = await rRes.json();
            }

            // Populate select with forge PNs
            const selectEl = document.getElementById('rmLogForgePn');
            selectEl.innerHTML = '<option value="">-- Select Forge PN --</option>';
            allRawMaterials.forEach(rm => {
                const opt = document.createElement('option');
                opt.value = rm.forge_pn;
                opt.textContent = rm.forge_pn;
                selectEl.appendChild(opt);
            });
            
            if (rmLogForgePnSelect) {
                rmLogForgePnSelect.destroy();
            }
            rmLogForgePnSelect = new TomSelect(selectEl, {
                create: true,
                sortField: { field: "text", direction: "asc" }
            });
            
            if (isReceipt) {
                if (document.getElementById('rmLogDcTypeGroup')) document.getElementById('rmLogDcTypeGroup').style.display = 'none';
                document.getElementById('rmLogDcNoGroup').style.display = 'none';
                document.getElementById('rmLogFinishPartNoGroup').style.display = 'none';
                if (document.getElementById('rmLogPartPrefixGroup')) document.getElementById('rmLogPartPrefixGroup').style.display = 'none';
            } else {
                if (document.getElementById('rmLogDcTypeGroup')) document.getElementById('rmLogDcTypeGroup').style.display = 'block';
                document.getElementById('rmLogDcNoGroup').style.display = 'block';
                document.getElementById('rmLogFinishPartNoGroup').style.display = 'block';
                if (document.getElementById('rmLogPartPrefixGroup')) document.getElementById('rmLogPartPrefixGroup').style.display = 'block';
                if (document.getElementById('rmLogPartPrefix')) document.getElementById('rmLogPartPrefix').value = '';

                // Auto-generate DC No for selected DC Type
                await autoGenerateRmDcNo();
                
                if (globalPartMasters.length === 0) {
                    const pmRes = await fetch('/api/partmaster');
                    globalPartMasters = await pmRes.json();
                }
                
                const fpSelectEl = document.getElementById('rmLogFinishPartNo');
                fpSelectEl.innerHTML = '<option value="">-- Select Finish Part No --</option>';
                globalPartMasters.forEach(pm => {
                    const opt = document.createElement('option');
                    opt.value = pm.partno;
                    opt.textContent = pm.partno;
                    fpSelectEl.appendChild(opt);
                });
                
                if (rmLogFinishPartNoSelect) {
                    rmLogFinishPartNoSelect.destroy();
                }
                rmLogFinishPartNoSelect = new TomSelect(fpSelectEl, {
                    create: false,
                    sortField: { field: "text", direction: "asc" }
                });
                
                rmLogFinishPartNoSelect.on('change', (val) => {
                    if (!val) return;
                    const cleanVal = val.trim().toLowerCase();
                    const selected = globalPartMasters.find(p => (p.partno || '').trim().toLowerCase() === cleanVal);
                    if (selected) {
                        if (selected.part_prefix && document.getElementById('rmLogPartPrefix')) {
                            document.getElementById('rmLogPartPrefix').value = selected.part_prefix;
                        }
                        if (selected.forge_pn) {
                            const targetForgePn = selected.forge_pn.trim();
                            if (rmLogForgePnSelect) {
                                let matchKey = Object.keys(rmLogForgePnSelect.options).find(k => k.trim().toLowerCase() === targetForgePn.toLowerCase());
                                if (!matchKey) {
                                    const normTarget = targetForgePn.replace(/[\s\-_#]/g, '').toLowerCase();
                                    matchKey = Object.keys(rmLogForgePnSelect.options).find(k => k.replace(/[\s\-_#]/g, '').toLowerCase() === normTarget);
                                }

                                if (matchKey) {
                                    rmLogForgePnSelect.setValue(matchKey);
                                } else {
                                    rmLogForgePnSelect.addOption({ value: targetForgePn, text: targetForgePn });
                                    rmLogForgePnSelect.setValue(targetForgePn);
                                }
                            }
                        }
                    }
                });
            }
            
            // Default date to today
            document.getElementById('rmLogDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('rmLogModal').classList.add('show');
        }
    });

    // Excel Import Logic
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet);

                let endpoint = '';
                let bodyData = '';

                if (currentTab === 'partmaster') {
                    const partsMap = {};
                    json.forEach(row => {
                        let partno = '', family = '', forge_pn = '', part_prefix = '', department = '', va = '';
                        let opn_no = '', description = '', machine = '', cycle_time = 0;
                        for (let k in row) {
                            let key = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            let val = String(row[k]).trim();
                            if (key === 'partno') partno = val;
                            else if (key === 'family') family = val;
                            else if (key === 'forgepn') forge_pn = val;
                            else if (key === 'partprefix' || key === 'prefix') part_prefix = val;
                            else if (key === 'dept' || key === 'department') department = val;
                            else if (key === 'va') va = val;
                            else if (key === 'opnno') opn_no = val;
                            else if (key === 'description') description = val;
                            else if (key === 'machine') machine = val;
                            else if (key === 'cycletime') cycle_time = parseFloat(val) || 0;
                        }
                        if (!partno) return;

                        if (!partsMap[partno]) {
                            partsMap[partno] = {
                                family, forge_pn, part_prefix, partno, department, va, operations: []
                            };
                        }

                        if (opn_no || description) {
                            partsMap[partno].operations.push({
                                opn_no, description, machine, cycle_time
                            });
                        }
                    });
                    endpoint = '/api/partmaster/bulk_import';
                    bodyData = JSON.stringify({ parts: Object.values(partsMap) });
                } else if (currentTab === 'machines') {
                    const machines = [];
                    json.forEach(row => {
                        let name = '';
                        let dept = '';
                        for (let k in row) {
                            let key = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (key === 'machinename' || key === 'machine' || key === 'name') name = String(row[k]).trim();
                            if (key === 'dept' || key === 'department') dept = String(row[k]).trim();
                        }
                        if (!name) return;
                        machines.push({
                            name: name,
                            department: dept
                        });
                    });
                    endpoint = '/api/machines/bulk_import';
                    bodyData = JSON.stringify({ machines: machines });
                } else if (currentTab === 'operators') {
                    const operators = [];
                    json.forEach(row => {
                        let name = '';
                        let dept = '';
                        let desig = 'Operator';
                        for (let k in row) {
                            let key = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (key === 'name' || key === 'operatorname' || key === 'operator') name = String(row[k]).trim();
                            if (key === 'dept' || key === 'department') dept = String(row[k]).trim();
                            if (key === 'designation' || key === 'desig' || key === 'role') desig = String(row[k]).trim();
                        }
                        if (!name) return;
                        operators.push({
                            name: name,
                            department: dept,
                            designation: desig || 'Operator'
                        });
                    });
                    endpoint = '/api/operators/bulk_import';
                    bodyData = JSON.stringify({ operators: operators });
                } else if (currentTab === 'rawmaterial') {
                    const rawmaterials = [];
                    json.forEach(row => {
                        let forge_pn = '', quantity = 0;
                        for (let k in row) {
                            let key = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            let val = String(row[k]).trim();
                            if (key === 'forgepn') forge_pn = val;
                            else if (key === 'quantity' || key === 'qty' || key === 'stock' || key === 'receipt') quantity = parseInt(val) || 0;
                        }
                        if (!forge_pn) return;
                        rawmaterials.push({ forge_pn, receipt: quantity, despatch: 0, stock: quantity });
                    });
                    
                    if (rawmaterials.length === 0) {
                        alert("No valid raw material data found. Please check column headers (e.g., 'Forge PN', 'Quantity').");
                        return;
                    }
                    
                    endpoint = '/api/rawmaterials/bulk';
                    bodyData = JSON.stringify({ rawmaterials: rawmaterials });
                } else if (currentTab === 'rm_receipt' || currentTab === 'rm_despatch') {
                    const logs = [];
                    const type = currentTab === 'rm_receipt' ? 'receipt' : 'despatch';
                    json.forEach(row => {
                        let forge_pn = '', qty = 0, date = '';
                        for (let k in row) {
                            let key = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            let val = String(row[k]).trim();
                            if (key === 'forgepn') forge_pn = val;
                            else if (key === 'quantity' || key === 'qty') qty = parseInt(val) || 0;
                            else if (key === 'date') date = row[k];
                        }
                        if (!forge_pn || qty <= 0) return;
                        
                        if (!date) {
                            date = new Date().toISOString().split('T')[0];
                        } else {
                            if (typeof date === 'number') {
                                const d = new Date((date - 25569) * 86400 * 1000);
                                date = d.toISOString().split('T')[0];
                            }
                        }
                        
                        logs.push({ type, date, forge_pn, qty });
                    });
                    
                    if (logs.length === 0) {
                        alert("No valid log data found. Please check column headers (e.g., 'Forge PN', 'Quantity').");
                        return;
                    }
                    
                    endpoint = '/api/rawmateriallogs/bulk';
                    bodyData = JSON.stringify({ logs: logs });
                }

                if (!endpoint) {
                    alert('Import is not supported on this tab.');
                    importBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import Excel`;
                    importBtn.disabled = false;
                    importFile.value = '';
                    return;
                }
                
                // Show loading indicator on button
                importBtn.innerHTML = 'Importing...';
                importBtn.disabled = true;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: bodyData
                });

                if (response.ok) {
                    const resJson = await response.json().catch(() => ({}));
                    alert(resJson.message || 'Import successful!');
                    if (currentTab === 'partmaster') fetchPartMasters();
                    else if (currentTab === 'machines') fetchMachines();
                    else if (currentTab === 'operators') fetchOperators();
                    else if (currentTab === 'rawmaterial') fetchRawMaterials();
                    else if (currentTab === 'rm_receipt') fetchRmLogs('receipt');
                    else if (currentTab === 'rm_despatch') fetchRmLogs('despatch');
                } else {
                    const errText = await response.text().catch(() => '');
                    alert('Import failed: ' + (errText || 'Please check the file format and column headers.'));
                }
            } catch (err) {
                console.error('Error importing file:', err);
                alert('Error parsing the file. Make sure it is a valid Excel format.');
            } finally {
                importBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import Excel`;
                importBtn.disabled = false;
                importFile.value = ''; // Reset file input
            }
        };
        reader.readAsBinaryString(file);
    });

    // --- PRODUCTS LOGIC ---
    async function fetchProducts() {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            productsBody.innerHTML = '';
            if (products.length === 0) {
                productsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No tools found. Add one!</td></tr>';
                return;
            }
            products.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.id}</td><td>${p.family}</td><td>${p.spec}</td><td>${p.make}</td>
                    <td>${p.stock}</td><td>Rs ${p.price.toFixed(2)}</td>
                    <td class="actions">
                        <button class="btn btn-edit" onclick="editProduct(${p.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
                    </td>`;
                productsBody.appendChild(tr);
            });
        } catch (e) { console.error(e); }
    }

    function openProductModal(isEdit) {
        productModal.classList.add('show');
        productModalTitle.textContent = isEdit ? 'Edit Tool' : 'Add Tool';
    }
    function closeProductModal() { productModal.classList.remove('show'); productForm.reset(); document.getElementById('productId').value = ''; }
    closeProductBtn.addEventListener('click', closeProductModal); cancelProductBtn.addEventListener('click', closeProductModal);

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const data = {
            family: document.getElementById('family').value, spec: document.getElementById('spec').value,
            make: document.getElementById('make').value, stock: parseInt(document.getElementById('stock').value),
            price: parseFloat(document.getElementById('price').value)
        };
        const url = id ? `/api/products/${id}` : '/api/products';
        await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeProductModal(); fetchProducts();
    });

    window.deleteProduct = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Delete this tool?')) {
            await fetch(`/api/products/${id}`, { method: 'DELETE' });
            fetchProducts();
        }
    };
    window.editProduct = async (id) => {
        const res = await fetch('/api/products'); const data = await res.json();
        const p = data.find(x => x.id === id);
        if (p) {
            document.getElementById('productId').value = p.id; document.getElementById('family').value = p.family;
            document.getElementById('spec').value = p.spec; document.getElementById('make').value = p.make;
            document.getElementById('stock').value = p.stock; document.getElementById('price').value = p.price;
            openProductModal(true);
        }
    };

    // --- PART MASTER LOGIC ---
    async function fetchPartMasters() {
        try {
            const response = await fetch('/api/partmaster');
            const parts = await response.json();
            partMasterBody.innerHTML = '';
            if (parts.length === 0) {
                partMasterBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No part masters found.</td></tr>';
                return;
            }
            parts.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.id}</td><td>${escapeHtml(p.customer || '')}</td><td>${escapeHtml(p.department || '')}</td><td>${escapeHtml(p.family || '')}</td><td>${escapeHtml(p.forge_pn || '')}</td><td>${escapeHtml(p.part_prefix || '')}</td><td>${escapeHtml(p.partno || '')}</td><td>${p.va !== undefined && p.va !== null ? p.va : ''}</td>
                    <td class="actions" style="white-space: nowrap;">
                        <button class="btn btn-outline" style="margin-right: 4px; padding: 4px 8px; font-size: 0.8rem;" onclick="openOperations(${p.id})">Operations</button>
                        <button class="btn btn-edit" style="margin-right: 4px; padding: 4px 8px; font-size: 0.8rem; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; cursor: pointer;" onclick="editPartMaster(${p.id})">Edit</button>
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; cursor: pointer;" onclick="deletePartMaster(${p.id})">Delete</button>
                    </td>`;
                partMasterBody.appendChild(tr);
            });
            applyPartMasterHeaderFilters();
        } catch (e) { console.error(e); }
    }

    function applyPartMasterHeaderFilters() {
        applyTableColFilters('partMasterTable');
    }

    // Universal Table Header Filter Engine
    window.applyTableColFilters = function(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const inputs = table.querySelectorAll('thead input, thead select');
        const activeFilters = [];
        inputs.forEach(input => {
            const val = input.value.trim().toLowerCase();
            if (val) {
                let colIdx = input.getAttribute('data-col');
                if (colIdx !== null && colIdx !== undefined) {
                    colIdx = parseInt(colIdx, 10);
                } else {
                    const th = input.closest('th');
                    if (th && th.parentNode) {
                        colIdx = Array.from(th.parentNode.children).indexOf(th);
                    }
                }
                if (colIdx !== null && colIdx !== undefined && !isNaN(colIdx)) {
                    activeFilters.push({ colIdx, val });
                }
            }
        });

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            if (tr.children.length === 1 && tr.children[0].hasAttribute('colspan')) return;
            let show = true;
            for (const f of activeFilters) {
                const cell = tr.children[f.colIdx];
                if (cell) {
                    const text = (cell.textContent || '').trim().toLowerCase();
                    if (!text.includes(f.val)) {
                        show = false;
                        break;
                    }
                }
            }
            tr.style.display = show ? '' : 'none';
        });

        const clearBtn = table.querySelector('.clear-table-filters-btn, [id^="clearFilters"], [id$="FiltersBtn"]');
        if (clearBtn) {
            clearBtn.style.display = activeFilters.length > 0 ? 'inline-block' : 'none';
        }
    };

    document.addEventListener('input', (e) => {
        if (e.target && e.target.closest('thead') && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
            const table = e.target.closest('table');
            if (table && table.id) {
                applyTableColFilters(table.id);
            }
        }
    });

    document.addEventListener('click', (e) => {
        const clearBtn = e.target.closest('.clear-table-filters-btn, [id^="clearFilters"], [id$="FiltersBtn"]');
        if (clearBtn) {
            const table = clearBtn.closest('table');
            if (table && table.id) {
                table.querySelectorAll('thead input, thead select').forEach(inp => inp.value = '');
                applyTableColFilters(table.id);
            }
        }
    });

    function openPartModal(isEdit) {
        if (partModal) {
            partModal.classList.add('active');
            partModal.classList.add('show');
        }
        if (partModalTitle) partModalTitle.textContent = isEdit ? 'Edit Part' : 'Add Part';
    }
    function closePartModal() {
        if (partModal) {
            partModal.classList.remove('active');
            partModal.classList.remove('show');
        }
        if (partForm) partForm.reset();
        const partIdInput = document.getElementById('partId');
        if (partIdInput) partIdInput.value = '';
        const prefixEl = document.getElementById('partPrefix');
        if (prefixEl) prefixEl.value = '';
    }
    closePartBtn.addEventListener('click', closePartModal); cancelPartBtn.addEventListener('click', closePartModal);

    partForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('partId').value;
        const data = {
            family: document.getElementById('partFamily').value,
            forge_pn: document.getElementById('forgePn').value,
            part_prefix: document.getElementById('partPrefix') ? document.getElementById('partPrefix').value.trim() : '',
            partno: document.getElementById('partno').value,
            department: document.getElementById('partDept').value,
            customer: document.getElementById('partCustomer').value,
            va: document.getElementById('partVa').value
        };
        const url = id ? `/api/partmaster/${id}` : '/api/partmaster';
        try {
            const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) {
                const errText = await res.text();
                let errDetail = errText;
                try {
                    const parsed = JSON.parse(errText);
                    if (parsed.detail) errDetail = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
                } catch(e){}
                alert('Failed to save part details: ' + errDetail);
                return;
            }
            closePartModal();
            fetchPartMasters();
        } catch(err) {
            console.error('Error saving part master:', err);
            alert('Failed to save part details: ' + err.message);
        }
    });

    window.deletePartMaster = async (id) => {
        if (!confirm('Are you sure you want to delete this part master row?')) return;
        try {
            const res = await fetch(`/api/partmaster/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchPartMasters();
            } else {
                alert('Failed to delete part.');
            }
        } catch(e) {
            alert('Error deleting part: ' + e);
        }
    };
    window.editPartMaster = async (id) => {
        const res = await fetch('/api/partmaster'); const data = await res.json();
        const p = data.find(x => x.id === id);
        if (p) {
            document.getElementById('partId').value = p.id;
            document.getElementById('partFamily').value = p.family;
            document.getElementById('forgePn').value = p.forge_pn;
            if (document.getElementById('partPrefix')) document.getElementById('partPrefix').value = p.part_prefix || '';
            document.getElementById('partno').value = p.partno;
            document.getElementById('partCustomer').value = p.customer || '';
            document.getElementById('partDept').value = p.department || '';
            document.getElementById('partVa').value = p.va || '';
            openPartModal(true);
        }
    };

    // --- PART OPERATIONS LOGIC ---
    let currentMachineOptions = '';
    
    function addOperationRow(op = { opn_no: '', description: '', machine: '', cycle_time: '' }) {
        let defaultOpn = (op && op.opn_no !== undefined && op.opn_no !== null) ? op.opn_no : '';
        if (defaultOpn === '' && operationsBody) {
            const existingRows = operationsBody.querySelectorAll('tr');
            let maxOpn = 0;
            existingRows.forEach(r => {
                const inp = r.querySelector('.opn-no');
                const val = inp ? parseInt(inp.value, 10) : NaN;
                if (!isNaN(val) && val > maxOpn) maxOpn = val;
            });
            defaultOpn = maxOpn > 0 ? (maxOpn + 10) : 10;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="opn-no" value="${defaultOpn}" placeholder="10" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;"></td>
            <td><input type="text" class="op-desc" value="${op.description || ''}" placeholder="Operation description" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;"></td>
            <td>
                <select class="op-mach" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;">
                    ${currentMachineOptions}
                </select>
            </td>
            <td><input type="number" step="0.01" min="0" class="op-time" value="${op.cycle_time || ''}" placeholder="0.00" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;"></td>
            <td style="text-align: center;">
                <button type="button" class="btn btn-outline remove-op-row-btn" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;" title="Delete Operation">&times;</button>
            </td>
        `;
        const selectEl = tr.querySelector('.op-mach');
        if (op.machine) selectEl.value = op.machine;
        
        tr.querySelector('.remove-op-row-btn')?.addEventListener('click', () => {
            tr.remove();
        });

        if (operationsBody) operationsBody.appendChild(tr);
    }

    document.getElementById('addOperationRowBtn')?.addEventListener('click', () => {
        addOperationRow();
    });

    window.openOperations = async (partId) => {
        if (!operationsPartId || !operationsModal) return;
        operationsPartId.value = partId;
        
        try {
            // Get the part's department to filter machines
            const pRes = await fetch('/api/partmaster');
            const parts = await pRes.json();
            const part = parts.find(p => p.id === partId);
            const partDept = part ? (part.department || '').trim().toLowerCase() : '';

            // Ensure machines are loaded for dropdown
            if (!availableMachines || availableMachines.length === 0) {
                const mRes = await fetch('/api/machines');
                availableMachines = await mRes.json();
            }

            // Fetch existing operations
            const res = await fetch(`/api/partmaster/${partId}/operations`);
            const existingOps = await res.json();

            if (operationsBody) operationsBody.innerHTML = '';
            currentMachineOptions = '<option value="">-- Select Machine --</option>';
            if (availableMachines && availableMachines.length > 0) {
                availableMachines.forEach(m => {
                    const mDept = (m.department || '').trim().toLowerCase();
                    if (!partDept || !mDept || mDept === partDept) {
                        currentMachineOptions += `<option value="${m.name}">${m.name}</option>`;
                    }
                });
            }

            if (existingOps && existingOps.length > 0) {
                existingOps.forEach(op => addOperationRow(op));
            } else {
                addOperationRow();
            }

            const opTableContainer = document.getElementById('operationsTable')?.closest('.table-container, .modal-table-container');
            if (opTableContainer) opTableContainer.style.display = 'block';

            operationsModal.classList.add('active');
            operationsModal.classList.add('show');
        } catch(e) {
            console.error('Error opening operations modal:', e);
        }
    };

    function closeOperationsModal() {
        if (operationsModal) {
            operationsModal.classList.remove('active');
            operationsModal.classList.remove('show');
        }
    }
    closeOperationsModalBtn?.addEventListener('click', closeOperationsModal);
    cancelOperationsBtn?.addEventListener('click', closeOperationsModal);

    saveOperationsBtn?.addEventListener('click', async () => {
        const partId = operationsPartId ? operationsPartId.value : null;
        if (!partId || !operationsBody) return;

        const rows = operationsBody.querySelectorAll('tr');
        const operationsData = [];

        rows.forEach(row => {
            const opnInp = row.querySelector('.opn-no');
            const descInp = row.querySelector('.op-desc');
            const machInp = row.querySelector('.op-mach');
            const timeInp = row.querySelector('.op-time');

            const opn_no = opnInp ? opnInp.value.trim() : '';
            const description = descInp ? descInp.value.trim() : '';
            const machine = machInp ? machInp.value : '';
            const cycle_time = timeInp ? (parseFloat(timeInp.value) || 0) : 0;

            if (opn_no || description) {
                operationsData.push({
                    opn_no, description, machine, cycle_time
                });
            }
        });

        try {
            const res = await fetch(`/api/partmaster/${partId}/operations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(operationsData)
            });
            if (res.ok) {
                closeOperationsModal();
                if (typeof fetchPartMasters === 'function') fetchPartMasters();
            } else {
                alert('Error saving operations.');
            }
        } catch (e) {
            console.error('Error saving operations:', e);
            alert('Error saving operations.');
        }
    });    // --- MACHINES LOGIC ---
    async function fetchMachines() {
        try {
            const response = await fetch('/api/machines');
            const machines = await response.json();
            availableMachines = machines; // update global list
            machinesBody.innerHTML = '';
            if (machines.length === 0) {
                machinesBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No machines found.</td></tr>';
                return;
            }
            machines.forEach(m => {
                const tr = document.createElement('tr');
                const deptVal = m.department || m.dept || '';
                tr.innerHTML = `
                    <td>${m.id}</td>
                    <td>${escapeHtml(deptVal)}</td>
                    <td>${escapeHtml(m.name || '')}</td>
                    <td class="actions">
                        <button class="btn btn-edit" onclick="editMachine(${m.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteMachine(${m.id})">Delete</button>
                    </td>`;
                machinesBody.appendChild(tr);
            });
            if (typeof applyTableColFilters === 'function') {
                applyTableColFilters('machinesTable');
            }
        } catch (e) { console.error(e); }
    }

    function openMachineModal(isEdit) {
        if (machineModal) {
            machineModal.classList.add('active');
            machineModal.classList.add('show');
        }
        if (machineModalTitle) machineModalTitle.textContent = isEdit ? 'Edit Machine' : 'Add Machine';
    }
    function closeMachineModal() { 
        if (machineModal) {
            machineModal.classList.remove('active');
            machineModal.classList.remove('show');
        }
        if (machineForm) machineForm.reset(); 
        const mId = document.getElementById('machineId');
        if (mId) mId.value = ''; 
    }
    closeMachineBtn.addEventListener('click', closeMachineModal); cancelMachineBtn.addEventListener('click', closeMachineModal);

    machineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('machineId').value;
        const deptVal = document.getElementById('machineDept') ? document.getElementById('machineDept').value : '';
        const data = { 
            name: document.getElementById('machineName').value, 
            dept: deptVal,
            department: deptVal 
        };
        const url = id ? `/api/machines/${id}` : '/api/machines';
        await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeMachineModal(); fetchMachines();
    });

    window.deleteMachine = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Delete this machine?')) {
            await fetch(`/api/machines/${id}`, { method: 'DELETE' });
            fetchMachines();
        }
    };
    window.editMachine = async (id) => {
        const res = await fetch('/api/machines'); const data = await res.json();
        const m = data.find(x => x.id === id);
        if (m) {
            document.getElementById('machineId').value = m.id;
            document.getElementById('machineName').value = m.name || '';
            const mDept = document.getElementById('machineDept');
            if (mDept) mDept.value = m.department || m.dept || '';
            openMachineModal(true);
        }
    };

    // --- OPERATORS LOGIC ---
    async function fetchOperators() {
        try {
            const response = await fetch('/api/operators');
            const operators = await response.json();
            operatorsBody.innerHTML = '';
            if (operators.length === 0) {
                operatorsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No operators found.</td></tr>';
                return;
            }
            operators.forEach((o, idx) => {
                const tr = document.createElement('tr');
                const deptVal = o.department || o.dept || '';
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(deptVal)}</td>
                    <td>${escapeHtml(o.name || '')}</td>
                    <td>${escapeHtml(o.designation || 'Operator')}</td>
                    <td class="actions">
                        <button class="btn btn-edit" onclick="editOperator(${o.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteOperator(${o.id})">Delete</button>
                    </td>`;
                operatorsBody.appendChild(tr);
            });
            if (typeof applyTableColFilters === 'function') {
                applyTableColFilters('operatorsTable');
            }
        } catch (e) { console.error(e); }
    }

    function openOperatorModal(isEdit) {
        if (operatorModal) {
            operatorModal.classList.add('active');
            operatorModal.classList.add('show');
        }
        if (operatorModalTitle) operatorModalTitle.textContent = isEdit ? 'Edit Operator' : 'Add Operator';
    }
    function closeOperatorModal() { 
        if (operatorModal) {
            operatorModal.classList.remove('active');
            operatorModal.classList.remove('show');
        }
        if (operatorForm) operatorForm.reset(); 
        const opId = document.getElementById('operatorId');
        if (opId) opId.value = ''; 
    }
    closeOperatorBtn.addEventListener('click', closeOperatorModal); cancelOperatorBtn.addEventListener('click', closeOperatorModal);

    operatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('operatorId').value;
        const deptVal = document.getElementById('operatorDepartment') ? document.getElementById('operatorDepartment').value : '';
        const data = {
            name: document.getElementById('operatorName').value,
            dept: deptVal,
            department: deptVal,
            designation: document.getElementById('operatorDesignation').value || 'Operator'
        };
        const url = id ? `/api/operators/${id}` : '/api/operators';
        await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeOperatorModal(); fetchOperators();
    });

    window.deleteOperator = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Delete this operator?')) {
            await fetch(`/api/operators/${id}`, { method: 'DELETE' });
            fetchOperators();
        }
    };
    window.editOperator = async (id) => {
        const res = await fetch('/api/operators'); const data = await res.json();
        const o = data.find(x => x.id === id);
        if (o) {
            document.getElementById('operatorId').value = o.id; 
            document.getElementById('operatorName').value = o.name || '';
            const deptEl = document.getElementById('operatorDepartment');
            if (deptEl) deptEl.value = o.department || o.dept || '';
            const desigEl = document.getElementById('operatorDesignation');
            if (desigEl) desigEl.value = o.designation || 'Operator';
            openOperatorModal(true);
        }
    };

    document.getElementById('deleteAllOperatorsBtn')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete ALL operator records? This cannot be undone.')) {
            try {
                const res = await fetch('/api/operators/clear-all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All operators deleted successfully.');
                    fetchOperators();
                } else {
                    alert('Failed to delete all operators.');
                }
            } catch (e) {
                console.error(e);
                alert('Error deleting all operators.');
            }
        }
    });

    // --- SETTERS LOGIC ---
    const settersBody = document.getElementById('settersBody');
    const setterModal = document.getElementById('setterModal');
    const setterForm = document.getElementById('setterForm');
    const closeSetterBtn = document.getElementById('closeSetterModalBtn');
    const cancelSetterBtn = document.getElementById('cancelSetterBtn');
    const setterModalTitle = document.getElementById('setterModalTitle');

    async function fetchSetters() {
        try {
            const response = await fetch('/api/setters');
            const setters = await response.json();
            if (settersBody) {
                settersBody.innerHTML = '';
                if (setters.length === 0) {
                    settersBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No setters found.</td></tr>';
                    return;
                }
                setters.forEach(s => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${s.id}</td><td>${s.department || ''}</td><td>${s.name}</td>
                        <td class="actions">
                            <button class="btn btn-edit" onclick="editSetter(${s.id})">Edit</button>
                            <button class="btn btn-danger" onclick="deleteSetter(${s.id})">Delete</button>
                        </td>`;
                    settersBody.appendChild(tr);
                });
            }
        } catch (e) { console.error(e); }
    }

    function openSetterModal(isEdit) {
        if (setterModal) {
            setterModal.classList.add('show');
            if (setterModalTitle) setterModalTitle.textContent = isEdit ? 'Edit Setter' : 'Add Setter';
        }
    }
    function closeSetterModal() {
        if (setterModal) setterModal.classList.remove('show');
        if (setterForm) setterForm.reset();
        const sId = document.getElementById('setterId');
        if (sId) sId.value = '';
    }
    if (closeSetterBtn) closeSetterBtn.addEventListener('click', closeSetterModal);
    if (cancelSetterBtn) cancelSetterBtn.addEventListener('click', closeSetterModal);

    if (setterForm) {
        setterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('setterId').value;
            const data = {
                name: document.getElementById('setterName').value,
                department: document.getElementById('setterDepartment').value
            };
            const url = id ? `/api/setters/${id}` : '/api/setters';
            await fetch(url, {
                method: id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            closeSetterModal();
            fetchSetters();
        });
    }

    window.deleteSetter = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Delete this setter?')) {
            await fetch(`/api/setters/${id}`, { method: 'DELETE' });
            fetchSetters();
        }
    };

    window.editSetter = async (id) => {
        const res = await fetch('/api/setters');
        const data = await res.json();
        const s = data.find(x => x.id === id);
        if (s) {
            document.getElementById('setterId').value = s.id;
            document.getElementById('setterName').value = s.name;
            document.getElementById('setterDepartment').value = s.department || '';
            openSetterModal(true);
        }
    };

    // --- ATTENDANCE LOGIC ---
    const attendanceSection = document.getElementById('attendanceSection');
    const attendanceMonthPicker = document.getElementById('attendanceMonthPicker');
    const attendanceHead = document.getElementById('attendanceHead');
    const attendanceBody = document.getElementById('attendanceBody');

    function getHolidaysForMonth(monthVal) {
        if (!monthVal) return [];
        try {
            const raw = localStorage.getItem('attendance_holidays_' + monthVal);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveHolidaysForMonth(monthVal, daysArray) {
        if (!monthVal) return;
        localStorage.setItem('attendance_holidays_' + monthVal, JSON.stringify(daysArray));
    }

    async function initAttendance() {
        if (attendanceMonthPicker && !attendanceMonthPicker.value) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            attendanceMonthPicker.value = `${yyyy}-${mm}`;
        }
        await renderAttendanceGrid();
    }

    if (attendanceMonthPicker) {
        attendanceMonthPicker.addEventListener('change', () => {
            renderAttendanceGrid();
        });
    }

    // Holiday Modal Elements & Handlers
    const markHolidaysBtn = document.getElementById('markHolidaysBtn');
    const holidayModal = document.getElementById('holidayModal');
    const closeHolidayModalBtn = document.getElementById('closeHolidayModalBtn');
    const cancelHolidayBtn = document.getElementById('cancelHolidayBtn');
    const saveHolidayBtn = document.getElementById('saveHolidayBtn');
    const holidayMonthLabel = document.getElementById('holidayMonthLabel');
    const holidayCheckboxesContainer = document.getElementById('holidayCheckboxesContainer');

    function openHolidayModal() {
        const attPicker = document.getElementById('attendanceMonthPicker');
        const hModal = document.getElementById('holidayModal');
        const hMonthLabel = document.getElementById('holidayMonthLabel');
        const hCbContainer = document.getElementById('holidayCheckboxesContainer');

        if (!attPicker || !hModal) return;
        const monthVal = attPicker.value;
        if (!monthVal) {
            alert('Please select a Month/Year first.');
            return;
        }

        const parts = monthVal.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const daysInMonth = new Date(year, month, 0).getDate();

        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (hMonthLabel) hMonthLabel.textContent = monthName;

        const currentHolidays = new Set(getHolidaysForMonth(monthVal));

        if (hCbContainer) {
            hCbContainer.innerHTML = '';
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month - 1, d);
                const dayOfWeek = dayNames[dateObj.getDay()];
                const isChecked = currentHolidays.has(d);
                const isSun = dateObj.getDay() === 0;

                const wrapper = document.createElement('label');
                wrapper.style.cssText = `
                    display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;
                    border: 1px solid ${isChecked ? '#86efac' : (isSun ? '#bfdbfe' : '#e2e8f0')};
                    background: ${isChecked ? '#dcfce7' : (isSun ? '#eff6ff' : '#ffffff')};
                    font-weight: ${isChecked || isSun ? '600' : '400'};
                `;

                wrapper.innerHTML = `
                    <input type="checkbox" class="holiday-day-cb" value="${d}" ${isChecked ? 'checked' : ''} style="cursor: pointer; accent-color: #16a34a;">
                    <span><strong>${d}</strong> <small style="color: ${isChecked ? '#15803d' : (isSun ? '#1e40af' : '#64748b')};">(${dayOfWeek})</small></span>
                `;

                hCbContainer.appendChild(wrapper);
            }
        }

        hModal.classList.add('show');
    }
    window.openHolidayModal = openHolidayModal;

    if (markHolidaysBtn) markHolidaysBtn.addEventListener('click', openHolidayModal);
    if (closeHolidayModalBtn) closeHolidayModalBtn.addEventListener('click', () => holidayModal.classList.remove('show'));
    if (cancelHolidayBtn) cancelHolidayBtn.addEventListener('click', () => holidayModal.classList.remove('show'));

    if (saveHolidayBtn) {
        saveHolidayBtn.addEventListener('click', () => {
            if (!attendanceMonthPicker) return;
            const monthVal = attendanceMonthPicker.value;
            const selectedDays = [];
            document.querySelectorAll('#holidayCheckboxesContainer .holiday-day-cb:checked').forEach(cb => {
                selectedDays.push(parseInt(cb.value));
            });

            saveHolidaysForMonth(monthVal, selectedDays);
            if (holidayModal) holidayModal.classList.remove('show');
            renderAttendanceGrid();
        });
    }

    async function renderAttendanceGrid() {
        if (!attendanceMonthPicker || !attendanceHead || !attendanceBody) return;
        const monthVal = attendanceMonthPicker.value;
        if (!monthVal) return;

        const parts = monthVal.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const daysInMonth = new Date(year, month, 0).getDate();

        const holidaysSet = new Set(getHolidaysForMonth(monthVal));

        // Build Table Header with Sticky Positioning & Light Green Holiday Headers
        let trHead = '<tr style="background-color: #f1f5f9; font-weight: bold;">';
        trHead += '<th style="border: 1px solid #cbd5e1; padding: 6px; min-width: 140px; text-align: left; position: sticky; top: 0; background-color: #f1f5f9; z-index: 10;">Name</th>';
        trHead += '<th style="border: 1px solid #cbd5e1; padding: 6px; min-width: 80px; text-align: left; position: sticky; top: 0; background-color: #f1f5f9; z-index: 10;">Dept</th>';
        trHead += '<th style="border: 1px solid #cbd5e1; padding: 6px; min-width: 110px; text-align: left; position: sticky; top: 0; background-color: #f1f5f9; z-index: 10;">Designation</th>';

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const isSunday = dateObj.getDay() === 0;
            const isHoliday = holidaysSet.has(d);

            if (isHoliday) {
                trHead += `<th style="border: 1px solid #86efac; padding: 4px 2px; min-width: 36px; background-color: #dcfce7; color: #15803d; font-weight: bold; position: sticky; top: 0; z-index: 10;" title="Holiday">🌴 ${d}<br><span style="font-size: 0.65rem; font-weight: 600; color: #166534;">Hol</span></th>`;
            } else if (isSunday) {
                trHead += `<th style="border: 1px solid #93c5fd; padding: 4px 2px; min-width: 36px; background-color: #dbeafe; color: #1e40af; font-weight: bold; position: sticky; top: 0; z-index: 10;">${d}<br><span style="font-size: 0.7rem; font-weight: normal;">Sun</span></th>`;
            } else {
                trHead += `<th style="border: 1px solid #cbd5e1; padding: 4px 2px; min-width: 36px; background-color: #f8fafc; position: sticky; top: 0; z-index: 10;">${d}</th>`;
            }
        }
        trHead += '</tr>';
        attendanceHead.innerHTML = trHead;

        // Fetch existing attendance for this month
        let existingRecords = [];
        try {
            const res = await fetch(`/api/attendance?month_year=${monthVal}`);
            if (res.ok) existingRecords = await res.json();
        } catch (e) { console.error(e); }

        // Fetch operators to auto-populate employees if attendance is new
        let allOperators = [];
        try {
            const opRes = await fetch('/api/operators');
            if (opRes.ok) allOperators = await opRes.json();
        } catch (e) { console.error(e); }

        // Group operators in exact sequence from Operator Master and map past hours
        const empMap = {};
        if (Array.isArray(allOperators)) {
            allOperators.forEach(op => {
                if (op && op.name) {
                    empMap[op.name] = {
                        name: op.name,
                        dept: op.dept || op.department || '',
                        designation: op.designation || op.role || 'Operator',
                        days: {}
                    };
                }
            });
        }

        if (Array.isArray(existingRecords)) {
            existingRecords.forEach(r => {
                const ename = (r.employee_name || '').trim();
                if (!ename) return;
                if (!empMap[ename]) {
                    empMap[ename] = {
                        name: ename,
                        dept: r.dept || '',
                        designation: r.designation || 'Operator',
                        days: {}
                    };
                }
                empMap[ename].days[r.day] = r.hours;
            });
        }

        let empList = Object.values(empMap);

        attendanceBody.innerHTML = '';

        if (empList.length === 0) {
            for (let i = 0; i < 5; i++) {
                empList.push({ name: '', dept: '', designation: '', days: {} });
            }
        }

        empList.forEach(emp => {
            addAttendanceRow(emp, daysInMonth, year, month);
        });
    }

    function addAttendanceRow(emp = { name: '', dept: '', designation: '', days: {} }, daysInMonth = 31, year = 2026, month = 8) {
        if (!attendanceMonthPicker) return;
        const monthVal = attendanceMonthPicker.value;
        if (monthVal) {
            const parts = monthVal.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            daysInMonth = new Date(year, month, 0).getDate();
        }

        const holidaysSet = new Set(getHolidaysForMonth(monthVal));

        const tr = document.createElement('tr');
        tr.style.height = '32px';

        let rowHtml = `
            <td style="border: 1px solid #cbd5e1; padding: 2px;"><input type="text" class="att-name" value="${emp.name || ''}" placeholder="Name" style="width: 100%; border: none; font-size: 0.85rem; padding: 4px; background: transparent;"></td>
            <td style="border: 1px solid #cbd5e1; padding: 2px;"><input type="text" class="att-dept" value="${emp.dept || ''}" placeholder="Dept" style="width: 100%; border: none; font-size: 0.85rem; padding: 4px; background: transparent;"></td>
            <td style="border: 1px solid #cbd5e1; padding: 2px;"><input type="text" class="att-desig" value="${emp.designation || 'Operator'}" placeholder="Designation" style="width: 100%; border: none; font-size: 0.85rem; padding: 4px; background: transparent;"></td>
        `;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const isSunday = dateObj.getDay() === 0;
            const isHoliday = holidaysSet.has(d);

            let bgStyle = 'border: 1px solid #cbd5e1;';
            if (isHoliday) {
                bgStyle = 'background-color: #dcfce7; border: 1px solid #86efac;';
            } else if (isSunday) {
                bgStyle = 'background-color: #eff6ff; border: 1px solid #bfdbfe;';
            }

            const val = emp.days && emp.days[d] !== undefined ? emp.days[d] : '';
            rowHtml += `
                <td style="${bgStyle} padding: 1px;">
                    <input type="text" class="att-day-val" data-day="${d}" value="${val}" style="width: 100%; text-align: center; border: none; background: transparent; font-size: 0.85rem; padding: 4px 1px;">
                </td>
            `;
        }

        tr.innerHTML = rowHtml;
        attendanceBody.appendChild(tr);
    }

    // Arrow Key Navigation for Attendance Grid
    attendanceBody?.addEventListener('keydown', (e) => {
        const input = e.target;
        if (!input || !input.tagName || input.tagName !== 'INPUT') return;

        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

        const currentTd = input.closest('td');
        const currentTr = input.closest('tr');
        if (!currentTd || !currentTr) return;

        const cellIndex = currentTd.cellIndex;

        if (key === 'ArrowUp') {
            e.preventDefault();
            const prevTr = currentTr.previousElementSibling;
            if (prevTr) {
                const targetInput = prevTr.cells[cellIndex]?.querySelector('input');
                if (targetInput) { targetInput.focus(); targetInput.select(); }
            }
        } else if (key === 'ArrowDown' || key === 'Enter') {
            e.preventDefault();
            const nextTr = currentTr.nextElementSibling;
            if (nextTr) {
                const targetInput = nextTr.cells[cellIndex]?.querySelector('input');
                if (targetInput) { targetInput.focus(); targetInput.select(); }
            }
        } else if (key === 'ArrowLeft') {
            if (input.selectionStart === 0 && input.selectionEnd === 0) {
                e.preventDefault();
                const prevTd = currentTd.previousElementSibling;
                if (prevTd) {
                    const targetInput = prevTd.querySelector('input');
                    if (targetInput) { targetInput.focus(); targetInput.select(); }
                }
            }
        } else if (key === 'ArrowRight') {
            if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
                e.preventDefault();
                const nextTd = currentTd.nextElementSibling;
                if (nextTd) {
                    const targetInput = nextTd.querySelector('input');
                    if (targetInput) { targetInput.focus(); targetInput.select(); }
                }
            }
        }
    });

    document.getElementById('addAttendanceEmpBtn')?.addEventListener('click', () => {
        addAttendanceRow();
    });

    document.getElementById('saveAttendanceBtn')?.addEventListener('click', async () => {
        if (!attendanceMonthPicker) return;
        const monthVal = attendanceMonthPicker.value;
        if (!monthVal) {
            alert('Please select a Month/Year.');
            return;
        }

        const rows = attendanceBody.querySelectorAll('tr');
        const entries = [];

        rows.forEach(tr => {
            const name = tr.querySelector('.att-name')?.value.trim();
            const dept = tr.querySelector('.att-dept')?.value.trim();
            const desig = tr.querySelector('.att-desig')?.value.trim();

            if (name) {
                let hasHours = false;
                tr.querySelectorAll('.att-day-val').forEach(input => {
                    const day = parseInt(input.getAttribute('data-day'));
                    const hrs = input.value.trim();
                    if (hrs !== '') {
                        hasHours = true;
                        entries.push({
                            employee_name: name,
                            dept: dept || '',
                            designation: desig || 'Operator',
                            day: day,
                            hours: hrs
                        });
                    }
                });

                // Save employee details and designation even if no hours are entered yet
                if (!hasHours) {
                    entries.push({
                        employee_name: name,
                        dept: dept || '',
                        designation: desig || 'Operator',
                        day: 1,
                        hours: "0"
                    });
                }
            }
        });

        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month_year: monthVal,
                    entries: entries
                })
            });
            if (res.ok) {
                alert(`Attendance for ${monthVal} saved successfully!`);
            } else {
                alert('Failed to save attendance.');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving attendance.');
        }
    });

    document.getElementById('exportAttendanceExcelBtn')?.addEventListener('click', () => {
        const monthVal = attendanceMonthPicker ? attendanceMonthPicker.value : "Sheet";
        let daysInMonth = 31;
        if (monthVal) {
            const parts = monthVal.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            daysInMonth = new Date(year, month, 0).getDate();
        }

        // Build headers row
        const headers = ['NAME', 'DEPT', 'DESIGNATION'];
        for (let d = 1; d <= daysInMonth; d++) {
            headers.push(d.toString());
        }

        const data = [headers];

        // Build data rows from table inputs
        const rows = document.querySelectorAll('#attendanceBody tr');
        rows.forEach(tr => {
            const name = tr.querySelector('.att-name')?.value.trim() || '';
            const dept = tr.querySelector('.att-dept')?.value.trim() || '';
            const desig = tr.querySelector('.att-desig')?.value.trim() || '';

            if (name || dept) {
                const rowData = [name, dept, desig];
                const dayInputs = tr.querySelectorAll('.att-day-val');
                dayInputs.forEach(input => {
                    const val = input.value.trim();
                    const numVal = Number(val);
                    rowData.push(val !== '' && !isNaN(numVal) ? numVal : val);
                });
                data.push(rowData);
            }
        });

        if (data.length <= 1) {
            alert('No attendance data available to export.');
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_${monthVal || 'Report'}.xlsx`);
    });

    // Initial fetch
    fetchProducts();
    // Pre-fetch machines so the dropdown is ready
    fetch('/api/machines').then(r => r.json()).then(data => availableMachines = data);

    // --- SCHEDULE LOGIC ---
    const schedulePartNo = document.getElementById('schedulePartNo');
    const scheduleDept = document.getElementById('scheduleDept');
    const scheduleCreateForm = document.getElementById('scheduleCreateForm');

    let allPartMasters = [];

    async function loadSchedulePartNos() {
        const res = await fetch('/api/partmaster');
        allPartMasters = await res.json();
        
        // Restore saved schedule department from localStorage
        const savedDept = localStorage.getItem('saved_schedule_dept');
        if (savedDept && scheduleDept) {
            scheduleDept.value = savedDept;
        }
        
        // Force trigger change to populate datalist if dept is already selected
        if (scheduleDept) scheduleDept.dispatchEvent(new Event('change'));
    }

    let schedulePartNoSelect = null;
    
    // Initialize TomSelect immediately
    const schedulePartNoEl = document.getElementById('schedulePartNo');
    if (schedulePartNoEl) {
        schedulePartNoSelect = new TomSelect(schedulePartNoEl, {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }
    
    scheduleDept.addEventListener('change', (e) => {
        const selectedDept = e.target.value;
        if (selectedDept) {
            localStorage.setItem('saved_schedule_dept', selectedDept);
        } else {
            localStorage.removeItem('saved_schedule_dept');
        }
        
        if (schedulePartNoSelect) {
            schedulePartNoSelect.clearOptions();
            schedulePartNoSelect.addOption({value: "", text: "Type or select a Part No"});
            if (selectedDept) {
                const selectedLower = selectedDept.trim().toLowerCase();
                const filteredParts = allPartMasters.filter(p => (p.department || '').trim().toLowerCase() === selectedLower);
                filteredParts.forEach(p => {
                    schedulePartNoSelect.addOption({value: p.partno, text: p.partno});
                });
            }
            schedulePartNoSelect.refreshOptions(false);
        }
    });

    async function fetchSchedulesForList() {
        try {
            const res = await fetch('/api/schedule');
            const schedules = await res.json();

            if (!allPartMasters || allPartMasters.length === 0) {
                try {
                    const pmRes = await fetch('/api/partmaster');
                    allPartMasters = await pmRes.json();
                } catch (e) {}
            }

            const filterDeptSel = document.getElementById('scheduleFilterDept');
            if (filterDeptSel) {
                const currentFilter = filterDeptSel.value;
                const uniqueDepts = Array.from(new Set(schedules.map(s => (s.department || '').trim()).filter(Boolean))).sort();
                filterDeptSel.innerHTML = '<option value="">All Depts</option>' + uniqueDepts.map(d => `<option value="${d}">${d}</option>`).join('');
                if (uniqueDepts.includes(currentFilter)) {
                    filterDeptSel.value = currentFilter;
                }
            }

            const selectedDept = filterDeptSel ? (filterDeptSel.value || '').trim().toLowerCase() : '';

            let filteredSchedules = schedules;
            if (selectedDept) {
                filteredSchedules = schedules.filter(s => (s.department || '').trim().toLowerCase() === selectedDept);
            }

            const tbody = document.getElementById('scheduleListBody');
            if (tbody) {
                tbody.innerHTML = '';
                if (filteredSchedules.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:1rem;">No schedules found.</td></tr>';
                } else {
                    // Sort by newest first assuming higher ID means newer
                    filteredSchedules.sort((a, b) => b.id - a.id);
                    filteredSchedules.forEach((s, idx) => {
                        const partKey = (s.partno || '').trim().toUpperCase();
                        const partObj = (allPartMasters || []).find(p => (p.partno || '').trim().toUpperCase() === partKey);
                        
                        const rateNum = parseFloat(s.rate || (partObj ? (partObj.va || partObj.rate) : 0)) || 0;
                        const qtyNum = parseInt(s.qty) || 0;
                        const valNum = rateNum * qtyNum;

                        const rateStr = rateNum > 0 ? rateNum.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0';
                        const valStr = valNum > 0 ? valNum.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0';

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${idx + 1}</td>
                            <td><strong>${s.department || ''}</strong></td>
                            <td>${s.partno}</td>
                            <td>${s.target_date}</td>
                            <td>${qtyNum}</td>
                            <td>${rateStr}</td>
                            <td><strong>${valStr}</strong></td>
                            <td><span style="padding: 2px 8px; background-color: rgba(59, 130, 246, 0.1); color: var(--primary); border-radius: 12px; font-size: 0.85em;">${s.status || 'Pending'}</span></td>
                            <td>
                                <button onclick="editSchedule(${s.id})" style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 8px;">Edit</button>
                                <button onclick="deleteSchedule(${s.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;">Delete</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            renderScheduleSummaryReport(filteredSchedules);
        } catch (e) {
            console.error('Error fetching schedules:', e);
        }
    }

    function renderScheduleSummaryReport(schedules) {
        const tbody = document.getElementById('scheduleSummaryBody');
        const tfoot = document.getElementById('scheduleSummaryFoot');
        if (!tbody || !tfoot) return;

        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (!schedules || schedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 0.75rem;">No data available.</td></tr>';
            return;
        }

        const deptCustMap = {};
        let grandTotalQty = 0;
        let grandTotalValue = 0;

        schedules.forEach(s => {
            const dept = (s.department || '').trim() || 'Unassigned';
            const partKey = (s.partno || '').trim().toUpperCase();
            const partObj = (allPartMasters || []).find(p => (p.partno || '').trim().toUpperCase() === partKey);

            const cust = (partObj && partObj.customer && partObj.customer.trim()) ? partObj.customer.trim() : dept;
            const rateNum = parseFloat(s.rate || (partObj ? (partObj.va || partObj.rate) : 0)) || 0;
            const qtyNum = parseInt(s.qty) || 0;
            const valNum = rateNum * qtyNum;

            if (!deptCustMap[dept]) {
                deptCustMap[dept] = {};
            }
            if (!deptCustMap[dept][cust]) {
                deptCustMap[dept][cust] = { qty: 0, value: 0 };
            }

            deptCustMap[dept][cust].qty += qtyNum;
            deptCustMap[dept][cust].value += valNum;

            grandTotalQty += qtyNum;
            grandTotalValue += valNum;
        });

        const depts = Object.keys(deptCustMap).sort();

        depts.forEach(dept => {
            const custs = Object.keys(deptCustMap[dept]).sort();
            let deptTotalQty = 0;
            let deptTotalValue = 0;

            custs.forEach(cust => {
                const item = deptCustMap[dept][cust];
                deptTotalQty += item.qty;
                deptTotalValue += item.value;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                tr.innerHTML = `
                    <td style="padding: 5px 8px;"><strong>${dept}</strong></td>
                    <td style="padding: 5px 8px;">${cust}</td>
                    <td style="padding: 5px 8px; text-align: right;">${item.qty.toLocaleString('en-IN')}</td>
                    <td style="padding: 5px 8px; text-align: right;">₹${item.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            });

            if (custs.length > 1) {
                const trDept = document.createElement('tr');
                trDept.style.background = 'rgba(0,0,0,0.03)';
                trDept.style.borderBottom = '1px solid var(--border-color)';
                trDept.style.fontWeight = '600';
                trDept.innerHTML = `
                    <td colspan="2" style="padding: 5px 8px; font-style: italic;">Subtotal (${dept}):</td>
                    <td style="padding: 5px 8px; text-align: right;">${deptTotalQty.toLocaleString('en-IN')}</td>
                    <td style="padding: 5px 8px; text-align: right;">₹${deptTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(trDept);
            }
        });

        const tfTr = document.createElement('tr');
        tfTr.innerHTML = `
            <td colspan="2" style="padding: 6px 8px; text-align: left; text-transform: uppercase;">Total (Dept Wise)</td>
            <td style="padding: 6px 8px; text-align: right; color: var(--primary); font-size: 0.9rem;">${grandTotalQty.toLocaleString('en-IN')}</td>
            <td style="padding: 6px 8px; text-align: right; color: var(--primary); font-size: 0.9rem;">₹${grandTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        `;
        tfoot.appendChild(tfTr);
    }

    document.getElementById('scheduleFilterDept')?.addEventListener('change', () => {
        fetchSchedulesForList();
    });

    let editingScheduleId = null;

    if (scheduleCreateForm) {
        scheduleCreateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const partVal = schedulePartNoSelect ? schedulePartNoSelect.getValue() : (document.getElementById('schedulePartNo')?.value || '');
            if (!partVal) {
                alert('Please select or type a Part No.');
                return;
            }
            const data = {
                partno: partVal,
                department: scheduleDept.value,
                target_date: document.getElementById('scheduleTargetDate').value,
                qty: parseInt(document.getElementById('scheduleQty').value)
            };
            try {
                const method = editingScheduleId ? 'PUT' : 'POST';
                const url = editingScheduleId ? `/api/schedule/${editingScheduleId}` : '/api/schedule';
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    alert(editingScheduleId ? 'Schedule updated successfully!' : 'Schedule created successfully!');
                    const savedDate = document.getElementById('scheduleTargetDate').value;
                    const savedDept = scheduleDept.value || localStorage.getItem('saved_schedule_dept') || '';

                    scheduleCreateForm.reset();

                    if (savedDate) document.getElementById('scheduleTargetDate').value = savedDate;
                    if (savedDept) {
                        scheduleDept.value = savedDept;
                        localStorage.setItem('saved_schedule_dept', savedDept);
                    }
                    editingScheduleId = null;
                    const submitBtn = document.querySelector('#scheduleCreateForm button[type="submit"]');
                    if (submitBtn) submitBtn.textContent = 'Create Schedule';
                    if (schedulePartNoSelect) schedulePartNoSelect.clear();
                    scheduleDept.dispatchEvent(new Event('change'));
                    fetchSchedulesForList();
                } else {
                    alert('Error saving schedule.');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        });
    }

    window.editSchedule = async function(id) {
        try {
            const res = await fetch('/api/schedule');
            const schedules = await res.json();
            const s = schedules.find(x => x.id === id);
            if (!s) return;
            
            editingScheduleId = id;
            
            const selectedDept = s.department || '';
            document.getElementById('scheduleDept').value = selectedDept;
            
            if (schedulePartNoSelect) {
                schedulePartNoSelect.clearOptions();
                schedulePartNoSelect.addOption({value: "", text: "Type or select a Part No"});
                const selectedLower = selectedDept.trim().toLowerCase();
                const filteredParts = (allPartMasters || []).filter(p => (p.department || '').trim().toLowerCase() === selectedLower);
                filteredParts.forEach(p => {
                    schedulePartNoSelect.addOption({value: p.partno, text: p.partno});
                });
                if (s.partno && !filteredParts.some(p => p.partno === s.partno)) {
                    schedulePartNoSelect.addOption({value: s.partno, text: s.partno});
                }
                schedulePartNoSelect.refreshOptions(false);
                schedulePartNoSelect.setValue(s.partno || '');
            } else {
                document.getElementById('schedulePartNo').value = s.partno || '';
            }
            
            document.getElementById('scheduleTargetDate').value = s.target_date || '';
            document.getElementById('scheduleQty').value = s.qty || 0;
            
            const submitBtn = document.querySelector('#scheduleCreateForm button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Schedule';
        } catch (e) {
            console.error(e);
        }
    };

    window.deleteSchedule = async function(id) {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        try {
            const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSchedulesForList();
            } else {
                alert('Failed to delete schedule.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const clearScheduleBtn = document.getElementById('clearScheduleBtn');
    if (clearScheduleBtn) {
        clearScheduleBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to completely clear the entire schedule? This action cannot be undone.")) {
                try {
                    const response = await fetch('/api/schedule', { method: 'DELETE' });
                    if (response.ok) {
                        fetchSchedulesForList();
                    } else {
                        alert('Error clearing schedules.');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error clearing schedules.');
                }
            }
        });
    }

    // Call fetchSchedulesForList when opening the create tab
    sidebarScheduleCreate.addEventListener('click', (e) => {
        loadSchedulePartNos();
        fetchSchedulesForList();
    });

    document.getElementById('exportRunBtn').addEventListener('click', () => {
        const table = document.getElementById('scheduleRunTable');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, {sheet: "Schedule Run"});
        XLSX.writeFile(wb, `Schedule_Run_${new Date().toISOString().slice(0,10)}.xlsx`);
    });

    async function fetchRunSchedule() {
        try {
            const res = await fetch('/api/schedule/run');
            const data = await res.json();
            const tbody = document.getElementById('scheduleRunBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No pending schedules found to run.</td></tr>';
                return;
            }
            
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.partno}</td>
                    <td>${item.opn_no}</td>
                    <td>${item.description}</td>
                    <td>${item.machine}</td>
                    <td>${item.qty}</td>
                    <td>${item.cycle_time}</td>
                    <td>${item.runtime}</td>
                    <td><span style="font-weight: 500;">${item.start_date}</span></td>
                    <td><span style="font-weight: 500;">${item.end_date}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('Error fetching run schedule:', e);
        }
    }

    // --- SCHEDULE STATUS LOGIC ---
    let statusAllParts = [];
    let spiderStatusDataMap = {};
    let wipPartBalancesCache = {};

    function openEditWipModal(dept, partno) {
        if (!userObj || (userObj.role !== 'admin' && (userObj.username || '').toLowerCase() !== 'admin')) {
            alert('Access Denied: Only Admin users are authorized to adjust WIP balances.');
            return;
        }
        const modal = document.getElementById('editWipModal');
        const title = document.getElementById('editWipModalTitle');
        const list = document.getElementById('editWipOperationsList');
        const inputPart = document.getElementById('editWipPartNo');
        const inputDept = document.getElementById('editWipDept');

        if (!modal || !list) return;

        inputPart.value = partno;
        inputDept.value = dept;
        title.textContent = `Adjust WIP Balances - Part: ${partno} (${dept})`;

        const cacheKey = `${dept.trim().toUpperCase()}_${partno.trim().toUpperCase()}`;
        const cached = wipPartBalancesCache[cacheKey] || { operations: [], rfdBal: 0 };

        let html = '';

        cached.operations.forEach(op => {
            const currentBal = op.current_balance;
            const defaultTarget = currentBal < 0 ? 0 : currentBal;
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg);">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">OPN ${op.opn_no} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(${op.description})</span></div>
                        <div style="font-size: 0.78rem; color: var(--text-muted);">Current System Balance: <strong style="${currentBal < 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${currentBal}</strong></div>
                    </div>
                    <div style="width: 130px;">
                        <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Target Actual</label>
                        <input type="number" class="wip-target-input" data-opn="${op.opn_no}" value="${defaultTarget}" style="width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-main); font-weight: 600;">
                    </div>
                </div>
            `;
        });

        const deburBal = cached.deburBal || 0;
        const deburDefault = deburBal;
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(2, 132, 199, 0.05);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: #0284c7;">DEBUR (Deburring)</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">Current System Balance: <strong style="${deburBal < 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${deburBal}</strong></div>
                </div>
                <div style="width: 130px;">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Target Actual</label>
                    <input type="number" class="wip-target-input" data-opn="debur" value="${deburDefault}" style="width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-main); font-weight: 600;">
                </div>
            </div>
        `;

        const forInsBal = cached.forInsBal || 0;
        const forInsDefault = forInsBal;
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(245, 158, 11, 0.05);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: #d97706;">FOR INS (For Inspection)</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">Current System Balance: <strong style="${forInsBal < 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${forInsBal}</strong></div>
                </div>
                <div style="width: 130px;">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Target Actual</label>
                    <input type="number" class="wip-target-input" data-opn="for ins" value="${forInsDefault}" style="width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-main); font-weight: 600;">
                </div>
            </div>
        `;

        const rfdBal = cached.rfdBal || 0;
        const rfdDefault = rfdBal;
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(16, 185, 129, 0.05);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: #10b981;">RFD (Ready For Despatch)</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">Current System Balance: <strong style="${rfdBal < 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${rfdBal}</strong></div>
                </div>
                <div style="width: 130px;">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Target Actual</label>
                    <input type="number" class="wip-target-input" data-opn="rfd" value="${rfdDefault}" style="width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-main); font-weight: 600;">
                </div>
            </div>
        `;

        list.innerHTML = html;
        modal.style.display = 'flex';
        modal.classList.add('show');
    }

    function closeEditWipModal() {
        const modal = document.getElementById('editWipModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }

    document.getElementById('statusTable')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-wip-btn');
        if (btn) {
            const partno = btn.getAttribute('data-partno');
            const dept = btn.getAttribute('data-dept');
            if (partno && dept) {
                openEditWipModal(dept, partno);
            }
        }
    });

    document.getElementById('closeEditWipModalBtn')?.addEventListener('click', closeEditWipModal);
    document.getElementById('cancelEditWipBtn')?.addEventListener('click', closeEditWipModal);

    document.getElementById('editWipForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const partno = document.getElementById('editWipPartNo').value;
        const dept = document.getElementById('editWipDept').value;
        const inputs = document.querySelectorAll('#editWipOperationsList .wip-target-input');

        const adjustments = [];
        inputs.forEach(inp => {
            const opn = inp.getAttribute('data-opn');
            const val = parseFloat(inp.value);
            if (opn && !isNaN(val)) {
                adjustments.push({ opn_no: opn, target_balance: val });
            }
        });

        if (adjustments.length === 0) {
            closeEditWipModal();
            return;
        }

        try {
            const res = await fetch('/api/schedule_status/adjust_part_wip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: dept, partno: partno, adjustments: adjustments })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'WIP Balances saved successfully!');
                closeEditWipModal();
                fetchScheduleStatus();
            } else {
                alert('Error updating WIP Balances: ' + (data.detail || data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error saving WIP Balances:', err);
            alert('Failed to save WIP Balances: ' + err.message);
        }
    });
    
    document.getElementById('statusDeptSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) localStorage.setItem('saved_status_dept', val);
        else localStorage.removeItem('saved_status_dept');
        fetchScheduleStatus();
    });

    const statusCustSelect = document.getElementById('statusCustomerSelect');
    if (statusCustSelect) {
        statusCustSelect.addEventListener('change', () => {
            fetchScheduleStatus();
        });
    }

    const statusFromDate = document.getElementById('statusFromDate');
    if (statusFromDate) {
        statusFromDate.addEventListener('change', () => {
            fetchScheduleStatus();
        });
    }

    const statusPartSearch = document.getElementById('statusPartSearch');
    if (statusPartSearch) {
        statusPartSearch.addEventListener('input', () => {
            if (statusPartSearchDebounceTimer) clearTimeout(statusPartSearchDebounceTimer);
            statusPartSearchDebounceTimer = setTimeout(() => {
                fetchScheduleStatus();
            }, 200);
        });
    }

    const generateStatusReportBtn = document.getElementById('generateStatusReportBtn');
    if (generateStatusReportBtn) {
        generateStatusReportBtn.addEventListener('click', () => {
            fetchScheduleStatus();
        });
    }

    document.getElementById('exportStatusBtn').addEventListener('click', () => {
        const table = document.getElementById('statusTable');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, {sheet: "Status"});
        XLSX.writeFile(wb, `Schedule_Status_${new Date().toISOString().slice(0,10)}.xlsx`);
    });

    document.getElementById('clearBacklogBtn')?.addEventListener('click', async () => {
        if (!userObj || (userObj.role !== 'admin' && (userObj.username || '').toLowerCase() !== 'admin')) {
            alert('Access Denied: Only Admin users are authorized to clear backlog corrections.');
            return;
        }
        if (!confirm('Are you sure you want to remove ALL backlog correction entries? This will delete all automated WIP correction logs so you can update actual WIP part by part using Edit WIP.')) {
            return;
        }

        const btn = document.getElementById('clearBacklogBtn');
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '🗑️ Clearing...';

        try {
            const res = await fetch('/api/schedule_status/clear_backlog_corrections', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Backlog correction entries removed successfully!');
                fetchScheduleStatus();
            } else {
                alert('Error clearing backlog corrections: ' + (data.detail || data.message || 'Unknown server error'));
            }
        } catch (err) {
            console.error('Error in clearing backlog corrections:', err);
            alert('Failed to clear backlog corrections: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    });

    function updateToggleExtraOpnsBtnLabel() {
        const btn = document.getElementById('toggleExtraOpnsBtn');
        if (!btn) return;
        const isHidden = document.body.classList.contains('hide-opn-extra');
        btn.innerHTML = isHidden ? '👁️ Show OPN 8-10' : '👁️ Hide OPN 8-10';
        btn.title = isHidden ? 'Show OPN 8, OPN 9, and OPN 10 columns' : 'Hide OPN 8, OPN 9, and OPN 10 columns';
    }

    document.getElementById('toggleExtraOpnsBtn')?.addEventListener('click', () => {
        const isHidden = document.body.classList.toggle('hide-opn-extra');
        localStorage.setItem('hide_opn_extra', isHidden ? 'true' : 'false');
        updateToggleExtraOpnsBtnLabel();
    });

    if (localStorage.getItem('hide_opn_extra') === 'true') {
        document.body.classList.add('hide-opn-extra');
    }
    updateToggleExtraOpnsBtnLabel();

    document.getElementById('autofixWipBtn')?.addEventListener('click', async () => {
        if (!userObj || (userObj.role !== 'admin' && (userObj.username || '').toLowerCase() !== 'admin')) {
            alert('Access Denied: Only Admin users are authorized to run backlog correction.');
            return;
        }
        const dept = document.getElementById('statusDeptSelect').value;
        const msg = dept 
            ? `Are you sure you want to run Backlog Correction for ALL parts in Department "${dept}"?\n\nThis will backfill missing upstream production logs across all parts using the same cumulative concept as Edit WIP.`
            : `Are you sure you want to run Backlog Correction for ALL parts across ALL Departments?\n\nThis will backfill missing upstream production logs across all parts using the same cumulative concept as Edit WIP.`;

        if (!confirm(msg)) return;

        const btn = document.getElementById('autofixWipBtn');
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⚡ Correcting Backlog...';

        try {
            const res = await fetch('/api/schedule_status/autofix_wip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: dept })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Backlog correction complete for all parts!');
                fetchScheduleStatus();
            } else {
                alert('Error performing Backlog Correction: ' + (data.detail || data.message || 'Unknown server error'));
            }
        } catch (err) {
            console.error('Error in Backlog Correction:', err);
            alert('Failed to execute Backlog Correction: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    });
    
    function populateStatusCustomerDropdown() {
        const custSelect = document.getElementById('statusCustomerSelect');
        if (!custSelect) return;
        const currentVal = custSelect.value;
        const custSet = new Set();
        (statusAllParts || []).forEach(p => {
            if (p.customer && p.customer.trim()) {
                custSet.add(p.customer.trim());
            }
        });
        const sortedCusts = Array.from(custSet).sort((a, b) => a.localeCompare(b));
        let html = '<option value="">-- All Customers --</option>';
        sortedCusts.forEach(c => {
            html += `<option value="${c}">${c}</option>`;
        });
        custSelect.innerHTML = html;
        if (currentVal && sortedCusts.includes(currentVal)) {
            custSelect.value = currentVal;
        }
    }

    async function initScheduleStatus() {
        try {
            const fromDateInput = document.getElementById('statusFromDate');
            if (fromDateInput && !fromDateInput.value) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                fromDateInput.value = `${year}-${month}-01`;
            }

            if (statusAllParts.length === 0) {
                const partsRes = await fetch('/api/partmaster');
                statusAllParts = await partsRes.json();
            }
            populateStatusCustomerDropdown();
            
            const deptSelect = document.getElementById('statusDeptSelect');
            const savedDept = localStorage.getItem('saved_status_dept');
            if (deptSelect && deptSelect.value) {
                fetchScheduleStatus();
            }
        } catch (e) {
            console.error('Error init schedule status', e);
        }
    }

    let currentScheduleStatusRequestId = 0;
    let statusPartSearchDebounceTimer = null;

    async function fetchScheduleStatus() {
        const requestId = ++currentScheduleStatusRequestId;

        const isAdmin = userObj && (userObj.role === 'admin' || (userObj.username || '').toLowerCase() === 'admin');

        const autofixBtn = document.getElementById('autofixWipBtn');
        if (autofixBtn) autofixBtn.style.display = isAdmin ? 'flex' : 'none';

        const clearBtn = document.getElementById('clearBacklogBtn');
        if (clearBtn) clearBtn.style.display = isAdmin ? 'flex' : 'none';

        const actionsTh = document.getElementById('statusActionsTh');
        if (actionsTh) actionsTh.style.display = isAdmin ? '' : 'none';

        const genBtn = document.getElementById('generateStatusReportBtn');
        if (genBtn) {
            genBtn.disabled = true;
            genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        const dept = document.getElementById('statusDeptSelect').value;
        const custFilter = (document.getElementById('statusCustomerSelect')?.value || '').trim().toUpperCase();
        const statusFromDateVal = (document.getElementById('statusFromDate')?.value || '').trim();
        const partSearchFilter = (document.getElementById('statusPartSearch')?.value || '').trim().toUpperCase();
        const tbody = document.getElementById('statusBody');

        if (!dept) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="25" style="text-align: center; padding: 2rem; color: #64748b; font-weight: 500;">⚠️ Please select a Department to generate the Schedule Status report.</td></tr>';
            }
            if (genBtn) {
                genBtn.disabled = false;
                genBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Generate Report';
            }
            return;
        }

        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="25" style="text-align: center; padding: 2rem; color: #0284c7; font-weight: 600;"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Generating Schedule Status Report... Please wait.</td></tr>';
        }

        try {
            if (!statusAllParts || statusAllParts.length === 0) {
                try {
                    const partsRes = await fetch('/api/partmaster');
                    statusAllParts = await partsRes.json();
                } catch(e) { statusAllParts = []; }
            }
            populateStatusCustomerDropdown();

            const [allSchedules, allLogs, allRmLogs, allHtLogs, allHtReceiptLogs, allPcLogs, allPcReceiptLogs, allRawMaterials] = await Promise.all([
                fetch('/api/schedule').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/prodlog').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/rawmateriallogs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/ht_logs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/ht_receipt_logs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/pc_logs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/pc_receipt_logs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/rawmaterials').then(r => r.ok ? r.json() : []).catch(() => [])
            ]);
            
            if (requestId !== currentScheduleStatusRequestId) {
                return;
            }

            tbody.innerHTML = '';

            const masterDeptParts = (statusAllParts || [])
                .filter(p => (p.department || '').trim().toUpperCase() === dept.trim().toUpperCase() || (p.dept || '').trim().toUpperCase() === dept.trim().toUpperCase())
                .map(p => (p.partno || '').trim());

            const schedDeptParts = allSchedules
                .filter(s => (s.department || '').trim().toUpperCase() === dept.trim().toUpperCase())
                .map(s => (s.partno || '').trim());

            const uniqueParts = [...new Set([...masterDeptParts, ...schedDeptParts])].filter(Boolean);
            uniqueParts.sort((a, b) => a.localeCompare(b));
            
            const filteredParts = uniqueParts.filter(partno => {
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase());
                const cust = (partObj && partObj.customer) ? partObj.customer.trim() : '';
                if (custFilter && cust.toUpperCase() !== custFilter) return false;
                if (partSearchFilter && !(partno || '').toUpperCase().includes(partSearchFilter)) return false;
                return true;
            });

            if (filteredParts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="25" style="text-align: center; padding: 2rem; color: #64748b; font-weight: 500;">No matching records found.</td></tr>';
            }

            // Fetch operations for all filtered parts in parallel
            const operationsMap = {};
            await Promise.all(filteredParts.map(async (partno) => {
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase());
                if (partObj && partObj.id) {
                    try {
                        const opsRes = await fetch(`/api/partmaster/${partObj.id}/operations`);
                        operationsMap[partno] = await opsRes.json();
                    } catch(e) { operationsMap[partno] = []; }
                } else {
                    operationsMap[partno] = [];
                }
            }));

            for (const partno of filteredParts) {
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase());
                const cust = (partObj && partObj.customer) ? partObj.customer.trim() : '';
                let operations = operationsMap[partno] || [];
                
                // Sort operations numerically if possible
                operations.sort((a, b) => {
                    let numA = parseInt(a.opn_no) || 0;
                    let numB = parseInt(b.opn_no) || 0;
                    return numA - numB;
                });
                
                const allPartSchedules = allSchedules.filter(s => 
                    (s.department || '').trim().toUpperCase() === dept.trim().toUpperCase() && 
                    (s.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()
                );
                const pendingSchedules = allPartSchedules.filter(s => s.status === 'Pending' || !s.status);
                const schedQty = pendingSchedules.reduce((sum, s) => sum + (s.qty || 0), 0);
                const isCompleted = allPartSchedules.length > 0 && (pendingSchedules.length === 0 || allPartSchedules.every(s => (s.status || '').trim().toLowerCase() === 'completed'));
                
                let rowHtml = `<td>${cust || '-'}</td><td>${partno}</td><td>${schedQty}</td>`;
                
                let opnBalances = [];
                const group1Parts = ["C100", "RS120", "RVI", "Q109", "R149", "RS160"];
                const isGroup1HT = group1Parts.includes((partno || '').trim().toUpperCase());

                // Opn 1 to 10
                for (let i = 0; i < 10; i++) {
                    if (i < operations.length) {
                        const currentOp = operations[i];
                        const nextOp = operations[i + 1];
                        
                        const opnClean = (currentOp.opn_no || '').trim().toLowerCase();
                        const descClean = (currentOp.description || '').trim().toLowerCase();
                        const machClean = (currentOp.machine || '').trim().toLowerCase();
                        const isPcOpn = opnClean === 'pc' || descClean === 'pc' || descClean.includes('powder coat') || machClean === 'pc';
                        
                        // Total produced for current op from logs
                        let currentProd = allLogs.filter(l => l.partno === partno && (l.opn_no || '').trim().toLowerCase() === opnClean).reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                        
                        // If opn is PC, set currentProd to PC Received total
                        if (isPcOpn) {
                            const pcRec = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                            currentProd = Math.max(currentProd, pcRec);
                        }

                        // Deduct HT sent for Turning (Opn 40 / OPN 3) for Group 1 HT parts
                        if (isGroup1HT && (opnClean === '40' || opnClean === 'opn 40' || opnClean === 'opn40')) {
                            const htSent = allHtLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                            currentProd -= htSent;
                        }

                        // Set Opn 50 (HT Received / OPN 4 / For Grind) to HT Received total for Group 1 HT parts
                        if (isGroup1HT && (opnClean === '50' || opnClean === 'opn 50' || opnClean === 'opn50')) {
                            const htRec = allHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                            currentProd = htRec;
                        }

                        // Check if nextOp is PC operation; if so, deduct PC sent from current operation
                        if (nextOp) {
                            const nextOpnClean = (nextOp.opn_no || '').trim().toLowerCase();
                            const nextDescClean = (nextOp.description || '').trim().toLowerCase();
                            const nextMachClean = (nextOp.machine || '').trim().toLowerCase();
                            const isNextPcOpn = nextOpnClean === 'pc' || nextDescClean === 'pc' || nextDescClean.includes('powder coat') || nextMachClean === 'pc';
                            
                            if (isNextPcOpn) {
                                const pcSent = allPcLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                                currentProd = Math.max(0, currentProd - pcSent);
                            }
                        }
                        
                        // Total produced for next op
                        let nextProd = 0;
                        if (nextOp) {
                            const nextOpClean = (nextOp.opn_no || '').trim().toLowerCase();
                            const nextDescClean = (nextOp.description || '').trim().toLowerCase();
                            const nextMachClean = (nextOp.machine || '').trim().toLowerCase();
                            const isNextPc = nextOpClean === 'pc' || nextDescClean === 'pc' || nextDescClean.includes('powder coat') || nextDescClean.includes('pc') || nextMachClean === 'pc';
                            const isNextHt = nextOpClean === 'ht' || nextOpClean === '50' || nextDescClean === 'ht' || nextDescClean.includes('heat treat') || nextMachClean === 'ht';

                            if (isGroup1HT && (nextOpClean === '50' || nextOpClean === 'opn 50' || nextOpClean === 'opn50')) {
                                nextProd = 0; // Opn 50 is HT Received, do not deduct from Opn 40 for Group 1
                            } else {
                                nextProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').trim().toLowerCase() === nextOpClean).reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                                if (isNextPc || nextOpClean.includes('pc')) {
                                    const pcRec = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                                    nextProd = Math.max(nextProd, pcRec);
                                } else if (isNextHt) {
                                    const htRec = allHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                                    nextProd = Math.max(nextProd, htRec);
                                }
                            }
                        } else {
                            const deburredTotal = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'debur').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                            const forInsLogTotal = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'for ins').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                            const lastOpProdVal = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').trim().toLowerCase() === opnClean).reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                            
                            nextProd = Math.max(deburredTotal, forInsLogTotal, lastOpProdVal);
                        }
                        
                        let balance = currentProd - nextProd;
                        opnBalances.push(balance);
                        const extraClass = i >= 7 ? ' class="col-opn-extra"' : '';
                        rowHtml += `<td${extraClass}>${balance}</td>`;
                    } else {
                        opnBalances.push(0);
                        const extraClass = i >= 7 ? ' class="col-opn-extra"' : '';
                        rowHtml += `<td${extraClass}></td>`;
                    }
                }
                
                // fixed columns: debur, for ins, rework, nc, rfd, desp
                const deburredTotal = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'debur').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const forInsLogTotal = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'for ins').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const reworkProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'rework').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const ncProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'nc').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const rejectionProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'rejection').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const rfdProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'rfd').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const totalDespAllTime = allRmLogs.filter(l => {
                    const isMatchPart = (l.finish_part_no || '').trim().toUpperCase() === (partno || '').trim().toUpperCase();
                    return isMatchPart && l.type === 'despatch';
                }).reduce((sum, l) => sum + (l.qty || 0), 0);
                const despProd = allRmLogs.filter(l => {
                    const isMatchPart = (l.finish_part_no || '').trim().toUpperCase() === (partno || '').trim().toUpperCase();
                    const isDespatch = l.type === 'despatch';
                    if (!isMatchPart || !isDespatch) return false;

                    if (statusFromDateVal) {
                        const logDateRaw = l.date || l.log_date || l.created_at || '';
                        const isoDate = parseLocalDateStr(logDateRaw);
                        if (isoDate) return isoDate >= statusFromDateVal;
                    }
                    return true;
                }).reduce((sum, l) => sum + (l.qty || 0), 0);

                let lastOpProd = 0;
                if (operations.length > 0) {
                    const lastOp = operations[operations.length - 1];
                    const lastOpnClean = (lastOp.opn_no || '').trim().toLowerCase();
                    const lastDescClean = (lastOp.description || '').trim().toLowerCase();
                    const lastMachClean = (lastOp.machine || '').trim().toLowerCase();
                    const isLastPc = lastOpnClean === 'pc' || lastDescClean === 'pc' || lastDescClean.includes('powder coat') || lastDescClean.includes('pc') || lastMachClean === 'pc';
                    const isLastHt = lastOpnClean === 'ht' || lastOpnClean === '50' || lastDescClean === 'ht' || lastDescClean.includes('heat treat') || lastMachClean === 'ht';

                    lastOpProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').trim().toLowerCase() === lastOpnClean).reduce((sum, l) => sum + (l.prod_qty || 0), 0);

                    if (isLastPc || lastOpnClean.includes('pc')) {
                        const pcRec = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                        lastOpProd = Math.max(lastOpProd, pcRec);
                    } else if (isLastHt) {
                        const htRec = allHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                        lastOpProd = Math.max(lastOpProd, htRec);
                    }
                }
                const pcRecTotal = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                if (pcRecTotal > lastOpProd) {
                    lastOpProd = pcRecTotal;
                }

                const deburBal = Math.max(0, lastOpProd - deburredTotal);
                const effectiveForIns = deburredTotal > 0 ? deburredTotal : forInsLogTotal;
                const totalInspected = Math.max(forInsLogTotal, rfdProd + reworkProd + ncProd + rejectionProd);
                const forInsBal = Math.max(0, effectiveForIns - totalInspected);
                const rfdBal = rfdProd - totalDespAllTime;
                const rfdPhyVal = (partObj && partObj.rfd_phy !== undefined && partObj.rfd_phy !== null) ? partObj.rfd_phy : 0;

                rowHtml += `<td>${deburBal}</td>`;
                rowHtml += `<td>${forInsBal}</td>`;
                rowHtml += `<td>${reworkProd}</td>`;
                rowHtml += `<td>${ncProd}</td>`;
                rowHtml += `<td>${rfdBal}</td>`;
                rowHtml += `<td><input type="number" class="rfd-phy-input" data-partno="${escapeHtml(partno)}" value="${rfdPhyVal}" style="width: 75px; padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 4px; text-align: right; background: var(--card-bg); color: var(--text-main); font-weight: 600;" title="Physical RFD quantity available" /></td>`;
                rowHtml += `<td>${despProd}</td>`;
                if (isAdmin) {
                    rowHtml += `<td><button class="btn btn-outline edit-wip-btn" data-partno="${partno}" data-dept="${dept}" style="padding: 2px 8px; font-size: 0.75rem; border-color: #0284c7; color: #0284c7;" title="Adjust WIP / Actual balances for this part">✏️ Edit WIP</button></td>`;
                }
                
                spiderStatusDataMap[(partno || '').trim().toUpperCase()] = {
                    schedQty,
                    opnBalances,
                    forInsBal,
                    rfdBal,
                    rfdPhyVal,
                    despProd
                };

                wipPartBalancesCache[`${dept.trim().toUpperCase()}_${partno.trim().toUpperCase()}`] = {
                    partno: partno,
                    dept: dept,
                    operations: operations.map((op, idx) => ({
                        opn_no: op.opn_no,
                        description: op.description || `OPN ${op.opn_no}`,
                        current_balance: opnBalances[idx] !== undefined ? opnBalances[idx] : 0
                    })),
                    deburBal: deburBal,
                    forInsBal: forInsBal,
                    rfdBal: rfdBal,
                    rfdPhyVal: rfdPhyVal
                };
                
                const tr = document.createElement('tr');
                if (isCompleted) {
                    tr.style.backgroundColor = 'rgba(34, 197, 94, 0.18)';
                    tr.title = 'Schedule Completed';
                }
                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);

                tr.querySelector('.edit-wip-btn')?.addEventListener('click', () => {
                    openEditWipModal(dept, partno);
                });

                tr.querySelector('.rfd-phy-input')?.addEventListener('change', async (e) => {
                    const inputEl = e.target;
                    const pNo = inputEl.dataset.partno;
                    const newVal = parseInt(inputEl.value, 10) || 0;
                    try {
                        const res = await fetch('/api/partmaster/update_rfd_phy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ partno: pNo, rfd_phy: newVal })
                        });
                        if (res.ok) {
                            if (statusAllParts) {
                                statusAllParts.filter(p => (p.partno || '').trim().toUpperCase() === (pNo || '').trim().toUpperCase()).forEach(p => p.rfd_phy = newVal);
                            }
                            inputEl.style.borderColor = '#22c55e';
                            setTimeout(() => { inputEl.style.borderColor = 'var(--border-color)'; }, 1500);
                        } else {
                            alert('Error saving physical RFD quantity');
                        }
                    } catch(err) {
                        console.error('Failed to update RFD Phy:', err);
                        alert('Failed to update RFD Phy quantity: ' + err.message);
                    }
                });
            }

            if (dept.trim().toUpperCase() === 'SPIDER') {
                await renderSpiderReport(allSchedules, allLogs, allRmLogs, allHtLogs, allHtReceiptLogs, allRawMaterials);
            } else {
                const spiderContainer = document.getElementById('spiderReportContainer');
                if (spiderContainer) spiderContainer.style.display = 'none';
            }
        } catch (e) {
            console.error('Error fetching schedule status:', e);
        } finally {
            if (requestId === currentScheduleStatusRequestId && genBtn) {
                genBtn.disabled = false;
                genBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Generate Report';
            }
        }
    }

    let resourceReqdCacheData = null;

    async function populateResourceDeptDropdown() {
        const deptSelect = document.getElementById('resourceDeptSelect');
        if (!deptSelect) return;
        const currentVal = deptSelect.value;
        try {
            const res = await fetch('/api/dept');
            const depts = await res.json();
            let deptNames = (depts || []).map(d => (d.name || d.department || '').trim().toUpperCase()).filter(Boolean);
            ['WIPRO', 'BC', 'GEAR', 'SPIDER'].forEach(d => {
                if (!deptNames.includes(d)) deptNames.push(d);
            });
            deptNames.sort();
            
            let html = '';
            deptNames.forEach(d => {
                html += `<option value="${d}">${d}</option>`;
            });
            deptSelect.innerHTML = html;
            if (currentVal && deptNames.includes(currentVal.toUpperCase())) {
                deptSelect.value = currentVal.toUpperCase();
            }
        } catch(e) {
            console.error('Error populating resource dept dropdown:', e);
        }
    }

    async function initResourceReqd() {
        await populateResourceDeptDropdown();

        const fromDateInput = document.getElementById('resourceFromDate');
        if (fromDateInput) {
            if (!fromDateInput.value) {
                const now = new Date();
                const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                fromDateInput.value = firstDayOfMonth;
            }
            if (!fromDateInput.dataset.hasListener) {
                fromDateInput.dataset.hasListener = 'true';
                fromDateInput.addEventListener('change', () => {
                    fetchResourceReqd();
                });
            }
        }

        const deptSelect = document.getElementById('resourceDeptSelect');
        if (deptSelect && !deptSelect.dataset.hasListener) {
            deptSelect.dataset.hasListener = 'true';
            deptSelect.addEventListener('change', () => {
                fetchResourceReqd();
            });
        }

        const exportBtn = document.getElementById('exportResourceReqdBtn');
        if (exportBtn && !exportBtn.dataset.hasListener) {
            exportBtn.dataset.hasListener = 'true';
            exportBtn.addEventListener('click', () => {
                exportResourceReqdExcel();
            });
        }

        fetchResourceReqd();
    }

    async function fetchResourceReqd() {
        const deptSelect = document.getElementById('resourceDeptSelect');
        const dept = (deptSelect?.value || 'WIPRO').trim().toUpperCase();
        
        const headEl = document.getElementById('resourceReqdHead');
        const bodyEl = document.getElementById('resourceReqdBody');
        const footEl = document.getElementById('resourceReqdFoot');

        if (!bodyEl) return;
        bodyEl.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: var(--text-muted);">⏳ Calculating Resource Requirements for department <strong>${dept}</strong>...</td></tr>`;
        if (headEl) headEl.innerHTML = '';
        if (footEl) footEl.innerHTML = '';

        try {
            const [schedRes, partsRes, logsRes] = await Promise.all([
                fetch('/api/schedule'),
                fetch('/api/partmaster'),
                fetch('/api/prodlog')
            ]);
            
            const schedules = await schedRes.json();
            const allParts = await partsRes.json();
            const allLogs = await logsRes.json();

            const now = new Date();
            const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Helper to match logs for current month
            const isLogCurrentMonth = (logDateStr) => {
                if (!logDateStr) return true;
                const s = String(logDateStr).trim();
                if (s.length >= 7 && s.charAt(4) === '-') {
                    return s.slice(0, 7) === currentYearMonth;
                }
                if (s.includes('/') || s.includes('-')) {
                    const parts = s.split(/[\/\-]/);
                    if (parts.length === 3) {
                        let y, m;
                        if (parts[0].length === 4) { y = parts[0]; m = parts[1].padStart(2, '0'); }
                        else if (parts[2].length === 4) { y = parts[2]; m = parts[1].padStart(2, '0'); }
                        if (y && m) return `${y}-${m}` === currentYearMonth;
                    }
                }
                return s.includes(currentYearMonth);
            };

            const fromDateInput = document.getElementById('resourceFromDate');
            const fromDateVal = fromDateInput ? (fromDateInput.value || '').trim() : '';

            const parseDateToIso = (dStr) => {
                if (!dStr) return null;
                let s = dStr.toString().split('T')[0].split(' ')[0].trim();
                if (!s) return null;
                let parts = s.split(/[\/\-]/);
                if (parts.length === 3) {
                    let y, m, d;
                    if (parts[0].length === 4) {
                        y = parseInt(parts[0], 10);
                        m = parseInt(parts[1], 10) - 1;
                        d = parseInt(parts[2], 10);
                    } else if (parts[2].length === 4) {
                        d = parseInt(parts[0], 10);
                        m = parseInt(parts[1], 10) - 1;
                        y = parseInt(parts[2], 10);
                    } else {
                        return null;
                    }
                    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
                return s;
            };

            const currentMonthLogs = (allLogs || []).filter(l => {
                if (!l.date) return false;
                if (fromDateVal) {
                    const isoDate = parseDateToIso(l.date);
                    if (isoDate) return isoDate >= fromDateVal;
                }
                return isLogCurrentMonth(l.date);
            });

            // Filter active schedules for chosen department
            const deptSchedules = (schedules || []).filter(s => 
                (s.department || '').trim().toUpperCase() === dept &&
                ((s.status || '').trim().toLowerCase() === 'pending' || !s.status)
            );

            // Group schedule qty by partno
            const partSchedMap = {};
            deptSchedules.forEach(s => {
                const partno = (s.partno || '').trim();
                if (!partno) return;
                const upperNo = partno.toUpperCase();
                partSchedMap[upperNo] = (partSchedMap[upperNo] || 0) + (parseFloat(s.qty) || 0);
            });

            const uniquePartNos = Object.keys(partSchedMap).sort();

            if (uniquePartNos.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: var(--text-muted);">No active pending schedules found for department <strong>${dept}</strong>.</td></tr>`;
                resourceReqdCacheData = null;
                return;
            }

            // Fetch operations for each part
            const partDetailsList = [];
            const machineSet = new Set();

            for (const upperNo of uniquePartNos) {
                const partObj = allParts.find(p => (p.partno || '').trim().toUpperCase() === upperNo);
                const cust = partObj?.customer || '-';
                const schedQty = partSchedMap[upperNo] || 0;
                let operations = [];

                if (partObj && partObj.id) {
                    try {
                        const opsRes = await fetch(`/api/partmaster/${partObj.id}/operations`);
                        operations = await opsRes.json();
                    } catch(e) { operations = []; }
                }

                // Map machine hours for this part based on Balance Qty
                const machineHoursMap = {};
                let partTotalHours = 0;
                let maxOpProdQty = 0;

                (operations || []).forEach(op => {
                    const mName = (op.machine || 'Unassigned').trim();
                    const opClean = (op.opn_no || '').trim().toLowerCase();
                    const cycTime = parseFloat(op.cycle_time) || 0;
                    
                    // Quantity produced in current month for this operation
                    const opLogs = currentMonthLogs.filter(l => 
                        (l.partno || '').trim().toUpperCase() === upperNo &&
                        (l.opn_no || '').trim().toLowerCase() === opClean
                    );
                    const opProdQty = opLogs.reduce((sum, l) => sum + (parseFloat(l.prod_qty) || 0), 0);
                    if (opProdQty > maxOpProdQty) maxOpProdQty = opProdQty;

                    // Balance quantity to be produced during the month for this operation
                    const opBalQty = Math.max(0, schedQty - opProdQty);

                    if (cycTime > 0) {
                        const hrs = (opBalQty * cycTime) / 60.0;
                        machineHoursMap[mName] = (machineHoursMap[mName] || 0) + hrs;
                        partTotalHours += hrs;
                        machineSet.add(mName);
                    }
                });

                const producedQty = maxOpProdQty;
                const balanceQty = Math.max(0, schedQty - producedQty);

                partDetailsList.push({
                    customer: cust,
                    partno: upperNo,
                    schedQty,
                    producedQty,
                    balanceQty,
                    machineHoursMap,
                    totalHours: partTotalHours
                });
            }

            // Sorted list of machines
            const machineList = Array.from(machineSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            resourceReqdCacheData = {
                dept,
                machineList,
                partDetailsList
            };

            renderResourceReqdTable(dept, machineList, partDetailsList);
        } catch (e) {
            console.error('Error fetching resource requirements:', e);
            bodyEl.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 2rem; color: #ef4444;">⚠️ Error loading Resource Requirements: ${e.message}</td></tr>`;
        }
    }

    function renderResourceReqdTable(dept, machineList, partDetailsList) {
        const headEl = document.getElementById('resourceReqdHead');
        const bodyEl = document.getElementById('resourceReqdBody');
        const footEl = document.getElementById('resourceReqdFoot');

        // Header
        let headHtml = `
            <tr style="background-color: var(--card-bg); border-bottom: 2px solid var(--border-color);">
                <th style="padding: 10px; text-align: left; position: sticky; top: 0; background: var(--card-bg); z-index: 2;">Customer</th>
                <th style="padding: 10px; text-align: left; position: sticky; top: 0; background: var(--card-bg); z-index: 2;">Part No</th>
                <th style="padding: 10px; text-align: right; position: sticky; top: 0; background: var(--card-bg); z-index: 2;">Schedule Qty</th>
                <th style="padding: 10px; text-align: right; position: sticky; top: 0; background: var(--card-bg); z-index: 2; color: #16a34a;">Produced Qty</th>
                <th style="padding: 10px; text-align: right; position: sticky; top: 0; background: var(--card-bg); z-index: 2; color: #d97706;">Balance Qty</th>
        `;

        machineList.forEach(m => {
            headHtml += `<th style="padding: 10px; text-align: right; position: sticky; top: 0; background: var(--card-bg); z-index: 2; min-width: 90px; color: #0284c7;">${escapeHtml(m)} (hrs)</th>`;
        });

        headHtml += `<th style="padding: 10px; text-align: right; position: sticky; top: 0; background: var(--card-bg); z-index: 2; font-weight: bold; color: var(--text-main);">Total Hours</th></tr>`;
        headEl.innerHTML = headHtml;

        // Body
        let bodyHtml = '';
        let grandSchedQty = 0;
        let grandProducedQty = 0;
        let grandBalanceQty = 0;
        let grandTotalHours = 0;
        const machineGrandTotals = {};
        machineList.forEach(m => machineGrandTotals[m] = 0);

        partDetailsList.forEach(item => {
            grandSchedQty += item.schedQty;
            grandProducedQty += item.producedQty;
            grandBalanceQty += item.balanceQty;
            grandTotalHours += item.totalHours;

            bodyHtml += `<tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 10px;">${escapeHtml(item.customer)}</td>
                <td style="padding: 8px 10px; font-weight: 600;">${escapeHtml(item.partno)}</td>
                <td style="padding: 8px 10px; text-align: right;">${item.schedQty.toLocaleString()}</td>
                <td style="padding: 8px 10px; text-align: right; color: #16a34a; font-weight: 600;">${item.producedQty.toLocaleString()}</td>
                <td style="padding: 8px 10px; text-align: right; color: #d97706; font-weight: 600;">${item.balanceQty.toLocaleString()}</td>
            `;

            machineList.forEach(m => {
                const hrs = item.machineHoursMap[m] || 0;
                machineGrandTotals[m] += hrs;
                bodyHtml += `<td style="padding: 8px 10px; text-align: right; ${hrs > 0 ? 'font-weight: 600; color: var(--text-main);' : 'color: var(--text-muted);'}">
                    ${hrs > 0 ? hrs.toFixed(2) : '-'}
                </td>`;
            });

            bodyHtml += `<td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0284c7;">${item.totalHours.toFixed(2)}</td></tr>`;
        });

        bodyEl.innerHTML = bodyHtml;

        // Footer Totals
        let footHtml = `
            <tr>
                <td style="padding: 10px;" colspan="2">TOTAL REQUIREMENT (${dept})</td>
                <td style="padding: 10px; text-align: right;">${grandSchedQty.toLocaleString()}</td>
                <td style="padding: 10px; text-align: right; color: #16a34a; font-weight: 700;">${grandProducedQty.toLocaleString()}</td>
                <td style="padding: 10px; text-align: right; color: #d97706; font-weight: 700;">${grandBalanceQty.toLocaleString()}</td>
        `;

        machineList.forEach(m => {
            const totalM = machineGrandTotals[m] || 0;
            footHtml += `<td style="padding: 10px; text-align: right; font-weight: 700; color: #0284c7;">${totalM.toFixed(2)}</td>`;
        });

        footHtml += `<td style="padding: 10px; text-align: right; font-weight: 800; font-size: 1.05rem; color: #0284c7;">${grandTotalHours.toFixed(2)}</td></tr>`;
        footEl.innerHTML = footHtml;
    }

    function exportResourceReqdExcel() {
        if (!resourceReqdCacheData || !resourceReqdCacheData.partDetailsList || resourceReqdCacheData.partDetailsList.length === 0) {
            alert('No Resource Requirement data available to export.');
            return;
        }

        const { dept, machineList, partDetailsList } = resourceReqdCacheData;
        const excelRows = [];

        partDetailsList.forEach(item => {
            const row = {
                'Customer': item.customer,
                'Part No': item.partno,
                'Schedule Qty': item.schedQty,
                'Produced Qty (Month)': item.producedQty,
                'Balance Qty': item.balanceQty
            };

            machineList.forEach(m => {
                const hrs = item.machineHoursMap[m] || 0;
                row[`${m} (hrs)`] = hrs > 0 ? parseFloat(hrs.toFixed(2)) : 0;
            });

            row['Total Hours'] = parseFloat(item.totalHours.toFixed(2));
            excelRows.push(row);
        });

        // Totals row
        const totalsRow = {
            'Customer': 'TOTAL',
            'Part No': dept,
            'Schedule Qty': partDetailsList.reduce((sum, i) => sum + i.schedQty, 0),
            'Produced Qty (Month)': partDetailsList.reduce((sum, i) => sum + i.producedQty, 0),
            'Balance Qty': partDetailsList.reduce((sum, i) => sum + i.balanceQty, 0)
        };

        let grandHours = 0;
        machineList.forEach(m => {
            const mTotal = partDetailsList.reduce((sum, i) => sum + (i.machineHoursMap[m] || 0), 0);
            totalsRow[`${m} (hrs)`] = parseFloat(mTotal.toFixed(2));
            grandHours += mTotal;
        });
        totalsRow['Total Hours'] = parseFloat(grandHours.toFixed(2));
        excelRows.push(totalsRow);

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Resource_Reqd_${dept}`);
        XLSX.writeFile(wb, `Resource_Requirement_${dept}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function findRmStock(targetFpn, targetPartno, allRms) {
        if (!allRms || allRms.length === 0) return 0;
        
        const norm = (s) => (s || '').toString().trim().toUpperCase().replace(/[\s\-_#]/g, '');
        const normTargetFpn = norm(targetFpn);
        const normTargetPartno = norm(targetPartno);

        let match = null;

        // 1. Exact match on normalized forge_pn (e.g. "A1106A" === "A1106A", "A106" === "A106")
        if (normTargetFpn) {
            match = allRms.find(r => norm(r.forge_pn) === normTargetFpn);
        }

        // 2. Exact match on normalized partno
        if (!match && normTargetPartno) {
            match = allRms.find(r => norm(r.forge_pn) === normTargetPartno);
        }

        // 3. Match where one is a variant (e.g. A1#106A vs A1#06 vs A1#106)
        if (!match && normTargetFpn) {
            const cleanTarget = normTargetFpn.replace(/^A10*/, 'A1');
            match = allRms.find(r => {
                const cleanR = norm(r.forge_pn).replace(/^A10*/, 'A1');
                return cleanR && cleanTarget && (
                    cleanR === cleanTarget || 
                    cleanR.startsWith(cleanTarget) || 
                    cleanTarget.startsWith(cleanR)
                );
            });
        }

        if (match) {
            let stk = (match.stock !== undefined && match.stock !== null && match.stock !== '') ? parseInt(match.stock) : ((parseInt(match.receipt) || 0) - (parseInt(match.despatch) || 0));
            return isNaN(stk) ? 0 : stk;
        }

        return 0;
    }

    async function renderSpiderReport(allSchedules, allLogs, allRmLogs, allHtLogs, allHtReceiptLogs, allRawMaterials = null) {
        const spiderContainer = document.getElementById('spiderReportContainer');
        const tbody = document.getElementById('spiderReportBody');
        if (!spiderContainer || !tbody) return;

        spiderContainer.style.display = 'block';
        tbody.innerHTML = '';
        const spiderForgingList = [];

        let allRms = allRawMaterials;
        if (!allRms) {
            try {
                const rRes = await fetch('/api/rawmaterials');
                allRms = await rRes.json();
            } catch(e) { allRms = []; }
        }

        const groups = [
            {
                name: "Group 1",
                parts: ["C100", "RS120", "RVI", "Q109", "R149", "RS160"],
                headers: [
                    { title: "Part No", rowspan: 2 },
                    { title: "sch qty", rowspan: 2 },
                    { title: "F Avail", rowspan: 2 },
                    { title: "WIP", rowspan: 2 },
                    { title: "RM Status", rowspan: 2 },
                    { title: "Fac & cen", rowspan: 2 },
                    { title: "HT", colspan: 3, subList: ["For HT", "Anusha", "JMS"] },
                    { title: "Grinding", colspan: 2, subList: ["For Grind", "For Ins"] },
                    { title: "RFD", rowspan: 2 },
                    { title: "Despatch", rowspan: 2 }
                ]
            },
            {
                name: "Group 2",
                parts: ["QD", "AMW", "15 I"],
                headers: [
                    { title: "Part No" },
                    { title: "sch qty" },
                    { title: "F Avail" },
                    { title: "WIP" },
                    { title: "RM Status" },
                    { title: "Boring" },
                    { title: "Fac & cen" },
                    { title: "turning" },
                    { title: "drilling" },
                    { title: "Inspec" },
                    { title: "RFD" },
                    { title: "Despatch" }
                ]
            },
            {
                name: "Group 3",
                parts: ["HR Forward"],
                headers: [
                    { title: "Part No" },
                    { title: "sch qty" },
                    { title: "F Avail" },
                    { title: "WIP" },
                    { title: "RM Status" },
                    { title: "Boring" },
                    { title: "Fac & cen" },
                    { title: "Pre Turn" },
                    { title: "Spherical" },
                    { title: "Inspec" },
                    { title: "RFD" },
                    { title: "Despatch" }
                ]
            },
            {
                name: "Group 4",
                parts: ["HR Rear"],
                headers: [
                    { title: "Part No" },
                    { title: "sch qty" },
                    { title: "F Avail" },
                    { title: "WIP" },
                    { title: "RM Status" },
                    { title: "Boring" },
                    { title: "Thickness" },
                    { title: "Fac & cen" },
                    { title: "Turning" },
                    { title: "Inspec" },
                    { title: "RFD" },
                    { title: "Despatch" }
                ]
            }
        ];

        const safeHtLogs = Array.isArray(allHtLogs) ? allHtLogs : [];
        const safeHtReceiptLogs = Array.isArray(allHtReceiptLogs) ? allHtReceiptLogs : [];

        for (const group of groups) {
            const trHeader1 = document.createElement('tr');
            trHeader1.style.backgroundColor = '#dbeafe';
            trHeader1.style.fontWeight = 'bold';
            
            const trHeader2 = document.createElement('tr');
            trHeader2.style.backgroundColor = '#eff6ff';
            trHeader2.style.fontWeight = 'bold';

            group.headers.forEach(h => {
                if (h.rowspan === 2) {
                    trHeader1.innerHTML += `<th rowspan="2" style="border:1px solid #cbd5e1; padding:6px; text-align:center; background:#dbeafe;">${h.title}</th>`;
                } else if (h.colspan) {
                    trHeader1.innerHTML += `<th colspan="${h.colspan}" style="border:1px solid #cbd5e1; padding:6px; text-align:center; background:#dbeafe;">${h.title}</th>`;
                    if (h.subList) {
                        h.subList.forEach(sub => {
                            trHeader2.innerHTML += `<th style="border:1px solid #cbd5e1; padding:6px; text-align:center; background:#eff6ff;">${sub}</th>`;
                        });
                    }
                } else {
                    trHeader1.innerHTML += `<th style="border:1px solid #cbd5e1; padding:6px; text-align:center; background:#dbeafe;">${h.title}</th>`;
                    if (h.sub) {
                        trHeader2.innerHTML += `<th style="border:1px solid #cbd5e1; padding:6px; text-align:center; background:#eff6ff;">${h.sub}</th>`;
                    }
                }
            });

            tbody.appendChild(trHeader1);
            if (trHeader2.children.length > 0) {
                tbody.appendChild(trHeader2);
            }

            // Precalculate merged Group 2 metrics for QD & AMW if present
            let group2MergedFAvail = 0;
            let group2MergedWip = 0;
            let group2MergedRmStatus = 0;
            let isGroup2Merged = false;

            if (group.name === 'Group 2' && group.parts.includes('QD') && group.parts.includes('AMW')) {
                isGroup2Merged = true;
                
                // Helper to get WIP for a part
                const getWip = (pKey) => {
                    const sData = spiderStatusDataMap[pKey] || spiderStatusDataMap[pKey.replace(/\s+/g, '')] || { opnBalances: [0,0,0,0,0,0,0,0,0,0], rfdBal: 0, forInsBal: 0 };
                    const opn = sData.opnBalances || [0,0,0,0,0,0,0,0,0,0];
                    return (opn[0]||0) + (opn[1]||0) + (opn[2]||0) + (opn[3]||0) + (sData.forInsBal||0) + (sData.rfdBal||0);
                };

                const qdWip = getWip('QD');
                const amwWip = getWip('AMW');
                group2MergedWip = qdWip + amwWip;

                // Lookup common forge_pn for QD / AMW
                const qdPartObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === 'QD');
                const amwPartObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === 'AMW');
                const qdFpn = qdPartObj ? qdPartObj.forge_pn : '';
                const amwFpn = amwPartObj ? amwPartObj.forge_pn : '';
                const sharedFpn = qdFpn || amwFpn || 'A1#06';

                group2MergedFAvail = findRmStock(sharedFpn, 'QD', allRms) || findRmStock(sharedFpn, 'AMW', allRms) || findRmStock('A1#06', 'QD', allRms) || findRmStock('A1#106A', 'QD', allRms);

                group2MergedRmStatus = group2MergedFAvail - group2MergedWip;
            }

            for (const pName of group.parts) {
                const partKey = pName.trim().toUpperCase();
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === partKey || (p.partno || '').replace(/\s+/g, '').toUpperCase() === partKey.replace(/\s+/g, ''));
                const sData = spiderStatusDataMap[partKey] || spiderStatusDataMap[partKey.replace(/\s+/g, '')] || { schedQty: 0, opnBalances: [0,0,0,0,0,0,0,0,0,0], rfdBal: 0, despProd: 0 };
                const opn = sData.opnBalances || [0,0,0,0,0,0,0,0,0,0];

                const fpn = partObj ? (partObj.forge_pn || '').trim().toUpperCase() : '';
                let fAvail = findRmStock(fpn, partKey, allRms);

                const sentAnusha = safeHtLogs.filter(l => (l.partno || '').trim().toUpperCase() === partKey && (l.vendor || '').toLowerCase().includes('anusha')).reduce((sum, l) => sum + (l.qty || 0), 0);
                const recAnusha = safeHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === partKey && (l.vendor || '').toLowerCase().includes('anusha')).reduce((sum, l) => sum + (l.qty || 0), 0);
                const pendingAnusha = Math.max(0, sentAnusha - recAnusha);

                const sentJMS = safeHtLogs.filter(l => (l.partno || '').trim().toUpperCase() === partKey && (l.vendor || '').toLowerCase().includes('jms')).reduce((sum, l) => sum + (l.qty || 0), 0);
                const recJMS = safeHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === partKey && (l.vendor || '').toLowerCase().includes('jms')).reduce((sum, l) => sum + (l.qty || 0), 0);
                const pendingJMS = Math.max(0, sentJMS - recJMS);

                const trRow = document.createElement('tr');
                let rowContent = `<td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${pName}</td>`;
                rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${sData.schedQty || 0}</td>`;

                if (isGroup2Merged && (partKey === 'QD' || partKey === 'AMW')) {
                    if (partKey === 'QD') {
                        rowContent += `<td rowspan="2" style="border:1px solid #cbd5e1; padding:6px; vertical-align:middle; text-align:center; font-weight:bold;">${group2MergedFAvail}</td>`;
                        rowContent += `<td rowspan="2" style="border:1px solid #cbd5e1; padding:6px; vertical-align:middle; text-align:center; font-weight:bold;">${group2MergedWip}</td>`;
                        rowContent += `<td rowspan="2" style="border:1px solid #cbd5e1; padding:6px; vertical-align:middle; text-align:center; font-weight:bold; color: ${group2MergedRmStatus < 0 ? '#ef4444' : '#16a34a'};">${group2MergedRmStatus}</td>`;
                    }
                } else {
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${fAvail || 0}</td>`;
                }

                let wip = 0;
                let rmStatus = 0;
                if (group.name === 'Group 1') {
                    const facCen = opn[1] || 0;
                    const forHt = opn[2] || 0;
                    const forGrind = opn[3] || 0;
                    const forIns = opn[4] || 0;
                    const rfdVal = sData.rfdBal || 0;

                    wip = facCen + forHt + pendingAnusha + pendingJMS + forGrind + forIns + rfdVal;
                    rmStatus = fAvail - wip;

                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; font-weight:600;">${wip}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; font-weight:600; color: ${rmStatus < 0 ? '#ef4444' : '#16a34a'};">${rmStatus}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${facCen}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${forHt}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; color:#d97706; font-weight:bold;">${pendingAnusha}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; color:#d97706; font-weight:bold;">${pendingJMS}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${forGrind}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${forIns}</td>`;
                } else if (group.name === 'Group 2' || group.name === 'Group 3' || group.name === 'Group 4') {
                    const opn0 = opn[0] || 0;
                    const opn1 = opn[1] || 0;
                    const opn2 = opn[2] || 0;
                    const opn3 = opn[3] || 0;
                    const forInsBal = sData.forInsBal || 0;
                    const rfdVal = sData.rfdBal || 0;

                    wip = opn0 + opn1 + opn2 + opn3 + forInsBal + rfdVal;
                    rmStatus = fAvail - wip;

                    if (!isGroup2Merged || (partKey !== 'QD' && partKey !== 'AMW')) {
                        rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; font-weight:600;">${wip}</td>`;
                        rowContent += `<td style="border:1px solid #cbd5e1; padding:6px; font-weight:600; color: ${rmStatus < 0 ? '#ef4444' : '#16a34a'};">${rmStatus}</td>`;
                    }
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${opn0}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${opn1}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${opn2}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${opn3}</td>`;
                    rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${forInsBal}</td>`;
                }

                rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${sData.rfdBal || 0}</td>`;
                rowContent += `<td style="border:1px solid #cbd5e1; padding:6px;">${sData.despProd || 0}</td>`;

                spiderForgingList.push({
                    forgePn: fpn || (partObj ? partObj.forge_pn : ''),
                    finPn: pName,
                    schedule: sData.schedQty || 0,
                    despatch: sData.despProd || 0,
                    wip: wip,
                    rmStatus: rmStatus,
                    fAvail: fAvail
                });

                trRow.innerHTML = rowContent;
                tbody.appendChild(trRow);
            }
        }

        renderSpiderForgingRequirementTable(spiderForgingList);
    }

    const exportSpiderBtn = document.getElementById('exportSpiderReportBtn');
    if (exportSpiderBtn) {
        exportSpiderBtn.addEventListener('click', () => {
            const table = document.getElementById('spiderReportTable');
            if (!table) return;
            const wb = XLSX.utils.table_to_book(table, {sheet: "SPIDER Report"});
            XLSX.writeFile(wb, `SPIDER_Detailed_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
        });
    }

    const SPIDER_DEFAULT_BUFFERS = {
        'C100': 500,
        'RS120': 1000,
        'RVI': 2000,
        'Q109': 4000,
        'R149': 2000,
        'RS160': 4000,
        'AMW': 1000,
        'QD': 0,
        '15I': 2000,
        '15 I': 2000
    };

    function getSpiderBuffers() {
        try {
            const saved = localStorage.getItem('spider_forging_buffers');
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error(e); }
        return { ...SPIDER_DEFAULT_BUFFERS };
    }

    function saveSpiderBuffer(partKey, val) {
        const buffers = getSpiderBuffers();
        buffers[partKey] = parseInt(val, 10) || 0;
        try {
            localStorage.setItem('spider_forging_buffers', JSON.stringify(buffers));
        } catch (e) { console.error(e); }
    }

    function renderSpiderForgingRequirementTable(forgingList) {
        const tbody = document.getElementById('spiderForgingReqBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const buffers = getSpiderBuffers();

        // Group items by forgePn (or detect common forgePn)
        const groupsMap = new Map();
        forgingList.forEach(item => {
            const rawFpn = (item.forgePn || '').trim().toUpperCase();
            // If forgePn is missing or dash, use finPn as key
            const groupKey = (rawFpn && rawFpn !== '-') ? rawFpn : item.finPn.trim().toUpperCase();
            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, []);
            }
            groupsMap.get(groupKey).push(item);
        });

        groupsMap.forEach((items, groupKey) => {
            const rowCount = items.length;

            let combinedBalToDesp = 0;
            let combinedWipPlusRm = 0;
            let combinedBuffer = 0;

            items.forEach((item, idx) => {
                const schedule = item.schedule || 0;
                const despatch = item.despatch || 0;
                const balToDesp = schedule - despatch;
                combinedBalToDesp += balToDesp;

                const partKey = item.finPn.trim().toUpperCase();
                const defaultBuf = SPIDER_DEFAULT_BUFFERS[partKey] !== undefined ? SPIDER_DEFAULT_BUFFERS[partKey] : (SPIDER_DEFAULT_BUFFERS[partKey.replace(/\s+/g, '')] !== undefined ? SPIDER_DEFAULT_BUFFERS[partKey.replace(/\s+/g, '')] : 0);
                const bufVal = buffers[partKey] !== undefined ? buffers[partKey] : defaultBuf;
                combinedBuffer += bufVal;

                if (rowCount > 1) {
                    if (idx === 0) {
                        combinedWipPlusRm = (item.fAvail !== undefined && item.fAvail !== null && item.fAvail > 0) ? item.fAvail : ((item.wip || 0) + (item.rmStatus || 0));
                    }
                } else {
                    combinedWipPlusRm = (item.wip || 0) + (item.rmStatus || 0);
                }
            });

            if (buffers[groupKey] !== undefined) {
                combinedBuffer = buffers[groupKey];
            }

            const combinedWipBal = combinedWipPlusRm - combinedBalToDesp;
            const combinedForgeReqdCalculated = combinedBuffer - combinedWipBal;
            const combinedForgeReqd = combinedForgeReqdCalculated < 0 ? 0 : combinedForgeReqdCalculated;

            items.forEach((item, idx) => {
                const partKey = item.finPn.trim().toUpperCase();
                const schedule = item.schedule || 0;
                const despatch = item.despatch || 0;
                const balToDesp = schedule - despatch;
                const wip = item.wip || 0;

                const tr = document.createElement('tr');
                let html = '';

                if (idx === 0) {
                    if (rowCount > 1) {
                        html += `<td rowspan="${rowCount}" style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 500; vertical-align: middle;">${item.forgePn || '-'}</td>`;
                    } else {
                        html += `<td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 500;">${item.forgePn || '-'}</td>`;
                    }
                }

                html += `<td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${item.finPn}</td>`;
                html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${schedule}</td>`;
                html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${despatch}</td>`;
                html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600; color: ${balToDesp < 0 ? '#ef4444' : '#1e293b'};">${balToDesp}</td>`;
                html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600;">${wip}</td>`;

                if (idx === 0) {
                    if (rowCount > 1) {
                        html += `<td rowspan="${rowCount}" style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600; vertical-align: middle; color: ${combinedWipBal < 0 ? '#ef4444' : '#16a34a'};">${combinedWipBal}</td>`;
                        html += `<td rowspan="${rowCount}" style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; vertical-align: middle;">
                            <input type="number" class="spider-buffer-input" data-part="${groupKey}" value="${combinedBuffer}" style="width: 85px; padding: 3px 6px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right; font-weight: 500;">
                        </td>`;
                        html += `<td rowspan="${rowCount}" style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; vertical-align: middle; color: ${combinedForgeReqd > 0 ? '#d97706' : '#64748b'};">${combinedForgeReqd}</td>`;
                    } else {
                        html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 600; color: ${combinedWipBal < 0 ? '#ef4444' : '#16a34a'};">${combinedWipBal}</td>`;
                        html += `<td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">
                            <input type="number" class="spider-buffer-input" data-part="${partKey}" value="${combinedBuffer}" style="width: 85px; padding: 3px 6px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right; font-weight: 500;">
                        </td>`;
                        html += `<td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; color: ${combinedForgeReqd > 0 ? '#d97706' : '#64748b'};">${combinedForgeReqd}</td>`;
                    }
                }

                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
        });

        tbody.querySelectorAll('.spider-buffer-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const part = e.target.getAttribute('data-part');
                const val = e.target.value;
                saveSpiderBuffer(part, val);
                renderSpiderForgingRequirementTable(forgingList);
            });
        });
    }

    const exportSpiderForgingBtn = document.getElementById('exportSpiderForgingReqBtn');
    if (exportSpiderForgingBtn) {
        exportSpiderForgingBtn.addEventListener('click', () => {
            const table = document.getElementById('spiderForgingReqTable');
            if (!table) return;
            const clone = table.cloneNode(true);
            const inputs = table.querySelectorAll('input');
            const cloneInputs = clone.querySelectorAll('input');
            inputs.forEach((inp, idx) => {
                if (cloneInputs[idx]) {
                    const parent = cloneInputs[idx].parentNode;
                    parent.textContent = inp.value;
                }
            });
            const wb = XLSX.utils.table_to_book(clone, {sheet: "Forging Requirement"});
            XLSX.writeFile(wb, `Spider_Forging_Requirement_${new Date().toISOString().slice(0,10)}.xlsx`);
        });
    }

    // --- SPIDER REPORT SHARING & RECIPIENTS LOGIC ---
    const DEFAULT_SPIDER_CONTACTS = [
        { id: 1, dept: 'ADMIN', name: 'Admin Office', phone: '', email: 'admin@grs.com' },
        { id: 2, dept: 'QC', name: 'QC Department', phone: '', email: 'qc@grs.com' },
        { id: 3, dept: 'SPIDER', name: 'Spider Supervisor', phone: '', email: 'spider@grs.com' },
        { id: 4, dept: 'MAINT', name: 'Maintenance Lead', phone: '', email: 'maint@grs.com' },
        { id: 5, dept: 'WIPRO', name: 'Wipro Coordinator', phone: '', email: 'wipro@grs.com' }
    ];

    function getSpiderContacts() {
        try {
            const saved = localStorage.getItem('spider_report_contacts');
            if (saved) return JSON.parse(saved);
        } catch (e) { console.error(e); }
        return DEFAULT_SPIDER_CONTACTS;
    }

    function saveSpiderContacts(contacts) {
        try {
            localStorage.setItem('spider_report_contacts', JSON.stringify(contacts));
        } catch (e) { console.error(e); }
    }

    function renderSpiderContactsTable() {
        const tbody = document.getElementById('reportContactsBody');
        if (!tbody) return;
        const contacts = getSpiderContacts();
        tbody.innerHTML = '';
        if (contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 1rem; color: var(--text-muted);">No contacts saved. Add a recipient below.</td></tr>';
            return;
        }
        contacts.forEach(c => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="text-align: center; padding: 0.5rem;"><input type="checkbox" class="contact-select-cb" data-id="${c.id}" checked></td>
                <td style="padding: 0.5rem;"><strong>${c.dept || '-'}</strong></td>
                <td style="padding: 0.5rem;">${c.name || '-'}</td>
                <td style="padding: 0.5rem; color: #16a34a;">${c.phone || '<span style="color:var(--text-muted)">-</span>'}</td>
                <td style="padding: 0.5rem; color: #0284c7;">${c.email || '<span style="color:var(--text-muted)">-</span>'}</td>
                <td style="text-align: center; padding: 0.5rem;">
                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #25D366; border-color: #25D366; margin-right: 4px;" onclick="sendSingleWhatsapp(${c.id})">WhatsApp</button>
                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #0284c7; border-color: #0284c7; margin-right: 4px;" onclick="sendSingleEmail(${c.id})">Email</button>
                    <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteSpiderContact(${c.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function generateSpiderReportSummaryText() {
        let text = `📊 *GRS ENGINEERING - SPIDER DEPT REPORT*\nDate: ${new Date().toLocaleDateString('en-IN')}\n\n`;
        text += `*SPIDER REPORT SUMMARY:*\n`;
        text += `-----------------------------------------\n`;
        text += `PART NO | SCH QTY | F AVAIL | WIP | RM STATUS\n`;
        text += `-----------------------------------------\n`;

        const table = document.getElementById('spiderReportTable');
        if (table) {
            const rows = table.querySelectorAll('tr');
            rows.forEach(r => {
                const cells = Array.from(r.querySelectorAll('td, th')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                if (cells.length >= 5 && cells[0] && cells[0] !== 'PART NO' && !cells[0].includes('Grinding') && !cells[0].includes('Boring') && !cells[0].includes('Turning')) {
                    text += `${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]} | ${cells[4]}\n`;
                }
            });
        }
        text += `-----------------------------------------\n`;
        text += `Generated via GRS Inventory Management System.`;
        return text;
    }

    function formatWhatsappPhone(phoneStr) {
        if (!phoneStr) return '';
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        return cleaned;
    }

    window.sendSingleWhatsapp = (contactId) => {
        const contacts = getSpiderContacts();
        const contact = contacts.find(c => c.id == contactId);
        if (!contact || !contact.phone) {
            alert('No valid phone number for this contact. Please edit or add a phone number.');
            return;
        }
        const phone = formatWhatsappPhone(contact.phone);
        const reportText = generateSpiderReportSummaryText();
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(reportText)}`;
        window.open(url, '_blank');
    };

    window.sendSingleEmail = (contactId) => {
        const contacts = getSpiderContacts();
        const contact = contacts.find(c => c.id == contactId);
        if (!contact || !contact.email) {
            alert('No valid email ID for this contact. Please edit or add an email address.');
            return;
        }
        const reportText = generateSpiderReportSummaryText();
        const url = `mailto:${contact.email}?subject=${encodeURIComponent('SPIDER Department Detailed Report')}&body=${encodeURIComponent(reportText)}`;
        window.open(url, '_blank');
    };

    window.deleteSpiderContact = (contactId) => {
        let contacts = getSpiderContacts();
        contacts = contacts.filter(c => c.id != contactId);
        saveSpiderContacts(contacts);
        renderSpiderContactsTable();
    };

    const sendSpiderBtn = document.getElementById('sendSpiderReportBtn');
    const sendReportModal = document.getElementById('sendReportModal');
    const closeSendReportModalBtn = document.getElementById('closeSendReportModalBtn');

    if (sendSpiderBtn && sendReportModal) {
        sendSpiderBtn.addEventListener('click', () => {
            renderSpiderContactsTable();
            sendReportModal.classList.add('show');
        });
    }

    if (closeSendReportModalBtn && sendReportModal) {
        closeSendReportModalBtn.addEventListener('click', () => {
            sendReportModal.classList.remove('show');
        });
    }

    document.getElementById('selectAllContactsCb')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.contact-select-cb').forEach(cb => cb.checked = checked);
    });

    document.getElementById('addReportContactForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const dept = document.getElementById('newContactDept').value.trim();
        const name = document.getElementById('newContactName').value.trim();
        const phone = document.getElementById('newContactPhone').value.trim();
        const email = document.getElementById('newContactEmail').value.trim();

        if (!dept || !name) return;

        const contacts = getSpiderContacts();
        const newContact = {
            id: Date.now(),
            dept,
            name,
            phone,
            email
        };
        contacts.push(newContact);
        saveSpiderContacts(contacts);
        renderSpiderContactsTable();

        document.getElementById('addReportContactForm').reset();
    });

    document.getElementById('sendSelectedWhatsappBtn')?.addEventListener('click', () => {
        const contacts = getSpiderContacts();
        const selectedCbs = Array.from(document.querySelectorAll('.contact-select-cb:checked'));
        if (selectedCbs.length === 0) {
            alert('Please select at least one contact.');
            return;
        }
        const reportText = generateSpiderReportSummaryText();
        let sentCount = 0;
        selectedCbs.forEach(cb => {
            const id = cb.getAttribute('data-id');
            const contact = contacts.find(c => c.id == id);
            if (contact && contact.phone) {
                const phone = formatWhatsappPhone(contact.phone);
                const url = `https://wa.me/${phone}?text=${encodeURIComponent(reportText)}`;
                window.open(url, '_blank');
                sentCount++;
            }
        });
        if (sentCount === 0) {
            alert('None of the selected contacts have a valid phone number filled in.');
        }
    });

    document.getElementById('sendSelectedEmailBtn')?.addEventListener('click', () => {
        const contacts = getSpiderContacts();
        const selectedCbs = Array.from(document.querySelectorAll('.contact-select-cb:checked'));
        if (selectedCbs.length === 0) {
            alert('Please select at least one contact.');
            return;
        }
        const emails = [];
        selectedCbs.forEach(cb => {
            const id = cb.getAttribute('data-id');
            const contact = contacts.find(c => c.id == id);
            if (contact && contact.email && contact.email.includes('@')) {
                emails.push(contact.email);
            }
        });
        if (emails.length === 0) {
            alert('None of the selected contacts have a valid email ID filled in.');
            return;
        }
        const reportText = generateSpiderReportSummaryText();
        const url = `mailto:${emails.join(',')}?subject=${encodeURIComponent('SPIDER Department Detailed Report')}&body=${encodeURIComponent(reportText)}`;
        window.open(url, '_blank');
    });

    document.getElementById('downloadReportImageBtn')?.addEventListener('click', async () => {
        const container = document.getElementById('spiderReportContainer');
        if (!container || typeof html2canvas === 'undefined') {
            alert('Report element or image generator not available.');
            return;
        }
        try {
            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });
            const link = document.createElement('a');
            link.download = `SPIDER_Detailed_Report_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Error generating image:', e);
            alert('Error generating report image.');
        }
    });

    document.getElementById('copyReportImageBtn')?.addEventListener('click', async () => {
        const container = document.getElementById('spiderReportContainer');
        if (!container || typeof html2canvas === 'undefined') {
            alert('Report element or image generator not available.');
            return;
        }
        try {
            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('Failed to generate image blob.');
                    return;
                }
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert('SPIDER Report HD Image copied to clipboard! You can paste (Ctrl+V) directly into WhatsApp or Email.');
                } catch (err) {
                    console.error('Clipboard error:', err);
                    alert('Clipboard write failed. Please use "Download Report Image" instead.');
                }
            });
        } catch (e) {
            console.error('Error copying image:', e);
            alert('Error rendering report image.');
        }
    });

    document.getElementById('copySpiderReportSummaryBtn')?.addEventListener('click', () => {
        const reportText = generateSpiderReportSummaryText();
        navigator.clipboard.writeText(reportText).then(() => {
            alert('SPIDER Report text copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    });

    // --- DEBUR LOGIC ---
    let deburAllParts = [];
    let deburOperatorsLoaded = false;
    
    document.getElementById('deburDeptSelect').addEventListener('change', fetchDeburStatus);
    
    async function initDebur() {
        try {
            if (!document.getElementById('deburDate').value) {
                document.getElementById('deburDate').valueAsDate = new Date();
            }
            
            if (deburAllParts.length === 0) {
                const partsRes = await fetch('/api/partmaster');
                deburAllParts = await partsRes.json();
            }
            if (!deburOperatorsLoaded) {
                const opRes = await fetch('/api/operators');
                const operators = await opRes.json();
                operators.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                const sel = document.getElementById('deburOperator');
                if (sel) {
                    sel.innerHTML = '<option value="">-- Select Operator --</option>';
                    operators.forEach(o => {
                        const opt = document.createElement('option');
                        opt.value = o.name;
                        opt.textContent = o.name;
                        sel.appendChild(opt);
                    });
                }
                deburOperatorsLoaded = true;
            }
            
            fetchDeburLogs();
            
            const deptSelect = document.getElementById('deburDeptSelect');
            if (deptSelect.value) {
                fetchDeburStatus();
            }
        } catch (e) {
            console.error('Error init debur', e);
        }
    }
    
    async function fetchDeburStatus() {
        const dept = document.getElementById('deburDeptSelect').value;
        const tbody = document.getElementById('deburPartsBody');
        tbody.innerHTML = '';
        if (!dept) {
            tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">Select a department</td></tr>';
            return;
        }

        try {
            const [schedRes, logRes, pcReceiptRes, htReceiptRes] = await Promise.all([
                fetch('/api/schedule'),
                fetch('/api/prodlog'),
                fetch('/api/pc_receipt_logs').catch(() => null),
                fetch('/api/ht_receipt_logs').catch(() => null)
            ]);
            
            const allSchedules = await schedRes.json();
            const allLogs = await logRes.json();
            const allPcReceiptLogs = (pcReceiptRes && pcReceiptRes.ok) ? await pcReceiptRes.json() : [];
            const allHtReceiptLogs = (htReceiptRes && htReceiptRes.ok) ? await htReceiptRes.json() : [];
            
            const deptSchedules = allSchedules.filter(s => (s.department || '').trim().toUpperCase() === dept.trim().toUpperCase() && (s.status === 'Pending' || !s.status));
            const uniqueParts = [...new Set(deptSchedules.map(s => s.partno))];
            
            if (uniqueParts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No pending parts for this department</td></tr>';
                return;
            }
            
            for (const partno of uniqueParts) {
                const partObj = deburAllParts.find(p => (p.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase());
                if (!partObj) continue;
                
                const opsRes = await fetch(`/api/partmaster/${partObj.id}/operations`);
                const operations = await opsRes.json();
                
                if (operations.length === 0) continue;
                
                operations.sort((a, b) => (parseInt(a.opn_no) || 0) - (parseInt(b.opn_no) || 0));
                const lastOp = operations[operations.length - 1];
                const lastOpnClean = (lastOp.opn_no || '').trim().toLowerCase();
                const lastDescClean = (lastOp.description || '').trim().toLowerCase();
                const lastMachClean = (lastOp.machine || '').trim().toLowerCase();

                const isLastPc = lastOpnClean === 'pc' || lastDescClean === 'pc' || lastDescClean.includes('powder coat') || lastDescClean.includes('pc') || lastMachClean === 'pc';
                const isLastHt = lastOpnClean === 'ht' || lastOpnClean === '50' || lastDescClean === 'ht' || lastDescClean.includes('heat treat') || lastMachClean === 'ht';

                let lastOpProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').trim().toLowerCase() === lastOpnClean).reduce((sum, l) => sum + (l.prod_qty || 0), 0);

                if (isLastPc || lastOpnClean.includes('pc')) {
                    const pcRec = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                    lastOpProd = Math.max(lastOpProd, pcRec);
                } else if (isLastHt) {
                    const htRec = allHtReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                    lastOpProd = Math.max(lastOpProd, htRec);
                }

                const pcRecTotal = allPcReceiptLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase()).reduce((sum, l) => sum + (l.qty || 0), 0);
                if (pcRecTotal > lastOpProd) {
                    lastOpProd = pcRecTotal;
                }

                const deburredProd = allLogs.filter(l => (l.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase() && (l.opn_no || '').toLowerCase() === 'debur').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                
                const balance = Math.max(0, lastOpProd - deburredProd);
                
                if (balance <= 0) continue;
                
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.innerHTML = `
                    <td>${partno}</td>
                    <td style="font-weight: 600; color: ${balance > 0 ? 'var(--primary-color)' : 'inherit'};">${balance}</td>
                `;
                tr.addEventListener('click', () => {
                    document.getElementById('deburPartNo').value = partno;
                });
                tbody.appendChild(tr);
            }
            
            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No parts pending debur</td></tr>';
            }
        } catch (e) {
            console.error('Error fetching debur status', e);
        }
    }
    
    document.getElementById('deburForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            dept: document.getElementById('deburDeptSelect').value,
            date: document.getElementById('deburDate').value,
            shift: '',
            setter: '',
            machine: '',
            operator: document.getElementById('deburOperator').value,
            partno: document.getElementById('deburPartNo').value,
            opn_no: 'debur', // Use debur as the operation
            description: '',
            runtime: parseFloat(document.getElementById('deburHours').value) || 0,
            cycle_time: 0,
            target_qty: 0,
            prod_qty: parseInt(document.getElementById('deburQty').value) || 0,
            efficiency: 0,
            idle_hours: 0,
            idle_reason: ''
        };
        
        try {
            const res = await fetch('/api/prodlog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById('deburHours').value = '';
                document.getElementById('deburQty').value = '';
                fetchDeburStatus(); // Refresh left side
                fetchDeburLogs();   // Refresh right side logs
            } else {
                alert("Failed to save debur log.");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving debur log.");
        }
    });

    async function fetchDeburLogs() {
        try {
            const res = await fetch('/api/prodlog');
            const allLogs = await res.json();
            const deburLogs = allLogs.filter(l => (l.opn_no || '').toLowerCase() === 'debur');
            
            // Sort descending by ID or Date to show newest first
            deburLogs.sort((a, b) => b.id - a.id);
            
            const tbody = document.getElementById('deburLogsBody');
            tbody.innerHTML = '';
            
            if (deburLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No debur logs found.</td></tr>';
                return;
            }
            
            // Show only recent 50 logs to keep UI snappy
            deburLogs.slice(0, 50).forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.date}</td>
                    <td>${log.operator || ''}</td>
                    <td>${log.partno}</td>
                    <td>${log.run_time || ''}</td>
                    <td><span style="font-weight: 500;">${log.prod_qty || ''}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('Error fetching debur logs:', e);
        }
    }

    // --- INSPECTION LOGIC ---
    let inspAllParts = [];
    let inspOperatorsLoaded = false;
    let savedInspectionReasons = new Set();

    document.getElementById('inspDeptSelect').addEventListener('change', fetchInspectionStatus);

    async function loadPastInspectionReasons() {
        try {
            const res = await fetch('/api/prodlog');
            const logs = await res.json();
            logs.forEach(l => {
                const op = (l.opn_no || '').toLowerCase();
                if (['rejection', 'rework', 'nc'].includes(op)) {
                    const rsn = (l.idle_reason || l.description || '').trim();
                    if (rsn && rsn !== 'None' && rsn !== 'Rejection' && rsn !== 'Rework' && rsn !== 'NC') {
                        savedInspectionReasons.add(rsn);
                    }
                }
            });
            updateReasonsDatalist();
        } catch (e) { console.error(e); }
    }

    function updateReasonsDatalist() {
        const datalist = document.getElementById('inspectionReasonsDatalist');
        if (!datalist) return;
        datalist.innerHTML = '';
        savedInspectionReasons.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            datalist.appendChild(opt);
        });
    }

    function createInspectionRow(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rowDiv = document.createElement('div');
        rowDiv.className = 'insp-detail-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '8px';
        rowDiv.style.alignItems = 'center';

        rowDiv.innerHTML = `
            <input type="number" class="insp-row-qty" placeholder="Qty" min="1" style="width: 100px; padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.05); color: var(--text-main); font-family: 'Inter', sans-serif;">
            <input type="text" class="insp-row-reason" list="inspectionReasonsDatalist" placeholder="Type or select reason..." style="flex: 1; padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.05); color: var(--text-main); font-family: 'Inter', sans-serif;">
            <button type="button" class="btn-text remove-insp-row-btn" style="color: #ef4444; font-size: 1.2rem; font-weight: bold; cursor: pointer; padding: 0 6px;">&times;</button>
        `;

        rowDiv.querySelector('.remove-insp-row-btn').addEventListener('click', () => {
            rowDiv.remove();
            autoSumInspection();
        });

        rowDiv.querySelector('.insp-row-qty').addEventListener('input', autoSumInspection);

        container.appendChild(rowDiv);
    }

    function initInspectionRows() {
        ['rejectionRowsContainer', 'reworkRowsContainer', 'ncRowsContainer'].forEach(cId => {
            const container = document.getElementById(cId);
            if (container && container.children.length === 0) {
                createInspectionRow(cId);
            }
        });
    }

    document.getElementById('addRejectionRowBtn')?.addEventListener('click', () => createInspectionRow('rejectionRowsContainer'));
    document.getElementById('addReworkRowBtn')?.addEventListener('click', () => createInspectionRow('reworkRowsContainer'));
    document.getElementById('addNCRowBtn')?.addEventListener('click', () => createInspectionRow('ncRowsContainer'));

    async function initInspection() {
        try {
            if (!document.getElementById('inspDate').value) {
                document.getElementById('inspDate').valueAsDate = new Date();
            }
            
            if (inspAllParts.length === 0) {
                const partsRes = await fetch('/api/partmaster');
                inspAllParts = await partsRes.json();
            }
            if (!inspOperatorsLoaded) {
                const opRes = await fetch('/api/operators');
                const operators = await opRes.json();
                operators.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                const sel = document.getElementById('inspOperator');
                if (sel) {
                    sel.innerHTML = '<option value="">-- Select Operator --</option>';
                    operators.forEach(o => {
                        const opt = document.createElement('option');
                        opt.value = o.name;
                        opt.textContent = o.name;
                        sel.appendChild(opt);
                    });
                }
                inspOperatorsLoaded = true;
            }
            
            loadPastInspectionReasons();
            initInspectionRows();
            fetchInspectionLogs();
            
            const deptSelect = document.getElementById('inspDeptSelect');
            if (deptSelect.value) {
                fetchInspectionStatus();
            }
        } catch (e) {
            console.error('Error init inspection', e);
        }
    }
    
    async function fetchInspectionStatus() {
        const dept = document.getElementById('inspDeptSelect').value;
        const tbody = document.getElementById('inspPartsBody');
        tbody.innerHTML = '';
        if (!dept) {
            tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">Select a department</td></tr>';
            return;
        }

        try {
            const [schedRes, logRes, pmRes] = await Promise.all([
                fetch('/api/schedule'),
                fetch('/api/prodlog'),
                fetch('/api/partmaster')
            ]);
            
            const allSchedules = await schedRes.json();
            const allLogs = await logRes.json();
            const allPartMasters = await pmRes.json();
            
            const deptSchedules = allSchedules.filter(s => (s.department || '').trim().toUpperCase() === dept.trim().toUpperCase() && (s.status === 'Pending' || !s.status));
            const uniqueParts = [...new Set(deptSchedules.map(s => s.partno))];
            
            if (uniqueParts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No pending parts for this department</td></tr>';
                return;
            }
            
            for (const partno of uniqueParts) {
                const partObj = allPartMasters.find(p => (p.partno || '').trim().toUpperCase() === (partno || '').trim().toUpperCase());
                let lastOpnNo = '';
                if (partObj) {
                    const opsRes = await fetch(`/api/partmaster/${partObj.id}/operations`);
                    const operations = await opsRes.json();
                    if (operations.length > 0) {
                        operations.sort((a, b) => (parseInt(a.opn_no) || 0) - (parseInt(b.opn_no) || 0));
                        lastOpnNo = (operations[operations.length - 1].opn_no || '').trim().toLowerCase();
                    }
                }

                const deburredTotal = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'debur').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const forInsLogTotal = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'for ins').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const lastOpProd = lastOpnNo ? allLogs.filter(l => l.partno === partno && (l.opn_no || '').trim().toLowerCase() === lastOpnNo).reduce((sum, l) => sum + (l.prod_qty || 0), 0) : 0;

                const effectiveForIns = deburredTotal > 0 ? deburredTotal : forInsLogTotal;

                const rfdProd = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'rfd').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const reworkProd = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'rework').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const ncProd = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'nc').reduce((sum, l) => sum + (l.prod_qty || 0), 0);
                const rejectionProd = allLogs.filter(l => l.partno === partno && (l.opn_no || '').toLowerCase() === 'rejection').reduce((sum, l) => sum + (l.prod_qty || 0), 0);

                const totalInspected = Math.max(forInsLogTotal, rfdProd + reworkProd + ncProd + rejectionProd);

                const balance = Math.max(0, effectiveForIns - totalInspected);
                
                if (balance <= 0) continue; // Only show parts with positive balance for inspection
                
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.innerHTML = `
                    <td>${partno}</td>
                    <td style="font-weight: 600; color: var(--primary-color);">${balance}</td>
                `;
                tr.addEventListener('click', () => {
                    document.getElementById('inspPartNo').value = partno;
                });
                tbody.appendChild(tr);
            }
            
            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No parts pending inspection</td></tr>';
            }
        } catch (e) {
            console.error('Error fetching inspection status', e);
        }
    }
    
    function autoSumInspection() {
        const rfd = parseInt(document.getElementById('inspRFD').value) || 0;
        
        let totalRej = 0;
        document.querySelectorAll('#rejectionRowsContainer .insp-row-qty').forEach(input => {
            totalRej += parseInt(input.value) || 0;
        });

        let totalRew = 0;
        document.querySelectorAll('#reworkRowsContainer .insp-row-qty').forEach(input => {
            totalRew += parseInt(input.value) || 0;
        });

        let totalNC = 0;
        document.querySelectorAll('#ncRowsContainer .insp-row-qty').forEach(input => {
            totalNC += parseInt(input.value) || 0;
        });

        const sum = rfd + totalRej + totalRew + totalNC;
        if (sum > 0) {
            document.getElementById('inspQty').value = sum;
        }
    }
    document.getElementById('inspRFD')?.addEventListener('input', autoSumInspection);

    document.getElementById('inspForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const date = document.getElementById('inspDate').value;
        const operator = document.getElementById('inspOperator').value;
        const partno = document.getElementById('inspPartNo').value;
        const runtime = parseFloat(document.getElementById('inspHours').value) || 0;
        const dept = document.getElementById('inspDeptSelect').value;
        
        const inspQty = parseInt(document.getElementById('inspQty').value) || 0;
        const rfdQty = parseInt(document.getElementById('inspRFD').value) || 0;
        
        if (inspQty === 0) {
            alert("Total Inspected quantity cannot be zero.");
            return;
        }
        
        const createPayload = (opn_no, qty, reason = '') => ({
            dept, date, shift: '', setter: '', machine: '',
            operator, partno, opn_no, description: reason, runtime,
            cycle_time: 0, target_qty: 0, prod_qty: qty, efficiency: 0,
            idle_hours: 0, idle_reason: reason
        });
        
        const payloads = [];
        payloads.push(createPayload('for ins', inspQty));
        if (rfdQty > 0) payloads.push(createPayload('rfd', rfdQty));

        // Rejection rows
        document.querySelectorAll('#rejectionRowsContainer .insp-detail-row').forEach(row => {
            const qty = parseInt(row.querySelector('.insp-row-qty').value) || 0;
            const rsn = row.querySelector('.insp-row-reason').value.trim();
            if (qty > 0) {
                payloads.push(createPayload('rejection', qty, rsn || 'Rejection'));
                if (rsn) savedInspectionReasons.add(rsn);
            }
        });

        // Rework rows
        document.querySelectorAll('#reworkRowsContainer .insp-detail-row').forEach(row => {
            const qty = parseInt(row.querySelector('.insp-row-qty').value) || 0;
            const rsn = row.querySelector('.insp-row-reason').value.trim();
            if (qty > 0) {
                payloads.push(createPayload('rework', qty, rsn || 'Rework'));
                if (rsn) savedInspectionReasons.add(rsn);
            }
        });

        // NC rows
        document.querySelectorAll('#ncRowsContainer .insp-detail-row').forEach(row => {
            const qty = parseInt(row.querySelector('.insp-row-qty').value) || 0;
            const rsn = row.querySelector('.insp-row-reason').value.trim();
            if (qty > 0) {
                payloads.push(createPayload('nc', qty, rsn || 'NC'));
                if (rsn) savedInspectionReasons.add(rsn);
            }
        });
        
        updateReasonsDatalist();

        try {
            let successCount = 0;
            for (const payload of payloads) {
                const res = await fetch('/api/prodlog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) successCount++;
            }
            
            if (successCount === payloads.length) {
                document.getElementById('inspHours').value = '';
                document.getElementById('inspQty').value = '';
                document.getElementById('inspRFD').value = '';
                
                ['rejectionRowsContainer', 'reworkRowsContainer', 'ncRowsContainer'].forEach(cId => {
                    const c = document.getElementById(cId);
                    if (c) c.innerHTML = '';
                });
                initInspectionRows();
                
                fetchInspectionStatus(); // Refresh left side
                fetchInspectionLogs();   // Refresh right side logs
            } else {
                alert("Failed to save some or all inspection logs.");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving inspection log.");
        }
    });

    let currentInspExportData = [];

    async function fetchInspectionLogs() {
        try {
            const res = await fetch('/api/prodlog');
            const allLogs = await res.json();
            const inspLogs = allLogs.filter(l => (l.opn_no || '').toLowerCase() === 'for ins');
            
            inspLogs.sort((a, b) => b.id - a.id);
            
            const tbody = document.getElementById('inspLogsBody');
            tbody.innerHTML = '';
            
            if (inspLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted)">No inspection logs found.</td></tr>';
                currentInspExportData = [];
                return;
            }
            
            currentInspExportData = [];

            inspLogs.slice(0, 50).forEach(log => {
                const date = log.date;
                const op = log.operator || '';
                const pno = log.partno;
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === (pno || '').trim().toUpperCase());
                const dept = log.department || log.dept || (partObj ? partObj.department : '') || '';
                
                const rfdLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rfd' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const rejLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rejection' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const rewLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rework' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const ncLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'nc' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);

                const totalRfd = rfdLogs.reduce((s, l) => s + (l.prod_qty || 0), 0);

                const rejText = rejLogs.map(l => `${l.prod_qty} (${l.idle_reason || l.description || ''})`).join(', ') || '0';
                const rewText = rewLogs.map(l => `${l.prod_qty} (${l.idle_reason || l.description || ''})`).join(', ') || '0';
                const ncText = ncLogs.map(l => `${l.prod_qty} (${l.idle_reason || l.description || ''})`).join(', ') || '0';

                currentInspExportData.push({
                    "Date": date,
                    "Dept": dept,
                    "Operator": op,
                    "Part No": pno,
                    "Hours": log.runtime || 0,
                    "Total Inspected": log.prod_qty || 0,
                    "RFD": totalRfd,
                    "Rejection": rejText,
                    "Rework": rewText,
                    "NC": ncText
                });

                const rejStr = rejLogs.map(l => `<span style="color:#ef4444; font-weight:600;">${l.prod_qty}</span> <small style="color:var(--text-muted);">(${l.idle_reason || l.description || ''})</small>`).join('<br>') || '0';
                const rewStr = rewLogs.map(l => `<span style="color:#f59e0b; font-weight:600;">${l.prod_qty}</span> <small style="color:var(--text-muted);">(${l.idle_reason || l.description || ''})</small>`).join('<br>') || '0';
                const ncStr = ncLogs.map(l => `<span style="color:#6366f1; font-weight:600;">${l.prod_qty}</span> <small style="color:var(--text-muted);">(${l.idle_reason || l.description || ''})</small>`).join('<br>') || '0';

                const allRelatedIds = [log.id, ...rfdLogs.map(l => l.id), ...rejLogs.map(l => l.id), ...rewLogs.map(l => l.id), ...ncLogs.map(l => l.id)];

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.date}</td>
                    <td><strong>${dept}</strong></td>
                    <td>${log.operator || ''}</td>
                    <td>${log.partno}</td>
                    <td>${log.runtime || ''}</td>
                    <td><span style="font-weight: bold; color: var(--primary-color);">${log.prod_qty || 0}</span></td>
                    <td><span style="color:#10b981; font-weight:600;">${totalRfd}</span></td>
                    <td>${rejStr}</td>
                    <td>${rewStr}</td>
                    <td>${ncStr}</td>
                    <td>
                        <button class="delete-insp-log-btn btn-text" style="color: #ef4444; cursor: pointer; padding: 2px 6px; font-size: 0.85rem;" title="Delete Log">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </td>
                `;

                tr.querySelector('.delete-insp-log-btn').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete inspection log for Part No: ${pno} (Date: ${date})?`)) {
                        try {
                            for (const id of allRelatedIds) {
                                await fetch(`/api/prodlog/${id}`, { method: 'DELETE' });
                            }
                            fetchInspectionStatus();
                            fetchInspectionLogs();
                        } catch (err) {
                            console.error('Error deleting inspection log:', err);
                            alert("Failed to delete log.");
                        }
                    }
                });

                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('Error fetching inspection logs:', e);
        }
    }

    document.getElementById('exportInspLogsBtn')?.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/prodlog');
            const allLogs = await res.json();
            const inspLogs = allLogs.filter(l => (l.opn_no || '').toLowerCase() === 'for ins');
            
            inspLogs.sort((a, b) => b.id - a.id);
            
            if (inspLogs.length === 0) {
                alert("No inspection logs available to export.");
                return;
            }

            const exportRows = [];

            inspLogs.forEach(log => {
                const date = log.date;
                const op = log.operator || '';
                const pno = log.partno;
                const partObj = (statusAllParts || []).find(p => (p.partno || '').trim().toUpperCase() === (pno || '').trim().toUpperCase());
                const dept = log.department || log.dept || (partObj ? partObj.department : '') || '';

                const rfdLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rfd' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const rejLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rejection' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const rewLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'rework' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);
                const ncLogs = allLogs.filter(l => l.partno === pno && l.date === date && l.operator === op && (l.opn_no || '').toLowerCase() === 'nc' && Math.abs((l.id || 0) - (log.id || 0)) <= 15);

                const totalRfd = rfdLogs.reduce((s, l) => s + (l.prod_qty || 0), 0);
                const maxRows = Math.max(1, rejLogs.length, rewLogs.length, ncLogs.length);

                for (let i = 0; i < maxRows; i++) {
                    exportRows.push({
                        "Date": i === 0 ? date : '',
                        "Dept": i === 0 ? dept : '',
                        "Operator": i === 0 ? op : '',
                        "Part No": i === 0 ? pno : '',
                        "Hours": i === 0 ? (log.runtime || 0) : '',
                        "Total Inspected": i === 0 ? (log.prod_qty || 0) : '',
                        "RFD": i === 0 ? totalRfd : '',
                        "Rejection Qty": rejLogs[i] ? rejLogs[i].prod_qty : '',
                        "Rejection Reason": rejLogs[i] ? (rejLogs[i].idle_reason || rejLogs[i].description || '') : '',
                        "Rework Qty": rewLogs[i] ? rewLogs[i].prod_qty : '',
                        "Rework Reason": rewLogs[i] ? (rewLogs[i].idle_reason || rewLogs[i].description || '') : '',
                        "NC Qty": ncLogs[i] ? ncLogs[i].prod_qty : '',
                        "NC Reason": ncLogs[i] ? (ncLogs[i].idle_reason || ncLogs[i].description || '') : ''
                    });
                }
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inspection Logs");
            XLSX.writeFile(wb, `Inspection_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error("Error exporting inspection logs:", err);
            alert("Failed to export inspection logs.");
        }
    });

    // --- PROD LOG LOGIC ---
    let prodLogAllMachines = [];
    let prodLogAllOperators = [];
    let prodLogAllSetters = [];
    let prodLogSchedules = [];
    let prodLogAllPartMasters = [];
    let prodLogAllPartsFallback = [];
    let currentPartOperations = [];

    let prodLogPartNoSelect = null;
    const prodLogPartNoEl = document.getElementById('prodLogPartNo');
    if (prodLogPartNoEl && window.TomSelect) {
        prodLogPartNoSelect = new TomSelect(prodLogPartNoEl, {
            create: false,
            sortField: { field: "text", direction: "asc" },
            placeholder: "Type to search Part No...",
            allowEmptyOption: true,
            onChange: async (val) => {
                await handleProdLogPartChange(val);
            }
        });
    }

    async function handleProdLogPartChange(partno) {
        const opnSelect = document.getElementById('prodLogOpnNo');
        if (!opnSelect) return;
        opnSelect.innerHTML = '<option value="">-- Select Operation --</option>';
        document.getElementById('prodLogDescription').value = '';
        document.getElementById('prodLogCycleTime').value = '';
        recalcProdLog();
        
        if (!partno) return;
        const cleanPart = String(partno).trim().toLowerCase();
        
        // 1. Try from partmaster
        let pmPart = (prodLogAllPartMasters || []).find(p => String(p.partno || p.part_no || '').trim().toLowerCase() === cleanPart);
        if (pmPart && pmPart.id) {
            try {
                const opRes = await fetch(`/api/partmaster/${pmPart.id}/operations`);
                if (opRes.ok) {
                    const ops = await opRes.json();
                    if (Array.isArray(ops) && ops.length > 0) {
                        currentPartOperations = ops;
                        opnSelect.innerHTML = '<option value="">-- Select Operation --</option>';
                        currentPartOperations.forEach(op => {
                            opnSelect.innerHTML += `<option value="${op.opn_no}">${op.opn_no}</option>`;
                        });
                        if (currentPartOperations.length === 1) {
                            opnSelect.value = currentPartOperations[0].opn_no;
                            opnSelect.dispatchEvent(new Event('change'));
                        }
                        return;
                    }
                }
            } catch (e) {
                console.error('Error fetching pm operations:', e);
            }
        }

        // 2. Try from parts table fallback
        let fallbackPart = (prodLogAllPartsFallback || []).find(p => String(p.part_no || p.partno || '').trim().toLowerCase() === cleanPart);
        if (fallbackPart && Array.isArray(fallbackPart.operations) && fallbackPart.operations.length > 0) {
            currentPartOperations = fallbackPart.operations;
            opnSelect.innerHTML = '<option value="">-- Select Operation --</option>';
            currentPartOperations.forEach(op => {
                opnSelect.innerHTML += `<option value="${op.opn_no}">${op.opn_no}</option>`;
            });
            if (currentPartOperations.length === 1) {
                opnSelect.value = currentPartOperations[0].opn_no;
                opnSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    function updateProdLogPartList(dept = '') {
        const deptUpper = (dept || '').trim().toUpperCase();
        const partNoSet = new Set();

        // 1. Scheduled parts matching dept (or all if no dept)
        if (Array.isArray(prodLogSchedules)) {
            const schedParts = prodLogSchedules.filter(s => !deptUpper || (s.department || '').trim().toUpperCase() === deptUpper);
            schedParts.forEach(s => s && s.partno && partNoSet.add(String(s.partno).trim()));
        }

        // 2. Part Master parts matching dept
        if (Array.isArray(prodLogAllPartMasters)) {
            const pmPartsMatching = prodLogAllPartMasters.filter(p => !deptUpper || !p.department || (p.department || '').trim().toUpperCase() === deptUpper);
            pmPartsMatching.forEach(p => p && (p.partno || p.part_no) && partNoSet.add(String(p.partno || p.part_no).trim()));

            // 3. Always include ALL Part Master parts as fallback so user can search any part
            prodLogAllPartMasters.forEach(p => p && (p.partno || p.part_no) && partNoSet.add(String(p.partno || p.part_no).trim()));
        }

        // 4. Parts table fallback
        if (Array.isArray(prodLogAllPartsFallback)) {
            prodLogAllPartsFallback.forEach(p => p && (p.part_no || p.partno) && partNoSet.add(String(p.part_no || p.partno).trim()));
        }

        const sortedParts = Array.from(partNoSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (!prodLogPartNoSelect && window.TomSelect) {
            const el = document.getElementById('prodLogPartNo');
            if (el) {
                prodLogPartNoSelect = new TomSelect(el, {
                    create: false,
                    sortField: { field: "text", direction: "asc" },
                    placeholder: "Type to search Part No...",
                    allowEmptyOption: true,
                    onChange: async (val) => {
                        await handleProdLogPartChange(val);
                    }
                });
            }
        }

        if (prodLogPartNoSelect) {
            prodLogPartNoSelect.clear(true);
            prodLogPartNoSelect.clearOptions();
            prodLogPartNoSelect.addOption({ value: '', text: '-- Select Part No --' });
            sortedParts.forEach(p => {
                prodLogPartNoSelect.addOption({ value: p, text: p });
            });
            prodLogPartNoSelect.refreshOptions(false);
        } else {
            const selectEl = document.getElementById('prodLogPartNo');
            if (selectEl) {
                selectEl.innerHTML = '<option value="">-- Select Part No --</option>';
                sortedParts.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    selectEl.appendChild(opt);
                });
            }
        }
    }

    function populateProdLogDeptFields(dept = '') {
        const deptUpper = (dept || '').trim().toUpperCase();
        const machSelect = document.getElementById('prodLogMachine');
        const opSelect = document.getElementById('prodLogOperator');
        const setterSelect = document.getElementById('prodLogSetter');

        if (machSelect) {
            const currentMach = machSelect.value;
            machSelect.innerHTML = '<option value="">-- Select Machine --</option>';
            const machs = (prodLogAllMachines || []).filter(m => !deptUpper || (m.department || m.dept || '').trim().toUpperCase() === deptUpper);
            const machsToDisplay = machs.length > 0 ? machs : (prodLogAllMachines || []);
            machsToDisplay.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                machSelect.appendChild(opt);
            });
            if (currentMach && machsToDisplay.some(m => m.name === currentMach)) {
                machSelect.value = currentMach;
            }
        }

        if (opSelect) {
            const currentOp = opSelect.value;
            opSelect.innerHTML = '<option value="">-- Select Operator --</option>';
            const filteredOperators = (prodLogAllOperators || []).filter(o => !deptUpper || (o.department || o.dept || '').trim().toUpperCase() === deptUpper);
            const opsToDisplay = filteredOperators.length > 0 ? filteredOperators : (prodLogAllOperators || []);
            opsToDisplay.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.name;
                opt.textContent = o.name;
                opSelect.appendChild(opt);
            });
            if (currentOp && opsToDisplay.some(o => o.name === currentOp)) {
                opSelect.value = currentOp;
            }
        }

        if (setterSelect) {
            const currentSetter = setterSelect.value;
            setterSelect.innerHTML = '<option value="">-- Select Setter --</option>';
            const filteredSetters = (prodLogAllSetters || []).filter(s => !deptUpper || (s.department || s.dept || '').trim().toUpperCase() === deptUpper);
            const settersToDisplay = filteredSetters.length > 0 ? filteredSetters : (prodLogAllSetters || []);
            settersToDisplay.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                setterSelect.appendChild(opt);
            });
            if (currentSetter && settersToDisplay.some(s => s.name === currentSetter)) {
                setterSelect.value = currentSetter;
            }
        }

        if (prodLogPartNoSelect) prodLogPartNoSelect.clear(true);
        else if (document.getElementById('prodLogPartNo')) document.getElementById('prodLogPartNo').value = '';

        updateProdLogPartList(deptUpper);

        // Reset dependent fields
        const opnEl = document.getElementById('prodLogOpnNo');
        if (opnEl) opnEl.innerHTML = '<option value="">-- Select Operation --</option>';
        const descEl = document.getElementById('prodLogDescription');
        if (descEl) descEl.value = '';
        const ctEl = document.getElementById('prodLogCycleTime');
        if (ctEl) ctEl.value = '';
        recalcProdLog();
    }

    async function initProdLog() {
        if (!document.getElementById('prodLogDate').value) {
            document.getElementById('prodLogDate').valueAsDate = new Date();
        }
        
        // Fetch dependencies independently so one failure never blocks the others
        const [machData, opData, setterData, schedData, pmData, shiftData, partsData] = await Promise.all([
            fetch('/api/machines').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/operators').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/setters').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/schedules').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/partmaster').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/shifts').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('/api/parts').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        prodLogAllMachines = machData || [];
        prodLogAllOperators = opData || [];
        prodLogAllSetters = setterData || [];
        prodLogSchedules = (schedData || []).filter(s => s.status === 'Pending' || !s.status);
        prodLogAllPartMasters = pmData || [];
        prodLogAllPartsFallback = partsData || [];

        // Populate Shift dropdown
        const shiftSelect = document.getElementById('prodLogShift');
        if (shiftSelect && shiftData && shiftData.length > 0) {
            const currentShift = shiftSelect.value;
            shiftSelect.innerHTML = '<option value="">-- Select Shift --</option>';
            shiftData.forEach(s => {
                const shiftLabel = `${s.name} (${s.hours} Hrs)`;
                const opt = document.createElement('option');
                opt.value = shiftLabel;
                opt.textContent = shiftLabel;
                shiftSelect.appendChild(opt);
            });
            if (currentShift && shiftData.some(s => `${s.name} (${s.hours} Hrs)` === currentShift || s.name === currentShift)) {
                shiftSelect.value = currentShift;
            } else if (shiftSelect.options.length > 1) {
                shiftSelect.selectedIndex = 1;
            }
        }

        const currentDept = document.getElementById('prodLogDept')?.value || '';
        populateProdLogDeptFields(currentDept);
        
        fetchProdLogs();
    }

    document.getElementById('prodLogDept')?.addEventListener('change', (e) => {
        populateProdLogDeptFields(e.target.value);
    });

    document.getElementById('prodLogPartNo')?.addEventListener('change', async (e) => {
        if (!prodLogPartNoSelect) {
            await handleProdLogPartChange(e.target.value);
        }
    });

    document.getElementById('prodLogOpnNo')?.addEventListener('change', (e) => {
        const opn_no = String(e.target.value).trim();
        const op = currentPartOperations.find(o => String(o.opn_no).trim() === opn_no);
        if (op) {
            document.getElementById('prodLogDescription').value = op.description || '';
            document.getElementById('prodLogCycleTime').value = op.cycle_time || 0;
            recalcProdLog();
        }
    });

    function recalcProdLog() {
        const runtime = parseFloat(document.getElementById('prodLogRuntime').value) || 0;
        const prodQty = parseFloat(document.getElementById('prodLogProdQty').value) || 0;
        const cycleTime = parseFloat(document.getElementById('prodLogCycleTime').value) || 0;
        
        let targetQty = 0;
        if (cycleTime > 0) {
            targetQty = (runtime * 60) / cycleTime;
            document.getElementById('prodLogTargetQty').value = Math.floor(targetQty);
        } else {
            document.getElementById('prodLogTargetQty').value = '';
        }
        
        if (targetQty > 0) {
            const eff = (prodQty / targetQty) * 100;
            document.getElementById('prodLogEfficiency').value = eff.toFixed(2);
        } else {
            document.getElementById('prodLogEfficiency').value = '';
        }
    }

    document.getElementById('prodLogRuntime').addEventListener('input', recalcProdLog);
    document.getElementById('prodLogProdQty').addEventListener('input', recalcProdLog);

    function validateHours() {
        const shiftName = document.getElementById('prodLogShift').value;
        const shiftObj = allShifts.find(s => s.name === shiftName);
        const maxHours = shiftObj ? parseFloat(shiftObj.hours || 0) : 0;
        
        const warningEl = document.getElementById('prodLogHoursWarning');
        if (!warningEl) return;
        
        if (maxHours === 0) {
            warningEl.style.display = 'none';
            return;
        }

        const runtime = parseFloat(document.getElementById('prodLogRuntime').value) || 0;
        const idle1 = parseFloat(document.getElementById('prodLogIdleHours').value) || 0;
        const idle2 = parseFloat(document.getElementById('prodLogIdleHours2').value) || 0;
        const idle3 = parseFloat(document.getElementById('prodLogIdleHours3').value) || 0;
        const totalCurrent = runtime + idle1 + idle2 + idle3;
        
        const continueOp = document.getElementById('prodLogContinueOperator') ? document.getElementById('prodLogContinueOperator').value : 'n';
        
        let totalToValidate = totalCurrent;
        if (continueOp === 'y') {
            totalToValidate += currentOperatorSessionHours;
        }
        
        if (totalToValidate > maxHours) {
            warningEl.innerText = `Run time & Idle time more than log hours (${maxHours})`;
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }
    }

    ['prodLogShift', 'prodLogRuntime', 'prodLogIdleHours', 'prodLogIdleHours2', 'prodLogIdleHours3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validateHours);
    });
    const continueOpEl = document.getElementById('prodLogContinueOperator');
    if (continueOpEl) continueOpEl.addEventListener('change', validateHours);

    async function fetchProdLogs() {
        try {
            const res = await fetch('/api/prodlog');
            const data = await res.json();
            const tbody = document.getElementById('prodLogBody');
            tbody.innerHTML = '';
            data.forEach(log => {
                let totalIdle = log.idle_hours || 0;
                if (log.idle_hours_2) totalIdle += log.idle_hours_2;
                if (log.idle_hours_3) totalIdle += log.idle_hours_3;

                // Pre-fill a map with 0 for all specific reasons
                const idleMap = {
                    "No load": 0, "No Operator": 0, "Setting": 0, "Setup": 0,
                    "No power": 0, "Tool issue": 0, "Quality issue": 0,
                    "fixture issue": 0, "Machine bd": 0, "misc": 0,
                    "Npd": 0, "rework": 0, "no plan": 0, "setter": 0
                };

                if (log.idle_reason && idleMap[log.idle_reason] !== undefined) {
                    idleMap[log.idle_reason] += log.idle_hours || 0;
                }
                if (log.idle_reason_2 && idleMap[log.idle_reason_2] !== undefined) {
                    idleMap[log.idle_reason_2] += log.idle_hours_2 || 0;
                }
                if (log.idle_reason_3 && idleMap[log.idle_reason_3] !== undefined) {
                    idleMap[log.idle_reason_3] += log.idle_hours_3 || 0;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.date ? log.date.split('-').reverse().join('/') : ''}</td>
                    <td>${log.dept}</td>
                    <td>${log.shift}</td>
                    <td>${log.setter || ''}</td>
                    <td>${log.partno}</td>
                    <td>${log.opn_no}</td>
                    <td>${log.description || ''}</td>
                    <td>${log.machine}</td>
                    <td>${log.operator || ''}</td>
                    <td>${log.multiple_mc || 1}</td>
                    <td>${log.cycle_time || ''}</td>
                    <td>${log.runtime || ''}</td>
                    <td>${log.target_qty || ''}</td>
                    <td><span style="font-weight:bold;color:var(--primary);">${log.prod_qty}</span></td>
                    <td>${log.efficiency}%</td>
                    <td><span style="font-weight:bold;">${totalIdle.toFixed(2)}</span></td>
                    <td>${idleMap["No load"] || ''}</td>
                    <td>${idleMap["No Operator"] || ''}</td>
                    <td>${idleMap["Setting"] || ''}</td>
                    <td>${idleMap["Setup"] || ''}</td>
                    <td>${idleMap["No power"] || ''}</td>
                    <td>${idleMap["Tool issue"] || ''}</td>
                    <td>${idleMap["Quality issue"] || ''}</td>
                    <td>${idleMap["fixture issue"] || ''}</td>
                    <td>${idleMap["Machine bd"] || ''}</td>
                    <td>${idleMap["misc"] || ''}</td>
                    <td>${idleMap["Npd"] || ''}</td>
                    <td>${idleMap["rework"] || ''}</td>
                    <td>${idleMap["no plan"] || ''}</td>
                    <td>${idleMap["setter"] || ''}</td>
                `;
                
                const actionTd = document.createElement('td');
                actionTd.style.whiteSpace = 'nowrap';

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-text';
                editBtn.style.color = 'var(--primary-color, #2563eb)';
                editBtn.style.marginRight = '8px';
                editBtn.textContent = 'Edit Date';
                editBtn.onclick = () => openEditProdLogDateModal(log.id, log.date);
                actionTd.appendChild(editBtn);

                const editMachineBtn = document.createElement('button');
                editMachineBtn.className = 'btn-text';
                editMachineBtn.style.color = 'var(--primary-color, #2563eb)';
                editMachineBtn.style.marginRight = '8px';
                editMachineBtn.textContent = 'Edit Machine';
                editMachineBtn.onclick = () => openEditProdLogMachineModal(log.id, log.machine, log.dept);
                actionTd.appendChild(editMachineBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-text';
                delBtn.style.color = 'var(--danger-color)';
                delBtn.textContent = 'Delete';
                delBtn.onclick = async () => {
                    if (confirm('Are you sure you want to delete this log?')) {
                        try {
                            const delRes = await fetch(`/api/prodlog/${log.id}`, { method: 'DELETE' });
                            if (delRes.ok) {
                                fetchProdLogs();
                            } else {
                                alert('Error deleting log.');
                            }
                        } catch (err) {
                            console.error(err);
                            alert('Error deleting log.');
                        }
                    }
                };
                actionTd.appendChild(delBtn);
                tr.appendChild(actionTd);
                
                tbody.appendChild(tr);
            });
            applyProdLogHeaderFilters();
        } catch (e) { console.error(e); }
    }

    const prodLogMachineIdle = document.getElementById('prodLogMachineIdle');
    const prodLogProdFields = document.getElementById('prodLogProdFields');

    function toggleMachineIdleMode() {
        if (!prodLogMachineIdle || !prodLogProdFields) return;
        const isIdle = prodLogMachineIdle.value === 'y';
        if (isIdle) {
            prodLogProdFields.style.display = 'none';
            ['prodLogOperator', 'prodLogPartNo', 'prodLogOpnNo', 'prodLogRuntime', 'prodLogProdQty'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.removeAttribute('required');
            });
        } else {
            prodLogProdFields.style.display = 'grid';
            ['prodLogOperator', 'prodLogPartNo', 'prodLogOpnNo', 'prodLogRuntime', 'prodLogProdQty'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('required', 'required');
            });
        }
        validateHours();
    }

    if (prodLogMachineIdle) {
        prodLogMachineIdle.addEventListener('change', toggleMachineIdleMode);
    }

    const prodLogForm = document.getElementById('prodLogForm');
    if (prodLogForm) {
        prodLogForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isIdle = document.getElementById('prodLogMachineIdle') ? document.getElementById('prodLogMachineIdle').value === 'y' : false;

            if (isIdle) {
                const idleHrs = parseFloat(document.getElementById('prodLogIdleHours').value) || 0;
                const idleRsn = document.getElementById('prodLogIdleReason').value;
                if (idleHrs <= 0) {
                    alert('Please enter Idle Hours for the idle machine.');
                    return;
                }
                if (!idleRsn || idleRsn === 'None') {
                    alert('Please select an Idle Reason.');
                    return;
                }
            }

            const data = {
                dept: document.getElementById('prodLogDept').value,
                date: document.getElementById('prodLogDate').value,
                shift: document.getElementById('prodLogShift').value,
                setter: document.getElementById('prodLogSetter').value,
                machine: document.getElementById('prodLogMachine').value,
                operator: isIdle ? "" : document.getElementById('prodLogOperator').value,
                multiple_mc: isIdle ? 1 : (parseInt(document.getElementById('prodLogMultipleMc').value) || 1),
                partno: isIdle ? "MACHINE IDLE" : (prodLogPartNoSelect ? prodLogPartNoSelect.getValue() : (document.getElementById('prodLogPartNo')?.value || '')),
                opn_no: isIdle ? "IDLE" : document.getElementById('prodLogOpnNo').value,
                description: isIdle ? (document.getElementById('prodLogIdleReason').value || "Machine Idle") : document.getElementById('prodLogDescription').value,
                cycle_time: isIdle ? 0 : (parseFloat(document.getElementById('prodLogCycleTime').value) || 0),
                runtime: isIdle ? 0 : (parseFloat(document.getElementById('prodLogRuntime').value) || 0),
                target_qty: isIdle ? 0 : (parseFloat(document.getElementById('prodLogTargetQty').value) || 0),
                prod_qty: isIdle ? 0 : (parseFloat(document.getElementById('prodLogProdQty').value) || 0),
                efficiency: isIdle ? 0 : (parseFloat(document.getElementById('prodLogEfficiency').value) || 0),
                idle_hours: parseFloat(document.getElementById('prodLogIdleHours').value) || 0,
                idle_reason: document.getElementById('prodLogIdleReason').value,
                idle_hours_2: isIdle ? 0 : (parseFloat(document.getElementById('prodLogIdleHours2').value) || 0),
                idle_reason_2: isIdle ? "None" : document.getElementById('prodLogIdleReason2').value,
                idle_hours_3: isIdle ? 0 : (parseFloat(document.getElementById('prodLogIdleHours3').value) || 0),
                idle_reason_3: isIdle ? "None" : document.getElementById('prodLogIdleReason3').value
            };
            
            try {
                const response = await fetch('/api/prodlog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    alert(isIdle ? 'Machine Idle Log saved successfully!' : 'Production Log saved!');
                    
                    const continueOp = document.getElementById('prodLogContinueOperator') ? document.getElementById('prodLogContinueOperator').value : 'n';
                    
                    if (continueOp === 'y' && !isIdle) {
                        const savedDept = data.dept;
                        const savedDate = data.date;
                        const savedShift = data.shift;
                        const savedSetter = data.setter;
                        const savedOperator = data.operator;
                        
                        prodLogForm.reset();
                        
                        document.getElementById('prodLogDept').value = savedDept;
                        document.getElementById('prodLogDate').value = savedDate;
                        document.getElementById('prodLogShift').value = savedShift;
                        document.getElementById('prodLogSetter').value = savedSetter;
                        document.getElementById('prodLogOperator').value = savedOperator;
                        document.getElementById('prodLogContinueOperator').value = 'y';
                        currentOperatorSessionHours += (
                            (parseFloat(data.runtime) || 0) + 
                            (parseFloat(data.idle_hours) || 0) + 
                            (parseFloat(data.idle_hours_2) || 0) + 
                            (parseFloat(data.idle_hours_3) || 0)
                        );
                    } else {
                        currentOperatorSessionHours = 0;
                        const savedDate = document.getElementById('prodLogDate').value;
                        prodLogForm.reset();
                        if (savedDate) document.getElementById('prodLogDate').value = savedDate;
                        else document.getElementById('prodLogDate').valueAsDate = new Date();
                        if (document.getElementById('prodLogContinueOperator')) {
                            document.getElementById('prodLogContinueOperator').value = 'n';
                        }
                    }
                    toggleMachineIdleMode();
                    validateHours();
                    
                    fetchProdLogs();
                } else {
                    alert('Error saving Prod Log');
                }
            } catch (err) { console.error(err); }
        });
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.classList.contains('prod-log-col-filter')) {
            applyProdLogHeaderFilters();
        }
    });

    function applyProdLogHeaderFilters() {
        const filters = {};
        document.querySelectorAll('.prod-log-col-filter').forEach(input => {
            const val = input.value.trim().toLowerCase();
            if (val) {
                filters[input.getAttribute('data-col')] = val;
            }
        });

        const rows = document.querySelectorAll('#prodLogBody tr');
        rows.forEach(tr => {
            const cells = tr.children;
            let show = true;
            for (const colIdx in filters) {
                const cell = cells[parseInt(colIdx)];
                if (cell) {
                    const cellText = (cell.textContent || '').trim().toLowerCase();
                    if (!cellText.includes(filters[colIdx])) {
                        show = false;
                        break;
                    }
                }
            }
            tr.style.display = show ? '' : 'none';
        });
    }

    const prodLogTableFilterDate = document.getElementById('prodLogTableFilterDate');
    const clearProdLogFilterDateBtn = document.getElementById('clearProdLogFilterDateBtn');

    if (prodLogTableFilterDate) {
        prodLogTableFilterDate.addEventListener('change', (e) => {
            const dateVal = e.target.value;
            const dateHeaderInput = document.querySelector('.prod-log-col-filter[data-col="0"]');
            if (dateHeaderInput) {
                if (dateVal) {
                    const parts = dateVal.split('-');
                    const fmtDate = `${parts[2]}/${parts[1]}`;
                    dateHeaderInput.value = fmtDate;
                } else {
                    dateHeaderInput.value = '';
                }
                applyProdLogHeaderFilters();
            }
        });
    }

    if (clearProdLogFilterDateBtn) {
        clearProdLogFilterDateBtn.addEventListener('click', () => {
            if (prodLogTableFilterDate) prodLogTableFilterDate.value = '';
            const dateHeaderInput = document.querySelector('.prod-log-col-filter[data-col="0"]');
            if (dateHeaderInput) dateHeaderInput.value = '';
            applyProdLogHeaderFilters();
        });
    }

    const exportProdLogBtn = document.getElementById('exportProdLogBtn');
    if (exportProdLogBtn) {
        exportProdLogBtn.addEventListener('click', () => {
            const table = document.getElementById('prodLogTable');
            if (!table) return;
            const wb = XLSX.utils.table_to_book(table, {sheet: "Prod Logs"});
            XLSX.writeFile(wb, `Production_Logs_${new Date().toISOString().slice(0,10)}.xlsx`);
        });
    }

    // --- Edit Prod Log Date Modal Logic ---
    const editProdLogDateModal = document.getElementById('editProdLogDateModal');
    const editProdLogDateForm = document.getElementById('editProdLogDateForm');
    const closeEditProdLogDateModalBtn = document.getElementById('closeEditProdLogDateModalBtn');
    const cancelEditProdLogDateBtn = document.getElementById('cancelEditProdLogDateBtn');

    function openEditProdLogDateModal(logId, currentDate) {
        if (!editProdLogDateModal) return;
        document.getElementById('editProdLogId').value = logId;
        document.getElementById('editProdLogDateInput').value = currentDate || new Date().toISOString().split('T')[0];
        editProdLogDateModal.classList.add('show');
    }

    function closeEditProdLogDateModal() {
        if (editProdLogDateModal) editProdLogDateModal.classList.remove('show');
    }

    if (closeEditProdLogDateModalBtn) closeEditProdLogDateModalBtn.addEventListener('click', closeEditProdLogDateModal);
    if (cancelEditProdLogDateBtn) cancelEditProdLogDateBtn.addEventListener('click', closeEditProdLogDateModal);

    if (editProdLogDateForm) {
        editProdLogDateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const logId = document.getElementById('editProdLogId').value;
            const newDate = document.getElementById('editProdLogDateInput').value;
            if (!logId || !newDate) return;

            try {
                const res = await fetch(`/api/prodlog/${logId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: newDate })
                });
                if (res.ok) {
                    closeEditProdLogDateModal();
                    fetchProdLogs();
                } else {
                    alert('Failed to update log date.');
                }
            } catch (err) {
                console.error(err);
                alert('Error updating log date.');
            }
        });
    }

    // --- Edit Prod Log Machine Modal Logic ---
    const editProdLogMachineModal = document.getElementById('editProdLogMachineModal');
    const editProdLogMachineForm = document.getElementById('editProdLogMachineForm');
    const closeEditProdLogMachineModalBtn = document.getElementById('closeEditProdLogMachineModalBtn');
    const cancelEditProdLogMachineBtn = document.getElementById('cancelEditProdLogMachineBtn');

    async function openEditProdLogMachineModal(logId, currentMachine, dept) {
        if (!editProdLogMachineModal) return;
        document.getElementById('editProdLogMachineId').value = logId;
        
        if (!prodLogAllMachines || prodLogAllMachines.length === 0) {
            try {
                const machRes = await fetch('/api/machines');
                prodLogAllMachines = await machRes.json();
            } catch(e) { console.error(e); }
        }
        
        const select = document.getElementById('editProdLogMachineSelect');
        select.innerHTML = '<option value="">-- Select Machine --</option>';
        
        const cleanDept = (dept || '').trim().toUpperCase();
        let filteredMachines = prodLogAllMachines;
        if (cleanDept) {
            const matches = prodLogAllMachines.filter(m => (m.department || '').trim().toUpperCase() === cleanDept);
            if (matches.length > 0) filteredMachines = matches;
        }
        
        filteredMachines.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            if (m.name === currentMachine) opt.selected = true;
            select.appendChild(opt);
        });

        editProdLogMachineModal.classList.add('show');
    }

    function closeEditProdLogMachineModal() {
        if (editProdLogMachineModal) editProdLogMachineModal.classList.remove('show');
    }

    if (closeEditProdLogMachineModalBtn) closeEditProdLogMachineModalBtn.addEventListener('click', closeEditProdLogMachineModal);
    if (cancelEditProdLogMachineBtn) cancelEditProdLogMachineBtn.addEventListener('click', closeEditProdLogMachineModal);

    if (editProdLogMachineForm) {
        editProdLogMachineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const logId = document.getElementById('editProdLogMachineId').value;
            const newMachine = document.getElementById('editProdLogMachineSelect').value;
            if (!logId || !newMachine) return;

            try {
                const res = await fetch(`/api/prodlog/${logId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ machine: newMachine })
                });
                if (res.ok) {
                    closeEditProdLogMachineModal();
                    fetchProdLogs();
                } else {
                    alert('Failed to update log machine.');
                }
            } catch (err) {
                console.error(err);
                alert('Error updating log machine.');
            }
        });
    }

    // --- RM Logs Fetch Logic ---
    async function fetchRmLogs(type) {
        try {
            const res = await fetch('/api/rawmateriallogs');
            const logs = await res.json();
            const filteredLogs = logs.filter(l => l.type === type);
            filteredLogs.sort((a, b) => {
                const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
                if (dateDiff !== 0) return dateDiff;

                if (type === 'despatch') {
                    const parseDc = (dc) => {
                        if (!dc) return 0;
                        const num = parseInt(String(dc).replace(/\D/g, ''), 10);
                        return isNaN(num) ? 0 : num;
                    };
                    const dcDiff = parseDc(b.dc_no) - parseDc(a.dc_no);
                    if (dcDiff !== 0) return dcDiff;
                }

                return (b.id || 0) - (a.id || 0);
            });
            
            const tbodyId = type === 'receipt' ? 'rmReceiptBody' : 'rmDespatchBody';
            const tbody = document.getElementById(tbodyId);
            if (tbody) {
                tbody.innerHTML = '';
                filteredLogs.forEach(log => {
                    const tr = document.createElement('tr');
                    let extraCols = '';
                    const encodedLog = encodeURIComponent(JSON.stringify(log));
                    let actionBtns = `
                        <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 4px;" onclick="editRmLog(JSON.parse(decodeURIComponent('${encodedLog}')))">Edit</button>
                        <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;" onclick="deleteRmLog(${log.id}, '${type}')">Delete</button>
                    `;
                    if (type === 'despatch') {
                        let prefixVal = log.part_prefix || '';
                        if (!prefixVal && globalPartMasters.length > 0 && log.finish_part_no) {
                            const matchedPm = globalPartMasters.find(pm => (pm.partno || '').trim().toLowerCase() === (log.finish_part_no || '').trim().toLowerCase());
                            if (matchedPm) prefixVal = matchedPm.part_prefix || '';
                        }
                        extraCols = `
                            <td>${log.dc_type || '-'}</td>
                            <td>${log.forge_pn}</td>
                            <td>${log.finish_part_no || '-'}</td>
                            <td>${prefixVal || '-'}</td>
                            <td>${log.dc_no || '-'}</td>
                        `;
                        actionBtns += `
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; color: #0284c7; border-color: #0284c7; margin-left: 4px;" onclick="exportDeliveryChallanToExcel(JSON.parse(decodeURIComponent('${encodedLog}')))">Print</button>
                        `;
                    }
                    tr.innerHTML = `
                        <td>${log.date}</td>
                        ${type === 'receipt' ? `<td>${log.forge_pn}</td>` : extraCols}
                        <td>${log.qty}</td>
                        <td>
                            ${actionBtns}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.editRmLog = async (log) => {
        if (!log) return;
        const isReceipt = log.type === 'receipt';
        document.getElementById('rmLogModalTitle').innerText = isReceipt ? 'Edit Receipt' : 'Edit Despatch';
        document.getElementById('rmLogId').value = log.id;
        document.getElementById('rmLogType').value = log.type;
        document.getElementById('rmLogDate').value = log.date || '';
        document.getElementById('rmLogQty').value = log.qty || 1;

        if (allRawMaterials.length === 0) {
            try {
                const rRes = await fetch('/api/rawmaterials');
                allRawMaterials = await rRes.json();
            } catch(e) {}
        }

        const selectEl = document.getElementById('rmLogForgePn');
        selectEl.innerHTML = '<option value="">-- Select Forge PN --</option>';
        const forgePnSet = new Set(allRawMaterials.map(rm => rm.forge_pn));
        if (log.forge_pn) forgePnSet.add(log.forge_pn);

        Array.from(forgePnSet).sort().forEach(fpn => {
            const opt = document.createElement('option');
            opt.value = fpn;
            opt.textContent = fpn;
            if (log.forge_pn && log.forge_pn.trim().toLowerCase() === fpn.trim().toLowerCase()) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        });

        if (rmLogForgePnSelect) {
            rmLogForgePnSelect.destroy();
        }
        rmLogForgePnSelect = new TomSelect(selectEl, {
            create: true,
            sortField: { field: "text", direction: "asc" }
        });
        if (log.forge_pn) {
            rmLogForgePnSelect.setValue(log.forge_pn);
        }

        if (isReceipt) {
            if (document.getElementById('rmLogDcTypeGroup')) document.getElementById('rmLogDcTypeGroup').style.display = 'none';
            document.getElementById('rmLogDcNoGroup').style.display = 'none';
            document.getElementById('rmLogFinishPartNoGroup').style.display = 'none';
            if (document.getElementById('rmLogPartPrefixGroup')) document.getElementById('rmLogPartPrefixGroup').style.display = 'none';
        } else {
            if (document.getElementById('rmLogDcTypeGroup')) document.getElementById('rmLogDcTypeGroup').style.display = 'block';
            if (document.getElementById('rmLogDcType')) document.getElementById('rmLogDcType').value = log.dc_type || 'Mfg-spider';
            document.getElementById('rmLogDcNoGroup').style.display = 'block';
            document.getElementById('rmLogFinishPartNoGroup').style.display = 'block';
            if (document.getElementById('rmLogPartPrefixGroup')) document.getElementById('rmLogPartPrefixGroup').style.display = 'block';
            document.getElementById('rmLogDcNo').value = log.dc_no || '';

            if (globalPartMasters.length === 0) {
                try {
                    const pmRes = await fetch('/api/partmaster');
                    globalPartMasters = await pmRes.json();
                } catch(e) {}
            }

            let initialPrefix = log.part_prefix || '';
            if (!initialPrefix && log.finish_part_no) {
                const matchedPm = globalPartMasters.find(pm => (pm.partno || '').trim().toLowerCase() === (log.finish_part_no || '').trim().toLowerCase());
                if (matchedPm) initialPrefix = matchedPm.part_prefix || '';
            }
            if (document.getElementById('rmLogPartPrefix')) document.getElementById('rmLogPartPrefix').value = initialPrefix;

            const fpSelectEl = document.getElementById('rmLogFinishPartNo');
            fpSelectEl.innerHTML = '<option value="">-- Select Finish Part No --</option>';
            const partSet = new Set(globalPartMasters.map(pm => pm.partno));
            if (log.finish_part_no) partSet.add(log.finish_part_no);

            Array.from(partSet).sort().forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (log.finish_part_no && log.finish_part_no.trim().toLowerCase() === p.trim().toLowerCase()) {
                    opt.selected = true;
                }
                fpSelectEl.appendChild(opt);
            });

            if (rmLogFinishPartNoSelect) {
                rmLogFinishPartNoSelect.destroy();
            }
            rmLogFinishPartNoSelect = new TomSelect(fpSelectEl, {
                create: false,
                sortField: { field: "text", direction: "asc" }
            });
            if (log.finish_part_no) {
                rmLogFinishPartNoSelect.setValue(log.finish_part_no);
            }

            rmLogFinishPartNoSelect.on('change', (val) => {
                if (!val) return;
                const cleanVal = val.trim().toLowerCase();
                const selected = globalPartMasters.find(p => (p.partno || '').trim().toLowerCase() === cleanVal);
                if (selected) {
                    if (selected.part_prefix && document.getElementById('rmLogPartPrefix')) {
                        document.getElementById('rmLogPartPrefix').value = selected.part_prefix;
                    }
                    if (selected.forge_pn) {
                        const targetForgePn = selected.forge_pn.trim();
                        if (rmLogForgePnSelect) {
                            let matchKey = Object.keys(rmLogForgePnSelect.options).find(k => k.trim().toLowerCase() === targetForgePn.toLowerCase());
                            if (!matchKey) {
                                const normTarget = targetForgePn.replace(/[\s\-_#]/g, '').toLowerCase();
                                matchKey = Object.keys(rmLogForgePnSelect.options).find(k => k.replace(/[\s\-_#]/g, '').toLowerCase() === normTarget);
                            }

                            if (matchKey) {
                                rmLogForgePnSelect.setValue(matchKey);
                            } else {
                                rmLogForgePnSelect.addOption({ value: targetForgePn, text: targetForgePn });
                                rmLogForgePnSelect.setValue(targetForgePn);
                            }
                        }
                    }
                }
            });
        }

        document.getElementById('rmLogModal').classList.add('show');
    };

    async function autoGenerateRmDcNo() {
        const type = document.getElementById('rmLogType')?.value;
        if (type !== 'despatch') return;
        const isEdit = !!document.getElementById('rmLogId')?.value;
        if (isEdit) return;

        const dcType = document.getElementById('rmLogDcType')?.value || 'Mfg-spider';
        const dateVal = document.getElementById('rmLogDate')?.value || new Date().toISOString().split('T')[0];

        try {
            const res = await fetch('/api/rawmateriallogs');
            const logs = await res.json();
            const despatchLogs = logs.filter(l => l.type === 'despatch');

            let maxSeq = 0;
            despatchLogs.forEach(l => {
                const lDcType = l.dc_type;
                const dcStr = String(l.dc_no || '').trim();
                if (!dcStr) return;

                let isMatch = false;
                if (lDcType) {
                    isMatch = (lDcType === dcType);
                } else {
                    if (dcType === 'Mfg-spider' && /^\d{4}-\d+$/.test(dcStr)) isMatch = true;
                    else if (dcType === 'AAL-Labour' && /^\d+\/\d{2}-\d{2}$/.test(dcStr)) isMatch = true;
                    else if (dcType === 'sub-con' && /^MD\d+-\d+$/i.test(dcStr)) isMatch = true;
                    else if (dcType === 'Labour-jobs' && /^\d+$/.test(dcStr)) isMatch = true;
                }

                if (isMatch) {
                    let seq = 0;
                    if (dcType === 'Mfg-spider') {
                        const m = dcStr.match(/(\d+)$/);
                        if (m) seq = parseInt(m[1], 10);
                    } else if (dcType === 'AAL-Labour') {
                        const m = dcStr.match(/^(\d+)\//);
                        if (m) seq = parseInt(m[1], 10);
                    } else if (dcType === 'sub-con') {
                        const m = dcStr.match(/(\d+)$/);
                        if (m) seq = parseInt(m[1], 10);
                    } else if (dcType === 'Labour-jobs') {
                        const m = dcStr.match(/^(\d+)$/);
                        if (m) seq = parseInt(m[1], 10);
                    }
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            });

            const nextSeq = maxSeq + 1;
            const paddedSeq = String(nextSeq).padStart(3, '0');

            const dObj = new Date(dateVal);
            const fullYear = isNaN(dObj.getFullYear()) ? new Date().getFullYear() : dObj.getFullYear();
            const month = isNaN(dObj.getMonth()) ? (new Date().getMonth() + 1) : (dObj.getMonth() + 1);

            let fyStart = month >= 4 ? fullYear : fullYear - 1;
            let fyCode = String(fyStart).slice(-2) + '-' + String((fyStart + 1) % 100).padStart(2, '0');
            let fyCodeNoDash = 'MD' + String(fyStart).slice(-2) + String((fyStart + 1) % 100).padStart(2, '0');

            let generatedDcNo = '';
            if (dcType === 'Mfg-spider') {
                generatedDcNo = `${fullYear}-${paddedSeq}`;
            } else if (dcType === 'AAL-Labour') {
                generatedDcNo = `${paddedSeq}/${fyCode}`;
            } else if (dcType === 'Labour-jobs') {
                generatedDcNo = `${paddedSeq}`;
            } else if (dcType === 'sub-con') {
                generatedDcNo = `${fyCodeNoDash}-${paddedSeq}`;
            }

            const dcNoInput = document.getElementById('rmLogDcNo');
            if (dcNoInput) {
                dcNoInput.value = generatedDcNo;
            }
        } catch (err) {
            console.error('Error in autoGenerateRmDcNo:', err);
        }
    }

    document.getElementById('rmLogDcType')?.addEventListener('change', autoGenerateRmDcNo);
    document.getElementById('rmLogDate')?.addEventListener('change', autoGenerateRmDcNo);

    function getFinYear(dateStr) {
        if (!dateStr) return '2026-27';
        const parts = dateStr.split('-');
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        if (isNaN(year)) year = 2026;
        if (isNaN(month)) month = 8;
        if (month < 4) {
            return `${year - 1}-${(year) % 100}`;
        } else {
            return `${year}-${(year + 1) % 100}`;
        }
    }

    window.exportDeliveryChallanToExcel = async (item) => {
        const dcNo = item.dc_no && item.dc_no !== '-' ? item.dc_no : '';
        const dateParts = (item.date || '').split('-');
        let dateFormatted = item.date;
        if (dateParts.length === 3) {
            dateFormatted = `${parseInt(dateParts[2])}/${parseInt(dateParts[1])}/${dateParts[0]}`;
        }
        const forgePn = item.forge_pn || '';
        const finishPartNo = item.finish_part_no || '';
        let partPrefix = item.part_prefix || '';
        if (!partPrefix && finishPartNo) {
            if (globalPartMasters.length === 0) {
                try {
                    const pmRes = await fetch('/api/partmaster');
                    globalPartMasters = await pmRes.json();
                } catch(e) {}
            }
            const matchedPm = globalPartMasters.find(pm => (pm.partno || '').trim().toLowerCase() === finishPartNo.trim().toLowerCase());
            if (matchedPm) partPrefix = matchedPm.part_prefix || '';
        }
        const qty = item.qty || 0;

        // 10 empty lines for rows 1 to 10
        let txtContent = '\r\n'.repeat(10);
        // Row 11: Date, DC No, Forge Part No, Finish Part No, Part Prefix, Qty (Tab separated)
        txtContent += `${dateFormatted}\t${dcNo}\t${forgePn}\t${finishPartNo}\t${partPrefix}\t${qty}\r\n`;

        // Modern File System Access API allows selecting & overwriting dc.txt directly
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'dc.txt',
                    types: [{
                        description: 'Text Document (*.txt)',
                        accept: { 'text/plain': ['.txt'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(txtContent);
                await writable.close();
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('showSaveFilePicker fallback:', err);
            }
        }

        // Fallback for older browsers
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'dc.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    window.deleteRmLog = async (id, type) => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete this record?')) {
            try {
                const res = await fetch(`/api/rawmateriallogs/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    fetchRmLogs(type);
                    if (typeof fetchRawMaterials === 'function') fetchRawMaterials();
                } else {
                    alert('Failed to delete log record');
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    // --- RAW MATERIAL LOGIC ---
    async function fetchRawMaterials() {
        try {
            const res = await fetch('/api/rawmaterials');
            allRawMaterials = await res.json();
            renderRawMaterials();
        } catch (e) {
            console.error('Error fetching raw materials', e);
        }
    }

    function renderRawMaterials() {
        const tbody = document.getElementById('rawMaterialsBody');
        if (!tbody) return;

        const filterVal = (document.getElementById('rmForgePnFilter')?.value || '').trim().toUpperCase();
        const clearBtn = document.getElementById('clearRmForgeFilterBtn');
        if (clearBtn) {
            clearBtn.style.display = filterVal ? 'inline-block' : 'none';
        }

        const filtered = (allRawMaterials || []).filter(rm => {
            if (!filterVal) return true;
            const fpn = (rm.forge_pn || '').trim().toUpperCase();
            const normFilter = filterVal.replace(/[\s\-_#]/g, '');
            const normFpn = fpn.replace(/[\s\-_#]/g, '');
            return fpn.includes(filterVal) || normFpn.includes(normFilter);
        });

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1rem;">No matching raw materials found</td></tr>';
            return;
        }

        filtered.forEach(rm => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rm.forge_pn}</td>
                <td>${rm.receipt}</td>
                <td>${rm.despatch}</td>
                <td>${rm.stock}</td>
                <td class="action-col">
                    <button class="btn btn-primary btn-sm" onclick="editRawMaterial(${rm.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRawMaterial(${rm.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('rmForgePnFilter')?.addEventListener('input', renderRawMaterials);
    document.getElementById('clearRmForgeFilterBtn')?.addEventListener('click', () => {
        const filterInput = document.getElementById('rmForgePnFilter');
        if (filterInput) {
            filterInput.value = '';
            renderRawMaterials();
        }
    });

    const rawMaterialModal = document.getElementById('rawMaterialModal');
    const rawMaterialForm = document.getElementById('rawMaterialForm');
    if (rawMaterialForm) {
        rawMaterialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('rmId').value;
            const forge_pn = document.getElementById('rmForgePn').value;
            const quantity = parseInt(document.getElementById('rmQuantity').value) || 0;
            const despatch = parseInt(document.getElementById('rmDespatch').value) || 0;
            
            // Map quantity to receipt, stock is receipt - despatch
            const receipt = quantity;
            const stock = receipt - despatch;
            
            const payload = { forge_pn, receipt, despatch, stock };
            
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/rawmaterials/${id}` : '/api/rawmaterials';
            
            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    rawMaterialModal.classList.remove('show');
                    fetchRawMaterials();
                } else {
                    alert('Failed to save raw material');
                }
            } catch (e) {
                console.error(e);
            }
        });
        
        document.getElementById('closeRmModalBtn').addEventListener('click', () => {
            rawMaterialModal.classList.remove('show');
        });
        document.getElementById('cancelRmBtn').addEventListener('click', () => {
            rawMaterialModal.classList.remove('show');
        });
    }

    const rmLogModal = document.getElementById('rmLogModal');
    const rmLogForm = document.getElementById('rmLogForm');
    if (rmLogForm) {
        rmLogForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('rmLogId').value;
            const type = document.getElementById('rmLogType').value;
            const date = document.getElementById('rmLogDate').value;
            const dc_type = type === 'despatch' ? document.getElementById('rmLogDcType').value : null;
            const forge_pn = document.getElementById('rmLogForgePn').value;
            const dc_no = type === 'despatch' ? document.getElementById('rmLogDcNo').value : null;
            const finish_part_no = type === 'despatch' ? document.getElementById('rmLogFinishPartNo').value : null;
            const part_prefix = type === 'despatch' ? (document.getElementById('rmLogPartPrefix') ? document.getElementById('rmLogPartPrefix').value : '') : null;
            const qty = parseInt(document.getElementById('rmLogQty').value) || 0;
            
            const payload = { type, date, dc_type, forge_pn, dc_no, finish_part_no, part_prefix, qty };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/rawmateriallogs/${id}` : '/api/rawmateriallogs';
            
            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    rmLogModal.classList.remove('show');
                    fetchRmLogs(type);
                    if (typeof fetchRawMaterials === 'function') fetchRawMaterials();
                } else {
                    alert('Failed to save log');
                }
            } catch (e) {
                console.error(e);
            }
        });
        
        document.getElementById('closeRmLogModalBtn').addEventListener('click', () => {
            rmLogModal.classList.remove('show');
        });
        document.getElementById('cancelRmLogBtn').addEventListener('click', () => {
            rmLogModal.classList.remove('show');
        });
    }

    window.editRawMaterial = (id) => {
        const rm = allRawMaterials.find(r => r.id === id);
        if (rm) {
            document.getElementById('rmModalTitle').innerText = 'Edit Raw Material';
            document.getElementById('rmId').value = rm.id;
            document.getElementById('rmForgePn').value = rm.forge_pn;
            document.getElementById('rmQuantity').value = rm.receipt;
            document.getElementById('rmDespatch').value = rm.despatch;
            rawMaterialModal.classList.add('show');
        }
    };

    window.deleteRawMaterial = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete this raw material?')) {
            try {
                const res = await fetch(`/api/rawmaterials/${id}`, { method: 'DELETE' });
                if (res.ok) fetchRawMaterials();
            } catch (e) {
                console.error(e);
            }
        }
    };

    document.getElementById('deleteAllRawMaterialsBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL items in RM Status? This action cannot be undone.')) {
            try {
                const res = await fetch('/api/rawmaterials/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All RM Status items deleted successfully!');
                    fetchRawMaterials();
                } else {
                    alert('Failed to delete RM Status items.');
                }
            } catch (err) {
                console.error(err);
                alert('Error deleting RM Status items.');
            }
        }
    });


    // --- USER MANAGEMENT LOGIC ---
    let allUsersList = [];

    async function fetchUsers() {
        try {
            const res = await fetch('/api/users');
            allUsersList = await res.json();
            const tbody = document.getElementById('usersBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            allUsersList.forEach(u => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.title = 'Click to view & edit rights';
                tr.innerHTML = `
                    <td>${u.id}</td>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.role}</td>
                    <td>
                        <button class="btn btn-outline edit-user-btn" style="margin-right: 5px; padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit Rights</button>
                        <button class="btn btn-outline" style="margin-right: 5px; padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="event.stopPropagation(); openChangePasswordModal(${u.id}, '${u.username}')">Change Password</button>
                        ${u.username !== 'admin' ? `<button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="event.stopPropagation(); deleteUser(${u.id})">Delete</button>` : ''}
                    </td>
                `;

                tr.addEventListener('click', () => populateUserRightsForm(u));
                tr.querySelector('.edit-user-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    populateUserRightsForm(u);
                });

                tbody.appendChild(tr);
            });
        } catch (e) { console.error(e); }
    }

    function populateUserRightsForm(user) {
        document.getElementById('editingUserId').value = user.id;
        document.getElementById('userFormTitle').innerText = `Edit Rights (${user.username})`;
        document.getElementById('userName').value = user.username;
        document.getElementById('userPass').value = '';
        document.getElementById('userPass').removeAttribute('required');
        document.getElementById('userPassLabel').innerText = 'Password (leave blank to keep current)';
        document.getElementById('userSubmitBtn').innerText = 'Save User Rights';
        document.getElementById('resetUserFormBtn').style.display = 'inline-block';

        let screens = [];
        try {
            screens = JSON.parse(user.accessible_screens || '[]');
        } catch(e) {}

        document.querySelectorAll('#userScreensList input[type="checkbox"]').forEach(chk => {
            if (chk.value === 'inventory') {
                chk.checked = screens.includes('inventory') || screens.includes('rawmaterial');
            } else if (chk.value === 'mfe') {
                chk.checked = screens.includes('mfe') || screens.includes('rfq') || screens.includes('sales');
            } else {
                chk.checked = screens.includes(chk.value);
            }
        });
    }

    function resetUserRightsForm() {
        document.getElementById('editingUserId').value = '';
        document.getElementById('userFormTitle').innerText = 'Create User';
        document.getElementById('userName').value = '';
        document.getElementById('userPass').value = '';
        document.getElementById('userPass').setAttribute('required', 'true');
        document.getElementById('userPassLabel').innerText = 'Password';
        document.getElementById('userSubmitBtn').innerText = 'Create User';
        document.getElementById('resetUserFormBtn').style.display = 'none';
        document.querySelectorAll('#userScreensList input[type="checkbox"]').forEach(chk => chk.checked = false);
    }

    document.getElementById('resetUserFormBtn')?.addEventListener('click', resetUserRightsForm);

    const userCreateForm = document.getElementById('userCreateForm');
    if (userCreateForm) {
        userCreateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editingId = document.getElementById('editingUserId').value;
            const username = document.getElementById('userName').value.trim();
            const password = document.getElementById('userPass').value.trim();

            const selectedScreens = Array.from(document.querySelectorAll('#userScreensList input[type="checkbox"]:checked')).map(cb => cb.value);
            const screensJson = JSON.stringify(selectedScreens);

            if (editingId) {
                const payload = {
                    username: username,
                    accessible_screens: screensJson
                };
                if (password) payload.password = password;

                try {
                    const res = await fetch(`/api/users/${editingId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        alert(`Rights updated for ${username}!`);
                        resetUserRightsForm();
                        fetchUsers();
                    } else {
                        const errData = await res.json();
                        alert(errData.detail || 'Error updating user');
                    }
                } catch(err) {
                    console.error(err);
                    alert('Error updating user');
                }
            } else {
                if (!password) {
                    alert('Password is required for new users.');
                    return;
                }
                const payload = {
                    username: username,
                    password: password,
                    accessible_screens: screensJson
                };

                try {
                    const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        alert('User created successfully!');
                        resetUserRightsForm();
                        fetchUsers();
                    } else {
                        const errData = await res.json();
                        alert(errData.detail || 'Error creating user');
                    }
                } catch(err) {
                    console.error(err);
                    alert('Error creating user');
                }
            }
        });
    }

    window.openChangePasswordModal = (userId, username) => {
        const modal = document.getElementById('changePasswordModal');
        if (!modal) return;
        document.getElementById('changePasswordUserId').value = userId;
        document.getElementById('changePasswordModalTitle').innerText = `Change Password for ${username}`;
        document.getElementById('newPasswordInput').value = '';
        modal.classList.add('show');
    };

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('changePasswordUserId').value;
            const newPassword = document.getElementById('newPasswordInput').value.trim();

            if (!newPassword) {
                alert('Please enter a new password');
                return;
            }

            try {
                const res = await fetch(`/api/users/${userId}/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: newPassword })
                });

                if (res.ok) {
                    alert('Password updated successfully!');
                    document.getElementById('changePasswordModal').classList.remove('show');
                } else {
                    const data = await res.json();
                    alert(data.detail || 'Error updating password');
                }
            } catch (err) {
                console.error(err);
                alert('Error updating password');
            }
        });
    }

    document.getElementById('closeChangePasswordModalBtn')?.addEventListener('click', () => {
        document.getElementById('changePasswordModal').classList.remove('show');
    });
    document.getElementById('cancelChangePasswordBtn')?.addEventListener('click', () => {
        document.getElementById('changePasswordModal').classList.remove('show');
    });
    
    // --- RM REQUIREMENT REPORT ---
    async function fetchRmRequirement() {
        try {
            const [schedRes, pmRes, rmRes] = await Promise.all([
                fetch('/api/schedule'),
                fetch('/api/partmaster'),
                fetch('/api/rawmaterials')
            ]);
            
            const schedules = await schedRes.json();
            const partMasters = await pmRes.json();
            const rawMaterials = await rmRes.json();
            
            const selectedDept = (document.getElementById('rmReqDept')?.value || '').trim().toUpperCase();
            const searchForgePn = (document.getElementById('rmReqForgePnInput')?.value || '').trim().toUpperCase();

            const reqs = {};
            // Only consider Pending schedules for requirement calculation
            const pendingSchedules = schedules.filter(s => s.status === 'Pending' || !s.status);
            
            pendingSchedules.forEach(sched => {
                const part = partMasters.find(p => p.partno === sched.partno);
                if (part && part.forge_pn) {
                    const fpn = part.forge_pn.trim().toUpperCase();
                    const partDept = (part.department || '').trim().toUpperCase();
                    if (selectedDept && partDept !== selectedDept) return;
                    if (searchForgePn && !fpn.includes(searchForgePn)) return;
                    reqs[fpn] = (reqs[fpn] || 0) + (sched.qty || 0);
                }
            });
            
            const tbody = document.getElementById('rmRequirementBody');
            if (tbody) {
                tbody.innerHTML = '';
                const keys = Object.keys(reqs).sort();
                
                if (keys.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No matching pending schedules found for requirement report.</td></tr>';
                    return;
                }
                
                let count = 0;
                keys.forEach(fpn => {
                    const required = reqs[fpn];
                    const rm = rawMaterials.find(r => (r.forge_pn || '').trim().toUpperCase() === fpn);
                    const stock = rm ? (rm.stock || 0) : 0;
                    const shortage = Math.max(0, required - stock);
                    
                    count++;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${fpn}</td>
                        <td>${required}</td>
                        <td>${stock}</td>
                        <td style="font-weight: 600; color: ${shortage > 0 ? '#ef4444' : 'inherit'};">${shortage}</td>
                    `;
                    tbody.appendChild(tr);
                });

                if (count === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No shortages found.</td></tr>';
                }
            }
        } catch(e) {
            console.error('Error fetching RM requirement:', e);
        }
    }

    document.getElementById('generateRmReqBtn')?.addEventListener('click', fetchRmRequirement);
    document.getElementById('rmReqDept')?.addEventListener('change', fetchRmRequirement);
    document.getElementById('rmReqForgePnInput')?.addEventListener('input', fetchRmRequirement);
    
    const exportRmReqBtn = document.getElementById('exportRmReqBtn');
    if (exportRmReqBtn) {
        exportRmReqBtn.addEventListener('click', () => {
            const table = document.getElementById('rmRequirementTable');
            if (table) {
                const wb = XLSX.utils.table_to_book(table, { sheet: "RM Requirement" });
                XLSX.writeFile(wb, "RM_Requirement_Report.xlsx");
            }
        });
    }
    
    window.deleteUser = async (id) => {
        if (!checkAdminAccess()) return;
        if (confirm('Delete this user?')) {
            try {
                const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
                if (res.ok) fetchUsers();
                else alert('Failed to delete user.');
            } catch (e) { console.error(e); }
        }
    };




    // ====== DEPARTMENTS CRUD ======
    async function fetchDepartments() {
        try {
            const res = await fetch('/api/departments');
            if (res.ok) {
                const depts = await res.json();
                renderDepartments(depts);
                populateDeptDropdowns(depts); // Also update dropdowns whenever departments are fetched
            }
        } catch (e) { console.error('Error fetching departments', e); }
    }

    function renderDepartments(depts) {
        const tbody = document.getElementById('departmentsBody');
        tbody.innerHTML = '';
        depts.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.id}</td>
                <td>${d.name}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-dept-btn" data-id="${d.id}" data-name="${d.name}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-dept-btn" data-id="${d.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.edit-dept-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                openDeptModal({ id, name });
            });
        });

        document.querySelectorAll('.delete-dept-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this department?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchDepartments();
                        else alert('Error deleting department');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    function openDeptModal(dept = null) {
        if (dept) {
            deptModalTitle.textContent = 'Edit Department';
            deptIdInput.value = dept.id;
            deptNameInput.value = dept.name;
        } else {
            deptModalTitle.textContent = 'Add Department';
            deptForm.reset();
            deptIdInput.value = '';
        }
        deptModal.classList.add('active');
        deptModal.classList.add('show');
    }

    function closeDeptModal() {
        if (deptModal) {
            deptModal.classList.remove('active');
            deptModal.classList.remove('show');
        }
        if (deptForm) deptForm.reset();
        if (deptIdInput) deptIdInput.value = '';
    }

    if (cancelDeptBtn) {
        cancelDeptBtn.addEventListener('click', closeDeptModal);
    }
    const closeDeptModalBtn = document.getElementById('closeDeptModalBtn');
    if (closeDeptModalBtn) {
        closeDeptModalBtn.addEventListener('click', closeDeptModal);
    }

    if (deptForm) {
        deptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameVal = (deptNameInput.value || '').trim();
            if (!nameVal) {
                alert('Please enter a department name.');
                return;
            }
            const payload = {
                name: nameVal
            };
            const id = deptIdInput.value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/departments/${id}` : '/api/departments';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    closeDeptModal();
                    fetchDepartments();
                } else {
                    const errText = await res.text().catch(() => '');
                    alert('Error saving department: ' + (errText || 'Please try again.'));
                }
            } catch (err) {
                console.error(err);
                alert('Error saving department: ' + err);
            }
        });
    }

    function populateDeptDropdowns(depts) {
        const selects = [
            'scheduleDept', 'statusDeptSelect', 'deburDeptSelect', 
            'inspDeptSelect', 'prodLogDept', 'partDept', 'machineDept'
        ];
        
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const currentVal = el.value;
                let html = '<option value="">-- Select Dept --</option>';
                depts.forEach(d => {
                    html += `<option value="${d.name}">${d.name}</option>`;
                });
                el.innerHTML = html;
                if (currentVal && depts.find(d => d.name === currentVal)) {
                    el.value = currentVal;
                }
            }
        });

        // Report dept dropdowns have "-- All Departments --" as default
        ['mcUtilDept', 'operEffDept', 'rmReqDept'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const currentVal = el.value;
                let html = '<option value="">-- All Departments --</option>';
                depts.forEach(d => {
                    html += `<option value="${d.name}">${d.name}</option>`;
                });
                el.innerHTML = html;
                if (currentVal && depts.find(d => d.name === currentVal)) {
                    el.value = currentVal;
                }
            }
        });
    }
    
    // ====== SHIFT CRUD ======
    async function fetchShifts() {
        try {
            const res = await fetch('/api/shifts');
            const data = await res.json();
            allShifts = data;
            renderShifts(data);
            populateShiftDropdowns(data);
        } catch (err) { console.error(err); }
    }

    function renderShifts(shifts) {
        const tbody = document.getElementById('shiftsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        shifts.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.id}</td>
                <td>${s.name}</td>
                <td>${s.hours}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-shift-btn" data-id="${s.id}" data-name="${s.name}" data-hours="${s.hours}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-shift-btn" data-id="${s.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.edit-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                const hours = e.target.getAttribute('data-hours');
                openShiftModal({ id, name, hours });
            });
        });

        document.querySelectorAll('.delete-shift-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this shift?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchShifts();
                        else alert('Error deleting shift');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    function openShiftModal(shift = null) {
        if (!shiftModal) return;
        if (shift) {
            shiftModalTitle.textContent = 'Edit Shift';
            shiftIdInput.value = shift.id;
            shiftNameInput.value = shift.name;
            shiftHoursInput.value = shift.hours;
        } else {
            shiftModalTitle.textContent = 'Add Shift';
            shiftForm.reset();
            shiftIdInput.value = '';
        }
        shiftModal.classList.add('active');
        shiftModal.classList.add('show');
    }

    function closeShiftModal() {
        if (shiftModal) {
            shiftModal.classList.remove('active');
            shiftModal.classList.remove('show');
        }
        if (shiftForm) shiftForm.reset();
        if (shiftIdInput) shiftIdInput.value = '';
    }

    if (cancelShiftBtn) {
        cancelShiftBtn.addEventListener('click', closeShiftModal);
    }
    const closeShiftModalBtn = document.getElementById('closeShiftModalBtn');
    if (closeShiftModalBtn) {
        closeShiftModalBtn.addEventListener('click', closeShiftModal);
    }

    if (shiftForm) {
        shiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameVal = (shiftNameInput.value || '').trim();
            if (!nameVal) {
                alert('Please enter a shift name.');
                return;
            }
            const payload = {
                name: nameVal,
                hours: parseFloat(shiftHoursInput.value) || 8.0
            };
            const id = shiftIdInput.value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/shifts/${id}` : '/api/shifts';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    closeShiftModal();
                    fetchShifts();
                } else {
                    const errText = await res.text().catch(() => '');
                    alert('Error saving shift: ' + (errText || 'Please try again.'));
                }
            } catch (err) {
                console.error(err);
                alert('Error saving shift: ' + err);
            }
        });
    }

    function populateShiftDropdowns(shifts) {
        const selects = ['scheduleRunShift', 'prodLogShift'];
        
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const currentVal = el.value;
                let html = '<option value="">-- Select Shift --</option>';
                shifts.forEach(s => {
                    html += `<option value="${s.name}">${s.name} (${s.hours} Hrs)</option>`;
                });
                el.innerHTML = html;
                if (currentVal && shifts.find(s => s.name === currentVal)) {
                    el.value = currentVal;
                }
            }
        });
    }
    
    // Initial fetch to populate dropdowns on page load
    fetchDepartments();
    fetchShifts();
    fetchVendors();

    // ====== VENDOR CRUD ======
    const vendorModal = document.getElementById('vendorModal');
    const vendorForm = document.getElementById('vendorForm');
    const vendorIdInput = document.getElementById('vendorId');
    const vendorNameInput = document.getElementById('vendorName');
    const vendorDetailsInput = document.getElementById('vendorDetails');
    const vendorModalTitle = document.getElementById('vendorModalTitle');
    const cancelVendorBtn = document.getElementById('cancelVendorBtn');
    const closeVendorModalBtn = document.getElementById('closeVendorModalBtn');

    async function fetchVendors() {
        try {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            renderVendors(data);
        } catch (err) { console.error(err); }
    }

    function renderVendors(vendors) {
        const tbody = document.getElementById('vendorsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        vendors.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${v.id}</td>
                <td>${v.name}</td>
                <td>${v.details || ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-vendor-btn" data-id="${v.id}" data-name="${v.name}" data-details="${v.details || ''}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-vendor-btn" data-id="${v.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.edit-vendor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                const details = e.target.getAttribute('data-details');
                openVendorModal({ id, name, details });
            });
        });

        document.querySelectorAll('.delete-vendor-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this vendor?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchVendors();
                        else alert('Error deleting vendor');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('vendorsTable');
    }

    function openVendorModal(vendor = null) {
        if (!vendorModal) return;
        if (vendor) {
            vendorModalTitle.textContent = 'Edit Vendor';
            vendorIdInput.value = vendor.id;
            vendorNameInput.value = vendor.name;
            vendorDetailsInput.value = vendor.details;
        } else {
            vendorModalTitle.textContent = 'Add Vendor';
            vendorForm.reset();
            vendorIdInput.value = '';
        }
        vendorModal.classList.add('show');
    }

    if (cancelVendorBtn) {
        cancelVendorBtn.addEventListener('click', () => {
            vendorModal.classList.remove('show');
        });
    }
    if (closeVendorModalBtn) {
        closeVendorModalBtn.addEventListener('click', () => {
            vendorModal.classList.remove('show');
        });
    }

    if (vendorForm) {
        vendorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: vendorNameInput.value,
                details: vendorDetailsInput.value
            };
            const id = vendorIdInput.value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/vendors/${id}` : '/api/vendors';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    vendorModal.classList.remove('show');
                    fetchVendors();
                } else {
                    alert('Error saving vendor');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving vendor');
            }
        });
    }

    // ====== SUPPLIER CRUD ======
    const supplierModal = document.getElementById('supplierModal');
    const supplierForm = document.getElementById('supplierForm');
    const supplierIdInput = document.getElementById('supplierId');
    const supplierNameInput = document.getElementById('supplierName');
    const supplierDetailsInput = document.getElementById('supplierDetails');
    const supplierModalTitle = document.getElementById('supplierModalTitle');
    const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
    const closeSupplierModalBtn = document.getElementById('closeSupplierModalBtn');

    async function fetchSuppliers() {
        try {
            const res = await fetch('/api/suppliers');
            const data = await res.json();
            renderSuppliers(data);
        } catch (err) { console.error(err); }
    }

    function renderSuppliers(suppliers) {
        const tbody = document.getElementById('suppliersBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!suppliers || suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No suppliers found. Click "+ Add Supplier" to create one.</td></tr>';
            return;
        }
        suppliers.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.details || ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-supplier-btn" data-id="${s.id}" data-name="${s.name}" data-details="${s.details || ''}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-supplier-btn" data-id="${s.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-supplier-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                const details = e.target.getAttribute('data-details');
                openSupplierModal({ id, name, details });
            });
        });

        tbody.querySelectorAll('.delete-supplier-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this supplier?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchSuppliers();
                        else alert('Error deleting supplier');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('suppliersTable');
    }

    function openSupplierModal(supplier = null) {
        if (!supplierModal) return;
        if (supplier) {
            supplierModalTitle.textContent = 'Edit Supplier';
            supplierIdInput.value = supplier.id;
            supplierNameInput.value = supplier.name;
            supplierDetailsInput.value = supplier.details || '';
        } else {
            supplierModalTitle.textContent = 'Add Supplier';
            if (supplierForm) supplierForm.reset();
            supplierIdInput.value = '';
        }
        supplierModal.classList.add('show');
    }

    if (cancelSupplierBtn) {
        cancelSupplierBtn.addEventListener('click', () => {
            supplierModal.classList.remove('show');
        });
    }
    if (closeSupplierModalBtn) {
        closeSupplierModalBtn.addEventListener('click', () => {
            supplierModal.classList.remove('show');
        });
    }

    if (supplierForm) {
        supplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: supplierNameInput.value.trim(),
                details: supplierDetailsInput.value.trim()
            };
            const id = supplierIdInput.value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/suppliers/${id}` : '/api/suppliers';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    supplierModal.classList.remove('show');
                    fetchSuppliers();
                } else {
                    alert('Error saving supplier details');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving supplier details');
            }
        });
    }

    // ====== HT LOG CRUD ======
    const htModal = document.getElementById('htModal');
    const htForm = document.getElementById('htForm');
    const htDateInput = document.getElementById('htDate');
    const htDcNoInput = document.getElementById('htDcNo');
    const htVendorSelect = document.getElementById('htVendor');
    const htPartNoSelect = document.getElementById('htPartNo');
    const htAvailableQtyInput = document.getElementById('htAvailableQty');
    const htQtyInput = document.getElementById('htQty');
    const cancelHtBtn = document.getElementById('cancelHtBtn');
    const closeHtModalBtn = document.getElementById('closeHtModalBtn');

    let currentSpiderParts = [];
    let currentVendorPending = [];

    async function fetchHtData() {
        await Promise.all([
            fetchAvailableHtParts(),
            fetchHtLogs(),
            fetchHtVendorPendingParts(),
            fetchHtReceiptLogs()
        ]);
    }

    async function fetchAvailableHtParts() {
        try {
            const res = await fetch('/api/ht/spider_parts');
            const data = await res.json();
            currentSpiderParts = data;
            renderAvailableHtParts(data);
        } catch (err) { console.error(err); }
    }

    function renderAvailableHtParts(parts) {
        const tbody = document.getElementById('htAvailablePartsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // Filter out parts with available_qty <= 0
        const availableParts = (parts || []).filter(p => (p.available_qty || 0) > 0);

        if (!availableParts || availableParts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No SPIDER parts with available Opn 40 quantity found</td></tr>';
            return;
        }
        availableParts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.partno}</strong></td>
                <td>${p.department || 'SPIDER'}</td>
                <td>${p.produced_qty}</td>
                <td>${p.ht_sent_qty}</td>
                <td><span style="font-weight: bold; color: #16a34a;">${p.available_qty}</span></td>
                <td>
                    <button class="btn btn-primary send-part-ht-btn" data-partno="${p.partno}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
                        Send to HT
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.send-part-ht-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partno = e.currentTarget.getAttribute('data-partno');
                openHtModal(partno);
            });
        });
        applyTableColFilters('htAvailablePartsTable');
    }

    async function fetchHtLogs() {
        try {
            const res = await fetch('/api/ht_logs');
            const data = await res.json();
            renderHtLogs(data);
        } catch (err) { console.error(err); }
    }

    function renderHtLogs(logs) {
        const tbody = document.getElementById('htBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No HT dispatch records found</td></tr>';
            return;
        }
        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${l.id}</td>
                <td>${l.date}</td>
                <td>${l.dc_no || ''}</td>
                <td>${l.vendor}</td>
                <td>${l.partno}</td>
                <td>${l.qty}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline delete-ht-btn" data-id="${l.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-ht-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this HT record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/ht_logs/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchHtData();
                        else alert('Error deleting HT record');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('htTable');
    }

    async function openHtModal(preselectedPartNo = null) {
        if (!htModal) return;
        htForm.reset();
        htAvailableQtyInput.value = '0';
        
        // Retain current date or set to today
        if (!htDateInput.value) {
            htDateInput.valueAsDate = new Date();
        }

        // Fetch vendors
        try {
            const vRes = await fetch('/api/vendors');
            const vendors = await vRes.json();
            let vHtml = '<option value="">-- Select Vendor --</option>';
            vendors.forEach(v => {
                vHtml += `<option value="${v.name}">${v.name}</option>`;
            });
            htVendorSelect.innerHTML = vHtml;
        } catch (err) { console.error(err); }

        // Fetch SPIDER parts
        try {
            const pRes = await fetch('/api/ht/spider_parts');
            const allParts = await pRes.json();
            currentSpiderParts = allParts.filter(p => (p.available_qty || 0) > 0 || p.partno === preselectedPartNo);
            let pHtml = '<option value="">-- Select Part --</option>';
            currentSpiderParts.forEach(p => {
                pHtml += `<option value="${p.partno}">${p.partno} (Avail: ${p.available_qty})</option>`;
            });
            htPartNoSelect.innerHTML = pHtml;

            if (preselectedPartNo) {
                htPartNoSelect.value = preselectedPartNo;
                const found = currentSpiderParts.find(p => p.partno === preselectedPartNo);
                htAvailableQtyInput.value = found ? found.available_qty : 0;
            }
        } catch (err) { console.error(err); }

        htModal.classList.add('show');
    }

    if (htPartNoSelect) {
        htPartNoSelect.addEventListener('change', (e) => {
            const partno = e.target.value;
            const found = currentSpiderParts.find(p => p.partno === partno);
            htAvailableQtyInput.value = found ? found.available_qty : 0;
        });
    }

    if (cancelHtBtn) {
        cancelHtBtn.addEventListener('click', () => htModal.classList.remove('show'));
    }
    if (closeHtModalBtn) {
        closeHtModalBtn.addEventListener('click', () => htModal.classList.remove('show'));
    }

    if (htForm) {
        htForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const partno = htPartNoSelect.value;
            const qty = parseInt(htQtyInput.value) || 0;
            const avail = parseInt(htAvailableQtyInput.value) || 0;

            if (qty > avail) {
                if (!confirm(`Warning: Entered quantity (${qty}) is greater than available Opn 50 quantity (${avail}). Do you still want to proceed?`)) {
                    return;
                }
            }

            const payload = {
                date: htDateInput.value,
                dc_no: htDcNoInput.value,
                vendor: htVendorSelect.value,
                partno: partno,
                qty: qty
            };

            try {
                const res = await fetch('/api/ht_logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    htModal.classList.remove('show');
                    fetchHtData();
                } else {
                    alert('Error saving HT record');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving HT record');
            }
        });
    }

    // ====== HT RECEIPT LOG CRUD ======
    const htReceiptModal = document.getElementById('htReceiptModal');
    const htReceiptForm = document.getElementById('htReceiptForm');
    const htReceiptDateInput = document.getElementById('htReceiptDate');
    const htReceiptVendorSelect = document.getElementById('htReceiptVendor');
    const htReceiptPartNoSelect = document.getElementById('htReceiptPartNo');
    const htReceiptPendingQtyInput = document.getElementById('htReceiptPendingQty');
    const htReceiptQtyInput = document.getElementById('htReceiptQty');
    const cancelHtReceiptBtn = document.getElementById('cancelHtReceiptBtn');
    const closeHtReceiptModalBtn = document.getElementById('closeHtReceiptModalBtn');

    async function fetchHtVendorPendingParts() {
        try {
            const res = await fetch('/api/ht/vendor_pending_parts');
            const data = await res.json();
            currentVendorPending = data;
            renderHtVendorPendingParts(data);
        } catch (err) { console.error(err); }
    }

    function renderHtVendorPendingParts(pendingList) {
        const tbody = document.getElementById('htVendorPendingBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const activePending = (pendingList || []).filter(p => p.pending_qty > 0);
        
        if (activePending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No parts currently pending at HT vendors</td></tr>';
            return;
        }

        activePending.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.vendor}</strong></td>
                <td>${p.partno}</td>
                <td>${p.sent_qty}</td>
                <td>${p.received_qty}</td>
                <td><span style="font-weight: bold; color: #d97706;">${p.pending_qty}</span></td>
                <td>
                    <button class="btn btn-primary receive-part-ht-btn" data-vendor="${p.vendor}" data-partno="${p.partno}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #059669; border-color: #059669;">
                        Receive from HT
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.receive-part-ht-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vendor = e.currentTarget.getAttribute('data-vendor');
                const partno = e.currentTarget.getAttribute('data-partno');
                openHtReceiptModal(vendor, partno);
            });
        });
        applyTableColFilters('htVendorPendingTable');
    }

    async function fetchHtReceiptLogs() {
        try {
            const res = await fetch('/api/ht_receipt_logs');
            const data = await res.json();
            renderHtReceiptLogs(data);
        } catch (err) { console.error(err); }
    }

    function renderHtReceiptLogs(logs) {
        const tbody = document.getElementById('htReceiptBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No HT receipt records found</td></tr>';
            return;
        }
        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${l.id}</td>
                <td>${l.date}</td>
                <td>${l.vendor}</td>
                <td>${l.partno}</td>
                <td><span style="font-weight: bold; color: #059669;">+${l.qty}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-outline delete-ht-receipt-btn" data-id="${l.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-ht-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this HT receipt record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/ht_receipt_logs/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchHtData();
                        else alert('Error deleting HT receipt record');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('htReceiptTable');
    }

    async function openHtReceiptModal(preVendor = null, prePartNo = null) {
        if (!htReceiptModal) return;
        htReceiptForm.reset();
        htReceiptPendingQtyInput.value = '0';

        if (!htReceiptDateInput.value) {
            htReceiptDateInput.valueAsDate = new Date();
        }

        // Fetch vendor pending list
        try {
            const res = await fetch('/api/ht/vendor_pending_parts');
            currentVendorPending = await res.json();
            
            // Populate Vendors dropdown (unique vendors with pending > 0)
            const uniqueVendors = [...new Set(currentVendorPending.filter(p => p.pending_qty > 0).map(p => p.vendor))];
            let vHtml = '<option value="">-- Select Vendor --</option>';
            uniqueVendors.forEach(v => {
                vHtml += `<option value="${v}">${v}</option>`;
            });
            htReceiptVendorSelect.innerHTML = vHtml;

            if (preVendor) {
                htReceiptVendorSelect.value = preVendor;
                updateHtReceiptPartsDropdown(preVendor, prePartNo);
            }
        } catch (err) { console.error(err); }

        htReceiptModal.classList.add('show');
    }

    function updateHtReceiptPartsDropdown(vendor, prePartNo = null) {
        const matching = currentVendorPending.filter(p => p.vendor === vendor && p.pending_qty > 0);
        let pHtml = '<option value="">-- Select Part --</option>';
        matching.forEach(m => {
            pHtml += `<option value="${m.partno}">${m.partno} (Pending: ${m.pending_qty})</option>`;
        });
        htReceiptPartNoSelect.innerHTML = pHtml;

        if (prePartNo) {
            htReceiptPartNoSelect.value = prePartNo;
            const found = matching.find(m => m.partno === prePartNo);
            htReceiptPendingQtyInput.value = found ? found.pending_qty : 0;
        } else {
            htReceiptPendingQtyInput.value = '0';
        }
    }

    if (htReceiptVendorSelect) {
        htReceiptVendorSelect.addEventListener('change', (e) => {
            const vendor = e.target.value;
            updateHtReceiptPartsDropdown(vendor);
        });
    }

    if (htReceiptPartNoSelect) {
        htReceiptPartNoSelect.addEventListener('change', (e) => {
            const vendor = htReceiptVendorSelect.value;
            const partno = e.target.value;
            const found = currentVendorPending.find(p => p.vendor === vendor && p.partno === partno);
            htReceiptPendingQtyInput.value = found ? found.pending_qty : 0;
        });
    }

    if (cancelHtReceiptBtn) {
        cancelHtReceiptBtn.addEventListener('click', () => htReceiptModal.classList.remove('show'));
    }
    if (closeHtReceiptModalBtn) {
        closeHtReceiptModalBtn.addEventListener('click', () => htReceiptModal.classList.remove('show'));
    }

    if (htReceiptForm) {
        htReceiptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const qty = parseInt(htReceiptQtyInput.value) || 0;
            const pending = parseInt(htReceiptPendingQtyInput.value) || 0;

            if (qty > pending) {
                if (!confirm(`Warning: Entered received quantity (${qty}) is greater than pending quantity at vendor (${pending}). Do you still want to proceed?`)) {
                    return;
                }
            }

            const payload = {
                date: htReceiptDateInput.value,
                vendor: htReceiptVendorSelect.value,
                partno: htReceiptPartNoSelect.value,
                qty: qty
            };

            try {
                const res = await fetch('/api/ht_receipt_logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    htReceiptModal.classList.remove('show');
                    fetchHtData();
                } else {
                    alert('Error saving HT receipt record');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving HT receipt record');
            }
        });
    }

    // ====== POWDER COATING (PC) LOGIC ======
    let currentPcAvailableParts = [];
    let currentPcVendorPending = [];

    async function fetchPcData() {
        await Promise.all([
            fetchAvailablePcParts(),
            fetchPcLogs(),
            fetchPcVendorPendingParts(),
            fetchPcReceiptLogs()
        ]);
    }

    async function fetchAvailablePcParts() {
        try {
            const res = await fetch('/api/pc/available_parts');
            const data = await res.json();
            currentPcAvailableParts = data;
            renderAvailablePcParts(data);
        } catch (err) { console.error(err); }
    }

    function renderAvailablePcParts(parts) {
        const tbody = document.getElementById('pcAvailablePartsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const availableParts = (parts || []).filter(p => (p.available_qty || 0) > 0);

        if (!availableParts || availableParts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No parts with available PC quantity found</td></tr>';
            return;
        }
        availableParts.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.partno}</strong></td>
                <td>${p.department || '-'}</td>
                <td>${p.produced_qty} (${p.prev_opn_no}: ${p.prev_opn_desc})</td>
                <td>${p.pc_sent_qty}</td>
                <td><span style="font-weight: bold; color: #16a34a;">${p.available_qty}</span></td>
                <td>
                    <button class="btn btn-primary send-part-pc-btn" data-partno="${p.partno}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">
                        Send to PC
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.send-part-pc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partno = e.currentTarget.getAttribute('data-partno');
                openPcModal(partno);
            });
        });
        applyTableColFilters('pcAvailablePartsTable');
    }

    async function fetchPcLogs() {
        try {
            const res = await fetch('/api/pc_logs');
            const data = await res.json();
            renderPcLogs(data);
        } catch (err) { console.error(err); }
    }

    function renderPcLogs(logs) {
        const tbody = document.getElementById('pcBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No PC dispatch records found</td></tr>';
            return;
        }
        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${l.id}</td>
                <td>${l.date}</td>
                <td>${l.dc_no || ''}</td>
                <td>${l.vendor}</td>
                <td>${l.partno}</td>
                <td>${l.qty}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline delete-pc-btn" data-id="${l.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-pc-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this PC dispatch record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/pc_logs/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchPcData();
                        else alert('Error deleting PC record');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('pcTable');
    }

    // Modal elements for PC
    const pcModal = document.getElementById('pcModal');
    const pcForm = document.getElementById('pcForm');
    const pcDateInput = document.getElementById('pcDate');
    const pcDcNoInput = document.getElementById('pcDcNo');
    const pcVendorSelect = document.getElementById('pcVendor');
    const pcPartNoSelect = document.getElementById('pcPartNo');
    const pcAvailableQtyInput = document.getElementById('pcAvailableQty');
    const pcQtyInput = document.getElementById('pcQty');
    const cancelPcBtn = document.getElementById('cancelPcBtn');
    const closePcModalBtn = document.getElementById('closePcModalBtn');

    async function openPcModal(preselectedPartNo = null) {
        if (!pcModal) return;
        pcForm.reset();
        pcAvailableQtyInput.value = '0';
        
        if (!pcDateInput.value) {
            pcDateInput.valueAsDate = new Date();
        }

        try {
            const vRes = await fetch('/api/vendors');
            const vendors = await vRes.json();
            let vHtml = '<option value="">-- Select Vendor --</option>';
            vendors.forEach(v => {
                vHtml += `<option value="${v.name}">${v.name}</option>`;
            });
            pcVendorSelect.innerHTML = vHtml;
        } catch (err) { console.error(err); }

        try {
            const pRes = await fetch('/api/pc/available_parts');
            const allParts = await pRes.json();
            currentPcAvailableParts = allParts;
            const filteredParts = allParts.filter(p => (p.available_qty || 0) > 0 || p.partno === preselectedPartNo);
            let pHtml = '<option value="">-- Select Part --</option>';
            filteredParts.forEach(p => {
                pHtml += `<option value="${p.partno}">${p.partno} (Avail: ${p.available_qty})</option>`;
            });
            pcPartNoSelect.innerHTML = pHtml;

            if (preselectedPartNo) {
                pcPartNoSelect.value = preselectedPartNo;
                const found = allParts.find(p => p.partno === preselectedPartNo);
                pcAvailableQtyInput.value = found ? found.available_qty : 0;
            }
        } catch (err) { console.error(err); }

        pcModal.classList.add('show');
    }

    if (pcPartNoSelect) {
        pcPartNoSelect.addEventListener('change', (e) => {
            const partno = e.target.value;
            const found = currentPcAvailableParts.find(p => p.partno === partno);
            pcAvailableQtyInput.value = found ? found.available_qty : 0;
        });
    }

    if (cancelPcBtn) cancelPcBtn.addEventListener('click', () => pcModal.classList.remove('show'));
    if (closePcModalBtn) closePcModalBtn.addEventListener('click', () => pcModal.classList.remove('show'));

    if (pcForm) {
        pcForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const partno = pcPartNoSelect.value;
            const qty = parseInt(pcQtyInput.value) || 0;
            const avail = parseInt(pcAvailableQtyInput.value) || 0;

            if (qty > avail) {
                if (!confirm(`Warning: Entered quantity (${qty}) is greater than available quantity (${avail}). Do you still want to proceed?`)) {
                    return;
                }
            }

            const payload = {
                date: pcDateInput.value,
                dc_no: pcDcNoInput.value,
                vendor: pcVendorSelect.value,
                partno: partno,
                qty: qty
            };

            try {
                const res = await fetch('/api/pc_logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    pcModal.classList.remove('show');
                    fetchPcData();
                } else {
                    alert('Error saving PC dispatch record');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving PC dispatch record');
            }
        });
    }

    // ====== PC RECEIPT LOG CRUD ======
    const pcReceiptModal = document.getElementById('pcReceiptModal');
    const pcReceiptForm = document.getElementById('pcReceiptForm');
    const pcReceiptDateInput = document.getElementById('pcReceiptDate');
    const pcReceiptVendorSelect = document.getElementById('pcReceiptVendor');
    const pcReceiptPartNoSelect = document.getElementById('pcReceiptPartNo');
    const pcReceiptPendingQtyInput = document.getElementById('pcReceiptPendingQty');
    const pcReceiptQtyInput = document.getElementById('pcReceiptQty');
    const cancelPcReceiptBtn = document.getElementById('cancelPcReceiptBtn');
    const closePcReceiptModalBtn = document.getElementById('closePcReceiptModalBtn');

    async function fetchPcVendorPendingParts() {
        try {
            const res = await fetch('/api/pc/vendor_pending_parts');
            const data = await res.json();
            currentPcVendorPending = data;
            renderPcVendorPendingParts(data);
        } catch (err) { console.error(err); }
    }

    function renderPcVendorPendingParts(pendingList) {
        const tbody = document.getElementById('pcVendorPendingBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const activePending = (pendingList || []).filter(p => p.pending_qty > 0);
        
        if (activePending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No parts currently pending at PC vendors</td></tr>';
            return;
        }

        activePending.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.vendor}</strong></td>
                <td>${p.partno}</td>
                <td>${p.sent_qty}</td>
                <td>${p.received_qty}</td>
                <td><span style="font-weight: bold; color: #d97706;">${p.pending_qty}</span></td>
                <td>
                    <button class="btn btn-primary receive-part-pc-btn" data-vendor="${p.vendor}" data-partno="${p.partno}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background-color: #059669; border-color: #059669;">
                        Receive from PC
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.receive-part-pc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vendor = e.currentTarget.getAttribute('data-vendor');
                const partno = e.currentTarget.getAttribute('data-partno');
                openPcReceiptModal(vendor, partno);
            });
        });
        applyTableColFilters('pcVendorPendingTable');
    }

    async function fetchPcReceiptLogs() {
        try {
            const res = await fetch('/api/pc_receipt_logs');
            const data = await res.json();
            renderPcReceiptLogs(data);
        } catch (err) { console.error(err); }
    }

    function renderPcReceiptLogs(logs) {
        const tbody = document.getElementById('pcReceiptBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No PC receipt records found</td></tr>';
            return;
        }
        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${l.id}</td>
                <td>${l.date}</td>
                <td>${l.vendor}</td>
                <td>${l.partno}</td>
                <td><span style="font-weight: bold; color: #059669;">+${l.qty}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-outline delete-pc-receipt-btn" data-id="${l.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-pc-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this PC receipt record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/pc_receipt_logs/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchPcData();
                        else alert('Error deleting PC receipt record');
                    } catch (err) { console.error(err); }
                }
            });
        });
        applyTableColFilters('pcReceiptTable');
    }

    async function openPcReceiptModal(vendor = null, partno = null) {
        if (!pcReceiptModal) return;
        pcReceiptForm.reset();
        pcReceiptPendingQtyInput.value = '0';
        
        if (!pcReceiptDateInput.value) {
            pcReceiptDateInput.valueAsDate = new Date();
        }

        try {
            const pendingRes = await fetch('/api/pc/vendor_pending_parts');
            const pendingList = await pendingRes.json();
            currentPcVendorPending = pendingList;

            const vendorsWithPending = [...new Set(pendingList.filter(p => p.pending_qty > 0).map(p => p.vendor))];
            let vHtml = '<option value="">-- Select Vendor --</option>';
            vendorsWithPending.forEach(v => {
                vHtml += `<option value="${v}">${v}</option>`;
            });
            pcReceiptVendorSelect.innerHTML = vHtml;

            if (vendor) {
                pcReceiptVendorSelect.value = vendor;
                populatePcReceiptParts(vendor, partno);
            }
        } catch (err) { console.error(err); }

        pcReceiptModal.classList.add('show');
    }

    function populatePcReceiptParts(vendor, preselectedPartNo = null) {
        const partsForVendor = currentPcVendorPending.filter(p => p.vendor === vendor && p.pending_qty > 0);
        let pHtml = '<option value="">-- Select Part --</option>';
        partsForVendor.forEach(p => {
            pHtml += `<option value="${p.partno}">${p.partno} (Pending: ${p.pending_qty})</option>`;
        });
        pcReceiptPartNoSelect.innerHTML = pHtml;

        if (preselectedPartNo) {
            pcReceiptPartNoSelect.value = preselectedPartNo;
            const found = partsForVendor.find(p => p.partno === preselectedPartNo);
            pcReceiptPendingQtyInput.value = found ? found.pending_qty : 0;
        } else {
            pcReceiptPendingQtyInput.value = 0;
        }
    }

    if (pcReceiptVendorSelect) {
        pcReceiptVendorSelect.addEventListener('change', (e) => {
            populatePcReceiptParts(e.target.value);
        });
    }

    if (pcReceiptPartNoSelect) {
        pcReceiptPartNoSelect.addEventListener('change', (e) => {
            const vendor = pcReceiptVendorSelect.value;
            const partno = e.target.value;
            const found = currentPcVendorPending.find(p => p.vendor === vendor && p.partno === partno);
            pcReceiptPendingQtyInput.value = found ? found.pending_qty : 0;
        });
    }

    if (cancelPcReceiptBtn) cancelPcReceiptBtn.addEventListener('click', () => pcReceiptModal.classList.remove('show'));
    if (closePcReceiptModalBtn) closePcReceiptModalBtn.addEventListener('click', () => pcReceiptModal.classList.remove('show'));

    if (pcReceiptForm) {
        pcReceiptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const vendor = pcReceiptVendorSelect.value;
            const partno = pcReceiptPartNoSelect.value;
            const qty = parseInt(pcReceiptQtyInput.value) || 0;
            const pending = parseInt(pcReceiptPendingQtyInput.value) || 0;

            if (qty > pending) {
                if (!confirm(`Warning: Received quantity (${qty}) exceeds pending quantity at vendor (${pending}). Proceed anyway?`)) {
                    return;
                }
            }

            const payload = {
                date: pcReceiptDateInput.value,
                vendor: vendor,
                partno: partno,
                qty: qty
            };

            try {
                const res = await fetch('/api/pc_receipt_logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    pcReceiptModal.classList.remove('show');
                    fetchPcData();
                } else {
                    alert('Error saving PC receipt record');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving PC receipt record');
            }
        });
    }

    // ====== M/C UTIL REPORT ======
    const generateMcUtilBtn = document.getElementById('generateMcUtilBtn');
    if (generateMcUtilBtn) {
        generateMcUtilBtn.addEventListener('click', async () => {
            const fromDate = document.getElementById('mcUtilFromDate').value;
            const toDate = document.getElementById('mcUtilToDate').value;
            const dept = document.getElementById('mcUtilDept').value;
            
            if (!fromDate || !toDate) {
                alert('Please select both From and To dates');
                return;
            }

            try {
                const res = await fetch('/api/prodlog');
                const allLogs = await res.json();
                
                // Filter
                const filtered = allLogs.filter(l => {
                    if (dept && (l.dept || '').toUpperCase() !== dept.toUpperCase()) return false;
                    if (l.date < fromDate || l.date > toDate) return false;
                    return true;
                });
                
                // Collect unique idle reasons
                const idleReasonsSet = new Set();
                filtered.forEach(l => {
                    if (l.idle_reason) idleReasonsSet.add(l.idle_reason.trim());
                    if (l.idle_reason_2) idleReasonsSet.add(l.idle_reason_2.trim());
                    if (l.idle_reason_3) idleReasonsSet.add(l.idle_reason_3.trim());
                });
                const idleReasons = Array.from(idleReasonsSet).filter(r => r).sort();
                
                // Group by machine
                const machineData = {};
                filtered.forEach(l => {
                    const mc = (l.machine || 'Unknown').trim();
                    if (!machineData[mc]) {
                        machineData[mc] = { runtime: 0, idleTotal: 0 };
                        idleReasons.forEach(r => machineData[mc][r] = 0);
                    }
                    
                    machineData[mc].runtime += (l.runtime || 0);
                    
                    let idle1 = l.idle_hours || 0;
                    let idle2 = l.idle_hours_2 || 0;
                    let idle3 = l.idle_hours_3 || 0;
                    
                    machineData[mc].idleTotal += (idle1 + idle2 + idle3);
                    
                    if (l.idle_reason && idle1 > 0) machineData[mc][l.idle_reason.trim()] += idle1;
                    if (l.idle_reason_2 && idle2 > 0) machineData[mc][l.idle_reason_2.trim()] += idle2;
                    if (l.idle_reason_3 && idle3 > 0) machineData[mc][l.idle_reason_3.trim()] += idle3;
                });
                
                // Render table
                const thead = document.getElementById('mcUtilHead');
                const tbody = document.getElementById('mcUtilBody');
                
                let headHtml = `<tr>
                    <th>Machine</th>
                    <th>Run Time</th>
                    <th>Idle Time</th>
                    <th>Log Time</th>
                    <th>Util %</th>`;
                idleReasons.forEach(r => {
                    headHtml += `<th>${r}</th>`;
                });
                headHtml += `</tr>`;
                thead.innerHTML = headHtml;
                
                tbody.innerHTML = '';
                
                const sortedMachines = Object.keys(machineData).sort();
                if (sortedMachines.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="${5 + idleReasons.length}" style="text-align:center; color: var(--text-muted);">No data found for selected period</td></tr>`;
                } else {
                    let totalRowHtml = '';
                    sortedMachines.forEach(mc => {
                        const d = machineData[mc];
                        const logTime = d.runtime + d.idleTotal;
                        const utilPercent = (d.runtime / 21) * 100;
                        let rowHtml = `<tr>
                            <td style="font-weight: 500;">${mc}</td>
                            <td>${d.runtime.toFixed(2)}</td>
                            <td>${d.idleTotal.toFixed(2)}</td>
                            <td>${logTime.toFixed(2)}</td>
                            <td>${utilPercent.toFixed(2)}%</td>`;
                        idleReasons.forEach(r => {
                            rowHtml += `<td>${d[r] ? d[r].toFixed(2) : '-'}</td>`;
                        });
                        rowHtml += `</tr>`;
                        totalRowHtml += rowHtml;
                    });
                    tbody.innerHTML = totalRowHtml;
                }
                
            } catch(e) {
                console.error('Error generating M/c Util report:', e);
                alert('Error generating report');
            }
        });
    }

    const exportMcUtilBtn = document.getElementById('exportMcUtilBtn');
    if (exportMcUtilBtn) {
        exportMcUtilBtn.addEventListener('click', () => {
            exportTableToExcel('mcUtilTable', 'Machine_Utilization_Report');
        });
    }

    // --- OPERATOR EFFICIENCY REPORT LOGIC ---
    async function fetchOperEffReport() {
        const selectedDate = document.getElementById('operEffDate')?.value;
        const deptFilter = (document.getElementById('operEffDept')?.value || '').trim().toUpperCase();

        const tbody = document.getElementById('operEffBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">Generating report...</td></tr>';

        try {
            const [opRes, prodRes, attRes] = await Promise.all([
                fetch('/api/operators'),
                fetch('/api/prodlog'),
                fetch('/api/attendance')
            ]);

            const allOperators = await opRes.json();
            const allProdLogs = await prodRes.json();
            const allAttendance = await attRes.json();

            let filteredOperators = allOperators;
            if (deptFilter) {
                filteredOperators = allOperators.filter(o => (o.department || '').trim().toUpperCase() === deptFilter);
            }

            tbody.innerHTML = '';
            if (filteredOperators.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No operators found.</td></tr>';
                return;
            }

            filteredOperators.forEach(op => {
                const opName = (op.name || '').trim();

                // Attendance Hours from Attendance records for selected date
                const opAttRecords = allAttendance.filter(r => (r.employee_name || '').trim().toUpperCase() === opName.toUpperCase());
                let totalAttHours = 0;

                opAttRecords.forEach(r => {
                    if (r.month_year && r.day && selectedDate) {
                        const recDateStr = `${r.month_year}-${String(r.day).padStart(2, '0')}`;
                        if (recDateStr === selectedDate) {
                            totalAttHours += parseFloat(r.hours || 0);
                        }
                    }
                });

                // Filter Prod Logs for this operator for selected date
                const opProdLogs = allProdLogs.filter(l => {
                    const lOp = (l.operator || '').trim().toUpperCase();
                    if (lOp !== opName.toUpperCase()) return false;
                    return l.date === selectedDate;
                });

                const sumRuntime = opProdLogs.reduce((sum, l) => sum + (parseFloat(l.runtime) || 0), 0);
                const sumIdleTime = opProdLogs.reduce((sum, l) => sum + (parseFloat(l.idle_hours) || 0) + (parseFloat(l.idle_hours_2) || 0) + (parseFloat(l.idle_hours_3) || 0), 0);
                const sumTargetQty = opProdLogs.reduce((sum, l) => sum + (parseFloat(l.target_qty) || 0), 0);
                const sumProdQty = opProdLogs.reduce((sum, l) => sum + (parseFloat(l.prod_qty) || 0), 0);

                // Multiple M/C value
                let multMcVal = '-';
                if (opProdLogs.length > 0) {
                    const multVals = opProdLogs.map(l => parseInt(l.multiple_mc) || 1);
                    const maxMult = Math.max(...multVals);
                    multMcVal = maxMult > 0 ? maxMult : 1;
                }

                let effPct = 0;
                if (sumTargetQty > 0) {
                    effPct = (sumProdQty / sumTargetQty) * 100;
                } else if (opProdLogs.length > 0) {
                    const validEffs = opProdLogs.map(l => parseFloat(l.efficiency) || 0).filter(e => e > 0);
                    if (validEffs.length > 0) {
                        effPct = validEffs.reduce((s, e) => s + e, 0) / validEffs.length;
                    }
                }

                const displayAttHours = totalAttHours.toFixed(2);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${opName}</strong></td>
                    <td>${displayAttHours}</td>
                    <td>${sumRuntime.toFixed(2)}</td>
                    <td>${sumIdleTime.toFixed(2)}</td>
                    <td>${Math.round(sumTargetQty)}</td>
                    <td><strong>${Math.round(sumProdQty)}</strong></td>
                    <td>${multMcVal}</td>
                    <td><span style="font-weight:bold; color: ${effPct >= 80 ? '#16a34a' : (effPct >= 50 ? '#d97706' : '#ef4444')};">${effPct.toFixed(2)}%</span></td>
                `;
                tbody.appendChild(tr);
            });

            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No data for selected date.</td></tr>';
            }
        } catch (err) {
            console.error('Error generating Operator Efficiency Report:', err);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#ef4444;">Error generating report.</td></tr>';
        }
    }

    document.getElementById('generateOperEffBtn')?.addEventListener('click', fetchOperEffReport);
    document.getElementById('operEffDept')?.addEventListener('change', fetchOperEffReport);
    document.getElementById('operEffDate')?.addEventListener('change', fetchOperEffReport);
    document.getElementById('mcUtilDept')?.addEventListener('change', () => document.getElementById('generateMcUtilBtn')?.click());
    document.getElementById('mcUtilFromDate')?.addEventListener('change', () => document.getElementById('generateMcUtilBtn')?.click());
    document.getElementById('mcUtilToDate')?.addEventListener('change', () => document.getElementById('generateMcUtilBtn')?.click());

    document.getElementById('exportOperEffBtn')?.addEventListener('click', () => {
        const table = document.getElementById('operEffTable');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, { sheet: "Operator Efficiency" });
        XLSX.writeFile(wb, `Operator_Efficiency_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // ====== INSERT MASTER CRUD ======
    const insertMasterModal = document.getElementById('insertMasterModal');
    const insertMasterForm = document.getElementById('insertMasterForm');
    const addInsertMasterBtn = document.getElementById('addInsertMasterBtn');
    const cancelInsertMasterBtn = document.getElementById('cancelInsertMasterBtn');
    const closeInsertMasterModalBtn = document.getElementById('closeInsertMasterModalBtn');

    async function fetchInsertMasters() {
        try {
            const res = await fetch('/api/insert_masters');
            const data = await res.json();
            renderInsertMasters(data);
        } catch (err) { console.error(err); }
    }

    function renderInsertMasters(inserts) {
        const tbody = document.getElementById('insertMasterBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!inserts || inserts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No insert records found. Click "+ Add Insert" or "Import Excel" to add records.</td></tr>';
            return;
        }
        const sorted = [...inserts].sort((a, b) => {
            const specA = (a.insert_spec || a.name || '').trim().toLowerCase();
            const specB = (b.insert_spec || b.name || '').trim().toLowerCase();
            return specA.localeCompare(specB, undefined, { numeric: true, sensitivity: 'base' });
        });
        sorted.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.insert_spec || item.name || ''}</strong></td>
                <td>${item.no_of_edges || 1}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-insert-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-insert-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-insert-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/insert_masters');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openInsertMasterModal(item);
            });
        });

        tbody.querySelectorAll('.delete-insert-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this insert master record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/insert_masters/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchInsertMasters();
                        else alert('Error deleting insert record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    function openInsertMasterModal(item = null) {
        if (!insertMasterModal) return;
        if (item) {
            document.getElementById('insertMasterModalTitle').textContent = 'Edit Insert Master';
            document.getElementById('insertMasterId').value = item.id;
            document.getElementById('insertSpecInput').value = item.insert_spec || item.name || '';
            document.getElementById('insertEdgesInput').value = item.no_of_edges || 1;
        } else {
            document.getElementById('insertMasterModalTitle').textContent = 'Add Insert Master';
            insertMasterForm.reset();
            document.getElementById('insertMasterId').value = '';
        }
        insertMasterModal.classList.add('show');
    }

    if (addInsertMasterBtn) addInsertMasterBtn.addEventListener('click', () => openInsertMasterModal());
    if (cancelInsertMasterBtn) cancelInsertMasterBtn.addEventListener('click', () => insertMasterModal.classList.remove('show'));
    if (closeInsertMasterModalBtn) closeInsertMasterModalBtn.addEventListener('click', () => insertMasterModal.classList.remove('show'));

    document.getElementById('importInsertMasterBtn')?.addEventListener('click', () => {
        document.getElementById('importInsertMasterInput')?.click();
    });

    const importInsertMasterInput = document.getElementById('importInsertMasterInput');
    if (importInsertMasterInput) {
        importInsertMasterInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const inserts = [];
                    json.forEach(row => {
                        let specVal = '';
                        let edgesVal = 1;

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['insert spec', 'insert_spec', 'specification', 'insert name', 'spec', 'name'].includes(k)) {
                                specVal = String(row[key] || '').trim();
                            }
                            if (['no. of edges', 'no of edges', 'no_of_edges', 'edges', 'edge'].includes(k)) {
                                edgesVal = parseInt(row[key]) || 1;
                            }
                        }

                        if (specVal) {
                            inserts.push({
                                insert_spec: specVal,
                                no_of_edges: edgesVal,
                                grade: '',
                                make: '',
                                stock: 0,
                                price: 0.0
                            });
                        }
                    });

                    if (inserts.length === 0) {
                        alert('No valid insert spec rows found in Excel sheet. Make sure headers are "Insert Spec" and "No. of Edges".');
                        return;
                    }

                    const res = await fetch('/api/insert_masters/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ inserts })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${inserts.length} Insert Master records!`);
                        fetchInsertMasters();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Insert Master Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importInsertMasterInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    if (insertMasterForm) {
        insertMasterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('insertMasterId').value;
            const payload = {
                insert_spec: document.getElementById('insertSpecInput').value.trim(),
                no_of_edges: parseInt(document.getElementById('insertEdgesInput').value) || 1,
                grade: '',
                make: '',
                stock: 0,
                price: 0.00
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/insert_masters/${id}` : '/api/insert_masters';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    insertMasterModal.classList.remove('show');
                    fetchInsertMasters();
                } else {
                    alert('Error saving insert record');
                }
            } catch (err) { console.error(err); alert('Error saving insert record'); }
        });
    }

    // ====== DRILL MASTER CRUD ======
    const drillMasterModal = document.getElementById('drillMasterModal');
    const drillMasterForm = document.getElementById('drillMasterForm');
    const addDrillMasterBtn = document.getElementById('addDrillMasterBtn');
    const cancelDrillMasterBtn = document.getElementById('cancelDrillMasterBtn');
    const closeDrillMasterModalBtn = document.getElementById('closeDrillMasterModalBtn');

    async function fetchDrillMasters() {
        try {
            const res = await fetch('/api/drill_masters');
            const data = await res.json();
            renderDrillMasters(data);
        } catch (err) { console.error(err); }
    }

    function renderDrillMasters(drills) {
        const tbody = document.getElementById('drillMasterBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!drills || drills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No drill records found. Click "+ Add Drill" or "Import Excel" to add records.</td></tr>';
            return;
        }
        drills.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.drill_size || item.size_dia || item.name || ''}</strong></td>
                <td>${item.sl_no || ''}</td>
                <td>${item.resharp_count || 0}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-drill-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-drill-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-drill-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/drill_masters');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openDrillMasterModal(item);
            });
        });

        tbody.querySelectorAll('.delete-drill-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this drill master record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/drill_masters/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchDrillMasters();
                        else alert('Error deleting drill record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    function openDrillMasterModal(item = null) {
        if (!drillMasterModal) return;
        if (item) {
            document.getElementById('drillMasterModalTitle').textContent = 'Edit Drill Master';
            document.getElementById('drillMasterId').value = item.id;
            document.getElementById('drillSizeInput').value = item.drill_size || item.size_dia || item.name || '';
            document.getElementById('drillSlNoInput').value = item.sl_no || '';
            document.getElementById('drillResharpInput').value = item.resharp_count || 0;
        } else {
            document.getElementById('drillMasterModalTitle').textContent = 'Add Drill Master';
            drillMasterForm.reset();
            document.getElementById('drillMasterId').value = '';
        }
        drillMasterModal.classList.add('show');
    }

    if (addDrillMasterBtn) addDrillMasterBtn.addEventListener('click', () => openDrillMasterModal());
    if (cancelDrillMasterBtn) cancelDrillMasterBtn.addEventListener('click', () => drillMasterModal.classList.remove('show'));
    if (closeDrillMasterModalBtn) closeDrillMasterModalBtn.addEventListener('click', () => drillMasterModal.classList.remove('show'));

    document.getElementById('importDrillMasterBtn')?.addEventListener('click', () => {
        document.getElementById('importDrillMasterInput')?.click();
    });

    const importDrillMasterInput = document.getElementById('importDrillMasterInput');
    if (importDrillMasterInput) {
        importDrillMasterInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const drills = [];
                    json.forEach(row => {
                        let sizeVal = '';
                        let slNoVal = '';
                        let resharpVal = 0;

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['drill size', 'drill_size', 'size / dia', 'size', 'dia', 'drill name', 'name'].includes(k)) {
                                sizeVal = String(row[key] || '').trim();
                            }
                            if (['sl no', 'sl_no', 'serial no', 'sl.no', 'slno', 'serial'].includes(k)) {
                                slNoVal = String(row[key] || '').trim();
                            }
                            if (['resharp count', 'resharp_count', 'resharp', 'resharpen count', 'resharpening'].includes(k)) {
                                resharpVal = parseInt(row[key]) || 0;
                            }
                        }

                        if (sizeVal || slNoVal) {
                            drills.push({
                                drill_size: sizeVal,
                                sl_no: slNoVal,
                                resharp_count: resharpVal,
                                name: '',
                                size_dia: '',
                                specification: '',
                                make: '',
                                stock: 0,
                                price: 0.0
                            });
                        }
                    });

                    if (drills.length === 0) {
                        alert('No valid drill records found in Excel sheet. Make sure headers are "Drill Size", "Sl No", and "Resharp Count".');
                        return;
                    }

                    const res = await fetch('/api/drill_masters/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ drills })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${drills.length} Drill Master records!`);
                        fetchDrillMasters();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Drill Master Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importDrillMasterInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    if (drillMasterForm) {
        drillMasterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('drillMasterId').value;
            const payload = {
                drill_size: document.getElementById('drillSizeInput').value.trim(),
                sl_no: document.getElementById('drillSlNoInput').value.trim(),
                resharp_count: parseInt(document.getElementById('drillResharpInput').value) || 0,
                name: '',
                size_dia: '',
                specification: '',
                make: '',
                stock: 0,
                price: 0.00
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/drill_masters/${id}` : '/api/drill_masters';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    drillMasterModal.classList.remove('show');
                    fetchDrillMasters();
                } else {
                    alert('Error saving drill record');
                }
            } catch (err) { console.error(err); alert('Error saving drill record'); }
        });
    }

    // ====== TAP MASTER CRUD ======
    const tapMasterModal = document.getElementById('tapMasterModal');
    const tapMasterForm = document.getElementById('tapMasterForm');
    const addTapMasterBtn = document.getElementById('addTapMasterBtn');
    const cancelTapMasterBtn = document.getElementById('cancelTapMasterBtn');
    const closeTapMasterModalBtn = document.getElementById('closeTapMasterModalBtn');

    async function fetchTapMasters() {
        try {
            const res = await fetch('/api/tap_masters');
            const data = await res.json();
            renderTapMasters(data);
        } catch (err) { console.error(err); }
    }

    function renderTapMasters(items) {
        const tbody = document.getElementById('tapMasterBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No tap records found. Click "+ Add Tap" or "Import Excel" to add records.</td></tr>';
            return;
        }
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.tap_spec || item.specification || item.name || ''}</strong></td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-tap-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-tap-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-tap-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/tap_masters');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openTapMasterModal(item);
            });
        });

        tbody.querySelectorAll('.delete-tap-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this tap master record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/tap_masters/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchTapMasters();
                        else alert('Error deleting tap record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    function openTapMasterModal(item = null) {
        if (!tapMasterModal) return;
        if (item) {
            document.getElementById('tapMasterModalTitle').textContent = 'Edit Tap Master';
            document.getElementById('tapMasterId').value = item.id;
            document.getElementById('tapSpecInput').value = item.tap_spec || item.specification || item.name || '';
        } else {
            document.getElementById('tapMasterModalTitle').textContent = 'Add Tap Master';
            tapMasterForm.reset();
            document.getElementById('tapMasterId').value = '';
        }
        tapMasterModal.classList.add('show');
    }

    if (addTapMasterBtn) addTapMasterBtn.addEventListener('click', () => openTapMasterModal());
    if (cancelTapMasterBtn) cancelTapMasterBtn.addEventListener('click', () => tapMasterModal.classList.remove('show'));
    if (closeTapMasterModalBtn) closeTapMasterModalBtn.addEventListener('click', () => tapMasterModal.classList.remove('show'));

    if (tapMasterForm) {
        tapMasterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('tapMasterId').value;
            const payload = {
                tap_spec: document.getElementById('tapSpecInput').value.trim(),
                name: '',
                specification: '',
                make: '',
                stock: 0,
                price: 0.00
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/tap_masters/${id}` : '/api/tap_masters';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    tapMasterModal.classList.remove('show');
                    fetchTapMasters();
                } else {
                    alert('Error saving tap record');
                }
            } catch (err) { console.error(err); alert('Error saving tap record'); }
        });
    }

    document.getElementById('importTapMasterBtn')?.addEventListener('click', () => {
        document.getElementById('importTapMasterInput')?.click();
    });

    const importTapMasterInput = document.getElementById('importTapMasterInput');
    if (importTapMasterInput) {
        importTapMasterInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const taps = [];
                    json.forEach(row => {
                        let tapSpecVal = '';

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['tap spec', 'tap_spec', 'tap', 'specification', 'spec', 'tap size', 'tap_size', 'name'].includes(k)) {
                                tapSpecVal = String(row[key] || '').trim();
                            }
                        }

                        if (tapSpecVal) {
                            taps.push({
                                tap_spec: tapSpecVal,
                                name: '',
                                specification: '',
                                make: '',
                                stock: 0,
                                price: 0.0
                            });
                        }
                    });

                    if (taps.length === 0) {
                        alert('No valid tap records found in Excel sheet. Make sure column header is "Tap Spec".');
                        return;
                    }

                    const res = await fetch('/api/tap_masters/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taps })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${taps.length} Tap Master records!`);
                        fetchTapMasters();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Tap Master Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importTapMasterInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    // ====== INSERT RECEIPT CRUD ======
    const insertReceiptModal = document.getElementById('insertReceiptModal');
    const insertReceiptForm = document.getElementById('insertReceiptForm');
    const addInsertReceiptBtn = document.getElementById('addInsertReceiptBtn');
    const cancelInsertReceiptBtn = document.getElementById('cancelInsertReceiptBtn');
    const closeInsertReceiptModalBtn = document.getElementById('closeInsertReceiptModalBtn');

    let allInsertReceiptsCache = [];

    async function fetchInsertReceipts() {
        try {
            const res = await fetch('/api/insert_receipts');
            allInsertReceiptsCache = await res.json();
            applyInsertReceiptFilters();
        } catch (err) { console.error(err); }
    }

    function applyInsertReceiptFilters() {
        if (!allInsertReceiptsCache) return;
        const inputs = document.querySelectorAll('.insert-receipt-col-filter');
        const filters = {};
        inputs.forEach(inp => {
            const key = inp.getAttribute('data-key');
            const val = inp.value.trim().toLowerCase();
            if (val) filters[key] = val;
        });

        let filtered = allInsertReceiptsCache;
        if (Object.keys(filters).length > 0) {
            filtered = allInsertReceiptsCache.filter(item => {
                if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
                if (filters.date && !(item.date || '').toLowerCase().includes(filters.date) && !formatExcelDate(item.date).toLowerCase().includes(filters.date)) return false;
                if (filters.supplier && !(item.supplier || '').toLowerCase().includes(filters.supplier)) return false;
                if (filters.insert_spec && !(item.insert_spec || '').toLowerCase().includes(filters.insert_spec)) return false;
                if (filters.batch_no && !(item.batch_no || '').toLowerCase().includes(filters.batch_no)) return false;
                if (filters.qty && !String(item.qty || 0).toLowerCase().includes(filters.qty)) return false;
                if (filters.rate && !String(item.rate || 0).toLowerCase().includes(filters.rate)) return false;
                return true;
            });
        }

        renderInsertReceipts(filtered);
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.classList.contains('insert-receipt-col-filter')) {
            applyInsertReceiptFilters();
        }
    });

    document.getElementById('clearInsertReceiptFiltersBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.insert-receipt-col-filter').forEach(inp => inp.value = '');
        applyInsertReceiptFilters();
    });

    function renderInsertReceipts(receipts) {
        const tbody = document.getElementById('insertReceiptBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!receipts || receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No insert receipts found. Click "+ Add Receipt" or "Import Excel" to add records.</td></tr>';
            return;
        }
        receipts.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><span style="font-weight: 500;">${item.date || ''}</span></td>
                <td>${item.supplier || ''}</td>
                <td><strong>${item.insert_spec || ''}</strong></td>
                <td>${item.batch_no || ''}</td>
                <td>${item.qty || 0}</td>
                <td>Rs. ${(item.rate || 0).toFixed(2)}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-receipt-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-receipt-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/insert_receipts');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openInsertReceiptModal(item);
            });
        });

        tbody.querySelectorAll('.delete-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this insert receipt record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/insert_receipts/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchInsertReceipts();
                        else alert('Error deleting receipt record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    // Clear All / Bulk Delete event listeners for Tool Crib
    document.getElementById('deleteAllInsertMastersBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL insert master entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/insert_masters/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All insert master entries deleted successfully.');
                    fetchInsertMasters();
                } else {
                    alert('Error deleting insert master entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    document.getElementById('deleteAllDrillMastersBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL drill master entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/drill_masters/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All drill master entries deleted successfully.');
                    fetchDrillMasters();
                } else {
                    alert('Error deleting drill master entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    document.getElementById('deleteAllTapMastersBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL tap master entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/tap_masters/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All tap master entries deleted successfully.');
                    fetchTapMasters();
                } else {
                    alert('Error deleting tap master entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    document.getElementById('deleteAllInsertReceiptsBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL insert receipt entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/insert_receipts/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All insert receipt entries deleted successfully.');
                    fetchInsertReceipts();
                } else {
                    alert('Error deleting insert receipt entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    document.getElementById('deleteAllTapReceiptsBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL tap receipt entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/tap_receipts/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All tap receipt entries deleted successfully.');
                    fetchTapReceipts();
                } else {
                    alert('Error deleting tap receipt entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    document.getElementById('deleteAllInsertIssuesBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL insert issue entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/insert_issues/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All insert issue entries deleted successfully.');
                    fetchInsertIssues();
                } else {
                    alert('Error deleting insert issue entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    // Reusable Searchable Select helper using TomSelect
    const tomSelectCache = {};

    function makeSearchableSelect(selectId, placeholderText = '-- Select Insert Spec --') {
        const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!select) return;
        const id = select.id || 'select_' + Math.random().toString(36).substr(2, 5);

        if (tomSelectCache[id]) {
            try { tomSelectCache[id].destroy(); } catch(e) {}
            delete tomSelectCache[id];
        }

        const oldWrapper = select.parentElement ? select.parentElement.querySelector('.searchable-select-wrapper') : null;
        if (oldWrapper) {
            oldWrapper.remove();
            select.style.display = 'block';
        }

        try {
            if (window.TomSelect) {
                tomSelectCache[id] = new TomSelect(select, {
                    create: false,
                    placeholder: placeholderText,
                    allowEmptyOption: true,
                    maxOptions: 500,
                    sortField: { field: "text", direction: "asc" }
                });
            }
        } catch (e) {
            console.error('Error initializing TomSelect on ' + id, e);
        }
    }

    async function populateInsertSpecDropdown(selectedSpec = '') {
        const sel = document.getElementById('receiptInsertSpecSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Insert Spec --</option>';
        try {
            const res = await fetch('/api/insert_masters');
            const data = await res.json();
            data.forEach(item => {
                const spec = item.insert_spec || item.name || '';
                if (spec) {
                    const opt = document.createElement('option');
                    opt.value = spec;
                    opt.textContent = spec;
                    if (selectedSpec && selectedSpec.trim().toLowerCase() === spec.trim().toLowerCase()) {
                        opt.selected = true;
                    }
                    sel.appendChild(opt);
                }
            });
            if (selectedSpec && !data.some(item => (item.insert_spec || item.name || '').trim().toLowerCase() === selectedSpec.trim().toLowerCase())) {
                const customOpt = document.createElement('option');
                customOpt.value = selectedSpec;
                customOpt.textContent = selectedSpec;
                customOpt.selected = true;
                sel.appendChild(customOpt);
            }
            makeSearchableSelect('receiptInsertSpecSelect');
            if (selectedSpec && tomSelectCache['receiptInsertSpecSelect']) {
                tomSelectCache['receiptInsertSpecSelect'].setValue(selectedSpec);
            }
        } catch (e) { console.error('Error fetching insert specs for dropdown:', e); }
    }

    async function generateNextBatchNo(dateStr) {
        if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
        }
        const parts = dateStr.split('-');
        let month = parseInt(parts[1], 10);
        let day = parseInt(parts[2], 10);
        if (isNaN(month) || isNaN(day)) {
            const d = new Date();
            month = d.getMonth() + 1;
            day = d.getDate();
        }
        const monthLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
        const monthLetter = monthLetters[(month - 1) % 12] || 'a';
        const prefix = `${monthLetter}${day}`;

        try {
            const res = await fetch('/api/insert_receipts');
            const data = await res.json();
            let maxSerial = 0;

            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item.batch_no) {
                        const b = item.batch_no.trim().toLowerCase();
                        if (b.startsWith(prefix.toLowerCase())) {
                            const rest = b.substring(prefix.length);
                            const num = parseInt(rest, 10);
                            if (!isNaN(num) && num > maxSerial) {
                                maxSerial = num;
                            }
                        }
                    }
                });
            }
            return `${prefix}${maxSerial + 1}`;
        } catch (err) {
            console.error('Error generating batch no:', err);
            return `${prefix}1`;
        }
    }

    let receiptSupplierTomSelect = null;

    async function populateSupplierDropdown(selectedSupplier = '') {
        const sel = document.getElementById('receiptSupplierInput');
        if (!sel) return;

        if (receiptSupplierTomSelect) {
            try { receiptSupplierTomSelect.destroy(); } catch (e) {}
            receiptSupplierTomSelect = null;
        }

        sel.innerHTML = '<option value="">-- Select Supplier --</option>';

        try {
            const res = await fetch('/api/suppliers');
            const suppliers = await res.json();
            
            suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                if (selectedSupplier && (s.name.trim().toLowerCase() === selectedSupplier.trim().toLowerCase())) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });

            if (selectedSupplier && !suppliers.some(s => s.name.trim().toLowerCase() === selectedSupplier.trim().toLowerCase())) {
                const customOpt = document.createElement('option');
                customOpt.value = selectedSupplier;
                customOpt.textContent = selectedSupplier;
                customOpt.selected = true;
                sel.appendChild(customOpt);
            }
        } catch (err) {
            console.error('Error fetching suppliers for dropdown:', err);
        }

        try {
            if (window.TomSelect) {
                receiptSupplierTomSelect = new TomSelect(sel, {
                    create: true,
                    placeholder: '-- Select or Type Supplier --',
                    allowEmptyOption: true,
                    maxOptions: 500,
                    sortField: { field: "text", direction: "asc" }
                });
                if (selectedSupplier) {
                    receiptSupplierTomSelect.setValue(selectedSupplier);
                }
            }
        } catch (e) {
            console.error('Error initializing TomSelect on receiptSupplierInput:', e);
        }
    }

    async function openInsertReceiptModal(item = null) {
        if (!insertReceiptModal) return;
        await populateInsertSpecDropdown(item ? item.insert_spec : '');
        await populateSupplierDropdown(item ? item.supplier : '');
        if (item) {
            document.getElementById('insertReceiptModalTitle').textContent = 'Edit Insert Receipt';
            document.getElementById('insertReceiptId').value = item.id;
            document.getElementById('receiptDateInput').value = item.date || '';
            document.getElementById('receiptBatchNoInput').value = item.batch_no || '';
            document.getElementById('receiptQtyInput').value = (item.qty !== undefined && item.qty !== null) ? item.qty : 1;
            document.getElementById('receiptRateInput').value = (item.rate !== undefined && item.rate !== null) ? item.rate : 0.00;
        } else {
            document.getElementById('insertReceiptModalTitle').textContent = 'Add Insert Receipt';
            insertReceiptForm.reset();
            document.getElementById('insertReceiptId').value = '';
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('receiptDateInput').value = todayStr;
            const autoBatch = await generateNextBatchNo(todayStr);
            document.getElementById('receiptBatchNoInput').value = autoBatch;
        }
        makeSearchableSelect('receiptInsertSpecSelect');
        if (item && item.insert_spec && tomSelectCache['receiptInsertSpecSelect']) {
            tomSelectCache['receiptInsertSpecSelect'].setValue(item.insert_spec);
        }
        if (item && item.supplier && receiptSupplierTomSelect) {
            receiptSupplierTomSelect.setValue(item.supplier);
        }
        insertReceiptModal.classList.add('show');
    }

    document.getElementById('receiptDateInput')?.addEventListener('change', async (e) => {
        const isEdit = !!document.getElementById('insertReceiptId').value;
        if (!isEdit && e.target.value) {
            const nextBatch = await generateNextBatchNo(e.target.value);
            document.getElementById('receiptBatchNoInput').value = nextBatch;
        }
    });

    if (addInsertReceiptBtn) addInsertReceiptBtn.addEventListener('click', () => openInsertReceiptModal());
    if (cancelInsertReceiptBtn) cancelInsertReceiptBtn.addEventListener('click', () => insertReceiptModal.classList.remove('show'));
    if (closeInsertReceiptModalBtn) closeInsertReceiptModalBtn.addEventListener('click', () => insertReceiptModal.classList.remove('show'));

    document.getElementById('importInsertReceiptBtn')?.addEventListener('click', () => {
        document.getElementById('importInsertReceiptInput')?.click();
    });

    const importInsertReceiptInput = document.getElementById('importInsertReceiptInput');
    if (importInsertReceiptInput) {
        importInsertReceiptInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const receipts = [];
                    const todayStr = new Date().toISOString().slice(0, 10);
                    json.forEach(row => {
                        let dateVal = todayStr;
                        let supplierVal = '';
                        let specVal = '';
                        let batchVal = '';
                        let qtyVal = 0;
                        let rateVal = 0.0;

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['date', 'receipt date', 'receipt_date'].includes(k)) {
                                dateVal = String(row[key] || '').trim();
                            }
                            if (['supplier', 'vendor', 'supplier name'].includes(k)) {
                                supplierVal = String(row[key] || '').trim();
                            }
                            if (['insert spec', 'insert_spec', 'spec', 'specification', 'insert'].includes(k)) {
                                specVal = String(row[key] || '').trim();
                            }
                            if (['batch no', 'batch_no', 'batch', 'batch number', 'lot no'].includes(k)) {
                                batchVal = String(row[key] || '').trim();
                            }
                            if (['qty', 'quantity', 'count'].includes(k)) {
                                qtyVal = parseInt(row[key]) || 0;
                            }
                            if (['rate', 'price', 'rate (rs)', 'unit rate'].includes(k)) {
                                rateVal = parseFloat(row[key]) || 0.0;
                            }
                        }

                        if (specVal) {
                            receipts.push({
                                date: dateVal || todayStr,
                                supplier: supplierVal,
                                insert_spec: specVal,
                                batch_no: batchVal,
                                qty: qtyVal,
                                rate: rateVal
                            });
                        }
                    });

                    if (receipts.length === 0) {
                        alert('No valid receipt records found in Excel sheet. Make sure headers are "Date", "Supplier", "Insert Spec", "Batch No", "Qty", and "Rate".');
                        return;
                    }

                    const res = await fetch('/api/insert_receipts/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ receipts })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${receipts.length} Insert Receipt records!`);
                        fetchInsertReceipts();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Insert Receipt Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importInsertReceiptInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    if (insertReceiptForm) {
        insertReceiptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('insertReceiptId').value;
            const payload = {
                date: document.getElementById('receiptDateInput').value,
                supplier: (receiptSupplierTomSelect ? receiptSupplierTomSelect.getValue() : document.getElementById('receiptSupplierInput').value || '').trim(),
                insert_spec: document.getElementById('receiptInsertSpecSelect').value,
                batch_no: document.getElementById('receiptBatchNoInput').value.trim(),
                qty: parseInt(document.getElementById('receiptQtyInput').value) || 0,
                rate: parseFloat(document.getElementById('receiptRateInput').value) || 0.00
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/insert_receipts/${id}` : '/api/insert_receipts';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    insertReceiptModal.classList.remove('show');
                    fetchInsertReceipts();
                } else {
                    alert('Error saving receipt record');
                }
            } catch (err) { console.error(err); alert('Error saving receipt record'); }
        });
    }

    // ====== TAP RECEIPT CRUD ======
    const tapReceiptModal = document.getElementById('tapReceiptModal');
    const tapReceiptForm = document.getElementById('tapReceiptForm');
    const addTapReceiptBtn = document.getElementById('addTapReceiptBtn');
    const cancelTapReceiptBtn = document.getElementById('cancelTapReceiptBtn');
    const closeTapReceiptModalBtn = document.getElementById('closeTapReceiptModalBtn');

    let allTapReceiptsCache = [];

    async function fetchTapReceipts() {
        try {
            const res = await fetch('/api/tap_receipts');
            allTapReceiptsCache = await res.json();
            applyTapReceiptFilters();
        } catch (err) { console.error(err); }
    }

    function applyTapReceiptFilters() {
        if (!allTapReceiptsCache) return;
        const inputs = document.querySelectorAll('.tap-receipt-col-filter');
        const filters = {};
        inputs.forEach(inp => {
            const key = inp.getAttribute('data-key');
            const val = inp.value.trim().toLowerCase();
            if (val) filters[key] = val;
        });

        let filtered = allTapReceiptsCache;
        if (Object.keys(filters).length > 0) {
            filtered = allTapReceiptsCache.filter(item => {
                if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
                if (filters.date && !(item.date || '').toLowerCase().includes(filters.date) && !formatExcelDate(item.date).toLowerCase().includes(filters.date)) return false;
                if (filters.supplier && !(item.supplier || '').toLowerCase().includes(filters.supplier)) return false;
                if (filters.tap_spec && !(item.tap_spec || '').toLowerCase().includes(filters.tap_spec)) return false;
                if (filters.qty && !String(item.qty || 0).toLowerCase().includes(filters.qty)) return false;
                if (filters.rate && !String(item.rate || 0).toLowerCase().includes(filters.rate)) return false;
                return true;
            });
        }

        renderTapReceipts(filtered);
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.classList.contains('tap-receipt-col-filter')) {
            applyTapReceiptFilters();
        }
    });

    document.getElementById('clearTapReceiptFiltersBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.tap-receipt-col-filter').forEach(inp => inp.value = '');
        applyTapReceiptFilters();
    });

    function renderTapReceipts(receipts) {
        const tbody = document.getElementById('tapReceiptBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!receipts || receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No tap receipts found. Click "+ Add Receipt" or "Import Excel" to add records.</td></tr>';
            return;
        }
        receipts.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><span style="font-weight: 500;">${item.date || ''}</span></td>
                <td>${item.supplier || ''}</td>
                <td><strong>${item.tap_spec || ''}</strong></td>
                <td>${item.qty || 0}</td>
                <td>Rs. ${(item.rate || 0).toFixed(2)}</td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-tap-receipt-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-tap-receipt-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-tap-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/tap_receipts');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openTapReceiptModal(item);
            });
        });

        tbody.querySelectorAll('.delete-tap-receipt-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this tap receipt record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/tap_receipts/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchTapReceipts();
                        else alert('Error deleting receipt record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    async function populateTapSpecDropdown(selectedSpec = '') {
        const sel = document.getElementById('tapReceiptSpecSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Tap Spec --</option>';
        try {
            const res = await fetch('/api/tap_masters');
            const data = await res.json();
            data.forEach(item => {
                const spec = item.tap_spec || item.specification || item.name || '';
                if (spec) {
                    const opt = document.createElement('option');
                    opt.value = spec;
                    opt.textContent = spec;
                    if (selectedSpec && selectedSpec.trim().toLowerCase() === spec.trim().toLowerCase()) {
                        opt.selected = true;
                    }
                    sel.appendChild(opt);
                }
            });
            if (selectedSpec && !data.some(item => (item.tap_spec || item.specification || item.name || '').trim().toLowerCase() === selectedSpec.trim().toLowerCase())) {
                const customOpt = document.createElement('option');
                customOpt.value = selectedSpec;
                customOpt.textContent = selectedSpec;
                customOpt.selected = true;
                sel.appendChild(customOpt);
            }
            makeSearchableSelect('tapReceiptSpecSelect', '-- Select Tap Spec --');
            if (selectedSpec && tomSelectCache['tapReceiptSpecSelect']) {
                tomSelectCache['tapReceiptSpecSelect'].setValue(selectedSpec);
            }
        } catch (e) { console.error('Error fetching tap specs for dropdown:', e); }
    }

    let tapReceiptSupplierTomSelect = null;

    async function populateTapReceiptSupplierDropdown(selectedSupplier = '') {
        const sel = document.getElementById('tapReceiptSupplierInput');
        if (!sel) return;

        if (tapReceiptSupplierTomSelect) {
            try { tapReceiptSupplierTomSelect.destroy(); } catch (e) {}
            tapReceiptSupplierTomSelect = null;
        }

        sel.innerHTML = '<option value="">-- Select Supplier --</option>';

        try {
            const res = await fetch('/api/suppliers');
            const suppliers = await res.json();
            
            suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                if (selectedSupplier && (s.name.trim().toLowerCase() === selectedSupplier.trim().toLowerCase())) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });

            if (selectedSupplier && !suppliers.some(s => s.name.trim().toLowerCase() === selectedSupplier.trim().toLowerCase())) {
                const customOpt = document.createElement('option');
                customOpt.value = selectedSupplier;
                customOpt.textContent = selectedSupplier;
                customOpt.selected = true;
                sel.appendChild(customOpt);
            }
        } catch (err) {
            console.error('Error fetching suppliers for dropdown:', err);
        }

        try {
            if (window.TomSelect) {
                tapReceiptSupplierTomSelect = new TomSelect(sel, {
                    create: true,
                    placeholder: '-- Select or Type Supplier --',
                    allowEmptyOption: true,
                    maxOptions: 500,
                    sortField: { field: "text", direction: "asc" }
                });
                if (selectedSupplier) {
                    tapReceiptSupplierTomSelect.setValue(selectedSupplier);
                }
            }
        } catch (e) {
            console.error('Error initializing TomSelect on tapReceiptSupplierInput:', e);
        }
    }

    async function openTapReceiptModal(item = null) {
        if (!tapReceiptModal) return;
        await populateTapSpecDropdown(item ? item.tap_spec : '');
        await populateTapReceiptSupplierDropdown(item ? item.supplier : '');
        if (item) {
            document.getElementById('tapReceiptModalTitle').textContent = 'Edit Tap Receipt';
            document.getElementById('tapReceiptId').value = item.id;
            document.getElementById('tapReceiptDateInput').value = item.date || '';
            document.getElementById('tapReceiptQtyInput').value = (item.qty !== undefined && item.qty !== null) ? item.qty : 1;
            document.getElementById('tapReceiptRateInput').value = (item.rate !== undefined && item.rate !== null) ? item.rate : 0.00;
        } else {
            document.getElementById('tapReceiptModalTitle').textContent = 'Add Tap Receipt';
            tapReceiptForm.reset();
            document.getElementById('tapReceiptId').value = '';
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('tapReceiptDateInput').value = todayStr;
        }
        makeSearchableSelect('tapReceiptSpecSelect', '-- Select Tap Spec --');
        if (item && item.tap_spec && tomSelectCache['tapReceiptSpecSelect']) {
            tomSelectCache['tapReceiptSpecSelect'].setValue(item.tap_spec);
        }
        if (item && item.supplier && tapReceiptSupplierTomSelect) {
            tapReceiptSupplierTomSelect.setValue(item.supplier);
        }
        tapReceiptModal.classList.add('show');
    }

    if (addTapReceiptBtn) addTapReceiptBtn.addEventListener('click', () => openTapReceiptModal());
    if (cancelTapReceiptBtn) cancelTapReceiptBtn.addEventListener('click', () => tapReceiptModal.classList.remove('show'));
    if (closeTapReceiptModalBtn) closeTapReceiptModalBtn.addEventListener('click', () => tapReceiptModal.classList.remove('show'));

    if (tapReceiptForm) {
        tapReceiptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('tapReceiptId').value;
            const payload = {
                date: document.getElementById('tapReceiptDateInput').value,
                supplier: (tapReceiptSupplierTomSelect ? tapReceiptSupplierTomSelect.getValue() : document.getElementById('tapReceiptSupplierInput').value || '').trim(),
                tap_spec: document.getElementById('tapReceiptSpecSelect').value,
                qty: parseInt(document.getElementById('tapReceiptQtyInput').value) || 1,
                rate: parseFloat(document.getElementById('tapReceiptRateInput').value) || 0.00
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/tap_receipts/${id}` : '/api/tap_receipts';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    tapReceiptModal.classList.remove('show');
                    fetchTapReceipts();
                } else {
                    alert('Error saving tap receipt record');
                }
            } catch (err) { console.error(err); alert('Error saving tap receipt record'); }
        });
    }

    document.getElementById('importTapReceiptBtn')?.addEventListener('click', () => {
        document.getElementById('importTapReceiptInput')?.click();
    });

    const importTapReceiptInput = document.getElementById('importTapReceiptInput');
    if (importTapReceiptInput) {
        importTapReceiptInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const receipts = [];
                    const todayStr = new Date().toISOString().slice(0, 10);
                    json.forEach(row => {
                        let dateVal = todayStr;
                        let supplierVal = '';
                        let specVal = '';
                        let qtyVal = 0;
                        let rateVal = 0.0;

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['date', 'receipt_date', 'receipt date'].includes(k)) {
                                dateVal = formatExcelDate(row[key]);
                            }
                            if (['supplier', 'vendor', 'supplier_name', 'supplier name'].includes(k)) {
                                supplierVal = String(row[key] || '').trim();
                            }
                            if (['tap spec', 'tap_spec', 'tap', 'specification', 'spec', 'tap size', 'tap_size'].includes(k)) {
                                specVal = String(row[key] || '').trim();
                            }
                            if (['qty', 'quantity', 'qty_received', 'qty received', 'rec_qty'].includes(k)) {
                                qtyVal = parseInt(row[key]) || 0;
                            }
                            if (['rate', 'price', 'unit_price', 'unit price', 'cost'].includes(k)) {
                                rateVal = parseFloat(row[key]) || 0.0;
                            }
                        }

                        if (specVal) {
                            receipts.push({
                                date: dateVal,
                                supplier: supplierVal,
                                tap_spec: specVal,
                                qty: qtyVal,
                                rate: rateVal
                            });
                        }
                    });

                    if (receipts.length === 0) {
                        alert('No valid tap receipt records found in Excel sheet. Make sure headers are "Date", "Supplier", "Tap Spec", "Qty", and "Rate".');
                        return;
                    }

                    const res = await fetch('/api/tap_receipts/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ receipts })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${receipts.length} Tap Receipt records!`);
                        fetchTapReceipts();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Tap Receipt Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importTapReceiptInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    // ====== INSERT ISSUE CRUD ======
    const insertIssueModal = document.getElementById('insertIssueModal');
    const insertIssueForm = document.getElementById('insertIssueForm');
    const addInsertIssueBtn = document.getElementById('addInsertIssueBtn');
    const cancelInsertIssueBtn = document.getElementById('cancelInsertIssueBtn');
    const closeInsertIssueModalBtn = document.getElementById('closeInsertIssueModalBtn');

    let allReceiptsCache = [];
    let allPartMastersCache = [];

    let allInsertMastersCache = [];

    let allInsertIssuesCache = [];

    async function fetchInsertIssues() {
        try {
            const [issueRes, masterRes] = await Promise.all([
                fetch('/api/insert_issues'),
                fetch('/api/insert_masters')
            ]);
            allInsertIssuesCache = await issueRes.json();
            allInsertMastersCache = await masterRes.json();
            applyInsertIssueFilters();
        } catch (err) { console.error(err); }
    }

    function applyInsertIssueFilters() {
        if (!allInsertIssuesCache) return;
        const inputs = document.querySelectorAll('.insert-issue-col-filter');
        const filters = {};
        inputs.forEach(inp => {
            const key = inp.getAttribute('data-key');
            const val = inp.value.trim().toLowerCase();
            if (val) filters[key] = val;
        });

        let filtered = allInsertIssuesCache;
        if (Object.keys(filters).length > 0) {
            filtered = allInsertIssuesCache.filter(item => {
                if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
                if (filters.date && !formatExcelDate(item.date).toLowerCase().includes(filters.date)) return false;
                if (filters.shift && !(item.shift || '').toLowerCase().includes(filters.shift)) return false;
                if (filters.dept && !(item.department || '').toLowerCase().includes(filters.dept)) return false;
                if (filters.insert_spec && !(item.insert_spec || '').toLowerCase().includes(filters.insert_spec)) return false;
                if (filters.batch_no && !(item.batch_no || '').toLowerCase().includes(filters.batch_no)) return false;
                if (filters.qty_issued && !String(item.qty_issued || '').toLowerCase().includes(filters.qty_issued)) return false;

                let usages = [];
                if (item.usages) {
                    try {
                        let parsed = item.usages;
                        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
                        if (Array.isArray(parsed)) usages = parsed;
                    } catch(e) {}
                }
                if (!usages || usages.length === 0) {
                    usages = [{ machine: item.machine || '', operator: item.operator || '', partno: item.partno || '', opn_no: item.opn_no || '' }];
                }

                if (filters.machine && !usages.some(u => (u.machine || '').toLowerCase().includes(filters.machine))) return false;
                if (filters.operator && !usages.some(u => (u.operator || '').toLowerCase().includes(filters.operator))) return false;
                if (filters.partno && !usages.some(u => (u.partno || '').toLowerCase().includes(filters.partno))) return false;
                if (filters.opn_no && !usages.some(u => (u.opn_no || '').toLowerCase().includes(filters.opn_no))) return false;

                return true;
            });
        }

        renderInsertIssues(filtered);
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.classList.contains('insert-issue-col-filter')) {
            applyInsertIssueFilters();
        }
    });

    document.getElementById('clearInsertIssueFiltersBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.insert-issue-col-filter').forEach(inp => inp.value = '');
        applyInsertIssueFilters();
    });

    function normalizeEdgeObj(rawEdgeData) {
        const result = {};
        if (!rawEdgeData) return result;
        let parsed = rawEdgeData;
        try {
            while (typeof parsed === 'string') {
                parsed = JSON.parse(parsed);
            }
        } catch(e) {}
        if (typeof parsed !== 'object' || parsed === null) return result;

        for (const key of Object.keys(parsed)) {
            const val = parsed[key];
            if (val !== undefined && val !== null && val !== '') {
                if (typeof val === 'object' && val.qty !== undefined) {
                    result[key] = {
                        qty: parseFloat(val.qty) || 0,
                        uIdx: val.uIdx !== undefined ? parseInt(val.uIdx) : 0,
                        partno: val.partno || ''
                    };
                } else if (!isNaN(val) && parseFloat(val) > 0) {
                    result[key] = {
                        qty: parseFloat(val),
                        uIdx: 0,
                        partno: ''
                    };
                }
            }
        }
        return result;
    }

    function getInstEdgeObj(edgeData, instIdx) {
        if (!edgeData) return {};
        let parsed = edgeData;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch(e) { return {}; }
        }
        if (!parsed || typeof parsed !== 'object') return {};

        if (parsed.instances && typeof parsed.instances === 'object') {
            const instData = parsed.instances[String(instIdx)];
            return normalizeEdgeObj(instData);
        }
        if (instIdx === 0) {
            return normalizeEdgeObj(parsed);
        }
        return {};
    }

    function setInstEdgeObj(edgeData, instIdx, newInstObj) {
        let parsed = edgeData;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch(e) { parsed = {}; }
        }
        if (!parsed || typeof parsed !== 'object') parsed = {};

        if (!parsed.instances || typeof parsed.instances !== 'object') {
            const legacyObj = normalizeEdgeObj(parsed);
            parsed = {
                instances: {
                    "0": legacyObj
                }
            };
        }
        parsed.instances[String(instIdx)] = newInstObj;
        return JSON.stringify(parsed);
    }

    function isInstComplete(item, instIdx, numEdges) {
        const instObj = getInstEdgeObj(item.edge_data, instIdx);
        let filledCount = 0;
        for (let i = 1; i <= numEdges; i++) {
            const info = instObj[String(i)];
            if (info && info.qty > 0) filledCount++;
        }
        return filledCount >= numEdges && numEdges > 0;
    }

    function getDeptShortCode(dept) {
        if (!dept) return '-';
        const clean = dept.trim().toUpperCase();
        if (clean === 'WIPRO') return 'W';
        if (clean === 'SPIDER') return 'S';
        if (clean === 'MAINT' || clean === 'MAINTENANCE') return 'M';
        if (clean === 'ADMIN') return 'A';
        if (clean === 'GEAR') return 'G';
        if (clean === 'HR') return 'H';
        if (clean === 'QC' || clean === 'QUALITY') return 'Q';
        if (clean === 'TC' || clean === 'TOOL CRIB') return 'TC';
        if (clean === 'BC') return 'B';
        return clean.charAt(0);
    }

    function formatDateDDMM(dateStr) {
        if (!dateStr) return '-';
        const fmt = formatExcelDate(dateStr);
        const parts = fmt.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}`;
        }
        return fmt;
    }

    function getDayDD(dateStr) {
        if (!dateStr) return '-';
        const fmt = formatExcelDate(dateStr);
        const parts = fmt.split('-');
        return parts.length === 3 ? parts[2] : fmt;
    }

    function buildMonitorCellHtml(item, uIdx, numEdges) {
        const qty = Math.max(1, parseInt(item.qty_issued) || 1);
        let html = '<div style="display: flex; flex-direction: column; gap: 3px;">';
        for (let iIdx = 0; iIdx < qty; iIdx++) {
            const isDone = isInstComplete(item, iIdx, numEdges);
            const btnLabel = qty > 1 ? `Ins #${iIdx + 1}` : `Insert Monitor`;
            html += `
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button class="btn btn-outline monitor-issue-btn" data-id="${item.id}" data-usage-idx="${uIdx}" data-inst-idx="${iIdx}" style="padding: 0.18rem 0.45rem; font-size: 0.76rem; color: #2563eb; border-color: #2563eb; font-weight: 600; border-radius: 4px; line-height: 1.2;">${btnLabel}</button>
                    ${isDone ? '<span title="All edge details entered for Insert #' + (iIdx + 1) + '" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background-color: #22c55e; color: white; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">✓</span>' : ''}
                </div>
            `;
        }
        html += '</div>';
        return html;
    }

    function renderInsertIssues(issues) {
        const tbody = document.getElementById('insertIssueBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!issues || issues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No insert issue records found. Click "+ Issue Insert" or "Import Excel" to add records.</td></tr>';
            return;
        }

        issues.forEach(item => {
            let numEdges = 4;
            const specKey = (item.insert_spec || '').trim().toLowerCase();
            const master = allInsertMastersCache.find(s => (s.insert_spec || s.name || '').trim().toLowerCase() === specKey);
            if (master) {
                numEdges = parseInt(master.no_of_edges) || parseInt(master.edges) || 4;
            }

            let usages = [];
            if (item.usages) {
                try {
                    let parsed = item.usages;
                    while (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    if (Array.isArray(parsed)) usages = parsed;
                } catch(e) {}
            }
            if (!usages || !Array.isArray(usages) || usages.length === 0) {
                usages = [{
                    machine: item.machine || '',
                    operator: item.operator || '',
                    partno: item.partno || '',
                    opn_no: item.opn_no || ''
                }];
            }

            const rowSpan = usages.length;

            usages.forEach((u, uIdx) => {
                const tr = document.createElement('tr');
                tr.style.height = '28px';
                if (uIdx > 0) {
                    tr.style.background = '#f9fafb';
                }

                const monitorCell = buildMonitorCellHtml(item, uIdx, numEdges);

                if (uIdx === 0) {
                    const formattedDate = formatExcelDate(item.date);
                    const dateDDMM = formatDateDDMM(item.date);
                    const deptShort = getDeptShortCode(item.department);
                    tr.innerHTML = `
                        <td rowspan="${rowSpan}" style="vertical-align: middle; font-weight: bold; padding: 3px 5px; font-size: 0.8rem;">${item.id}</td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><span style="font-weight: 600;" title="${formattedDate}">${dateDDMM}</span></td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><strong>${item.shift || ''}</strong></td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><span style="font-weight: 700; color: #0284c7;">${item.department || ''}</span></td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><strong>${item.insert_spec || ''}</strong></td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;">${item.batch_no || ''}</td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><span style="font-weight: 700; color: var(--primary-color);">${item.qty_issued || 0}</span></td>
                        <td rowspan="${rowSpan}" style="vertical-align: middle; padding: 3px 5px; font-size: 0.8rem;"><span style="font-weight: 700; color: #16a34a;">${item.qty_received || 0}</span></td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.machine || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.operator || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.partno || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.opn_no || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${monitorCell}</td>
                        <td class="actions-cell" style="padding: 3px 5px;">
                            <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                                <button class="btn btn-outline add-usage-btn" data-id="${item.id}" style="padding: 0.15rem 0.35rem; font-size: 0.72rem; color: #16a34a; border-color: #16a34a; font-weight: 600;" title="Add Usage Entry">+ Add Usage</button>
                                <button class="btn btn-outline edit-issue-btn" data-id="${item.id}" style="padding: 0.15rem 0.35rem; font-size: 0.72rem;">Edit</button>
                                <button class="btn btn-outline delete-issue-btn" data-id="${item.id}" style="padding: 0.15rem 0.35rem; font-size: 0.72rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                            </div>
                        </td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.machine || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.operator || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.partno || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${u.opn_no || ''}</td>
                        <td style="padding: 3px 5px; font-size: 0.8rem;">${monitorCell}</td>
                        <td class="actions-cell" style="padding: 3px 5px;">
                            <button class="btn btn-outline delete-subusage-btn" data-id="${item.id}" data-usage-idx="${uIdx}" style="padding: 0.15rem 0.35rem; font-size: 0.72rem; color: #ef4444; border-color: #ef4444;" title="Remove this usage entry">Delete Usage</button>
                        </td>
                    `;
                }
                tbody.appendChild(tr);
            });
        });

        tbody.querySelectorAll('.add-usage-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const res = await fetch('/api/insert_issues');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openAddUsageModal(item);
            });
        });

        tbody.querySelectorAll('.delete-subusage-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const uIdx = parseInt(btn.getAttribute('data-usage-idx'));
                if (confirm('Delete this additional usage entry?')) {
                    try {
                        const res = await fetch('/api/insert_issues');
                        const data = await res.json();
                        const item = data.find(x => x.id == id);
                        if (!item) return;

                        let usages = [];
                        if (item.usages) {
                            try {
                                let parsed = item.usages;
                                while (typeof parsed === 'string') {
                                    parsed = JSON.parse(parsed);
                                }
                                if (Array.isArray(parsed)) usages = parsed;
                            } catch(e) {}
                        }
                        if (usages.length > uIdx) {
                            usages.splice(uIdx, 1);
                            const payload = {
                                date: item.date || '',
                                shift: item.shift || '',
                                department: item.department || '',
                                insert_spec: item.insert_spec || '',
                                batch_no: item.batch_no || '',
                                qty_issued: item.qty_issued || 1,
                                machine: item.machine || '',
                                operator: item.operator || '',
                                partno: item.partno || '',
                                opn_no: item.opn_no || '',
                                usages: JSON.stringify(usages),
                                receipt_id: item.receipt_id || null,
                                edge_data: item.edge_data || ''
                            };
                            await fetch(`/api/insert_issues/${id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            fetchInsertIssues();
                        }
                    } catch(err) { console.error(err); }
                }
            });
        });

        tbody.querySelectorAll('.monitor-issue-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                const uIdx = parseInt(btn.getAttribute('data-usage-idx')) || 0;
                const instIdx = parseInt(btn.getAttribute('data-inst-idx')) || 0;
                const res = await fetch('/api/insert_issues');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openInsertMonitorModal(item, uIdx, instIdx);
            });
        });

        tbody.querySelectorAll('.edit-issue-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/insert_issues');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openInsertIssueModal(item);
            });
        });

        tbody.querySelectorAll('.delete-issue-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this insert issue record? This will restore the stock back to the receipt batch.')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/insert_issues/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchInsertIssues();
                        else alert('Error deleting issue record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    let allMachinesCache = [];
    let allOperatorsCache = [];

    async function populateIssueModalDropdowns(selectedDept = '', selectedSpec = '', selectedBatch = '', selectedPart = '', selectedOpn = '', selectedShift = '') {
        const deptSel = document.getElementById('issueDeptSelect');
        const specSel = document.getElementById('issueInsertSpecSelect');
        const shiftSel = document.getElementById('issueShiftSelect');

        // 0. Shifts
        if (shiftSel) {
            shiftSel.innerHTML = '<option value="">-- Select Shift --</option>';
            try {
                const sRes = await fetch('/api/shifts');
                const shifts = await sRes.json();
                shifts.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name;
                    opt.textContent = s.name;
                    if (selectedShift && selectedShift.trim().toLowerCase() === s.name.trim().toLowerCase()) {
                        opt.selected = true;
                    }
                    shiftSel.appendChild(opt);
                });
            } catch (e) { console.error(e); }
        }

        // 1. Departments
        deptSel.innerHTML = '<option value="">-- Select Dept --</option>';
        try {
            const dRes = await fetch('/api/departments');
            const depts = await dRes.json();
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                if (selectedDept && selectedDept.trim().toUpperCase() === d.name.trim().toUpperCase()) {
                    opt.selected = true;
                }
                deptSel.appendChild(opt);
            });
        } catch (e) { console.error(e); }

        // Fetch dependency caches
        try {
            const [mRes, oRes, pRes] = await Promise.all([
                fetch('/api/machines'),
                fetch('/api/operators'),
                fetch('/api/partmaster')
            ]);
            allMachinesCache = await mRes.json();
            allOperatorsCache = await oRes.json();
            allPartMastersCache = await pRes.json();
        } catch (e) { console.error(e); }

        // 2. Insert Specs
        specSel.innerHTML = '<option value="">-- Select Insert Spec --</option>';
        try {
            const specRes = await fetch('/api/insert_masters');
            const specs = await specRes.json();
            specs.forEach(s => {
                const sp = s.insert_spec || s.name || '';
                if (sp) {
                    const opt = document.createElement('option');
                    opt.value = sp;
                    opt.textContent = sp;
                    if (selectedSpec && selectedSpec.trim().toLowerCase() === sp.trim().toLowerCase()) {
                        opt.selected = true;
                    }
                    specSel.appendChild(opt);
                }
            });
            makeSearchableSelect('issueInsertSpecSelect');
        } catch (e) { console.error(e); }

        filterIssueDropdownsByDept(selectedDept, selectedPart);

        if (selectedSpec) {
            await updateBatchDropdownForSpec(selectedSpec, selectedBatch);
        }
        if (selectedPart) {
            await updateOpnDropdownForPart(selectedPart, selectedOpn);
        }
    }

    // ====== ADD USAGE MODAL LOGIC ======
    const addUsageModal = document.getElementById('addUsageModal');
    const closeAddUsageModalBtn = document.getElementById('closeAddUsageModalBtn');
    const cancelAddUsageBtn = document.getElementById('cancelAddUsageBtn');
    const addUsageForm = document.getElementById('addUsageForm');
    let currentAddUsageItem = null;

    if (closeAddUsageModalBtn) closeAddUsageModalBtn.addEventListener('click', () => addUsageModal.classList.remove('show'));
    if (cancelAddUsageBtn) cancelAddUsageBtn.addEventListener('click', () => addUsageModal.classList.remove('show'));

    async function openAddUsageModal(item) {
        if (!addUsageModal || !item) return;
        currentAddUsageItem = item;
        document.getElementById('addUsageIssueId').value = item.id;
        document.getElementById('addUsageSubtitle').textContent = `ID #${item.id} | ${item.insert_spec || ''} (Batch: ${item.batch_no || '-'})`;

        // Ensure dependency caches are populated
        if (allMachinesCache.length === 0 || allOperatorsCache.length === 0 || allPartMastersCache.length === 0) {
            try {
                const [mRes, oRes, pRes] = await Promise.all([
                    fetch('/api/machines'),
                    fetch('/api/operators'),
                    fetch('/api/partmaster')
                ]);
                allMachinesCache = await mRes.json();
                allOperatorsCache = await oRes.json();
                allPartMastersCache = await pRes.json();
            } catch (e) { console.error(e); }
        }

        const machSel = document.getElementById('addUsageMachineSelect');
        const opSel = document.getElementById('addUsageOperatorSelect');
        const partSel = document.getElementById('addUsagePartNoSelect');
        const opnSel = document.getElementById('addUsageOpnNoSelect');

        const cleanDept = (item.department || '').trim().toUpperCase();

        machSel.innerHTML = '<option value="">-- Select Machine --</option>';
        const filteredMachines = cleanDept ? allMachinesCache.filter(m => (m.department || '').trim().toUpperCase() === cleanDept) : allMachinesCache;
        const machinesToDisplay = filteredMachines.length > 0 ? filteredMachines : allMachinesCache;
        machinesToDisplay.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            machSel.appendChild(opt);
        });

        opSel.innerHTML = '<option value="">-- Select Operator --</option>';
        const filteredOperators = cleanDept ? allOperatorsCache.filter(o => (o.department || '').trim().toUpperCase() === cleanDept) : allOperatorsCache;
        const operatorsToDisplay = filteredOperators.length > 0 ? filteredOperators : allOperatorsCache;
        operatorsToDisplay.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        operatorsToDisplay.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.name;
            opt.textContent = o.name;
            opSel.appendChild(opt);
        });

        partSel.innerHTML = '<option value="">-- Select Part No --</option>';
        const filteredParts = cleanDept ? allPartMastersCache.filter(p => (p.department || '').trim().toUpperCase() === cleanDept) : allPartMastersCache;
        const partsToDisplay = filteredParts.length > 0 ? filteredParts : allPartMastersCache;
        partsToDisplay.forEach(p => {
            if (p.partno) {
                const opt = document.createElement('option');
                opt.value = p.partno;
                opt.textContent = p.partno;
                partSel.appendChild(opt);
            }
        });

        opnSel.innerHTML = '<option value="">-- Select Operation --</option>';
        addUsageModal.classList.add('show');
    }

    document.getElementById('addUsagePartNoSelect')?.addEventListener('change', async (e) => {
        const opnSel = document.getElementById('addUsageOpnNoSelect');
        opnSel.innerHTML = '<option value="">-- Select Operation --</option>';
        const partVal = e.target.value;
        if (!partVal) return;

        const partObj = allPartMastersCache.find(p => (p.partno || '').trim().toUpperCase() === partVal.trim().toUpperCase());
        if (!partObj) return;

        try {
            const res = await fetch(`/api/partmaster/${partObj.id}/operations`);
            const ops = await res.json();
            ops.sort((a, b) => (parseInt(a.opn_no) || 0) - (parseInt(b.opn_no) || 0));
            ops.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.opn_no;
                opt.textContent = `${o.opn_no} - ${o.description || ''}`;
                opnSel.appendChild(opt);
            });
        } catch (err) { console.error(err); }
    });

    if (addUsageForm) {
        addUsageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('addUsageIssueId').value;
            if (!id) return;

            const mach = document.getElementById('addUsageMachineSelect').value;
            const op = document.getElementById('addUsageOperatorSelect').value;
            const part = document.getElementById('addUsagePartNoSelect').value;
            const opn = document.getElementById('addUsageOpnNoSelect').value;

            try {
                const getRes = await fetch(`/api/insert_issues/${id}`);
                if (!getRes.ok) {
                    alert('Error fetching issue record');
                    return;
                }
                const currentItem = await getRes.json();

                let usages = [];
                if (currentItem.usages) {
                    try {
                        let parsed = currentItem.usages;
                        while (typeof parsed === 'string') {
                            parsed = JSON.parse(parsed);
                        }
                        if (Array.isArray(parsed)) usages = parsed;
                    } catch(e) {}
                }
                if (!usages || !Array.isArray(usages) || usages.length === 0) {
                    usages = [{
                        machine: currentItem.machine || '',
                        operator: currentItem.operator || '',
                        partno: currentItem.partno || '',
                        opn_no: currentItem.opn_no || ''
                    }];
                }

                usages.push({ machine: mach, operator: op, partno: part, opn_no: opn });

                const payload = {
                    date: currentItem.date || '',
                    shift: currentItem.shift || '',
                    department: currentItem.department || '',
                    insert_spec: currentItem.insert_spec || '',
                    batch_no: currentItem.batch_no || '',
                    qty_issued: currentItem.qty_issued || 1,
                    machine: currentItem.machine || '',
                    operator: currentItem.operator || '',
                    partno: currentItem.partno || '',
                    opn_no: currentItem.opn_no || '',
                    usages: JSON.stringify(usages),
                    receipt_id: currentItem.receipt_id || null,
                    edge_data: currentItem.edge_data || ''
                };

                const res = await fetch(`/api/insert_issues/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    addUsageModal.classList.remove('show');
                    addUsageForm.reset();
                    fetchInsertIssues();
                } else {
                    const errTxt = await res.text();
                    console.error('Error adding usage:', errTxt);
                    alert('Error adding usage entry');
                }
            } catch(err) { console.error(err); alert('Error adding usage entry'); }
        });
    }

    function createUsageCard(usageData = null) {
        const container = document.getElementById('usageEntriesContainer');
        if (!container) return;

        const cardIndex = container.children.length + 1;
        const card = document.createElement('div');
        card.className = 'usage-entry-card';
        card.style.cssText = 'background: rgba(0,0,0,0.02); border: 1px solid var(--border-color, #cbd5e1); border-radius: 8px; padding: 0.8rem; position: relative; margin-bottom: 0.4rem;';

        const cleanDept = (document.getElementById('issueDeptSelect')?.value || '').trim().toUpperCase();

        const filteredMachines = cleanDept ? allMachinesCache.filter(m => (m.department || '').trim().toUpperCase() === cleanDept) : allMachinesCache;
        const machinesToDisplay = filteredMachines.length > 0 ? filteredMachines : allMachinesCache;
        let machineOpts = '<option value="">-- Select Machine --</option>';
        machinesToDisplay.forEach(m => {
            const sel = (usageData && usageData.machine === m.name) ? 'selected' : '';
            machineOpts += `<option value="${m.name}" ${sel}>${m.name}</option>`;
        });

        const filteredOperators = cleanDept ? allOperatorsCache.filter(o => (o.department || '').trim().toUpperCase() === cleanDept) : allOperatorsCache;
        const operatorsToDisplay = filteredOperators.length > 0 ? filteredOperators : allOperatorsCache;
        operatorsToDisplay.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        let operatorOpts = '<option value="">-- Select Operator --</option>';
        operatorsToDisplay.forEach(o => {
            const sel = (usageData && usageData.operator === o.name) ? 'selected' : '';
            operatorOpts += `<option value="${o.name}" ${sel}>${o.name}</option>`;
        });

        const filteredParts = cleanDept ? allPartMastersCache.filter(p => (p.department || '').trim().toUpperCase() === cleanDept) : allPartMastersCache;
        const partsToDisplay = filteredParts.length > 0 ? filteredParts : allPartMastersCache;
        let partOpts = '<option value="">-- Select Part No --</option>';
        partsToDisplay.forEach(p => {
            if (p.partno) {
                const sel = (usageData && usageData.partno === p.partno) ? 'selected' : '';
                partOpts += `<option value="${p.partno}" ${sel}>${p.partno}</option>`;
            }
        });

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-weight: 600; font-size: 0.8rem; color: var(--text-muted);">Usage Entry #${cardIndex}</span>
                ${cardIndex > 1 ? '<button type="button" class="remove-usage-card-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem; font-weight: bold;" title="Remove Entry">&times;</button>' : ''}
            </div>
            <div class="form-row" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.2rem;">Machine</label>
                    <select class="usage-machine-select" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;">
                        ${machineOpts}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.2rem;">Operator</label>
                    <select class="usage-operator-select" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;">
                        ${operatorOpts}
                    </select>
                </div>
            </div>
            <div class="form-row" style="display: flex; gap: 0.5rem;">
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.2rem;">Part No</label>
                    <select class="usage-partno-select" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;">
                        ${partOpts}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.2rem;">Opn No</label>
                    <select class="usage-opnno-select" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;">
                        <option value="">-- Select Opn --</option>
                    </select>
                </div>
            </div>
        `;

        container.appendChild(card);

        const removeBtn = card.querySelector('.remove-usage-card-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                card.remove();
                container.querySelectorAll('.usage-entry-card').forEach((c, idx) => {
                    const label = c.querySelector('span');
                    if (label) label.textContent = `Usage Entry #${idx + 1}`;
                });
            });
        }

        const opSel = card.querySelector('.usage-operator-select');
        const partSel = card.querySelector('.usage-partno-select');
        const opnSel = card.querySelector('.usage-opnno-select');

        if (opSel) makeSearchableSelect(opSel, '-- Select Operator --');
        if (partSel) makeSearchableSelect(partSel, '-- Select Part No --');

        partSel.addEventListener('change', async (e) => {
            const selectedPart = e.target.value;
            opnSel.innerHTML = '<option value="">-- Select Opn --</option>';
            if (!selectedPart) return;

            const partObj = allPartMastersCache.find(p => (p.partno || '').trim().toUpperCase() === selectedPart.trim().toUpperCase());
            if (!partObj) return;

            try {
                const res = await fetch(`/api/partmaster/${partObj.id}/operations`);
                const ops = await res.json();
                ops.sort((a, b) => (parseInt(a.opn_no) || 0) - (parseInt(b.opn_no) || 0));
                ops.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.opn_no;
                    opt.textContent = `${o.opn_no} - ${o.description || ''}`;
                    if (usageData && usageData.opn_no && usageData.opn_no.trim().toLowerCase() === o.opn_no.trim().toLowerCase()) {
                        opt.selected = true;
                    }
                    opnSel.appendChild(opt);
                });
            } catch (err) { console.error(err); }
        });

        if (usageData && usageData.partno) {
            partSel.dispatchEvent(new Event('change'));
        }
    }

    document.getElementById('addUsageEntryRowBtn')?.addEventListener('click', () => createUsageCard());

    function filterIssueDropdownsByDept(dept = '', selectedPart = '') {
        const machSel = document.getElementById('issueMachineSelect');
        const opSel = document.getElementById('issueOperatorSelect');
        const partSel = document.getElementById('issuePartNoSelect');

        const cleanDept = (dept || '').trim().toUpperCase();

        // 1. Filter Machines
        if (machSel) {
            machSel.innerHTML = '<option value="">-- Select Machine --</option>';
            const filteredMachines = cleanDept ? allMachinesCache.filter(m => (m.department || '').trim().toUpperCase() === cleanDept) : allMachinesCache;
            const machinesToDisplay = filteredMachines.length > 0 ? filteredMachines : allMachinesCache;
            machinesToDisplay.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                machSel.appendChild(opt);
            });
        }

        // 2. Filter Operators
        if (opSel) {
            opSel.innerHTML = '<option value="">-- Select Operator --</option>';
            const filteredOperators = cleanDept ? allOperatorsCache.filter(o => (o.department || '').trim().toUpperCase() === cleanDept) : allOperatorsCache;
            const operatorsToDisplay = filteredOperators.length > 0 ? filteredOperators : allOperatorsCache;
            operatorsToDisplay.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            operatorsToDisplay.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.name;
                opt.textContent = o.name;
                opSel.appendChild(opt);
            });
            makeSearchableSelect(opSel, '-- Select Operator --');
        }

        // 3. Filter Parts
        if (partSel) {
            partSel.innerHTML = '<option value="">-- Select Part No --</option>';
            const filteredParts = cleanDept ? allPartMastersCache.filter(p => (p.department || '').trim().toUpperCase() === cleanDept) : allPartMastersCache;
            const partsToDisplay = filteredParts.length > 0 ? filteredParts : allPartMastersCache;
            partsToDisplay.forEach(p => {
                if (p.partno) {
                    const opt = document.createElement('option');
                    opt.value = p.partno;
                    opt.textContent = p.partno;
                    if (selectedPart && selectedPart.trim().toUpperCase() === p.partno.trim().toUpperCase()) {
                        opt.selected = true;
                    }
                    partSel.appendChild(opt);
                }
            });
            makeSearchableSelect(partSel, '-- Select Part No --');
        }
    }

    document.getElementById('issueDeptSelect')?.addEventListener('change', (e) => {
        filterIssueDropdownsByDept(e.target.value);
    });

    async function updateBatchDropdownForSpec(spec, selectedBatch = '') {
        const batchSel = document.getElementById('issueBatchNoSelect');
        const availInput = document.getElementById('issueAvailableQtyInput');
        batchSel.innerHTML = '<option value="">-- Select Batch --</option>';
        availInput.value = '0';

        if (!spec) return;

        try {
            const res = await fetch('/api/insert_receipts');
            allReceiptsCache = await res.json();

            const matchingReceipts = allReceiptsCache.filter(r => {
                const isSpecMatch = (r.insert_spec || '').trim().toLowerCase() === spec.trim().toLowerCase();
                const bNo = (r.batch_no || `ID-${r.id}`).trim();
                const isSelected = selectedBatch && selectedBatch.trim().toLowerCase() === bNo.toLowerCase();
                const hasStock = (parseFloat(r.qty) || 0) > 0;
                return isSpecMatch && (hasStock || isSelected);
            });
            
            if (matchingReceipts.length === 0) {
                batchSel.innerHTML = '<option value="">-- No Batches Available --</option>';
                return;
            }

            matchingReceipts.forEach(r => {
                const bNo = r.batch_no || `ID-${r.id}`;
                const opt = document.createElement('option');
                opt.value = bNo;
                opt.setAttribute('data-qty', r.qty);
                opt.setAttribute('data-receipt-id', r.id);
                opt.textContent = `${bNo} (Avail Qty: ${r.qty})`;
                if (selectedBatch && selectedBatch.trim().toLowerCase() === bNo.trim().toLowerCase()) {
                    opt.selected = true;
                    availInput.value = r.qty;
                }
                batchSel.appendChild(opt);
            });

            if (!selectedBatch && matchingReceipts.length > 0) {
                batchSel.selectedIndex = 1;
                availInput.value = matchingReceipts[0].qty;
            }
        } catch (e) { console.error(e); }
    }

    async function updateOpnDropdownForPart(partno, selectedOpn = '') {
        const opnSel = document.getElementById('issueOpnNoSelect');
        opnSel.innerHTML = '<option value="">-- Select Operation --</option>';
        if (!partno) return;

        const partObj = allPartMastersCache.find(p => (p.partno || '').trim().toUpperCase() === partno.trim().toUpperCase());
        if (!partObj) return;

        try {
            const res = await fetch(`/api/partmaster/${partObj.id}/operations`);
            const ops = await res.json();
            ops.sort((a, b) => (parseInt(a.opn_no) || 0) - (parseInt(b.opn_no) || 0));
            ops.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.opn_no;
                opt.textContent = `${o.opn_no} - ${o.description || ''}`;
                if (selectedOpn && selectedOpn.trim().toLowerCase() === (o.opn_no || '').trim().toLowerCase()) {
                    opt.selected = true;
                }
                opnSel.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    document.getElementById('issueInsertSpecSelect')?.addEventListener('change', (e) => {
        updateBatchDropdownForSpec(e.target.value);
    });

    document.getElementById('issueBatchNoSelect')?.addEventListener('change', (e) => {
        const selOpt = e.target.options[e.target.selectedIndex];
        const qty = selOpt ? selOpt.getAttribute('data-qty') : 0;
        document.getElementById('issueAvailableQtyInput').value = qty || 0;
    });

    document.getElementById('issuePartNoSelect')?.addEventListener('change', (e) => {
        updateOpnDropdownForPart(e.target.value);
    });

    async function openInsertIssueModal(item = null) {
        if (!insertIssueModal) return;
        const container = document.getElementById('usageEntriesContainer');
        if (container) container.innerHTML = '';

        if (item) {
            document.getElementById('insertIssueModalTitle').textContent = 'Edit Insert Issue';
            document.getElementById('insertIssueId').value = item.id;
            document.getElementById('issueDateInput').value = item.date || '';
            document.getElementById('issueQtyInput').value = item.qty_issued || 1;
            if (document.getElementById('issueQtyReceivedInput')) {
                document.getElementById('issueQtyReceivedInput').value = item.qty_received || 0;
            }
            await populateIssueModalDropdowns(item.department, item.insert_spec, item.batch_no, item.partno, item.opn_no, item.shift);

            let usages = [];
            if (item.usages) {
                try {
                    let parsed = item.usages;
                    while (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    if (Array.isArray(parsed)) usages = parsed;
                } catch(e) {}
            }
            if (!usages || !Array.isArray(usages) || usages.length === 0) {
                usages = [{
                    machine: item.machine || '',
                    operator: item.operator || '',
                    partno: item.partno || '',
                    opn_no: item.opn_no || ''
                }];
            }
            usages.forEach(u => createUsageCard(u));
        } else {
            document.getElementById('insertIssueModalTitle').textContent = 'Issue Insert';
            insertIssueForm.reset();
            document.getElementById('insertIssueId').value = '';
            document.getElementById('issueDateInput').valueAsDate = new Date();
            if (document.getElementById('issueQtyReceivedInput')) {
                document.getElementById('issueQtyReceivedInput').value = 0;
            }
            await populateIssueModalDropdowns();
            createUsageCard();
        }
        insertIssueModal.classList.add('show');
    }

    if (addInsertIssueBtn) addInsertIssueBtn.addEventListener('click', () => openInsertIssueModal());
    if (cancelInsertIssueBtn) cancelInsertIssueBtn.addEventListener('click', () => insertIssueModal.classList.remove('show'));
    if (closeInsertIssueModalBtn) closeInsertIssueModalBtn.addEventListener('click', () => insertIssueModal.classList.remove('show'));

    document.getElementById('importInsertIssueBtn')?.addEventListener('click', () => {
        document.getElementById('importInsertIssueInput')?.click();
    });

    const exportInsertIssueExcelBtn = document.getElementById('exportInsertIssueExcelBtn');
    if (exportInsertIssueExcelBtn) {
        exportInsertIssueExcelBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/insert_issues');
                if (!res.ok) {
                    alert('Failed to fetch insert issues for export.');
                    return;
                }
                const data = await res.json();
                if (!data || data.length === 0) {
                    alert('No Insert Issue records available to export.');
                    return;
                }

                // Ensure insert masters cache is populated to get edge count per spec
                if (!allInsertMastersCache || allInsertMastersCache.length === 0) {
                    try {
                        const mRes = await fetch('/api/insert_masters');
                        allInsertMastersCache = await mRes.json();
                    } catch(e) {}
                }

                // Transform data into flat array for Excel sheet with Insert Monitor Edge rows
                const exportRows = [];
                data.forEach(item => {
                    let usages = [];
                    if (item.usages) {
                        try {
                            let parsed = item.usages;
                            while (typeof parsed === 'string') {
                                parsed = JSON.parse(parsed);
                            }
                            if (Array.isArray(parsed)) usages = parsed;
                        } catch(e) {}
                    }
                    if (!usages || !Array.isArray(usages) || usages.length === 0) {
                        usages = [{
                            machine: item.machine || '',
                            operator: item.operator || '',
                            partno: item.partno || '',
                            opn_no: item.opn_no || ''
                        }];
                    }

                    const formattedDate = formatExcelDate(item.date);

                    // Determine number of edges for this spec
                    let numEdges = 4;
                    const specKey = (item.insert_spec || '').trim().toLowerCase();
                    const master = (allInsertMastersCache || []).find(s => (s.insert_spec || s.name || '').trim().toLowerCase() === specKey);
                    if (master) {
                        numEdges = parseInt(master.no_of_edges) || parseInt(master.edges) || 4;
                    }

                    const totalQty = Math.max(1, parseInt(item.qty_issued) || 1);

                    for (let instIdx = 0; instIdx < totalQty; instIdx++) {
                        const instObj = getInstEdgeObj(item.edge_data, instIdx);
                        let instTotalEdgeQty = 0;
                        for (let e = 1; e <= numEdges; e++) {
                            const info = instObj[String(e)];
                            if (info && info.qty > 0) instTotalEdgeQty += parseFloat(info.qty) || 0;
                        }

                        for (let e = 1; e <= numEdges; e++) {
                            const info = instObj[String(e)] || { qty: 0, uIdx: 0, partno: '' };
                            const assignedUidx = info.uIdx !== undefined ? parseInt(info.uIdx) : 0;
                            const assignedUsage = usages[assignedUidx] || usages[0] || {};

                            exportRows.push({
                                'Issue ID': item.id,
                                'Date': formattedDate,
                                'Shift': item.shift || '',
                                'Dept': item.department || '',
                                'Insert Spec': item.insert_spec || '',
                                'Batch No': item.batch_no || '',
                                'Qty Issued': item.qty_issued || 1,
                                'Qty Received': item.qty_received || 0,
                                'Machine': assignedUsage.machine || item.machine || '',
                                'Operator': assignedUsage.operator || item.operator || '',
                                'Part No': assignedUsage.partno || item.partno || '',
                                'Opn No': assignedUsage.opn_no || item.opn_no || '',
                                'Insert No': totalQty > 1 ? `Insert #${instIdx + 1}` : `Insert #1`,
                                'Edge No': `Edge ${e}`,
                                'Edge Qty': info.qty || 0,
                                'Total Edge Qty': instTotalEdgeQty
                            });
                        }
                    }
                });

                if (typeof XLSX === 'undefined') {
                    alert('Excel export library is loading, please try again in a moment.');
                    return;
                }

                const ws = XLSX.utils.json_to_sheet(exportRows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Insert Monitor Issues");

                const todayStr = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(wb, `Insert_Monitor_Issues_${todayStr}.xlsx`);
            } catch (err) {
                console.error('Error exporting Insert Issues to Excel:', err);
                alert('Error generating Excel file.');
            }
        });
    }

    const importInsertIssueInput = document.getElementById('importInsertIssueInput');
    if (importInsertIssueInput) {
        importInsertIssueInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const issues = [];
                    const todayStr = new Date().toISOString().slice(0, 10);
                    json.forEach(row => {
                        let dateVal = todayStr;
                        let specVal = '';
                        let batchVal = '';
                        let qtyVal = 1;
                        let qtyRecVal = 0;
                        let shiftVal = '';
                        let deptVal = '';
                        let machineVal = '';
                        let opVal = '';
                        let partVal = '';
                        let opnVal = '';

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['date', 'issue date', 'issue_date'].includes(k)) dateVal = String(row[key] || '').trim();
                            if (['shift', 'shift name', 'shift_name'].includes(k)) shiftVal = String(row[key] || '').trim();
                            if (['dept', 'dep', 'department', 'dept name', 'dept_name'].includes(k)) deptVal = String(row[key] || '').trim();
                            if (['insert spec', 'insert_spec', 'spec'].includes(k)) specVal = String(row[key] || '').trim();
                            if (['batch no', 'batch_no', 'batch'].includes(k)) batchVal = String(row[key] || '').trim();
                            if (['qty issued', 'qty_issued', 'qty', 'issued qty', 'qty issu'].includes(k)) qtyVal = parseInt(row[key]) || 1;
                            if (['qty received', 'qty_received', 'qty rec', 'received qty'].includes(k)) qtyRecVal = parseInt(row[key]) || 0;
                            if (['machine', 'machine name', 'm/c'].includes(k)) machineVal = String(row[key] || '').trim();
                            if (['operator', 'operator name'].includes(k)) opVal = String(row[key] || '').trim();
                            if (['part no', 'partno', 'part_no'].includes(k)) partVal = String(row[key] || '').trim();
                            if (['opn no', 'opn_no', 'opn', 'operation'].includes(k)) opnVal = String(row[key] || '').trim();
                        }

                        if (specVal) {
                            issues.push({
                                date: formatExcelDate(dateVal),
                                shift: shiftVal,
                                department: deptVal,
                                insert_spec: specVal,
                                batch_no: batchVal,
                                qty_issued: qtyVal,
                                qty_received: qtyRecVal,
                                machine: machineVal,
                                operator: opVal,
                                partno: partVal,
                                opn_no: opnVal
                            });
                        }
                    });

                    if (issues.length === 0) {
                        alert('No valid issue records found in Excel sheet. Make sure headers are "Date", "Insert Spec", "Batch No", "Qty Issued", "Machine", "Operator", "Part No", and "Opn No".');
                        return;
                    }

                    const res = await fetch('/api/insert_issues/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ issues })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${issues.length} Insert Issue records and updated batch stocks!`);
                        fetchInsertIssues();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Insert Issue Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importInsertIssueInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    if (insertIssueForm) {
        insertIssueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('insertIssueId').value;
            const batchSel = document.getElementById('issueBatchNoSelect');
            const selectedOpt = batchSel.options[batchSel.selectedIndex];
            const receiptId = selectedOpt ? selectedOpt.getAttribute('data-receipt-id') : null;

            const mach = document.getElementById('issueMachineSelect').value;
            const op = document.getElementById('issueOperatorSelect').value;
            const part = document.getElementById('issuePartNoSelect').value;
            const opn = document.getElementById('issueOpnNoSelect').value;

            let usagesList = [{ machine: mach, operator: op, partno: part, opn_no: opn }];

            if (id) {
                try {
                    const res = await fetch(`/api/insert_issues/${id}`);
                    if (res.ok) {
                        const existing = await res.json();
                        if (existing.usages) {
                            try {
                                let parsed = existing.usages;
                                while (typeof parsed === 'string') {
                                    parsed = JSON.parse(parsed);
                                }
                                if (Array.isArray(parsed) && parsed.length > 1) {
                                    parsed[0] = { machine: mach, operator: op, partno: part, opn_no: opn };
                                    usagesList = parsed;
                                }
                            } catch(e) {}
                        }
                    }
                } catch(e) {}
            }

            const payload = {
                date: document.getElementById('issueDateInput').value,
                shift: document.getElementById('issueShiftSelect')?.value || '',
                department: document.getElementById('issueDeptSelect').value,
                insert_spec: document.getElementById('issueInsertSpecSelect').value,
                batch_no: batchSel.value,
                qty_issued: parseInt(document.getElementById('issueQtyInput').value) || 1,
                qty_received: parseInt(document.getElementById('issueQtyReceivedInput')?.value) || 0,
                machine: mach,
                operator: op,
                partno: part,
                opn_no: opn,
                usages: JSON.stringify(usagesList),
                receipt_id: receiptId ? parseInt(receiptId) : null
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/insert_issues/${id}` : '/api/insert_issues';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    insertIssueModal.classList.remove('show');
                    fetchInsertIssues();
                } else {
                    alert('Error saving issue record');
                }
            } catch (err) { console.error(err); alert('Error saving issue record'); }
        });
    }

    // ====== TAP ISSUE CRUD ======
    const tapIssueModal = document.getElementById('tapIssueModal');
    const tapIssueForm = document.getElementById('tapIssueForm');
    const addTapIssueBtn = document.getElementById('addTapIssueBtn');
    const cancelTapIssueBtn = document.getElementById('cancelTapIssueBtn');
    const closeTapIssueModalBtn = document.getElementById('closeTapIssueModalBtn');

    let allTapIssuesCache = [];

    async function fetchTapIssues() {
        try {
            const res = await fetch('/api/tap_issues');
            allTapIssuesCache = await res.json();
            applyTapIssueFilters();
        } catch (err) { console.error(err); }
    }

    function applyTapIssueFilters() {
        if (!allTapIssuesCache) return;
        const inputs = document.querySelectorAll('.tap-issue-col-filter');
        const filters = {};
        inputs.forEach(inp => {
            const key = inp.getAttribute('data-key');
            const val = inp.value.trim().toLowerCase();
            if (val) filters[key] = val;
        });

        let filtered = allTapIssuesCache;
        if (Object.keys(filters).length > 0) {
            filtered = allTapIssuesCache.filter(item => {
                if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
                if (filters.date && !(item.date || '').toLowerCase().includes(filters.date) && !formatExcelDate(item.date).toLowerCase().includes(filters.date)) return false;
                if (filters.shift && !(item.shift || '').toLowerCase().includes(filters.shift)) return false;
                if (filters.department && !(item.department || '').toLowerCase().includes(filters.department)) return false;
                if (filters.tap_spec && !(item.tap_spec || '').toLowerCase().includes(filters.tap_spec)) return false;
                if (filters.qty && !String(item.qty || 0).toLowerCase().includes(filters.qty)) return false;
                if (filters.machine && !(item.machine || '').toLowerCase().includes(filters.machine)) return false;
                if (filters.operator && !(item.operator || '').toLowerCase().includes(filters.operator)) return false;
                if (filters.partno && !(item.partno || '').toLowerCase().includes(filters.partno)) return false;
                if (filters.opn_no && !(item.opn_no || '').toLowerCase().includes(filters.opn_no)) return false;
                if (filters.tap_life && !String(item.tap_life || 0).toLowerCase().includes(filters.tap_life)) return false;
                if (filters.usages && !(item.usages || '').toLowerCase().includes(filters.usages)) return false;
                return true;
            });
        }

        renderTapIssues(filtered);
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.classList.contains('tap-issue-col-filter')) {
            applyTapIssueFilters();
        }
    });

    document.getElementById('clearTapIssueFiltersBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.tap-issue-col-filter').forEach(inp => inp.value = '');
        applyTapIssueFilters();
    });

    function renderTapIssues(issues) {
        const tbody = document.getElementById('tapIssueBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!issues || issues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No tap issues found. Click "+ Issue Tap" or "Import Excel" to add records.</td></tr>';
            return;
        }
        issues.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><span style="font-weight: 500;">${item.date || ''}</span></td>
                <td>${item.shift || ''}</td>
                <td>${item.department || ''}</td>
                <td><strong>${item.tap_spec || ''}</strong></td>
                <td>${item.qty || 0}</td>
                <td>${item.machine || ''}</td>
                <td>${item.operator || ''}</td>
                <td>${item.partno || ''}</td>
                <td>${item.opn_no || ''}</td>
                <td>${item.tap_life || 0}</td>
                <td><span class="badge" style="background: var(--primary-light, #e0f2fe); color: var(--primary-color, #0284c7); border-radius: 4px; padding: 2px 6px; font-size: 0.75rem;">${item.usages || 'New'}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-outline edit-tap-issue-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;">Edit</button>
                    <button class="btn btn-outline delete-tap-issue-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-tap-issue-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/tap_issues');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openTapIssueModal(item);
            });
        });

        tbody.querySelectorAll('.delete-tap-issue-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this tap issue record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/tap_issues/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchTapIssues();
                        else alert('Error deleting issue record');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    async function populateTapIssueDropdowns(item = null) {
        // Shift dropdown
        try {
            const res = await fetch('/api/shifts');
            const data = await res.json();
            const sel = document.getElementById('tapIssueShiftSelect');
            sel.innerHTML = '<option value="">-- Select Shift --</option>';
            data.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                if (item && item.shift === s.name) opt.selected = true;
                sel.appendChild(opt);
            });
            makeSearchableSelect('tapIssueShiftSelect', '-- Select Shift --');
            if (item && item.shift && tomSelectCache['tapIssueShiftSelect']) {
                tomSelectCache['tapIssueShiftSelect'].setValue(item.shift);
            }
        } catch (e) {}

        // Dept dropdown
        try {
            const res = await fetch('/api/departments');
            const data = await res.json();
            const sel = document.getElementById('tapIssueDeptSelect');
            sel.innerHTML = '<option value="">-- Select Department --</option>';
            data.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                if (item && item.department === d.name) opt.selected = true;
                sel.appendChild(opt);
            });
            makeSearchableSelect('tapIssueDeptSelect', '-- Select Department --');
            if (item && item.department && tomSelectCache['tapIssueDeptSelect']) {
                tomSelectCache['tapIssueDeptSelect'].setValue(item.department);
            }
        } catch (e) {}

        // Tap Spec dropdown (from TapMaster)
        try {
            const res = await fetch('/api/tap_masters');
            const data = await res.json();
            const sel = document.getElementById('tapIssueSpecSelect');
            sel.innerHTML = '<option value="">-- Select Tap Spec --</option>';
            data.forEach(t => {
                const spec = t.tap_spec || t.specification || t.name || '';
                if (spec) {
                    const opt = document.createElement('option');
                    opt.value = spec;
                    opt.textContent = spec;
                    if (item && item.tap_spec === spec) opt.selected = true;
                    sel.appendChild(opt);
                }
            });
            makeSearchableSelect('tapIssueSpecSelect', '-- Select Tap Spec --');
            if (item && item.tap_spec && tomSelectCache['tapIssueSpecSelect']) {
                tomSelectCache['tapIssueSpecSelect'].setValue(item.tap_spec);
            }
        } catch (e) {}

        // Machine dropdown
        try {
            const res = await fetch('/api/machines');
            const data = await res.json();
            const sel = document.getElementById('tapIssueMachineSelect');
            sel.innerHTML = '<option value="">-- Select Machine --</option>';
            data.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                if (item && item.machine === m.name) opt.selected = true;
                sel.appendChild(opt);
            });
            makeSearchableSelect('tapIssueMachineSelect', '-- Select Machine --');
            if (item && item.machine && tomSelectCache['tapIssueMachineSelect']) {
                tomSelectCache['tapIssueMachineSelect'].setValue(item.machine);
            }
        } catch (e) {}

        // Operator dropdown
        try {
            const res = await fetch('/api/operators');
            const data = await res.json();
            const sel = document.getElementById('tapIssueOperatorSelect');
            sel.innerHTML = '<option value="">-- Select Operator --</option>';
            data.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.name;
                opt.textContent = o.name;
                if (item && item.operator === o.name) opt.selected = true;
                sel.appendChild(opt);
            });
            makeSearchableSelect('tapIssueOperatorSelect', '-- Select Operator --');
            if (item && item.operator && tomSelectCache['tapIssueOperatorSelect']) {
                tomSelectCache['tapIssueOperatorSelect'].setValue(item.operator);
            }
        } catch (e) {}

        // Part No dropdown
        try {
            const res = await fetch('/api/parts');
            const parts = await res.json();
            const sel = document.getElementById('tapIssuePartNoSelect');
            sel.innerHTML = '<option value="">-- Select Part No --</option>';
            parts.forEach(p => {
                const partName = p.part_number || p.name || '';
                if (partName) {
                    const opt = document.createElement('option');
                    opt.value = partName;
                    opt.textContent = partName;
                    if (item && item.partno === partName) opt.selected = true;
                    sel.appendChild(opt);
                }
            });
            makeSearchableSelect('tapIssuePartNoSelect', '-- Select Part No --');
            if (item && item.partno && tomSelectCache['tapIssuePartNoSelect']) {
                tomSelectCache['tapIssuePartNoSelect'].setValue(item.partno);
                populateTapIssueOpnDropdown(item.partno, item ? item.opn_no : '');
            }
        } catch (e) {}
    }

    async function populateTapIssueOpnDropdown(partNo, selectedOpn = '') {
        const sel = document.getElementById('tapIssueOpnNoSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Operation --</option>';
        if (!partNo) {
            makeSearchableSelect('tapIssueOpnNoSelect', '-- Select Operation --');
            return;
        }
        try {
            const res = await fetch('/api/parts');
            const parts = await res.json();
            const part = parts.find(p => (p.part_number || p.name || '') === partNo);
            if (part && part.id) {
                const opRes = await fetch(`/api/parts/${part.id}/operations`);
                const ops = await opRes.json();
                ops.forEach(op => {
                    const opnName = op.opn_no || op.name || `OPN ${op.sequence_order || ''}`;
                    const opt = document.createElement('option');
                    opt.value = opnName;
                    opt.textContent = opnName;
                    if (selectedOpn && selectedOpn === opnName) opt.selected = true;
                    sel.appendChild(opt);
                });
            }
            makeSearchableSelect('tapIssueOpnNoSelect', '-- Select Operation --');
            if (selectedOpn && tomSelectCache['tapIssueOpnNoSelect']) {
                tomSelectCache['tapIssueOpnNoSelect'].setValue(selectedOpn);
            }
        } catch (e) { console.error('Error fetching opns:', e); }
    }

    document.getElementById('tapIssuePartNoSelect')?.addEventListener('change', (e) => {
        const selectedPart = e.target.value;
        populateTapIssueOpnDropdown(selectedPart);
    });

    async function openTapIssueModal(item = null) {
        if (!tapIssueModal) return;
        await populateTapIssueDropdowns(item);
        if (item) {
            document.getElementById('tapIssueModalTitle').textContent = 'Edit Tap Issue';
            document.getElementById('tapIssueId').value = item.id;
            document.getElementById('tapIssueDateInput').value = item.date || '';
            document.getElementById('tapIssueQtyInput').value = (item.qty !== undefined && item.qty !== null) ? item.qty : 1;
            document.getElementById('tapIssueLifeInput').value = (item.tap_life !== undefined && item.tap_life !== null) ? item.tap_life : 0;
            document.getElementById('tapIssueUsageSelect').value = item.usages || 'New';
        } else {
            document.getElementById('tapIssueModalTitle').textContent = 'Issue Tap';
            tapIssueForm.reset();
            document.getElementById('tapIssueId').value = '';
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('tapIssueDateInput').value = todayStr;
        }
        tapIssueModal.classList.add('show');
    }

    if (addTapIssueBtn) addTapIssueBtn.addEventListener('click', () => openTapIssueModal());
    if (cancelTapIssueBtn) cancelTapIssueBtn.addEventListener('click', () => tapIssueModal.classList.remove('show'));
    if (closeTapIssueModalBtn) closeTapIssueModalBtn.addEventListener('click', () => tapIssueModal.classList.remove('show'));

    if (tapIssueForm) {
        tapIssueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('tapIssueId').value;
            const payload = {
                date: document.getElementById('tapIssueDateInput').value,
                shift: (tomSelectCache['tapIssueShiftSelect'] ? tomSelectCache['tapIssueShiftSelect'].getValue() : document.getElementById('tapIssueShiftSelect').value || '').trim(),
                department: (tomSelectCache['tapIssueDeptSelect'] ? tomSelectCache['tapIssueDeptSelect'].getValue() : document.getElementById('tapIssueDeptSelect').value || '').trim(),
                tap_spec: (tomSelectCache['tapIssueSpecSelect'] ? tomSelectCache['tapIssueSpecSelect'].getValue() : document.getElementById('tapIssueSpecSelect').value || '').trim(),
                qty: parseInt(document.getElementById('tapIssueQtyInput').value) || 1,
                machine: (tomSelectCache['tapIssueMachineSelect'] ? tomSelectCache['tapIssueMachineSelect'].getValue() : document.getElementById('tapIssueMachineSelect').value || '').trim(),
                operator: (tomSelectCache['tapIssueOperatorSelect'] ? tomSelectCache['tapIssueOperatorSelect'].getValue() : document.getElementById('tapIssueOperatorSelect').value || '').trim(),
                partno: (tomSelectCache['tapIssuePartNoSelect'] ? tomSelectCache['tapIssuePartNoSelect'].getValue() : document.getElementById('tapIssuePartNoSelect').value || '').trim(),
                opn_no: (tomSelectCache['tapIssueOpnNoSelect'] ? tomSelectCache['tapIssueOpnNoSelect'].getValue() : document.getElementById('tapIssueOpnNoSelect').value || '').trim(),
                tap_life: parseInt(document.getElementById('tapIssueLifeInput').value) || 0,
                usages: document.getElementById('tapIssueUsageSelect').value
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/tap_issues/${id}` : '/api/tap_issues';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    tapIssueModal.classList.remove('show');
                    fetchTapIssues();
                } else {
                    alert('Error saving tap issue record');
                }
            } catch (err) { console.error(err); alert('Error saving tap issue record'); }
        });
    }

    document.getElementById('importTapIssueBtn')?.addEventListener('click', () => {
        document.getElementById('importTapIssueInput')?.click();
    });

    const importTapIssueInput = document.getElementById('importTapIssueInput');
    if (importTapIssueInput) {
        importTapIssueInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    if (!json || json.length === 0) {
                        alert('No valid data found in Excel sheet.');
                        return;
                    }

                    const issues = [];
                    const todayStr = new Date().toISOString().slice(0, 10);
                    json.forEach(row => {
                        let dateVal = todayStr;
                        let shiftVal = '';
                        let deptVal = '';
                        let specVal = '';
                        let qtyVal = 1;
                        let machineVal = '';
                        let operatorVal = '';
                        let partVal = '';
                        let opnVal = '';
                        let lifeVal = 0;
                        let usageVal = 'New';

                        for (const key of Object.keys(row)) {
                            const k = key.trim().toLowerCase();
                            if (['date', 'issue_date', 'issue date'].includes(k)) dateVal = formatExcelDate(row[key]);
                            if (['shift'].includes(k)) shiftVal = String(row[key] || '').trim();
                            if (['dept', 'department'].includes(k)) deptVal = String(row[key] || '').trim();
                            if (['tap spec', 'tap_spec', 'spec', 'tap'].includes(k)) specVal = String(row[key] || '').trim();
                            if (['qty', 'quantity'].includes(k)) qtyVal = parseInt(row[key]) || 1;
                            if (['machine', 'm/c', 'mc'].includes(k)) machineVal = String(row[key] || '').trim();
                            if (['operator', 'op'].includes(k)) operatorVal = String(row[key] || '').trim();
                            if (['part no', 'partno', 'part_no', 'part'].includes(k)) partVal = String(row[key] || '').trim();
                            if (['opn no', 'opnno', 'opn_no', 'opn', 'operation'].includes(k)) opnVal = String(row[key] || '').trim();
                            if (['tap life', 'tap_life', 'life'].includes(k)) lifeVal = parseInt(row[key]) || 0;
                            if (['usage', 'usages', 'usage type', 'usage_type'].includes(k)) usageVal = String(row[key] || '').trim();
                        }

                        if (specVal) {
                            issues.push({
                                date: dateVal,
                                shift: shiftVal,
                                department: deptVal,
                                tap_spec: specVal,
                                qty: qtyVal,
                                machine: machineVal,
                                operator: operatorVal,
                                partno: partVal,
                                opn_no: opnVal,
                                tap_life: lifeVal,
                                usages: usageVal
                            });
                        }
                    });

                    if (issues.length === 0) {
                        alert('No valid tap issue records found in Excel sheet.');
                        return;
                    }

                    const res = await fetch('/api/tap_issues/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ issues })
                    });

                    if (res.ok) {
                        alert(`Successfully imported ${issues.length} Tap Issue records!`);
                        fetchTapIssues();
                    } else {
                        alert('Error importing Excel data.');
                    }
                } catch (err) {
                    console.error('Error importing Tap Issue Excel:', err);
                    alert('Error reading Excel file.');
                } finally {
                    importTapIssueInput.value = '';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    document.getElementById('deleteAllTapIssuesBtn')?.addEventListener('click', async () => {
        if (!checkAdminAccess()) return;
        if (confirm('Are you sure you want to delete ALL tap issue entries? This action cannot be undone!')) {
            try {
                const res = await fetch('/api/tap_issues/all', { method: 'DELETE' });
                if (res.ok) {
                    alert('All tap issue entries deleted successfully.');
                    fetchTapIssues();
                } else {
                    alert('Error deleting tap issue entries.');
                }
            } catch (e) { console.error(e); }
        }
    });

    // ====== INSERT MONITOR MODAL ======
    const insertMonitorModal = document.getElementById('insertMonitorModal');
    const closeInsertMonitorModalBtn = document.getElementById('closeInsertMonitorModalBtn');
    const cancelInsertMonitorBtn = document.getElementById('cancelInsertMonitorBtn');
    const saveInsertMonitorBtn = document.getElementById('saveInsertMonitorBtn');
    let currentMonitorIssueItem = null;
    let currentMonitorUidx = 0;
    let currentMonitorInstIdx = 0;

    if (closeInsertMonitorModalBtn) closeInsertMonitorModalBtn.addEventListener('click', () => insertMonitorModal.classList.remove('show'));
    if (cancelInsertMonitorBtn) cancelInsertMonitorBtn.addEventListener('click', () => insertMonitorModal.classList.remove('show'));

    async function openInsertMonitorModal(item, targetUidx = 0, targetInstIdx = 0) {
        if (!insertMonitorModal || !item) return;
        currentMonitorIssueItem = item;
        currentMonitorUidx = targetUidx;
        currentMonitorInstIdx = targetInstIdx;

        let usages = [];
        if (item.usages) {
            try {
                let parsed = item.usages;
                while (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                if (Array.isArray(parsed)) usages = parsed;
            } catch(e) {}
        }
        if (!usages || !Array.isArray(usages) || usages.length === 0) {
            usages = [{
                machine: item.machine || '',
                operator: item.operator || '',
                partno: item.partno || '',
                opn_no: item.opn_no || ''
            }];
        }

        const currentUsage = usages[targetUidx] || usages[0];
        const totalQty = Math.max(1, parseInt(item.qty_issued) || 1);
        const instTitle = totalQty > 1 ? ` [Insert #${targetInstIdx + 1} of ${totalQty}]` : '';

        const subtitleEl = document.getElementById('monitorSubtitle');
        if (subtitleEl) {
            subtitleEl.textContent = `${item.insert_spec || ''}${instTitle} | Part: ${currentUsage.partno || item.partno || '-'} | Opn: ${currentUsage.opn_no || item.opn_no || '-'} | Batch: ${item.batch_no || '-'}`;
        }

        let numEdges = 4;
        try {
            const specRes = await fetch('/api/insert_masters');
            const specs = await specRes.json();
            const master = specs.find(s => (s.insert_spec || s.name || '').trim().toLowerCase() === (item.insert_spec || '').trim().toLowerCase());
            if (master) {
                numEdges = parseInt(master.no_of_edges) || parseInt(master.edges) || 4;
            }
        } catch (e) { console.error(e); }

        const edgeObjNormalized = getInstEdgeObj(item.edge_data, targetInstIdx);

        const tbody = document.getElementById('insertMonitorTableBody');
        tbody.innerHTML = '';

        let activeMonitorInput = null;

        for (let i = 1; i <= numEdges; i++) {
            const tr = document.createElement('tr');
            const info = edgeObjNormalized[String(i)];

            let inputHtml = '';
            if (info && info.qty > 0) {
                if (info.uIdx === targetUidx) {
                    inputHtml = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <button type="button" class="btn btn-outline edge-step-btn" data-edge="${i}" data-dir="-1" style="padding: 4px 12px; font-weight: bold; font-size: 1.1rem; border-radius: 4px; border-color: #cbd5e1; background: #f8fafc; touch-action: manipulation;">-</button>
                                <input type="number" pattern="[0-9]*" inputmode="numeric" class="edge-qty-input" data-edge="${i}" value="${info.qty}" placeholder="Qty" min="0" style="flex: 1; min-width: 60px; padding: 4px 6px; font-size: 1.05rem; font-weight: bold; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;">
                                <button type="button" class="btn btn-outline edge-step-btn" data-edge="${i}" data-dir="1" style="padding: 4px 12px; font-weight: bold; font-size: 1.1rem; border-radius: 4px; border-color: #cbd5e1; background: #f8fafc; touch-action: manipulation;">+</button>
                            </div>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="10" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+10</button>
                                <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="25" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+25</button>
                                <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="50" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+50</button>
                                <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="100" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+100</button>
                                <button type="button" class="edge-clear-btn" data-edge="${i}" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #fca5a5; color: #dc2626; border-radius: 3px; background: #fef2f2; cursor: pointer; touch-action: manipulation;">Clear</button>
                            </div>
                        </div>
                    `;
                } else {
                    const label = info.partno ? info.partno : `Usage #${info.uIdx + 1}`;
                    inputHtml = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="number" pattern="[0-9]*" inputmode="numeric" class="edge-qty-input" data-edge="${i}" value="" placeholder="Filled in ${label}" disabled style="flex: 1; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.05); color: var(--text-muted); opacity: 0.7; cursor: not-allowed;">
                            <span style="font-size: 0.8rem; color: #16a34a; font-weight: 500; white-space: nowrap;">✓ (${label}: Qty ${info.qty})</span>
                        </div>
                    `;
                }
            } else {
                inputHtml = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn btn-outline edge-step-btn" data-edge="${i}" data-dir="-1" style="padding: 4px 12px; font-weight: bold; font-size: 1.1rem; border-radius: 4px; border-color: #cbd5e1; background: #f8fafc; touch-action: manipulation;">-</button>
                            <input type="number" pattern="[0-9]*" inputmode="numeric" class="edge-qty-input" data-edge="${i}" value="" placeholder="Qty" min="0" style="flex: 1; min-width: 60px; padding: 4px 6px; font-size: 1.05rem; font-weight: bold; text-align: center; border: 1px solid var(--border-color); border-radius: 4px;">
                            <button type="button" class="btn btn-outline edge-step-btn" data-edge="${i}" data-dir="1" style="padding: 4px 12px; font-weight: bold; font-size: 1.1rem; border-radius: 4px; border-color: #cbd5e1; background: #f8fafc; touch-action: manipulation;">+</button>
                        </div>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="10" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+10</button>
                            <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="25" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+25</button>
                            <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="50" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+50</button>
                            <button type="button" class="edge-quick-btn" data-edge="${i}" data-add="100" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #cbd5e1; border-radius: 3px; background: #f1f5f9; cursor: pointer; touch-action: manipulation;">+100</button>
                            <button type="button" class="edge-clear-btn" data-edge="${i}" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid #fca5a5; color: #dc2626; border-radius: 3px; background: #fef2f2; cursor: pointer; touch-action: manipulation;">Clear</button>
                        </div>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: 700; width: 70px; font-size: 0.9rem;">Edge ${i}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">
                    ${inputHtml}
                </td>
            `;
            tbody.appendChild(tr);
        }

        updateMonitorTotalQty();

        tbody.querySelectorAll('.edge-qty-input').forEach(input => {
            if (!input.disabled) {
                input.addEventListener('input', updateMonitorTotalQty);
            }
        });

        tbody.querySelectorAll('.edge-step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const edge = btn.getAttribute('data-edge');
                const dir = parseInt(btn.getAttribute('data-dir')) || 0;
                const inp = tbody.querySelector(`.edge-qty-input[data-edge="${edge}"]`);
                if (inp && !inp.disabled) {
                    let val = parseInt(inp.value) || 0;
                    val = Math.max(0, val + dir);
                    inp.value = val > 0 ? val : '';
                    updateMonitorTotalQty();
                }
            });
        });

        tbody.querySelectorAll('.edge-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const edge = btn.getAttribute('data-edge');
                const addVal = parseInt(btn.getAttribute('data-add')) || 0;
                const inp = tbody.querySelector(`.edge-qty-input[data-edge="${edge}"]`);
                if (inp && !inp.disabled) {
                    let val = parseInt(inp.value) || 0;
                    val = Math.max(0, val + addVal);
                    inp.value = val;
                    updateMonitorTotalQty();
                }
            });
        });

        tbody.querySelectorAll('.edge-clear-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const edge = btn.getAttribute('data-edge');
                const inp = tbody.querySelector(`.edge-qty-input[data-edge="${edge}"]`);
                if (inp && !inp.disabled) {
                    inp.value = '';
                    updateMonitorTotalQty();
                }
            });
        });

        insertMonitorModal.classList.add('show');
    }

    function updateMonitorTotalQty() {
        const inputs = document.querySelectorAll('#insertMonitorTableBody .edge-qty-input');
        let total = 0;
        inputs.forEach(inp => {
            if (!inp.disabled) {
                total += parseInt(inp.value) || 0;
            }
        });
        const totalSpan = document.getElementById('monitorTotalQty');
        if (totalSpan) totalSpan.textContent = `Total Edge Qty: ${total}`;
    }

    if (saveInsertMonitorBtn) {
        saveInsertMonitorBtn.addEventListener('click', async () => {
            if (!currentMonitorIssueItem) return;
            const inputs = document.querySelectorAll('#insertMonitorTableBody .edge-qty-input');

            try {
                const getRes = await fetch(`/api/insert_issues/${currentMonitorIssueItem.id}`);
                const freshItem = getRes.ok ? await getRes.json() : currentMonitorIssueItem;

                let usages = [];
                if (freshItem.usages) {
                    try {
                        let parsed = freshItem.usages;
                        while (typeof parsed === 'string') {
                            parsed = JSON.parse(parsed);
                        }
                        if (Array.isArray(parsed)) usages = parsed;
                    } catch(e) {}
                }
                if (!usages || !Array.isArray(usages) || usages.length === 0) {
                    usages = [{
                        machine: freshItem.machine || '',
                        operator: freshItem.operator || '',
                        partno: freshItem.partno || '',
                        opn_no: freshItem.opn_no || ''
                    }];
                }

                const currentUsage = usages[currentMonitorUidx] || usages[0];
                const activePartno = currentUsage.partno || freshItem.partno || '';

                const currentInstObj = getInstEdgeObj(freshItem.edge_data, currentMonitorInstIdx);

                inputs.forEach(inp => {
                    if (inp.disabled) return;
                    const edgeNo = inp.getAttribute('data-edge');
                    const val = parseInt(inp.value) || 0;
                    if (val > 0) {
                        currentInstObj[edgeNo] = {
                            qty: val,
                            uIdx: currentMonitorUidx,
                            partno: activePartno
                        };
                    } else {
                        if (currentInstObj[edgeNo] && currentInstObj[edgeNo].uIdx === currentMonitorUidx) {
                            delete currentInstObj[edgeNo];
                        }
                    }
                });

                const newEdgeData = setInstEdgeObj(freshItem.edge_data, currentMonitorInstIdx, currentInstObj);

                const payload = {
                    date: freshItem.date || '',
                    shift: freshItem.shift || '',
                    department: freshItem.department || '',
                    insert_spec: freshItem.insert_spec || '',
                    batch_no: freshItem.batch_no || '',
                    qty_issued: freshItem.qty_issued || 1,
                    machine: freshItem.machine || '',
                    operator: freshItem.operator || '',
                    partno: freshItem.partno || '',
                    opn_no: freshItem.opn_no || '',
                    usages: freshItem.usages || '',
                    receipt_id: freshItem.receipt_id || null,
                    edge_data: newEdgeData
                };

                const res = await fetch(`/api/insert_issues/${currentMonitorIssueItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    insertMonitorModal.classList.remove('show');
                    fetchInsertIssues();
                } else {
                    alert('Error saving monitor details.');
                }
            } catch (e) {
                console.error(e);
                alert('Error updating insert issue monitor.');
            }
        });
    }

    // ====== BREAKDOWN SLIP (B/D SLIP) LOGIC ======
    const bdSlipModal = document.getElementById('bdSlipModal');
    const bdSlipForm = document.getElementById('bdSlipForm');
    const addBdSlipBtn = document.getElementById('addBdSlipBtn');
    const cancelBdSlipBtn = document.getElementById('cancelBdSlipBtn');
    const closeBdSlipModalBtn = document.getElementById('closeBdSlipModalBtn');

    async function fetchBdSlips() {
        try {
            const res = await fetch('/api/breakdown_slips');
            const data = await res.json();
            renderBdSlips(data);
        } catch (err) { console.error('Error fetching breakdown slips:', err); }
    }

    function renderBdSlips(slips) {
        const tbody = document.getElementById('bdSlipBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!slips || slips.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.75rem;">No breakdown slips found. Click "+ Add Breakdown Slip" to create a record.</td></tr>';
            return;
        }

        slips.forEach(item => {
            const tr = document.createElement('tr');
            const isSignedOff = item.status === 'Signed Off' || (item.signoff_date_time && item.signoff_date_time.trim() !== '');
            const statusBadge = isSignedOff 
                ? '<span style="color: #16a34a; font-weight: 600; background: #dcfce7; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Signed Off</span>' 
                : '<span style="color: #d97706; font-weight: 600; background: #fef3c7; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Open</span>';

            const formattedDateTime = item.date_time ? item.date_time.replace('T', ' ') : '';
            const formattedSignoff = item.signoff_date_time ? item.signoff_date_time.replace('T', ' ') : '-';

            tr.innerHTML = `
                <td>${item.id}</td>
                <td><span style="font-weight: 500;">${formattedDateTime}</span></td>
                <td>${item.department || ''}</td>
                <td>${item.shift || ''}</td>
                <td><strong>${item.maint_type || 'Breakdown'}</strong></td>
                <td>${item.request_by || ''}</td>
                <td><strong>${item.machine || ''}</strong></td>
                <td style="max-width: 200px; white-space: pre-wrap; font-size: 0.85rem;">${item.problem || ''}</td>
                <td>${formattedSignoff}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    ${!isSignedOff ? `<button class="btn btn-outline signoff-bd-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: #16a34a; border-color: #16a34a; margin-right: 4px;">Sign-off</button>` : ''}
                    <button class="btn btn-outline edit-bd-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 4px;">Edit</button>
                    <button class="btn btn-outline delete-bd-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.signoff-bd-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const now = new Date();
                const nowStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                const res = await fetch('/api/breakdown_slips');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) {
                    item.signoff_date_time = nowStr;
                    item.status = 'Signed Off';
                    try {
                        const updateRes = await fetch(`/api/breakdown_slips/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(item)
                        });
                        if (updateRes.ok) fetchBdSlips();
                    } catch(err) { console.error(err); }
                }
            });
        });

        tbody.querySelectorAll('.edit-bd-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const res = await fetch('/api/breakdown_slips');
                const data = await res.json();
                const item = data.find(x => x.id == id);
                if (item) openBdSlipModal(item);
            });
        });

        tbody.querySelectorAll('.delete-bd-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Delete this Breakdown Slip record?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetch(`/api/breakdown_slips/${id}`, { method: 'DELETE' });
                        if (res.ok) fetchBdSlips();
                        else alert('Error deleting breakdown slip');
                    } catch (err) { console.error(err); }
                }
            });
        });
    }

    async function openBdSlipModal(item = null) {
        if (!bdSlipModal) return;

        const [deptRes, shiftRes, machRes] = await Promise.all([
            fetch('/api/departments'),
            fetch('/api/shifts'),
            fetch('/api/machines')
        ]);
        const depts = await deptRes.json();
        const shifts = await shiftRes.json();
        const machines = await machRes.json();

        const deptSel = document.getElementById('bdDeptSelect');
        deptSel.innerHTML = '<option value="">-- Select Dept --</option>';
        depts.forEach(d => {
            deptSel.innerHTML += `<option value="${d.name}">${d.name}</option>`;
        });

        const shiftSel = document.getElementById('bdShiftSelect');
        shiftSel.innerHTML = '<option value="">-- Select Shift --</option>';
        shifts.forEach(s => {
            shiftSel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });

        const updateMachineDropdown = (selectedDept, currentMach = '') => {
            const machSel = document.getElementById('bdMachineSelect');
            machSel.innerHTML = '<option value="">-- Select Machine --</option>';
            const cleanDept = (selectedDept || '').trim().toUpperCase();
            let filtered = machines;
            if (cleanDept) {
                const matches = machines.filter(m => (m.department || '').trim().toUpperCase() === cleanDept);
                if (matches.length > 0) filtered = matches;
            }
            filtered.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                if (m.name === currentMach) opt.selected = true;
                machSel.appendChild(opt);
            });
        };

        deptSel.onchange = (e) => {
            updateMachineDropdown(e.target.value);
        };

        if (item) {
            document.getElementById('bdSlipModalTitle').textContent = 'Edit Breakdown Slip';
            document.getElementById('bdSlipId').value = item.id;
            document.getElementById('bdDateTimeInput').value = item.date_time || '';
            document.getElementById('bdDeptSelect').value = item.department || '';
            document.getElementById('bdShiftSelect').value = item.shift || '';
            document.getElementById('bdMaintTypeSelect').value = item.maint_type || 'Breakdown';
            document.getElementById('bdRequestByInput').value = item.request_by || '';
            updateMachineDropdown(item.department || '', item.machine || '');
            document.getElementById('bdProblemInput').value = item.problem || '';
            document.getElementById('bdSignoffDateTimeInput').value = item.signoff_date_time || '';
        } else {
            document.getElementById('bdSlipModalTitle').textContent = 'Create Breakdown Slip';
            bdSlipForm.reset();
            document.getElementById('bdSlipId').value = '';
            const now = new Date();
            const nowStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            document.getElementById('bdDateTimeInput').value = nowStr;
            updateMachineDropdown('');
        }

        bdSlipModal.classList.add('show');
    }

    if (addBdSlipBtn) addBdSlipBtn.addEventListener('click', () => openBdSlipModal());
    if (cancelBdSlipBtn) cancelBdSlipBtn.addEventListener('click', () => bdSlipModal.classList.remove('show'));
    if (closeBdSlipModalBtn) closeBdSlipModalBtn.addEventListener('click', () => bdSlipModal.classList.remove('show'));

    if (bdSlipForm) {
        bdSlipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('bdSlipId').value;
            const signoffVal = document.getElementById('bdSignoffDateTimeInput').value;

            const payload = {
                date_time: document.getElementById('bdDateTimeInput').value,
                department: document.getElementById('bdDeptSelect').value,
                shift: document.getElementById('bdShiftSelect').value,
                maint_type: document.getElementById('bdMaintTypeSelect').value,
                request_by: document.getElementById('bdRequestByInput').value.trim(),
                machine: document.getElementById('bdMachineSelect').value,
                problem: document.getElementById('bdProblemInput').value.trim(),
                signoff_date_time: signoffVal,
                status: signoffVal ? 'Signed Off' : 'Open'
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/breakdown_slips/${id}` : '/api/breakdown_slips';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    bdSlipModal.classList.remove('show');
                    fetchBdSlips();
                } else {
                    alert('Error saving Breakdown Slip');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving Breakdown Slip');
            }
        });
    }

    // ====== SERVICE DETAILS LOGIC ======
    let openBreakdownSlipsMap = {};
    let currentServiceDetailId = null;

    async function initServiceDetails() {
        showServiceFormView();
        await loadOpenBreakdownMachinesDropdown();
        fetchServiceHistory();
    }

    function showServiceFormView() {
        const formCont = document.getElementById('sdFormContainer');
        const histCont = document.getElementById('sdHistoryContainer');
        const toggleBtn = document.getElementById('sdToggleViewBtn');
        if (formCont) formCont.style.display = 'block';
        if (histCont) histCont.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'View Service History';
    }

    function showServiceHistoryView() {
        const formCont = document.getElementById('sdFormContainer');
        const histCont = document.getElementById('sdHistoryContainer');
        const toggleBtn = document.getElementById('sdToggleViewBtn');
        if (formCont) formCont.style.display = 'none';
        if (histCont) histCont.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = 'Back to Entry Form';
    }

    const sdToggleViewBtn = document.getElementById('sdToggleViewBtn');
    if (sdToggleViewBtn) {
        sdToggleViewBtn.addEventListener('click', () => {
            const formCont = document.getElementById('sdFormContainer');
            if (formCont && formCont.style.display === 'none') {
                showServiceFormView();
            } else {
                showServiceHistoryView();
            }
        });
    }

    const newServiceEntryBtn = document.getElementById('newServiceEntryBtn');
    if (newServiceEntryBtn) {
        newServiceEntryBtn.addEventListener('click', () => {
            resetServiceDetailsForm();
            showServiceFormView();
        });
    }

    async function loadOpenBreakdownMachinesDropdown() {
        const select = document.getElementById('sdBreakdownSelect');
        if (!select) return;
        select.innerHTML = '<option value="">-- Loading Open Breakdown Slips... --</option>';

        try {
            const res = await fetch('/api/breakdown_slips');
            const data = await res.json();
            openBreakdownSlipsMap = {};

            const openSlips = data.filter(s => s.status !== 'Signed Off' && (!s.signoff_date_time || s.signoff_date_time.trim() === ''));

            select.innerHTML = '<option value="">-- Select Open Breakdown Machine --</option>';
            if (openSlips.length === 0) {
                select.innerHTML += '<option value="" disabled>(No open breakdown slips currently available)</option>';
            }

            openSlips.forEach(item => {
                openBreakdownSlipsMap[item.id] = item;
                const probText = item.problem ? item.problem.substring(0, 45) : 'No problem text';
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${item.machine} | ${probText} (Dept: ${item.department || '-'}, ID: ${item.id})`;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading breakdown slips:', err);
            select.innerHTML = '<option value="">-- Error loading open breakdowns --</option>';
        }
    }

    const sdBreakdownSelect = document.getElementById('sdBreakdownSelect');
    if (sdBreakdownSelect) {
        sdBreakdownSelect.addEventListener('change', async (e) => {
            const bdId = e.target.value;
            const infoCard = document.getElementById('sdBreakdownInfoCard');
            if (bdId && openBreakdownSlipsMap[bdId]) {
                const item = openBreakdownSlipsMap[bdId];
                document.getElementById('sdInfoId').textContent = item.id;
                document.getElementById('sdInfoDate').textContent = item.date_time ? item.date_time.replace('T', ' ') : '-';
                document.getElementById('sdInfoDept').textContent = item.department || '-';
                document.getElementById('sdInfoMachine').textContent = item.machine || '-';
                document.getElementById('sdInfoRequestBy').textContent = item.request_by || '-';
                document.getElementById('sdInfoProblem').textContent = item.problem || '-';
                if (infoCard) infoCard.style.display = 'block';

                await loadExistingServiceDetailForBreakdown(item.id);
            } else {
                if (infoCard) infoCard.style.display = 'none';
                resetServiceDetailsForm(false);
            }
        });
    }

    async function loadExistingServiceDetailForBreakdown(breakdownSlipId) {
        try {
            const res = await fetch('/api/service_details');
            const list = await res.json();
            const existing = list.find(s => s.breakdown_slip_id == breakdownSlipId);
            if (existing) {
                currentServiceDetailId = existing.id;
                
                // Load Spares Data
                let sparesList = [];
                try { sparesList = JSON.parse(existing.spares_data || '[]'); } catch(e) {}
                sdSparesBody.innerHTML = '';
                if (sparesList.length > 0) {
                    sparesList.forEach(sp => addSpareRow(sp));
                } else {
                    addSpareRow();
                }

                // Load Service Data
                let serviceList = [];
                try { serviceList = JSON.parse(existing.service_data || '[]'); } catch(e) {}
                sdServiceBody.innerHTML = '';
                if (serviceList.length > 0) {
                    serviceList.forEach(srv => addServiceRow(srv));
                } else {
                    addServiceRow();
                }

                // Load Remarks
                document.getElementById('sdRemarksInput').value = existing.remarks || '';
                calcServiceTotals();
            } else {
                currentServiceDetailId = null;
                if (sdSparesBody) sdSparesBody.innerHTML = '';
                if (sdServiceBody) sdServiceBody.innerHTML = '';
                addSpareRow();
                addServiceRow();
                document.getElementById('sdRemarksInput').value = '';
                calcServiceTotals();
            }
        } catch (err) {
            console.error('Error loading existing service detail:', err);
        }
    }

    // Dynamic Spares Rows Logic
    const sdSparesBody = document.getElementById('sdSparesBody');
    const sdAddSpareRowBtn = document.getElementById('sdAddSpareRowBtn');

    function addSpareRow(data = {}) {
        if (!sdSparesBody) return;
        const defaultToday = new Date().toISOString().split('T')[0];
        const tr = document.createElement('tr');
        tr.className = 'spare-row';
        tr.innerHTML = `
            <td style="padding: 6px;"><input type="date" class="spare-date" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.date || defaultToday}"></td>
            <td style="padding: 6px;"><input type="text" class="spare-name" placeholder="Spare name/spec" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.part_name || ''}"></td>
            <td style="padding: 6px;"><input type="number" class="spare-qty" min="1" step="1" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.qty !== undefined ? data.qty : 1}"></td>
            <td style="padding: 6px;"><input type="number" class="spare-unit-cost" min="0" step="0.01" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.unit_cost || 0}"></td>
            <td style="padding: 6px;"><input type="number" class="spare-total-cost" readonly style="width: 100%; padding: 4px 6px; background: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.total_cost || 0}"></td>
            <td style="padding: 6px;">
                <select class="spare-received" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    <option value="Yes" ${data.received === 'Yes' || !data.received ? 'selected' : ''}>Yes</option>
                    <option value="No" ${data.received === 'No' ? 'selected' : ''}>No</option>
                </select>
            </td>
            <td style="padding: 6px;"><input type="date" class="spare-date-received" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.date_received || defaultToday}"></td>
            <td style="padding: 6px;"><input type="text" class="spare-remarks" placeholder="Supplier / remarks" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.remarks || ''}"></td>
            <td style="padding: 6px; text-align: center;"><button type="button" class="btn btn-outline remove-row-btn" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444; font-weight: bold;">&times;</button></td>
        `;
        sdSparesBody.appendChild(tr);

        const qtyIn = tr.querySelector('.spare-qty');
        const unitIn = tr.querySelector('.spare-unit-cost');
        const totalIn = tr.querySelector('.spare-total-cost');
        const removeBtn = tr.querySelector('.remove-row-btn');

        const updateRowTotal = () => {
            const q = parseFloat(qtyIn.value) || 0;
            const u = parseFloat(unitIn.value) || 0;
            totalIn.value = (q * u).toFixed(2);
            calcServiceTotals();
        };

        qtyIn.addEventListener('input', updateRowTotal);
        unitIn.addEventListener('input', updateRowTotal);

        removeBtn.addEventListener('click', () => {
            tr.remove();
            calcServiceTotals();
        });

        updateRowTotal();
    }

    if (sdAddSpareRowBtn) {
        sdAddSpareRowBtn.addEventListener('click', () => addSpareRow());
    }

    // Dynamic Service Rows Logic
    const sdServiceBody = document.getElementById('sdServiceBody');
    const sdAddServiceRowBtn = document.getElementById('sdAddServiceRowBtn');

    function addServiceRow(data = {}) {
        if (!sdServiceBody) return;
        const tr = document.createElement('tr');
        tr.className = 'service-row';
        tr.innerHTML = `
            <td style="padding: 6px;"><input type="text" class="service-work" placeholder="Work done / action taken" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.work_done || ''}"></td>
            <td style="padding: 6px;"><input type="text" class="service-tech" placeholder="Technician / vendor name" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.technician || ''}"></td>
            <td style="padding: 6px;"><input type="datetime-local" class="service-start" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.start_time || ''}"></td>
            <td style="padding: 6px;"><input type="datetime-local" class="service-end" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.end_time || ''}"></td>
            <td style="padding: 6px;"><input type="number" class="service-cost" min="0" step="0.01" style="width: 100%; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${data.cost || 0}"></td>
            <td style="padding: 6px; text-align: center;"><button type="button" class="btn btn-outline remove-row-btn" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444; font-weight: bold;">&times;</button></td>
        `;
        sdServiceBody.appendChild(tr);

        const costIn = tr.querySelector('.service-cost');
        const removeBtn = tr.querySelector('.remove-row-btn');

        costIn.addEventListener('input', () => calcServiceTotals());
        removeBtn.addEventListener('click', () => {
            tr.remove();
            calcServiceTotals();
        });

        calcServiceTotals();
    }

    if (sdAddServiceRowBtn) {
        sdAddServiceRowBtn.addEventListener('click', () => addServiceRow());
    }

    function calcServiceTotals() {
        let sparesTotal = 0;
        document.querySelectorAll('.spare-total-cost').forEach(input => {
            sparesTotal += parseFloat(input.value) || 0;
        });

        let serviceTotal = 0;
        document.querySelectorAll('.service-cost').forEach(input => {
            serviceTotal += parseFloat(input.value) || 0;
        });

        const grandTotal = sparesTotal + serviceTotal;

        const sparesIn = document.getElementById('sdSparesTotal');
        const serviceIn = document.getElementById('sdServiceTotal');
        const grandIn = document.getElementById('sdGrandTotal');

        if (sparesIn) sparesIn.value = sparesTotal.toFixed(2);
        if (serviceIn) serviceIn.value = serviceTotal.toFixed(2);
        if (grandIn) grandIn.value = grandTotal.toFixed(2);
    }

    function resetServiceDetailsForm(clearSelect = true) {
        currentServiceDetailId = null;
        if (clearSelect) {
            const select = document.getElementById('sdBreakdownSelect');
            if (select) select.value = '';
            const infoCard = document.getElementById('sdBreakdownInfoCard');
            if (infoCard) infoCard.style.display = 'none';
        }

        if (sdSparesBody) sdSparesBody.innerHTML = '';
        if (sdServiceBody) sdServiceBody.innerHTML = '';

        addSpareRow();
        addServiceRow();

        const remarksIn = document.getElementById('sdRemarksInput');
        if (remarksIn) remarksIn.value = '';

        calcServiceTotals();
    }

    const saveServiceDetailBtn = document.getElementById('saveServiceDetailBtn');
    if (saveServiceDetailBtn) {
        saveServiceDetailBtn.addEventListener('click', async () => {
            const bdIdVal = document.getElementById('sdBreakdownSelect').value;
            if (!bdIdVal && !currentServiceDetailId) {
                alert('Please select an Open Breakdown Machine');
                return;
            }

            const bdItem = openBreakdownSlipsMap[bdIdVal] || {};

            const sparesList = [];
            document.querySelectorAll('.spare-row').forEach(tr => {
                const date = tr.querySelector('.spare-date').value;
                const name = tr.querySelector('.spare-name').value.trim();
                const qty = parseFloat(tr.querySelector('.spare-qty').value) || 0;
                const unit_cost = parseFloat(tr.querySelector('.spare-unit-cost').value) || 0;
                const total_cost = parseFloat(tr.querySelector('.spare-total-cost').value) || 0;
                const received = tr.querySelector('.spare-received').value;
                const date_received = tr.querySelector('.spare-date-received').value;
                const remarks = tr.querySelector('.spare-remarks').value.trim();
                if (name || total_cost > 0 || remarks) {
                    sparesList.push({ date, part_name: name, qty, unit_cost, total_cost, received, date_received, remarks });
                }
            });

            const serviceList = [];
            document.querySelectorAll('.service-row').forEach(tr => {
                const work_done = tr.querySelector('.service-work').value.trim();
                const technician = tr.querySelector('.service-tech').value.trim();
                const start_time = tr.querySelector('.service-start').value;
                const end_time = tr.querySelector('.service-end').value;
                const cost = parseFloat(tr.querySelector('.service-cost').value) || 0;
                if (work_done || technician || cost > 0) {
                    serviceList.push({ work_done, technician, start_time, end_time, cost });
                }
            });

            const spares_cost = parseFloat(document.getElementById('sdSparesTotal').value) || 0;
            const service_cost = parseFloat(document.getElementById('sdServiceTotal').value) || 0;
            const total_cost = parseFloat(document.getElementById('sdGrandTotal').value) || 0;
            const remarks = document.getElementById('sdRemarksInput').value.trim();

            const payload = {
                breakdown_slip_id: parseInt(bdIdVal) || (bdItem.id ? parseInt(bdItem.id) : null),
                machine: bdItem.machine || '',
                spares_data: JSON.stringify(sparesList),
                service_data: JSON.stringify(serviceList),
                spares_cost,
                service_cost,
                total_cost,
                remarks
            };

            const method = currentServiceDetailId ? 'PUT' : 'POST';
            const url = currentServiceDetailId ? `/api/service_details/${currentServiceDetailId}` : '/api/service_details';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const savedItem = await res.json();
                    currentServiceDetailId = savedItem.id;
                    alert('Service Details saved successfully!');
                    fetchServiceHistory();
                } else {
                    alert('Error saving Service Details');
                }
            } catch (err) {
                console.error(err);
                alert('Error saving Service Details');
            }
        });
    }

    async function fetchServiceHistory() {
        const tbody = document.getElementById('sdHistoryBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        try {
            const res = await fetch('/api/service_details');
            const data = await res.json();
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 0.75rem;">No service detail history recorded yet.</td></tr>';
                return;
            }

            data.forEach(item => {
                let spareNames = '-';
                let spareSuppliers = '-';
                try {
                    const spares = JSON.parse(item.spares_data || '[]');
                    const names = spares.map(s => s.part_name ? s.part_name.trim() : '').filter(Boolean);
                    if (names.length > 0) spareNames = names.join(', ');
                    const suppliers = spares.map(s => s.remarks ? s.remarks.trim() : (s.supplier ? s.supplier.trim() : '')).filter(Boolean);
                    if (suppliers.length > 0) spareSuppliers = suppliers.join(', ');
                } catch(e) {}

                let actionsTaken = '-';
                let vendorTechs = '-';
                try {
                    const services = JSON.parse(item.service_data || '[]');
                    const actions = services.map(s => s.work_done ? s.work_done.trim() : '').filter(Boolean);
                    if (actions.length > 0) actionsTaken = actions.join(', ');
                    const techs = services.map(s => s.technician ? s.technician.trim() : (s.vendor ? s.vendor.trim() : '')).filter(Boolean);
                    if (techs.length > 0) vendorTechs = techs.join(', ');
                } catch(e) {}

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.breakdown_slip_id || '-'}</td>
                    <td><strong>${item.machine || '-'}</strong></td>
                    <td style="max-width: 180px; white-space: pre-wrap; font-size: 0.85rem; font-weight: 500; color: #0284c7;">${spareNames}</td>
                    <td style="max-width: 150px; white-space: pre-wrap; font-size: 0.85rem; font-weight: 500; color: #475569;">${spareSuppliers}</td>
                    <td style="max-width: 200px; white-space: pre-wrap; font-size: 0.85rem; font-weight: 500; color: #15803d;">${actionsTaken}</td>
                    <td style="max-width: 150px; white-space: pre-wrap; font-size: 0.85rem; font-weight: 500; color: #0f766e;">${vendorTechs}</td>
                    <td>₹${(item.spares_cost || 0).toFixed(2)}</td>
                    <td>₹${(item.service_cost || 0).toFixed(2)}</td>
                    <td><strong style="color: #0369a1;">₹${(item.total_cost || 0).toFixed(2)}</strong></td>
                    <td style="max-width: 160px; white-space: pre-wrap; font-size: 0.85rem;">${item.remarks || '-'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-outline delete-sd-btn" data-id="${item.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.delete-sd-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Delete this Service Detail record?')) {
                        const id = e.target.getAttribute('data-id');
                        try {
                            const delRes = await fetch(`/api/service_details/${id}`, { method: 'DELETE' });
                            if (delRes.ok) fetchServiceHistory();
                        } catch (err) { console.error(err); }
                    }
                });
            });
        } catch (err) { console.error(err); }
    }

    // --- Insert CPC Report Implementation ---
    let insertCpcDataCache = null;

    async function fetchInsertCpcReport() {
        try {
            const [issueRes, receiptRes, masterRes, prodRes, partRes, deptRes] = await Promise.all([
                fetch('/api/insert_issues'),
                fetch('/api/insert_receipts'),
                fetch('/api/insert_masters'),
                fetch('/api/prodlog'),
                fetch('/api/partmaster'),
                fetch('/api/departments').catch(() => null)
            ]);

            const issues = await issueRes.json();
            const receipts = await receiptRes.json();
            const masters = await masterRes.json();
            const prodLogs = await prodRes.json();
            const parts = await partRes.json();
            let depts = [];
            if (deptRes && deptRes.ok) {
                try { depts = await deptRes.json(); } catch(e) {}
            }

            populateInsertCpcFilterDropdowns(issues, parts, depts);

            const fromDate = document.getElementById('insertCpcFromDate')?.value || '';
            const toDate = document.getElementById('insertCpcToDate')?.value || '';
            const filterDept = document.getElementById('insertCpcFilterDept')?.value || '';
            const filterPart = document.getElementById('insertCpcFilterPart')?.value || '';

            // Build Rate Maps from Insert Receipts & Insert Masters
            const receiptIdRateMap = {};
            const batchSpecRateMap = {};
            const specRateMap = {};

            // 1. Process Insert Receipts
            receipts.forEach(r => {
                const rate = parseFloat(r.rate) || 0;
                if (r.id) receiptIdRateMap[String(r.id)] = rate;

                const cleanSpec = (r.insert_spec || '').replace(/\s+/g, '').toLowerCase();
                const cleanBatch = (r.batch_no || '').replace(/\s+/g, '').toLowerCase();

                if (cleanBatch && cleanSpec && rate > 0) {
                    batchSpecRateMap[`${cleanBatch}_${cleanSpec}`] = rate;
                }
                if (cleanSpec && rate > 0) {
                    specRateMap[cleanSpec] = rate;
                }
            });

            // 2. Fallback to Insert Masters
            masters.forEach(m => {
                const cleanSpec = (m.insert_spec || m.name || '').replace(/\s+/g, '').toLowerCase();
                const rate = parseFloat(m.rate || m.cost || m.price || 0) || 0;
                if (cleanSpec && rate > 0 && !specRateMap[cleanSpec]) {
                    specRateMap[cleanSpec] = rate;
                }
            });

            const getRateForInsert = (item, rawSpec) => {
                if (item.receipt_id && receiptIdRateMap[String(item.receipt_id)] > 0) {
                    return receiptIdRateMap[String(item.receipt_id)];
                }
                const cleanBatch = (item.batch_no || '').replace(/\s+/g, '').toLowerCase();
                const cleanSpec = (rawSpec || item.insert_spec || '').replace(/\s+/g, '').toLowerCase();
                if (cleanBatch && cleanSpec && batchSpecRateMap[`${cleanBatch}_${cleanSpec}`] > 0) {
                    return batchSpecRateMap[`${cleanBatch}_${cleanSpec}`];
                }
                if (cleanSpec && specRateMap[cleanSpec] > 0) {
                    return specRateMap[cleanSpec];
                }
                return 0;
            };

            const vaMap = {};
            parts.forEach(p => {
                const pKey = (p.partno || '').trim().toLowerCase();
                if (pKey) {
                    vaMap[pKey] = {
                        partno: p.partno,
                        va: parseFloat(p.va || 0) || 0
                    };
                }
            });

            const filteredIssues = issues.filter(item => {
                const d = formatExcelDate(item.date);
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                if (filterDept && (item.department || '').trim().toLowerCase() !== filterDept.trim().toLowerCase()) return false;
                return true;
            });

            const partMap = {};

            filteredIssues.forEach(item => {
                let usages = [];
                if (item.usages) {
                    try {
                        let parsed = item.usages;
                        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
                        if (Array.isArray(parsed)) usages = parsed;
                    } catch(e) {}
                }
                if (!usages || !Array.isArray(usages) || usages.length === 0) {
                    usages = [{
                        partno: item.partno || '',
                        opn_no: item.opn_no || ''
                    }];
                }

                const totalIssued = parseInt(item.qty_issued) || 1;
                const qtyPerUsage = totalIssued / usages.length;

                usages.forEach(u => {
                    const rawPart = (u.partno || item.partno || '').trim();
                    const rawOpn = String(u.opn_no || item.opn_no || '').trim();
                    const rawSpec = (item.insert_spec || '').trim();

                    if (!rawPart) return;
                    if (filterPart && rawPart.toLowerCase() !== filterPart.trim().toLowerCase()) return;

                    const pKey = rawPart.toLowerCase();
                    const oKey = rawOpn.toLowerCase() || 'unspecified';
                    const sKey = rawSpec.toLowerCase() || 'unspecified';

                    if (!partMap[pKey]) {
                        partMap[pKey] = {
                            partno: rawPart,
                            opns: {}
                        };
                    }

                    if (!partMap[pKey].opns[oKey]) {
                        partMap[pKey].opns[oKey] = {
                            opn_no: rawOpn,
                            specs: {}
                        };
                    }

                    if (!partMap[pKey].opns[oKey].specs[sKey]) {
                        const rate = getRateForInsert(item, rawSpec);
                        partMap[pKey].opns[oKey].specs[sKey] = {
                            spec: rawSpec,
                            qty_issued: 0,
                            rate: rate,
                            value: 0
                        };
                    }

                    partMap[pKey].opns[oKey].specs[sKey].qty_issued += qtyPerUsage;
                    partMap[pKey].opns[oKey].specs[sKey].value = partMap[pKey].opns[oKey].specs[sKey].qty_issued * partMap[pKey].opns[oKey].specs[sKey].rate;
                });
            });

            const filteredProdLogs = prodLogs.filter(p => {
                const d = formatExcelDate(p.date);
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                if (filterDept && (p.dept || '').trim().toLowerCase() !== filterDept.trim().toLowerCase()) return false;
                return true;
            });

            const prodQtyMap = {};
            filteredProdLogs.forEach(p => {
                const pKey = (p.partno || '').trim().toLowerCase();
                const oKey = String(p.opn_no || '').trim().toLowerCase();
                const key = `${pKey}_${oKey}`;
                const qty = parseInt(p.prod_qty || p.ok_qty) || 0;
                prodQtyMap[key] = (prodQtyMap[key] || 0) + qty;
            });

            renderInsertCpcReport(partMap, prodQtyMap, vaMap);
        } catch (err) {
            console.error('Error in fetchInsertCpcReport:', err);
        }
    }

    function populateInsertCpcFilterDropdowns(issues, parts, depts) {
        const deptSelect = document.getElementById('insertCpcFilterDept');
        const partSelect = document.getElementById('insertCpcFilterPart');
        if (!deptSelect || !partSelect) return;

        if (deptSelect.options.length <= 1) {
            const deptSet = new Set();
            issues.forEach(i => { if (i.department) deptSet.add(i.department.trim()); });
            if (Array.isArray(depts)) depts.forEach(d => { if (d.name) deptSet.add(d.name.trim()); });
            deptSet.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });
        }

        if (partSelect.options.length <= 1) {
            const partSet = new Set();
            issues.forEach(i => {
                if (i.partno) partSet.add(i.partno.trim());
                if (i.usages) {
                    try {
                        let parsed = i.usages;
                        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(u => { if (u.partno) partSet.add(u.partno.trim()); });
                        }
                    } catch(e) {}
                }
            });
            parts.forEach(p => { if (p.partno) partSet.add(p.partno.trim()); });
            Array.from(partSet).sort().forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                partSelect.appendChild(opt);
            });
        }
    }

    function renderInsertCpcReport(partMap, prodQtyMap, vaMap) {
        const tbody = document.getElementById('insertCpcBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const partKeys = Object.keys(partMap).sort();

        if (partKeys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No insert issue data found for the selected filters.</td></tr>`;
            return;
        }

        partKeys.forEach(pKey => {
            const partObj = partMap[pKey];
            const partno = partObj.partno;
            const partVa = vaMap[pKey] ? vaMap[pKey].va : 0;
            const opnKeys = Object.keys(partObj.opns).sort((a,b) => (parseInt(a)||0) - (parseInt(b)||0));

            let partTotalSpecRows = 0;
            opnKeys.forEach(oKey => {
                const specKeys = Object.keys(partObj.opns[oKey].specs);
                partTotalSpecRows += specKeys.length;
            });

            const totalPartRowSpan = partTotalSpecRows + 2;

            let totalPartCpc = 0;
            let totalPartValue = 0;
            let isFirstPartRow = true;

            opnKeys.forEach(oKey => {
                const opnObj = partObj.opns[oKey];
                const opn_no = opnObj.opn_no;
                const qtyProd = prodQtyMap[`${pKey}_${oKey}`] || 0;
                const specKeys = Object.keys(opnObj.specs);

                let opnTotalValue = 0;
                specKeys.forEach(sKey => {
                    opnTotalValue += opnObj.specs[sKey].value;
                });

                const cpcOpn = qtyProd > 0 ? (opnTotalValue / qtyProd) : 0;
                totalPartCpc += cpcOpn;

                const opnRowSpan = specKeys.length;
                let isFirstOpnRow = true;

                specKeys.forEach(sKey => {
                    const specObj = opnObj.specs[sKey];
                    totalPartValue += specObj.value;

                    const tr = document.createElement('tr');
                    let html = '';

                    if (isFirstPartRow) {
                        html += `<td rowspan="${totalPartRowSpan}" style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-weight: bold; background: #fafafa;">${partno}</td>`;
                        isFirstPartRow = false;
                    }

                    if (isFirstOpnRow) {
                        html += `<td rowspan="${opnRowSpan}" style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; font-weight: 600; text-align: center;">${opn_no}</td>`;
                        html += `<td rowspan="${opnRowSpan}" style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; text-align: center; font-weight: 500;">${qtyProd}</td>`;
                    }

                    const qtyIssuedFormatted = Number.isInteger(specObj.qty_issued) ? specObj.qty_issued : specObj.qty_issued.toFixed(2);
                    html += `<td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 500;">${specObj.spec}</td>`;
                    html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 600;">${qtyIssuedFormatted}</td>`;
                    html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 500;">₹${specObj.value.toFixed(2)}</td>`;

                    if (isFirstOpnRow) {
                        html += `<td rowspan="${opnRowSpan}" style="border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; text-align: right; font-weight: 600; color: #0284c7;">₹${cpcOpn.toFixed(2)}</td>`;
                        isFirstOpnRow = false;
                    }

                    tr.innerHTML = html;
                    tbody.appendChild(tr);
                });
            });

            const trTotalCpc = document.createElement('tr');
            trTotalCpc.style.background = '#f1f5f9';
            trTotalCpc.innerHTML = `
                <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; font-weight: bold; color: var(--text-main);">total part cpc</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; font-weight: bold; color: var(--primary-color);">₹${totalPartCpc.toFixed(2)}</td>
            `;
            tbody.appendChild(trTotalCpc);

            const trPartVa = document.createElement('tr');
            trPartVa.style.background = '#f8fafc';
            trPartVa.innerHTML = `
                <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; font-weight: bold; color: var(--text-main);">Part VA</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; font-weight: bold; color: #0284c7;">₹${partVa.toFixed(2)}</td>
            `;
            tbody.appendChild(trPartVa);
        });
    }

    document.getElementById('filterInsertCpcBtn')?.addEventListener('click', fetchInsertCpcReport);
    document.getElementById('resetInsertCpcBtn')?.addEventListener('click', () => {
        if (document.getElementById('insertCpcFromDate')) document.getElementById('insertCpcFromDate').value = '';
        if (document.getElementById('insertCpcToDate')) document.getElementById('insertCpcToDate').value = '';
        if (document.getElementById('insertCpcFilterDept')) document.getElementById('insertCpcFilterDept').value = '';
        if (document.getElementById('insertCpcFilterPart')) document.getElementById('insertCpcFilterPart').value = '';
        fetchInsertCpcReport();
    });

    document.getElementById('exportInsertCpcBtn')?.addEventListener('click', () => {
        const table = document.getElementById('insertCpcTable');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, { sheet: "Insert_CPC_Report" });
        XLSX.writeFile(wb, `Insert_CPC_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // --- Insert Stock Summary Implementation ---
    let allInsertStockCache = [];

    async function fetchInsertStockReport() {
        const tbody = document.getElementById('insertStockBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">Loading Insert Stock...</td></tr>';

        try {
            const [mastersRes, receiptsRes, issuesRes] = await Promise.all([
                fetch('/api/insert_masters'),
                fetch('/api/insert_receipts'),
                fetch('/api/insert_issues')
            ]);

            const masters = await mastersRes.json();
            const receipts = await receiptsRes.json();
            const issues = await issuesRes.json();

            const variantsMap = {};

            // 1. Initialize from Insert Masters
            masters.forEach(m => {
                const spec = (m.insert_spec || m.name || '').trim();
                if (spec) {
                    const key = spec.toUpperCase();
                    if (!variantsMap[key]) {
                        variantsMap[key] = {
                            spec: spec,
                            no_of_edges: m.no_of_edges || m.edges || '-',
                            total_received: 0,
                            total_issued: 0,
                            current_stock: 0,
                            total_value: 0,
                            last_rate: parseFloat(m.rate || m.cost || m.price || 0) || 0
                        };
                    } else if (m.no_of_edges) {
                        variantsMap[key].no_of_edges = m.no_of_edges;
                    }
                }
            });

            // 2. Aggregate Receipts (remaining batch stock & rate)
            receipts.forEach(r => {
                const spec = (r.insert_spec || '').trim();
                if (!spec) return;
                const key = spec.toUpperCase();
                if (!variantsMap[key]) {
                    variantsMap[key] = {
                        spec: spec,
                        no_of_edges: '-',
                        total_received: 0,
                        total_issued: 0,
                        current_stock: 0,
                        total_value: 0,
                        last_rate: 0
                    };
                }
                const rQty = parseInt(r.qty) || 0;
                const rRate = parseFloat(r.rate) || 0;

                if (rQty > 0) {
                    variantsMap[key].current_stock += rQty;
                    variantsMap[key].total_value += (rQty * rRate);
                }
                if (rRate > 0) {
                    variantsMap[key].last_rate = rRate;
                }
            });

            // 3. Aggregate Issues
            issues.forEach(i => {
                const spec = (i.insert_spec || '').trim();
                if (!spec) return;
                const key = spec.toUpperCase();
                if (!variantsMap[key]) {
                    variantsMap[key] = {
                        spec: spec,
                        no_of_edges: '-',
                        total_received: 0,
                        total_issued: 0,
                        current_stock: 0,
                        total_value: 0,
                        last_rate: 0
                    };
                }
                const iQty = parseInt(i.qty_issued) || 0;
                variantsMap[key].total_issued += iQty;
            });

            // 4. Calculate total received & average rate
            Object.values(variantsMap).forEach(v => {
                v.total_received = v.current_stock + v.total_issued;
                v.avg_rate = v.current_stock > 0 ? (v.total_value / v.current_stock) : v.last_rate;
            });

            allInsertStockCache = Object.values(variantsMap).sort((a, b) => a.spec.localeCompare(b.spec, undefined, { numeric: true, sensitivity: 'base' }));

            renderInsertStockTable(allInsertStockCache);

        } catch (err) {
            console.error('Error fetching Insert Stock:', err);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 1.5rem;">Error loading Insert Stock data</td></tr>';
        }
    }

    function renderInsertStockTable(data) {
        const tbody = document.getElementById('insertStockBody');
        if (!tbody) return;
        const searchVal = (document.getElementById('insertStockSearchInput')?.value || '').trim().toLowerCase();

        let filtered = data;
        if (searchVal) {
            filtered = data.filter(d => d.spec.toLowerCase().includes(searchVal));
        }

        let grandTotalVariants = filtered.length;
        let grandTotalStock = 0;
        let grandTotalValue = 0;

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No insert variants found matching search.</td></tr>';
        } else {
            filtered.forEach(item => {
                grandTotalStock += item.current_stock;
                grandTotalValue += item.total_value;

                const tr = document.createElement('tr');
                const stockStyle = item.current_stock > 0 
                    ? 'color: #10b981; font-weight: 700; background: rgba(16, 185, 129, 0.08); padding: 4px 8px; border-radius: 4px; display: inline-block;' 
                    : 'color: #ef4444; font-weight: 600; background: rgba(239, 68, 68, 0.08); padding: 4px 8px; border-radius: 4px; display: inline-block;';

                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--text-main);">${item.spec}</td>
                    <td style="text-align: center;">${item.no_of_edges}</td>
                    <td style="text-align: center;">${item.total_received}</td>
                    <td style="text-align: center;">${item.total_issued}</td>
                    <td style="text-align: center;"><span style="${stockStyle}">${item.current_stock}</span></td>
                    <td style="text-align: right;">Rs. ${item.avg_rate.toFixed(2)}</td>
                    <td style="text-align: right; font-weight: 600;">Rs. ${item.total_value.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        const varEl = document.getElementById('insertStockTotalVariants');
        const qtyEl = document.getElementById('insertStockTotalQty');
        const valEl = document.getElementById('insertStockTotalValue');

        if (varEl) varEl.textContent = grandTotalVariants;
        if (qtyEl) qtyEl.textContent = grandTotalStock;
        if (valEl) valEl.textContent = `Rs. ${grandTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    document.getElementById('insertStockSearchInput')?.addEventListener('input', () => {
        renderInsertStockTable(allInsertStockCache);
    });

    document.getElementById('exportInsertStockBtn')?.addEventListener('click', () => {
        const table = document.getElementById('insertStockTable');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table, { sheet: "Insert_Stock" });
        XLSX.writeFile(wb, `Insert_Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // --- BC PRODUCTION REPORT ---
    function initBcProdReport() {
        const fromInput = document.getElementById('bcProdFromDate');
        const toInput = document.getElementById('bcProdToDate');
        const today = new Date().toISOString().split('T')[0];
        if (fromInput && !fromInput.value) fromInput.value = today;
        if (toInput && !toInput.value) toInput.value = today;
        fetchBcProdReport();
    }

    document.getElementById('bcProdFromDate')?.addEventListener('change', fetchBcProdReport);
    document.getElementById('bcProdToDate')?.addEventListener('change', fetchBcProdReport);

    document.getElementById('exportBcProdBtn')?.addEventListener('click', () => {
        exportBcProdExcel();
    });

    document.getElementById('printBcProdBtn')?.addEventListener('click', () => {
        printBcProdReport();
    });

    function parseLocalDateStr(dStr) {
        if (!dStr) return null;
        let s = dStr.toString().split('T')[0].split(' ')[0].trim();
        if (!s) return null;
        let parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
            let y, m, d;
            if (parts[0].length === 4) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                d = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) {
                let p1 = parseInt(parts[0], 10);
                let p2 = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
                d = p1; m = p2 - 1;
            } else {
                return null;
            }
            return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
        return s;
    }

    function isDateInRange(logDate, fromDate, toDate) {
        if (!logDate) return false;
        const formattedLog = parseLocalDateStr(logDate);
        if (!formattedLog) return false;

        if (fromDate && formattedLog < fromDate) return false;
        if (toDate && formattedLog > toDate) return false;
        return true;
    }

    function matchMachine(logMach, targetMach) {
        if (!logMach || !targetMach) return false;
        let a = logMach.toString().toLowerCase().replace(/[\s\-_0]+/g, '');
        let b = targetMach.toString().toLowerCase().replace(/[\s\-_0]+/g, '');
        if (a === b) return true;
        a = a.replace(/haas/g, 'hass');
        b = b.replace(/haas/g, 'hass');
        if (a === b) return true;
        a = a.replace(/cincinnati/g, 'cincinati');
        b = b.replace(/cincinnati/g, 'cincinati');
        if (a === b) return true;
        a = a.replace(/milwaukee/g, 'millwake');
        b = b.replace(/milwaukee/g, 'millwake');
        if (a === b) return true;
        return false;
    }

    async function fetchBcProdReport() {
        const fromInput = document.getElementById('bcProdFromDate');
        const toInput = document.getElementById('bcProdToDate');
        const today = new Date().toISOString().split('T')[0];
        const fromDate = fromInput && fromInput.value ? fromInput.value : today;
        const toDate = toInput && toInput.value ? toInput.value : today;

        try {
            const [prodRes, pcRes, pcReceiptRes] = await Promise.all([
                fetch('/api/prodlog'),
                fetch('/api/pc_logs'),
                fetch('/api/pc_receipt_logs')
            ]);

            const allProdLogs = prodRes.ok ? await prodRes.json() : [];
            const allPcLogs = pcRes.ok ? await pcRes.json() : [];
            const allPcReceiptLogs = pcReceiptRes.ok ? await pcReceiptRes.json() : [];

            // 1. Table 1: BC Machine Production (STRICTLY RESTRICTED TO 10 MACHINES)
            const machineList = [
                "AMS 1",
                "AMS 2",
                "AMS 3",
                "AMS 4",
                "HASS BC 1",
                "HASS BC 2",
                "HASS BC 3",
                "MILLWAKE",
                "CINCINATI",
                "WMW"
            ];

            const logsInPeriod = allProdLogs.filter(l => isDateInRange(l.date, fromDate, toDate));

            let bcMachineHtml = '';
            let grandTotalBcProd = 0;

            machineList.forEach(machName => {
                const machLogs = logsInPeriod.filter(l => matchMachine(l.machine, machName));

                if (machLogs.length > 0) {
                    // Group by partno + opn_no to get cumulative qty operation-wise
                    const grouped = {};
                    machLogs.forEach(l => {
                        const part = (l.partno || '').trim();
                        const opn = (l.opn_no || '').trim();
                        const key = `${part}___${opn}`;
                        if (!grouped[key]) {
                            grouped[key] = { partno: part, opn_no: opn, qty: 0 };
                        }
                        const pQty = (l.prod_qty || 0);
                        grouped[key].qty += pQty;
                        grandTotalBcProd += pQty;
                    });

                    const groupKeys = Object.keys(grouped);
                    groupKeys.forEach((k, idx) => {
                        const item = grouped[k];
                        const mCol = idx === 0 ? `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">${machName}</td>` : `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;"></td>`;
                        bcMachineHtml += `
                            <tr>
                                ${mCol}
                                <td style="border: 1px solid #000000; padding: 6px 10px;">${item.partno}</td>
                                <td style="border: 1px solid #000000; padding: 6px 10px;">${item.opn_no}</td>
                                <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 600;">${item.qty}</td>
                            </tr>
                        `;
                    });
                } else {
                    bcMachineHtml += `
                        <tr>
                            <td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">${machName}</td>
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                            <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right;"></td>
                        </tr>
                    `;
                }
            });

            // Summary Row for Table 1
            bcMachineHtml += `
                <tr style="background-color: #f1f5f9;">
                    <td colspan="3" style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700; text-align: right; color: var(--text-main);">Total BC Production Qty:</td>
                    <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${grandTotalBcProd}</td>
                </tr>
            `;

            const bcBody = document.getElementById('bcMachineBody');
            if (bcBody) bcBody.innerHTML = bcMachineHtml;

            // 2. Table 2: To PC
            const toPcLogsInPeriod = allPcLogs.filter(l => isDateInRange(l.date, fromDate, toDate));
            const toPcGrouped = {};
            let grandTotalToPc = 0;

            toPcLogsInPeriod.forEach(l => {
                const part = (l.partno || '').trim();
                if (part) {
                    const q = (l.qty || 0);
                    toPcGrouped[part] = (toPcGrouped[part] || 0) + q;
                    grandTotalToPc += q;
                }
            });

            let toPcHtml = '';
            const toPcParts = Object.keys(toPcGrouped).sort();
            if (toPcParts.length > 0) {
                toPcParts.forEach((part, idx) => {
                    const labelCol = idx === 0 ? `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">To PC</td>` : `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;"></td>`;
                    toPcHtml += `
                        <tr>
                            ${labelCol}
                            <td style="border: 1px solid #000000; padding: 6px 10px;">${part}</td>
                            <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 600;">${toPcGrouped[part]}</td>
                        </tr>
                    `;
                });
            } else {
                for (let i = 0; i < 4; i++) {
                    const labelCol = i === 0 ? `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">To PC</td>` : `<td style="border: 1px solid #000000; padding: 6px 10px;"></td>`;
                    toPcHtml += `
                        <tr>
                            ${labelCol}
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                        </tr>
                    `;
                }
            }

            // Summary Row for Table 2
            toPcHtml += `
                <tr style="background-color: #f1f5f9;">
                    <td colspan="2" style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700; text-align: right; color: var(--text-main);">Total Sent to PC Qty:</td>
                    <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${grandTotalToPc}</td>
                </tr>
            `;

            const toPcBody = document.getElementById('toPcBody');
            if (toPcBody) toPcBody.innerHTML = toPcHtml;

            // 3. Table 3: From PC
            const fromPcLogsInPeriod = allPcReceiptLogs.filter(l => isDateInRange(l.date, fromDate, toDate));
            const fromPcGrouped = {};
            let grandTotalFromPc = 0;

            fromPcLogsInPeriod.forEach(l => {
                const part = (l.partno || '').trim();
                if (part) {
                    const q = (l.qty || 0);
                    fromPcGrouped[part] = (fromPcGrouped[part] || 0) + q;
                    grandTotalFromPc += q;
                }
            });

            let fromPcHtml = '';
            const fromPcParts = Object.keys(fromPcGrouped).sort();
            if (fromPcParts.length > 0) {
                fromPcParts.forEach((part, idx) => {
                    const labelCol = idx === 0 ? `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">From PC</td>` : `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;"></td>`;
                    fromPcHtml += `
                        <tr>
                            ${labelCol}
                            <td style="border: 1px solid #000000; padding: 6px 10px;">${part}</td>
                            <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 600;">${fromPcGrouped[part]}</td>
                        </tr>
                    `;
                });
            } else {
                for (let i = 0; i < 4; i++) {
                    const labelCol = i === 0 ? `<td style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700;">From PC</td>` : `<td style="border: 1px solid #000000; padding: 6px 10px;"></td>`;
                    fromPcHtml += `
                        <tr>
                            ${labelCol}
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                            <td style="border: 1px solid #000000; padding: 6px 10px;"></td>
                        </tr>
                    `;
                }
            }

            // Summary Row for Table 3
            fromPcHtml += `
                <tr style="background-color: #f1f5f9;">
                    <td colspan="2" style="border: 1px solid #000000; padding: 6px 10px; font-weight: 700; text-align: right; color: var(--text-main);">Total Received from PC Qty:</td>
                    <td style="border: 1px solid #000000; padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">${grandTotalFromPc}</td>
                </tr>
            `;

            const fromPcBody = document.getElementById('fromPcBody');
            if (fromPcBody) fromPcBody.innerHTML = fromPcHtml;

        } catch (e) {
            console.error('Error fetching BC Prod report:', e);
        }
    }

    function exportBcProdExcel() {
        const fromDate = document.getElementById('bcProdFromDate')?.value || new Date().toISOString().split('T')[0];
        const toDate = document.getElementById('bcProdToDate')?.value || new Date().toISOString().split('T')[0];
        const dateStr = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;

        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded');
            return;
        }

        const wb = XLSX.utils.book_new();
        const wsData = [];
        wsData.push([`BC Production Report - Period: ${fromDate} to ${toDate}`]);
        wsData.push([]);

        // Table 1: BC Production
        wsData.push(["Machine", "Part no", "Opn no", "Qty"]);
        const bcRows = document.querySelectorAll('#bcMachineTable tbody tr');
        bcRows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            wsData.push([tds[0]?.innerText || '', tds[1]?.innerText || '', tds[2]?.innerText || '', tds[3]?.innerText || '']);
        });

        wsData.push([]);
        wsData.push([]);

        // Table 2: To PC
        wsData.push(["To PC", "Part no", "qty"]);
        const toPcRows = document.querySelectorAll('#toPcTable tbody tr');
        toPcRows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            wsData.push([tds[0]?.innerText || '', tds[1]?.innerText || '', tds[2]?.innerText || '']);
        });

        wsData.push([]);
        wsData.push([]);

        // Table 3: From PC
        wsData.push(["From PC", "Part no", "qty"]);
        const fromPcRows = document.querySelectorAll('#fromPcTable tbody tr');
        fromPcRows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            wsData.push([tds[0]?.innerText || '', tds[1]?.innerText || '', tds[2]?.innerText || '']);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "BC Prod");
        XLSX.writeFile(wb, `BC_Production_Report_${dateStr}.xlsx`);
    }

    function printBcProdReport() {
        const printContents = document.getElementById('bcProdPrintContainer')?.innerHTML;
        const fromDate = document.getElementById('bcProdFromDate')?.value || new Date().toISOString().split('T')[0];
        const toDate = document.getElementById('bcProdToDate')?.value || new Date().toISOString().split('T')[0];
        const dateStr = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

        if (!printContents) return;

        const printWindow = window.open('', '', 'height=700,width=900');
        printWindow.document.write('<html><head><title>BC Production Report - ' + dateStr + '</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: sans-serif; padding: 20px; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #000; padding: 6px 10px; font-size: 13px; }');
        printWindow.document.write('th { font-weight: bold; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write('<h2 style="margin-bottom: 15px;">BC Production Report - Period: ' + dateStr + '</h2>');
        printWindow.document.write(printContents);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 250);
    }

    // --- DB BACKUP LOGIC (ADMIN ONLY) ---
    document.getElementById('downloadJsonDbBackupBtn')?.addEventListener('click', async () => {
        if (!userObj || (userObj.role !== 'admin' && (userObj.username || '').toLowerCase() !== 'admin')) {
            alert('Access Denied: Only Admin users can download database backups.');
            return;
        }
        const btn = document.getElementById('downloadJsonDbBackupBtn');
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing JSON Backup...';

        try {
            const res = await fetch('/api/admin/export_db_backup');
            if (!res.ok) throw new Error('Failed to fetch DB backup data');
            const data = await res.json();

            const dateStr = new Date().toISOString().slice(0, 10);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `GRS_Factory_Database_Full_Backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Database JSON backup downloaded successfully to your local machine!');
        } catch (err) {
            console.error('Error downloading DB backup:', err);
            alert('Failed to download database backup: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    });

    document.getElementById('downloadExcelDbBackupBtn')?.addEventListener('click', async () => {
        if (!userObj || (userObj.role !== 'admin' && (userObj.username || '').toLowerCase() !== 'admin')) {
            alert('Access Denied: Only Admin users can download database backups.');
            return;
        }
        if (typeof XLSX === 'undefined') {
            alert('Excel generator library is loading. Please try again in a moment.');
            return;
        }
        const btn = document.getElementById('downloadExcelDbBackupBtn');
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Excel Backup...';

        try {
            const res = await fetch('/api/admin/export_db_backup');
            if (!res.ok) throw new Error('Failed to fetch DB backup data');
            const data = await res.json();
            const tables = data.tables || {};

            const wb = XLSX.utils.book_new();
            Object.keys(tables).forEach(tName => {
                const rows = tables[tName] || [];
                const ws = XLSX.utils.json_to_sheet(rows);
                const sheetName = tName.slice(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `GRS_Factory_Database_Excel_Backup_${dateStr}.xlsx`);
            alert('Multi-Sheet Excel Database backup downloaded successfully!');
        } catch (err) {
            console.error('Error exporting Excel DB backup:', err);
            alert('Failed to export Excel backup: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    });

    // --- ATTENDANCE VS LOGIN HOURS REPORT LOGIC ---
    let currentAttVsLoginData = null;

    async function fetchAttVsLoginReport() {
        const mInput = document.getElementById('attVsLoginMonth');
        const dSelect = document.getElementById('attVsLoginDeptSelect');
        const body = document.getElementById('attVsLoginBody');
        const hRow1 = document.getElementById('attVsLoginHeaderRow1');
        const hRow2 = document.getElementById('attVsLoginHeaderRow2');

        if (!mInput || !body || !hRow1 || !hRow2) return;

        let monthVal = mInput.value;
        if (!monthVal) {
            monthVal = new Date().toISOString().slice(0, 7);
            mInput.value = monthVal;
        }
        if (dSelect && dSelect.options.length <= 1) {
            try {
                const [deptRes, opRes] = await Promise.all([
                    fetch('/api/departments').catch(() => null),
                    fetch('/api/operators').catch(() => null)
                ]);
                const deptSet = new Set();
                if (deptRes && deptRes.ok) {
                    const depts = await deptRes.json();
                    depts.forEach(d => { if (d.name) deptSet.add(d.name.trim()); });
                }
                if (opRes && opRes.ok) {
                    const ops = await opRes.json();
                    ops.forEach(o => { if (o.department) deptSet.add(o.department.trim()); });
                }
                Array.from(deptSet).sort().forEach(dName => {
                    const opt = document.createElement('option');
                    opt.value = dName;
                    opt.textContent = dName;
                    dSelect.appendChild(opt);
                });
            } catch(e) {}
        }
        const deptVal = dSelect ? dSelect.value : '';

        body.innerHTML = `<tr><td colspan="100" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Fetching Attendance vs Login data...</td></tr>`;

        try {
            const res = await fetch(`/api/reports/att_vs_login?month_year=${encodeURIComponent(monthVal)}&dept=${encodeURIComponent(deptVal)}`);
            if (!res.ok) throw new Error('Failed to load Attendance vs Login report');
            const data = await res.json();
            currentAttVsLoginData = data;
            renderAttVsLoginTable();
        } catch (err) {
            console.error('Error fetching Att vs Login report:', err);
            body.innerHTML = `<tr><td colspan="100" style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${err.message}</td></tr>`;
        }
    }

    function renderAttVsLoginTable() {
        if (!currentAttVsLoginData) return;
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        const body = document.getElementById('attVsLoginBody');
        const hRow1 = document.getElementById('attVsLoginHeaderRow1');
        const hRow2 = document.getElementById('attVsLoginHeaderRow2');
        const searchInput = document.getElementById('attVsLoginSearch');

        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const daysInMonth = currentAttVsLoginData.days_in_month || 31;
        const allData = currentAttVsLoginData.data || [];

        const filtered = allData.filter(row => {
            if (!searchVal) return true;
            return (row.operators || '').toLowerCase().includes(searchVal) || (row.dept || '').toLowerCase().includes(searchVal);
        });

        // Build Header Row 1 (Top Level Days)
        let r1Html = `<th style="padding: 8px; border: 1px solid #cbd5e1; background: #e2e8f0; position: sticky; left: 0; z-index: 10;"></th><th style="padding: 8px; border: 1px solid #cbd5e1; background: #e2e8f0; position: sticky; left: 100px; z-index: 10;"></th>`;
        for (let d = 1; d <= daysInMonth; d++) {
            r1Html += `<th colspan="2" style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: bold; font-size: 0.9rem;">${d}</th>`;
        }
        r1Html += `<th colspan="3" style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #e2e8f0; font-weight: bold;">TOTAL SUMMARY</th>`;
        hRow1.innerHTML = r1Html;

        // Build Header Row 2 (Sub-columns)
        let r2Html = `<th style="padding: 8px; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: left; min-width: 100px; position: sticky; left: 0; z-index: 10;">dept</th><th style="padding: 8px; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: left; min-width: 140px; position: sticky; left: 100px; z-index: 10;">operators</th>`;
        for (let d = 1; d <= daysInMonth; d++) {
            r2Html += `<th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; min-width: 75px; background: #fff;">att hours</th><th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; min-width: 75px; background: #f0fdf4;">login hours</th>`;
        }
        r2Html += `<th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; min-width: 85px; background: #e0f2fe; font-weight: bold;">Total Att</th><th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; min-width: 85px; background: #dcfce7; font-weight: bold;">Total Login</th><th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right; min-width: 80px; background: #fef3c7; font-weight: bold;">Diff</th>`;
        hRow2.innerHTML = r2Html;

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="${daysInMonth * 2 + 5}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No operator attendance vs login records found for this selection.</td></tr>`;
            return;
        }

        let bodyHtml = '';
        filtered.forEach((row, idx) => {
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            bodyHtml += `<tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">`;
            bodyHtml += `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 500; position: sticky; left: 0; background: ${bg}; z-index: 5;">${escapeHtml(row.dept)}</td>`;
            bodyHtml += `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 600; position: sticky; left: 100px; background: ${bg}; z-index: 5;">${escapeHtml(row.operators)}</td>`;

            for (let d = 1; d <= daysInMonth; d++) {
                const dayObj = (row.days && row.days[String(d)]) || { att_hours: 0, login_hours: 0 };
                const attH = dayObj.att_hours || 0;
                const loginH = dayObj.login_hours || 0;

                const attDisp = attH > 0 ? attH.toFixed(1) : '-';
                const loginDisp = loginH > 0 ? loginH.toFixed(1) : '-';

                bodyHtml += `<td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; ${attH > 0 ? 'color: #0369a1; font-weight: 500;' : 'color: #94a3b8;'}">${attDisp}</td>`;
                bodyHtml += `<td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; ${loginH > 0 ? 'color: #15803d; font-weight: 600;' : 'color: #94a3b8;'}">${loginDisp}</td>`;
            }

            const diffColor = row.diff > 0 ? '#b45309' : (row.diff < 0 ? '#dc2626' : '#16a34a');

            bodyHtml += `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0369a1; background: #f0f9ff;">${row.total_att.toFixed(1)}</td>`;
            bodyHtml += `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #15803d; background: #f0fdf4;">${row.total_login.toFixed(1)}</td>`;
            bodyHtml += `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: ${diffColor}; background: #fffbeb;">${row.diff.toFixed(1)}</td>`;
            bodyHtml += `</tr>`;
        });

        body.innerHTML = bodyHtml;
    }

    // Attach Event Listeners
    document.getElementById('generateAttVsLoginBtn')?.addEventListener('click', fetchAttVsLoginReport);
    document.getElementById('attVsLoginMonth')?.addEventListener('change', fetchAttVsLoginReport);
    document.getElementById('attVsLoginDeptSelect')?.addEventListener('change', fetchAttVsLoginReport);
    document.getElementById('attVsLoginSearch')?.addEventListener('input', renderAttVsLoginTable);

    // Export to Excel
    document.getElementById('exportAttVsLoginBtn')?.addEventListener('click', () => {
        if (!currentAttVsLoginData || !currentAttVsLoginData.data || currentAttVsLoginData.data.length === 0) {
            alert('No data available to export');
            return;
        }
        if (typeof XLSX === 'undefined') {
            alert('Excel library loading. Please try again.');
            return;
        }

        const daysInMonth = currentAttVsLoginData.days_in_month || 31;
        const monthVal = currentAttVsLoginData.month_year || 'report';

        const row1 = ['', ''];
        for (let d = 1; d <= daysInMonth; d++) {
            row1.push(d, '');
        }
        row1.push('TOTAL SUMMARY', '', '');

        const row2 = ['dept', 'operators'];
        for (let d = 1; d <= daysInMonth; d++) {
            row2.push('att hours', 'login hours');
        }
        row2.push('Total Att', 'Total Login', 'Diff');

        const exportRows = [row1, row2];

        currentAttVsLoginData.data.forEach(row => {
            const r = [row.dept, row.operators];
            for (let d = 1; d <= daysInMonth; d++) {
                const dayObj = (row.days && row.days[String(d)]) || { att_hours: 0, login_hours: 0 };
                r.push(dayObj.att_hours || 0, dayObj.login_hours || 0);
            }
            r.push(row.total_att, row.total_login, row.diff);
            exportRows.push(r);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, "Att_vs_Login");
        XLSX.writeFile(wb, `Attendance_vs_Login_Report_${monthVal}.xlsx`);
    });

    // --- RFQ (Request For Quotation) LOGIC ---
    let globalRfqs = [];
    let globalCustomers = [];

    async function fetchCustomers() {
        try {
            const res = await fetch('/api/customers');
            if (res.ok) {
                globalCustomers = await res.json();
                populateCustomerDropdowns();
            }
        } catch (e) {
            console.error('Error fetching customers:', e);
        }
    }

    function populateCustomerDropdowns() {
        const filterSelect = document.getElementById('rfqFilterCustomer');
        const formSelect = document.getElementById('rfqFormCustomerSelect');
        
        if (filterSelect) {
            const cur = filterSelect.value;
            filterSelect.innerHTML = '<option value="">-- All Customers --</option>';
            globalCustomers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                filterSelect.appendChild(opt);
            });
            filterSelect.value = cur;
        }

        if (formSelect) {
            const cur = formSelect.value;
            formSelect.innerHTML = `
                <option value="">-- Select Customer --</option>
                <option value="__NEW_CUSTOMER__">+ Enter New Customer...</option>
            `;
            globalCustomers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                formSelect.appendChild(opt);
            });
            formSelect.value = cur;
        }
    }

    async function fetchRfqs() {
        const fromDate = document.getElementById('rfqFilterFromDate')?.value || '';
        const toDate = document.getElementById('rfqFilterToDate')?.value || '';
        const customer = document.getElementById('rfqFilterCustomer')?.value || '';
        const search = document.getElementById('rfqSearchInput')?.value || '';

        let url = `/api/rfq?`;
        if (fromDate) url += `date_from=${encodeURIComponent(fromDate)}&`;
        if (toDate) url += `date_to=${encodeURIComponent(toDate)}&`;
        if (customer) url += `customer=${encodeURIComponent(customer)}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                globalRfqs = await res.json();
                renderRfqTable(globalRfqs);
            }
        } catch (e) {
            console.error('Error fetching RFQs:', e);
        }
    }

    function renderRfqTable(data) {
        const tbody = document.getElementById('rfqTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No RFQ records found.</td></tr>`;
            return;
        }

        data.forEach((rfq, index) => {
            const tr = document.createElement('tr');
            
            let itemsHtml = '';
            if (rfq.items && rfq.items.length > 0) {
                itemsHtml = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem; background:rgba(0,0,0,0.01); border-radius:4px;">
                    <thead><tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
                        <th style="padding:4px 8px; text-align:left;">Part No</th>
                        <th style="padding:4px 8px; text-align:left;">Description</th>
                    </tr></thead><tbody>`;
                rfq.items.forEach(it => {
                    itemsHtml += `<tr style="border-bottom:1px dashed rgba(0,0,0,0.05);">
                        <td style="padding:4px 8px; font-weight:600; color:var(--primary-color);">${escapeHtml(it.partno)}</td>
                        <td style="padding:4px 8px; color:var(--text-main);">${escapeHtml(it.description || '-')}</td>
                    </tr>`;
                });
                itemsHtml += `</tbody></table>`;
            } else {
                itemsHtml = `<span style="color:var(--text-muted); font-style:italic;">No items</span>`;
            }

            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                <td>${escapeHtml(rfq.date)}</td>
                <td style="font-weight: 600;">${escapeHtml(rfq.rfqno)}</td>
                <td>${escapeHtml(rfq.unit || '-')}</td>
                <td style="font-weight: 500;">${escapeHtml(rfq.customer)}</td>
                <td>${itemsHtml}</td>
                <td style="text-align: center; font-weight: bold;">${rfq.items ? rfq.items.length : 0}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button class="btn btn-outline btn-sm edit-rfq-btn" data-id="${rfq.id}" title="Edit RFQ" style="padding: 3px 8px; font-size: 0.8rem;">✏️ Edit</button>
                        <button class="btn btn-outline btn-sm delete-rfq-btn delete-btn" data-id="${rfq.id}" title="Delete RFQ" style="padding: 3px 8px; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-rfq-btn').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const rfq = globalRfqs.find(r => r.id === id);
                if (rfq) openRfqModal(rfq);
            };
        });

        tbody.querySelectorAll('.delete-rfq-btn').forEach(btn => {
            btn.onclick = async () => {
                if (typeof checkAdminAccess === 'function' && !checkAdminAccess()) return;
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this RFQ record?')) {
                    try {
                        const res = await fetch(`/api/rfq/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            fetchRfqs();
                        } else {
                            alert('Failed to delete RFQ.');
                        }
                    } catch (e) {
                        alert('Error deleting RFQ: ' + e.message);
                    }
                }
            };
        });
    }

    function addRfqItemRow(partno = '', description = '') {
        const tbody = document.getElementById('rfqItemsFormBody');
        if (!tbody) return;

        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 6px; text-align: center; font-weight: bold; color: var(--text-muted);">${rowCount}</td>
            <td style="padding: 6px;">
                <input type="text" class="form-control rfq-item-partno" value="${escapeHtml(partno)}" placeholder="Enter Part No" required style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="text" class="form-control rfq-item-desc" value="${escapeHtml(description)}" placeholder="Enter Description / Specs" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" class="btn btn-outline btn-sm remove-rfq-item-btn" style="padding: 2px 6px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;">✕</button>
            </td>
        `;

        tr.querySelector('.remove-rfq-item-btn').onclick = () => {
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, idx) => {
                row.cells[0].textContent = idx + 1;
            });
        };

        tbody.appendChild(tr);
    }

    function openRfqModal(rfq = null) {
        const modal = document.getElementById('rfqModal');
        const modalTitle = document.getElementById('rfqModalTitle');
        const rfqIdInput = document.getElementById('rfqId');
        const dateInput = document.getElementById('rfqFormDate');
        const noInput = document.getElementById('rfqFormNo');
        const unitInput = document.getElementById('rfqFormUnit');
        const customerSelect = document.getElementById('rfqFormCustomerSelect');
        const newCustInput = document.getElementById('rfqFormNewCustomerInput');
        const itemsBody = document.getElementById('rfqItemsFormBody');

        if (!modal) return;

        if (itemsBody) itemsBody.innerHTML = '';
        if (newCustInput) {
            newCustInput.style.display = 'none';
            newCustInput.value = '';
        }

        if (rfq) {
            if (modalTitle) modalTitle.textContent = 'Edit Request For Quotation (RFQ)';
            if (rfqIdInput) rfqIdInput.value = rfq.id;
            if (dateInput) dateInput.value = rfq.date || new Date().toISOString().slice(0, 10);
            if (noInput) noInput.value = rfq.rfqno || '';
            if (unitInput) unitInput.value = rfq.unit || '';
            
            let found = false;
            if (customerSelect) {
                Array.from(customerSelect.options).forEach(opt => {
                    if (opt.value === rfq.customer) found = true;
                });
                if (found) {
                    customerSelect.value = rfq.customer;
                } else {
                    customerSelect.value = '__NEW_CUSTOMER__';
                    if (newCustInput) {
                        newCustInput.style.display = 'block';
                        newCustInput.value = rfq.customer || '';
                    }
                }
            }

            if (rfq.items && rfq.items.length > 0) {
                rfq.items.forEach(it => addRfqItemRow(it.partno, it.description));
            } else {
                addRfqItemRow();
            }
        } else {
            if (modalTitle) modalTitle.textContent = 'Create Request For Quotation (RFQ)';
            if (rfqIdInput) rfqIdInput.value = '';
            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
            if (noInput) noInput.value = '';
            if (unitInput) unitInput.value = '';
            if (customerSelect) customerSelect.value = '';
            addRfqItemRow();
        }

        modal.style.display = 'flex';
        modal.classList.add('show');
    }

    function closeRfqModal() {
        const modal = document.getElementById('rfqModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }

    window.openRfqModal = openRfqModal;
    window.closeRfqModal = closeRfqModal;

    function initRfqSection() {
        fetchCustomers();
        fetchRfqs();

        const addRfqBtn = document.getElementById('addRfqBtn');
        const closeBtn = document.getElementById('closeRfqModalBtn');
        const cancelBtn = document.getElementById('cancelRfqBtn');
        const form = document.getElementById('rfqForm');
        const customerSelect = document.getElementById('rfqFormCustomerSelect');
        const newCustInput = document.getElementById('rfqFormNewCustomerInput');
        const addRowBtn = document.getElementById('addRfqItemRowBtn');
        const filterApplyBtn = document.getElementById('rfqFilterApplyBtn');
        const filterResetBtn = document.getElementById('rfqFilterResetBtn');
        const exportExcelBtn = document.getElementById('exportRfqExcelBtn');

        if (addRfqBtn) addRfqBtn.onclick = () => openRfqModal();
        if (closeBtn) closeBtn.onclick = closeRfqModal;
        if (cancelBtn) cancelBtn.onclick = closeRfqModal;
        if (addRowBtn) addRowBtn.onclick = () => addRfqItemRow();

        if (customerSelect) {
            customerSelect.onchange = () => {
                if (customerSelect.value === '__NEW_CUSTOMER__') {
                    newCustInput.style.display = 'block';
                    newCustInput.focus();
                } else {
                    newCustInput.style.display = 'none';
                }
            };
        }

        if (filterApplyBtn) filterApplyBtn.onclick = () => fetchRfqs();
        if (filterResetBtn) {
            filterResetBtn.onclick = () => {
                if (document.getElementById('rfqFilterFromDate')) document.getElementById('rfqFilterFromDate').value = '';
                if (document.getElementById('rfqFilterToDate')) document.getElementById('rfqFilterToDate').value = '';
                if (document.getElementById('rfqFilterCustomer')) document.getElementById('rfqFilterCustomer').value = '';
                if (document.getElementById('rfqSearchInput')) document.getElementById('rfqSearchInput').value = '';
                fetchRfqs();
            };
        }

        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => {
                if (!globalRfqs || globalRfqs.length === 0) {
                    alert('No RFQ records to export.');
                    return;
                }
                const exportData = [];
                globalRfqs.forEach(rfq => {
                    if (rfq.items && rfq.items.length > 0) {
                        rfq.items.forEach(it => {
                            exportData.push({
                                "RFQ Date": rfq.date,
                                "RFQ No": rfq.rfqno,
                                "Unit": rfq.unit || '',
                                "Customer": rfq.customer,
                                "Part No": it.partno,
                                "Description": it.description || ''
                            });
                        });
                    } else {
                        exportData.push({
                            "RFQ Date": rfq.date,
                            "RFQ No": rfq.rfqno,
                            "Unit": rfq.unit || '',
                            "Customer": rfq.customer,
                            "Part No": '',
                            "Description": ''
                        });
                    }
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "RFQ_Report");
                XLSX.writeFile(wb, `RFQ_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const id = document.getElementById('rfqId').value;
                const date = document.getElementById('rfqFormDate').value;
                const rfqno = document.getElementById('rfqFormNo').value;
                const unit = document.getElementById('rfqFormUnit').value;
                const custSelectVal = customerSelect.value;
                let customer = custSelectVal;
                if (custSelectVal === '__NEW_CUSTOMER__') {
                    customer = newCustInput.value.trim();
                }

                if (!customer) {
                    alert('Please select or enter a Customer name.');
                    return;
                }

                const itemRows = document.querySelectorAll('#rfqItemsFormBody tr');
                const items = [];
                itemRows.forEach(row => {
                    const partno = row.querySelector('.rfq-item-partno')?.value.trim() || '';
                    const description = row.querySelector('.rfq-item-desc')?.value.trim() || '';
                    if (partno) {
                        items.push({ partno, description });
                    }
                });

                if (items.length === 0) {
                    alert('Please add at least one Part No item.');
                    return;
                }

                const payload = {
                    date,
                    rfqno,
                    unit,
                    customer,
                    items
                };

                const url = id ? `/api/rfq/${id}` : '/api/rfq';
                const method = id ? 'PUT' : 'POST';

                try {
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        closeRfqModal();
                        fetchCustomers();
                        fetchRfqs();
                    } else {
                        const err = await res.json();
                        alert('Error: ' + (err.detail || 'Failed to save RFQ'));
                    }
                } catch (err) {
                    alert('Error saving RFQ: ' + err.message);
                }
            };
        }
    }

    // --- QUOTATION MASTER LOGIC ---
    let globalQuotes = [];

    async function fetchQuotes() {
        const fromDate = document.getElementById('quoteFilterFromDate')?.value || '';
        const toDate = document.getElementById('quoteFilterToDate')?.value || '';
        const customer = document.getElementById('quoteFilterCustomer')?.value || '';
        const search = document.getElementById('quoteSearchInput')?.value || '';

        let url = `/api/quotes?`;
        if (fromDate) url += `date_from=${encodeURIComponent(fromDate)}&`;
        if (toDate) url += `date_to=${encodeURIComponent(toDate)}&`;
        if (customer) url += `customer=${encodeURIComponent(customer)}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                globalQuotes = await res.json();
                populateQuoteCustomerDropdown();
                renderQuoteTable(globalQuotes);
            }
        } catch (e) {
            console.error('Error fetching Quotes:', e);
        }
    }

    function populateQuoteCustomerDropdown() {
        const filterSelect = document.getElementById('quoteFilterCustomer');
        if (!filterSelect) return;

        const cur = filterSelect.value;
        const custSet = new Set();
        (globalQuotes || []).forEach(q => {
            if (q.customer && q.customer.trim()) custSet.add(q.customer.trim());
        });
        (globalCustomers || []).forEach(c => {
            if (c && c.trim()) custSet.add(c.trim());
        });

        const sorted = Array.from(custSet).sort((a, b) => a.localeCompare(b));
        let html = '<option value="">-- All Customers --</option>';
        sorted.forEach(c => {
            html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
        filterSelect.innerHTML = html;
        filterSelect.value = cur;
    }

    function renderQuoteTable(data) {
        const tbody = document.getElementById('quoteTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 20px;">No Quotation records found.</td></tr>`;
            return;
        }

        data.forEach((q, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                <td>${escapeHtml(q.date)}</td>
                <td style="font-weight: 600; color: var(--primary-color);">${escapeHtml(q.quote_no)}</td>
                <td style="color: var(--text-muted);">${escapeHtml(q.rfq_no || '-')}</td>
                <td style="font-weight: 500;">${escapeHtml(q.customer)}</td>
                <td style="font-weight: 600;">${escapeHtml(q.part_no)}</td>
                <td>${escapeHtml(q.part_description || '-')}</td>
                <td style="text-align: right; font-weight: 700; color: #0284c7;">₹${(q.final_unit_price || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right; font-weight: 600; color: #10b981; white-space: nowrap;">
                    <span>₹${(q.total_dev_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background-color: #10b981; color: #ffffff; border-radius: 4px; font-size: 11px; margin-left: 6px; vertical-align: middle; box-shadow: 0 1px 2px rgba(0,0,0,0.15);" title="Quote Submitted">
                        <i class="fas fa-check"></i>
                    </span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button class="btn btn-outline btn-sm edit-quote-btn" data-id="${q.id}" title="Edit Quote" style="padding: 3px 8px; font-size: 0.8rem;">✏️ Edit</button>
                        <button class="btn btn-outline btn-sm delete-quote-btn delete-btn" data-id="${q.id}" title="Delete Quote" style="padding: 3px 8px; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit-quote-btn').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const quote = globalQuotes.find(q => q.id === id);
                if (quote) openQuoteModal(quote);
            };
        });

        tbody.querySelectorAll('.delete-quote-btn').forEach(btn => {
            btn.onclick = async () => {
                if (typeof checkAdminAccess === 'function' && !checkAdminAccess()) return;
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this Quotation record?')) {
                    try {
                        const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            fetchQuotes();
                        } else {
                            alert('Failed to delete Quote.');
                        }
                    } catch (e) {
                        alert('Error deleting Quote: ' + e.message);
                    }
                }
            };
        });
    }

    function addQuoteOpnRow(opnName = '', machine = '', cycleTime = 0, hourlyRate = 0) {
        const tbody = document.getElementById('quoteOpnsFormBody');
        if (!tbody) return;
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        const costPerPc = (parseFloat(cycleTime || 0) / 60) * parseFloat(hourlyRate || 0);

        tr.innerHTML = `
            <td style="padding: 6px; text-align: center; font-weight: bold; color: var(--text-muted);">${rowCount}</td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-opn-name" value="${escapeHtml(opnName)}" placeholder="e.g. Turning Opn 10" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-opn-machine" value="${escapeHtml(machine)}" placeholder="e.g. CNC Lathe" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="number" step="0.01" class="form-control quote-opn-cycletime" value="${cycleTime}" placeholder="Min" style="width: 100%; padding: 4px 8px; text-align: right; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="number" step="1" class="form-control quote-opn-hourlyrate" value="${hourlyRate}" placeholder="₹/hr" style="width: 100%; padding: 4px 8px; text-align: right; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px; text-align: right; font-weight: 600; color: var(--primary-color);" class="quote-opn-cost">
                ₹${costPerPc.toFixed(2)}
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" class="btn btn-outline btn-sm remove-quote-row-btn" style="padding: 2px 6px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;">✕</button>
            </td>
        `;

        tr.querySelectorAll('.quote-opn-cycletime, .quote-opn-hourlyrate').forEach(inp => {
            inp.oninput = () => {
                const ct = parseFloat(tr.querySelector('.quote-opn-cycletime').value) || 0;
                const hr = parseFloat(tr.querySelector('.quote-opn-hourlyrate').value) || 0;
                const c = (ct / 60) * hr;
                tr.querySelector('.quote-opn-cost').textContent = `₹${c.toFixed(2)}`;
                calculateQuoteTotals();
            };
        });

        tr.querySelector('.remove-quote-row-btn').onclick = () => {
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, idx) => row.cells[0].textContent = idx + 1);
            calculateQuoteTotals();
        };

        tbody.appendChild(tr);
        calculateQuoteTotals();
    }

    function addQuoteProcRow(procName = '', vendorNotes = '', costPerPc = 0) {
        const tbody = document.getElementById('quoteProcsFormBody');
        if (!tbody) return;
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        tr.innerHTML = `
            <td style="padding: 6px; text-align: center; font-weight: bold; color: var(--text-muted);">${rowCount}</td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-proc-name" value="${escapeHtml(procName)}" placeholder="e.g. Heat Treatment / Zinc Plating" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-proc-vendor" value="${escapeHtml(vendorNotes)}" placeholder="Vendor or specs" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="number" step="0.01" class="form-control quote-proc-cost" value="${costPerPc}" placeholder="₹/pc" style="width: 100%; padding: 4px 8px; text-align: right; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" class="btn btn-outline btn-sm remove-quote-row-btn" style="padding: 2px 6px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;">✕</button>
            </td>
        `;

        tr.querySelector('.quote-proc-cost').oninput = calculateQuoteTotals;
        tr.querySelector('.remove-quote-row-btn').onclick = () => {
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, idx) => row.cells[0].textContent = idx + 1);
            calculateQuoteTotals();
        };

        tbody.appendChild(tr);
        calculateQuoteTotals();
    }

    function addQuotePackRow(desc = '', costPerPc = 0) {
        const tbody = document.getElementById('quotePacksFormBody');
        if (!tbody) return;
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        tr.innerHTML = `
            <td style="padding: 6px; text-align: center; font-weight: bold; color: var(--text-muted);">${rowCount}</td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-pack-desc" value="${escapeHtml(desc)}" placeholder="e.g. Corrugated Box & VCI Bag" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="number" step="0.01" class="form-control quote-pack-cost" value="${costPerPc}" placeholder="₹/pc" style="width: 100%; padding: 4px 8px; text-align: right; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" class="btn btn-outline btn-sm remove-quote-row-btn" style="padding: 2px 6px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;">✕</button>
            </td>
        `;

        tr.querySelector('.quote-pack-cost').oninput = calculateQuoteTotals;
        tr.querySelector('.remove-quote-row-btn').onclick = () => {
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, idx) => row.cells[0].textContent = idx + 1);
            calculateQuoteTotals();
        };

        tbody.appendChild(tr);
        calculateQuoteTotals();
    }

    function addQuoteDevRow(desc = '', totalCost = 0) {
        const tbody = document.getElementById('quoteDevsFormBody');
        if (!tbody) return;
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        tr.innerHTML = `
            <td style="padding: 6px; text-align: center; font-weight: bold; color: var(--text-muted);">${rowCount}</td>
            <td style="padding: 6px;">
                <input type="text" class="form-control quote-dev-desc" value="${escapeHtml(desc)}" placeholder="e.g. Milling Fixture / Gauges / Tooling" style="width: 100%; padding: 4px 8px; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px;">
                <input type="number" step="1" class="form-control quote-dev-cost" value="${totalCost}" placeholder="Total ₹" style="width: 100%; padding: 4px 8px; text-align: right; font-size: 0.88rem;">
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" class="btn btn-outline btn-sm remove-quote-row-btn" style="padding: 2px 6px; color: #ef4444; border-color: #ef4444; font-size: 0.8rem;">✕</button>
            </td>
        `;

        tr.querySelector('.quote-dev-cost').oninput = calculateQuoteTotals;
        tr.querySelector('.remove-quote-row-btn').onclick = () => {
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, idx) => row.cells[0].textContent = idx + 1);
            calculateQuoteTotals();
        };

        tbody.appendChild(tr);
        calculateQuoteTotals();
    }

    function calculateQuoteTotals() {
        let totalMachining = 0;
        document.querySelectorAll('#quoteOpnsFormBody tr').forEach(tr => {
            const ct = parseFloat(tr.querySelector('.quote-opn-cycletime')?.value) || 0;
            const hr = parseFloat(tr.querySelector('.quote-opn-hourlyrate')?.value) || 0;
            totalMachining += (ct / 60) * hr;
        });

        let totalProc = 0;
        document.querySelectorAll('#quoteProcsFormBody tr').forEach(tr => {
            totalProc += parseFloat(tr.querySelector('.quote-proc-cost')?.value) || 0;
        });

        let totalPack = 0;
        document.querySelectorAll('#quotePacksFormBody tr').forEach(tr => {
            totalPack += parseFloat(tr.querySelector('.quote-pack-cost')?.value) || 0;
        });

        let totalDev = 0;
        document.querySelectorAll('#quoteDevsFormBody tr').forEach(tr => {
            totalDev += parseFloat(tr.querySelector('.quote-dev-cost')?.value) || 0;
        });

        const baseCost = totalMachining + totalProc + totalPack;

        const totalMachiningCell = document.getElementById('quoteTotalMachiningCostCell');
        const totalProcCell = document.getElementById('quoteTotalProcCostCell');
        const totalPackCell = document.getElementById('quoteTotalPackCostCell');
        const totalDevCell = document.getElementById('quoteTotalDevCostCell');
        const baseCostDisplay = document.getElementById('quoteBaseCostDisplay');
        const overheadInp = document.getElementById('quoteOverheadPct');
        const finalUnitPriceInp = document.getElementById('quoteFinalUnitPrice');

        if (totalMachiningCell) totalMachiningCell.textContent = `₹${totalMachining.toFixed(2)}`;
        if (totalProcCell) totalProcCell.textContent = `₹${totalProc.toFixed(2)}`;
        if (totalPackCell) totalPackCell.textContent = `₹${totalPack.toFixed(2)}`;
        if (totalDevCell) totalDevCell.textContent = `₹${totalDev.toFixed(2)}`;
        if (baseCostDisplay) baseCostDisplay.textContent = `₹${baseCost.toFixed(2)}`;

        const overheadPct = parseFloat(overheadInp?.value) || 0;
        const calculatedPrice = baseCost * (1 + overheadPct / 100);

        if (finalUnitPriceInp && !finalUnitPriceInp.dataset.userModified) {
            finalUnitPriceInp.value = calculatedPrice.toFixed(2);
        }
    }

    function populateRfqDatalist() {
        const datalist = document.getElementById('quoteRfqNoDatalist');
        if (!datalist) return;
        datalist.innerHTML = '';
        (globalRfqs || []).forEach(rfq => {
            const opt = document.createElement('option');
            opt.value = rfq.rfqno;
            opt.textContent = `${rfq.rfqno} (${rfq.customer})`;
            datalist.appendChild(opt);
        });
    }

    function openQuoteModal(quote = null) {
        const modal = document.getElementById('quoteModal');
        const modalTitle = document.getElementById('quoteModalTitle');
        const idInput = document.getElementById('quoteId');
        const dateInput = document.getElementById('quoteFormDate');
        const noInput = document.getElementById('quoteFormNo');
        const rfqNoInput = document.getElementById('quoteFormRfqNo');
        const custInput = document.getElementById('quoteFormCustomer');
        const unitInput = document.getElementById('quoteFormUnit');
        const partNoInput = document.getElementById('quoteFormPartNo');
        const partDescInput = document.getElementById('quoteFormPartDesc');
        const overheadInp = document.getElementById('quoteOverheadPct');
        const finalPriceInp = document.getElementById('quoteFinalUnitPrice');

        const opnsBody = document.getElementById('quoteOpnsFormBody');
        const procsBody = document.getElementById('quoteProcsFormBody');
        const packsBody = document.getElementById('quotePacksFormBody');
        const devsBody = document.getElementById('quoteDevsFormBody');

        if (!modal) return;

        populateRfqDatalist();

        if (opnsBody) opnsBody.innerHTML = '';
        if (procsBody) procsBody.innerHTML = '';
        if (packsBody) packsBody.innerHTML = '';
        if (devsBody) devsBody.innerHTML = '';

        if (finalPriceInp) delete finalPriceInp.dataset.userModified;

        if (quote) {
            if (modalTitle) modalTitle.textContent = `Edit Quotation (${quote.quote_no})`;
            if (idInput) idInput.value = quote.id;
            if (dateInput) dateInput.value = quote.date || new Date().toISOString().slice(0, 10);
            if (noInput) noInput.value = quote.quote_no || '';
            if (rfqNoInput) rfqNoInput.value = quote.rfq_no || '';
            if (custInput) custInput.value = quote.customer || '';
            if (unitInput) unitInput.value = quote.unit || '';
            if (partNoInput) partNoInput.value = quote.part_no || '';
            if (partDescInput) partDescInput.value = quote.part_description || '';
            if (overheadInp) overheadInp.value = quote.overhead_profit_pct !== undefined ? quote.overhead_profit_pct : 15;
            if (finalPriceInp) {
                finalPriceInp.value = (quote.final_unit_price || 0).toFixed(2);
                finalPriceInp.dataset.userModified = 'true';
            }

            try {
                const opns = typeof quote.machining_details === 'string' ? JSON.parse(quote.machining_details) : (quote.machining_details || []);
                opns.forEach(o => addQuoteOpnRow(o.opn_name, o.machine, o.cycle_time, o.hourly_rate));
            } catch (e) {}

            try {
                const procs = typeof quote.other_process_details === 'string' ? JSON.parse(quote.other_process_details) : (quote.other_process_details || []);
                procs.forEach(p => addQuoteProcRow(p.proc_name, p.vendor_notes, p.cost_per_pc));
            } catch (e) {}

            try {
                const packs = typeof quote.packing_details === 'string' ? JSON.parse(quote.packing_details) : (quote.packing_details || []);
                packs.forEach(p => addQuotePackRow(p.desc, p.cost_per_pc));
            } catch (e) {}

            try {
                const devs = typeof quote.dev_cost_details === 'string' ? JSON.parse(quote.dev_cost_details) : (quote.dev_cost_details || []);
                devs.forEach(d => addQuoteDevRow(d.desc, d.total_cost));
            } catch (e) {}
        } else {
            if (modalTitle) modalTitle.textContent = 'Create Quotation';
            if (idInput) idInput.value = '';
            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
            const numQuotes = (Array.isArray(globalQuotes) ? globalQuotes.length : 0);
            if (noInput) noInput.value = `QTN/${new Date().getFullYear()}/${String(numQuotes + 1).padStart(3, '0')}`;
            if (rfqNoInput) rfqNoInput.value = '';
            if (custInput) custInput.value = '';
            if (unitInput) unitInput.value = '';
            if (partNoInput) partNoInput.value = '';
            if (partDescInput) partDescInput.value = '';
            if (overheadInp) overheadInp.value = 15;
            if (finalPriceInp) finalPriceInp.value = '0.00';

            addQuoteOpnRow();
            addQuoteProcRow();
            addQuotePackRow();
            addQuoteDevRow();
        }

        calculateQuoteTotals();

        modal.style.display = 'flex';
        modal.classList.add('show');
    }

    function closeQuoteModal() {
        const modal = document.getElementById('quoteModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }

    window.openQuoteModal = openQuoteModal;
    window.closeQuoteModal = closeQuoteModal;

    function initQuoteSection() {
        if (typeof globalRfqs !== 'undefined' && globalRfqs.length === 0 && typeof fetchRfqs === 'function') fetchRfqs();
        fetchQuotes();

        const addQuoteBtn = document.getElementById('addQuoteBtn');
        const closeBtn = document.getElementById('closeQuoteModalBtn');
        const cancelBtn = document.getElementById('cancelQuoteBtn');
        const form = document.getElementById('quoteForm');
        const rfqNoInput = document.getElementById('quoteFormRfqNo');

        const addOpnBtn = document.getElementById('addQuoteOpnRowBtn');
        const addProcBtn = document.getElementById('addQuoteProcRowBtn');
        const addPackBtn = document.getElementById('addQuotePackRowBtn');
        const addDevBtn = document.getElementById('addQuoteDevRowBtn');

        const filterApplyBtn = document.getElementById('quoteFilterApplyBtn');
        const filterResetBtn = document.getElementById('quoteFilterResetBtn');
        const exportExcelBtn = document.getElementById('exportQuoteExcelBtn');
        const overheadInp = document.getElementById('quoteOverheadPct');
        const finalPriceInp = document.getElementById('quoteFinalUnitPrice');

        if (addQuoteBtn) addQuoteBtn.onclick = () => openQuoteModal();
        if (closeBtn) closeBtn.onclick = closeQuoteModal;
        if (cancelBtn) cancelBtn.onclick = closeQuoteModal;

        if (addOpnBtn) addOpnBtn.onclick = () => addQuoteOpnRow();
        if (addProcBtn) addProcBtn.onclick = () => addQuoteProcRow();
        if (addPackBtn) addPackBtn.onclick = () => addQuotePackRow();
        if (addDevBtn) addDevBtn.onclick = () => addQuoteDevRow();

        if (overheadInp) {
            overheadInp.oninput = () => {
                if (finalPriceInp) delete finalPriceInp.dataset.userModified;
                calculateQuoteTotals();
            };
        }

        if (finalPriceInp) {
            finalPriceInp.oninput = () => {
                finalPriceInp.dataset.userModified = 'true';
            };
        }

        if (rfqNoInput) {
            rfqNoInput.onchange = () => {
                const val = rfqNoInput.value.trim();
                const matched = (typeof globalRfqs !== 'undefined' ? globalRfqs : []).find(r => r.rfqno === val);
                if (matched) {
                    if (matched.customer) document.getElementById('quoteFormCustomer').value = matched.customer;
                    if (matched.unit) document.getElementById('quoteFormUnit').value = matched.unit;
                    if (matched.items && matched.items.length > 0) {
                        document.getElementById('quoteFormPartNo').value = matched.items[0].partno || '';
                        document.getElementById('quoteFormPartDesc').value = matched.items[0].description || '';
                    }
                }
            };
        }

        if (filterApplyBtn) filterApplyBtn.onclick = () => fetchQuotes();
        if (filterResetBtn) {
            filterResetBtn.onclick = () => {
                if (document.getElementById('quoteFilterFromDate')) document.getElementById('quoteFilterFromDate').value = '';
                if (document.getElementById('quoteFilterToDate')) document.getElementById('quoteFilterToDate').value = '';
                if (document.getElementById('quoteFilterCustomer')) document.getElementById('quoteFilterCustomer').value = '';
                if (document.getElementById('quoteSearchInput')) document.getElementById('quoteSearchInput').value = '';
                fetchQuotes();
            };
        }

        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => {
                if (!globalQuotes || globalQuotes.length === 0) {
                    alert('No Quotation records to export.');
                    return;
                }
                const exportData = globalQuotes.map(q => ({
                    "Date": q.date,
                    "Quote No": q.quote_no,
                    "RFQ No": q.rfq_no || '',
                    "Customer": q.customer,
                    "Part No": q.part_no,
                    "Part Description": q.part_description || '',
                    "Unit Price (₹)": q.final_unit_price || 0,
                    "Dev Cost (₹)": q.total_dev_cost || 0,
                    "Base Cost (₹)": q.base_part_cost || 0,
                    "Overhead %": q.overhead_profit_pct || 0
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Quotation_Report");
                XLSX.writeFile(wb, `Quotation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const id = document.getElementById('quoteId').value;
                const date = document.getElementById('quoteFormDate').value;
                const quote_no = document.getElementById('quoteFormNo').value;
                const rfq_no = document.getElementById('quoteFormRfqNo').value;
                const customer = document.getElementById('quoteFormCustomer').value;
                const unit = document.getElementById('quoteFormUnit').value;
                const part_no = document.getElementById('quoteFormPartNo').value;
                const part_description = document.getElementById('quoteFormPartDesc').value;
                const overhead_profit_pct = parseFloat(document.getElementById('quoteOverheadPct').value) || 0;
                const final_unit_price = parseFloat(document.getElementById('quoteFinalUnitPrice').value) || 0;

                const machining_details_arr = [];
                let total_machining_cost = 0;
                document.querySelectorAll('#quoteOpnsFormBody tr').forEach(tr => {
                    const opn_name = tr.querySelector('.quote-opn-name')?.value.trim() || '';
                    const machine = tr.querySelector('.quote-opn-machine')?.value.trim() || '';
                    const cycle_time = parseFloat(tr.querySelector('.quote-opn-cycletime')?.value) || 0;
                    const hourly_rate = parseFloat(tr.querySelector('.quote-opn-hourlyrate')?.value) || 0;
                    if (opn_name) {
                        const cost = (cycle_time / 60) * hourly_rate;
                        total_machining_cost += cost;
                        machining_details_arr.push({ opn_name, machine, cycle_time, hourly_rate, cost });
                    }
                });

                const other_process_details_arr = [];
                let total_other_process_cost = 0;
                document.querySelectorAll('#quoteProcsFormBody tr').forEach(tr => {
                    const proc_name = tr.querySelector('.quote-proc-name')?.value.trim() || '';
                    const vendor_notes = tr.querySelector('.quote-proc-vendor')?.value.trim() || '';
                    const cost_per_pc = parseFloat(tr.querySelector('.quote-proc-cost')?.value) || 0;
                    if (proc_name) {
                        total_other_process_cost += cost_per_pc;
                        other_process_details_arr.push({ proc_name, vendor_notes, cost_per_pc });
                    }
                });

                const packing_details_arr = [];
                let total_packing_cost = 0;
                document.querySelectorAll('#quotePacksFormBody tr').forEach(tr => {
                    const desc = tr.querySelector('.quote-pack-desc')?.value.trim() || '';
                    const cost_per_pc = parseFloat(tr.querySelector('.quote-pack-cost')?.value) || 0;
                    if (desc) {
                        total_packing_cost += cost_per_pc;
                        packing_details_arr.push({ desc, cost_per_pc });
                    }
                });

                const dev_cost_details_arr = [];
                let total_dev_cost = 0;
                document.querySelectorAll('#quoteDevsFormBody tr').forEach(tr => {
                    const desc = tr.querySelector('.quote-dev-desc')?.value.trim() || '';
                    const total_cost = parseFloat(tr.querySelector('.quote-dev-cost')?.value) || 0;
                    if (desc) {
                        total_dev_cost += total_cost;
                        dev_cost_details_arr.push({ desc, total_cost });
                    }
                });

                const base_part_cost = total_machining_cost + total_other_process_cost + total_packing_cost;

                const matchedRfq = (typeof globalRfqs !== 'undefined' ? globalRfqs : []).find(r => r.rfqno === rfq_no);
                const rfq_id = matchedRfq ? matchedRfq.id : null;

                const payload = {
                    quote_no,
                    date,
                    rfq_id,
                    rfq_no,
                    customer,
                    part_no,
                    part_description,
                    unit,
                    overhead_profit_pct,
                    total_machining_cost,
                    total_other_process_cost,
                    total_packing_cost,
                    base_part_cost,
                    final_unit_price,
                    total_dev_cost,
                    machining_details: JSON.stringify(machining_details_arr),
                    other_process_details: JSON.stringify(other_process_details_arr),
                    packing_details: JSON.stringify(packing_details_arr),
                    dev_cost_details: JSON.stringify(dev_cost_details_arr)
                };

                const url = id ? `/api/quotes/${id}` : '/api/quotes';
                const method = id ? 'PUT' : 'POST';

                try {
                    const res = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        closeQuoteModal();
                        fetchQuotes();
                    } else {
                        const err = await res.json();
                        alert('Error: ' + (err.detail || 'Failed to save Quotation'));
                    }
                } catch (err) {
                    alert('Error saving Quotation: ' + err.message);
                }
            };
        }
    }
});
