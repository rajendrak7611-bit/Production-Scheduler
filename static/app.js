document.addEventListener("DOMContentLoaded", () => {
    // Current date display
    const today = new Date().toISOString().split("T")[0];
    const dateDisplay = document.getElementById("currentDateDisplay");
    if (dateDisplay) dateDisplay.innerText = today;
    const logDateInput = document.getElementById("logDate");
    if (logDateInput) logDateInput.value = today;

    // Navigation / Tab Switching
    const navItems = document.querySelectorAll(".nav-item");
    const tabScreens = document.querySelectorAll(".tab-screen");
    const tabTitle = document.getElementById("currentTabTitle");

    window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    window.handleLoginSubmit = async function(e) {
        if (e) e.preventDefault();
        const err = document.getElementById("loginError") || document.getElementById("loginErrorMessage");
        if (err) err.style.display = "none";

        const uInput = document.getElementById("loginUsername");
        const pInput = document.getElementById("loginPassword");
        const u = uInput ? uInput.value.trim() : "";
        const p = pInput ? pInput.value.trim() : "";

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: u, password: p })
            });
            if (res.ok) {
                const user = await res.json();
                localStorage.setItem("currentUser", JSON.stringify(user));
                window.currentUser = user;
                const overlay = document.getElementById("loginOverlay");
                if (overlay) overlay.style.display = "none";
                applyUserRoleAccess();
            } else {
                const data = await res.json().catch(() => ({}));
                if (err) {
                    err.innerText = data.detail || "Invalid username or password!";
                    err.style.display = "block";
                }
            }
        } catch (error) {
            console.error("Login error:", error);
            if (err) {
                err.innerText = "Error connecting to server. Please try again.";
                err.style.display = "block";
            }
        }
    };

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginSubmit);
    }

    window.logoutUser = function() {
        localStorage.removeItem("currentUser");
        window.currentUser = null;
        const uInput = document.getElementById("loginUsername");
        const pInput = document.getElementById("loginPassword");
        const err = document.getElementById("loginError") || document.getElementById("loginErrorMessage");
        if (uInput) uInput.value = "";
        if (pInput) pInput.value = "";
        if (err) err.style.display = "none";
        checkUserAuth();
    };

    window.applyUserRoleAccess = function() {
        const overlay = document.getElementById("loginOverlay");
        const userBadge = document.getElementById("userStatusBadge");
        const userRoleText = document.getElementById("userRoleText");
        const userIcon = document.getElementById("userStatusIcon");

        if (!window.currentUser) {
            if (overlay) overlay.style.display = "flex";
            return;
        }

        if (overlay) overlay.style.display = "none";

        const isGuest = (window.currentUser.role === "guest");

        if (userRoleText) userRoleText.innerText = isGuest ? "Guest User" : "Admin User";
        if (userIcon) userIcon.className = isGuest ? "fa-solid fa-user" : "fa-solid fa-user-shield";
        if (userBadge) {
            userBadge.style.background = isGuest ? "#fef3c7" : "#dbeafe";
            userBadge.style.color = isGuest ? "#92400e" : "#1e40af";
        }

        // All Production Management sidebar items remain visible for all users (admin & guest)
        navItems.forEach(item => {
            item.style.display = "flex";
        });

        const activeNav = document.querySelector(".nav-item.active");
        const currentTab = activeNav ? activeNav.dataset.tab : "dashboard";
        switchTab(currentTab);
    };

    window.checkUserAuth = function() {
        window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
        if (!window.currentUser) {
            const overlay = document.getElementById("loginOverlay");
            if (overlay) overlay.style.display = "flex";
        } else {
            applyUserRoleAccess();
        }
    };

    checkUserAuth();

    window.switchTab = function(tabName) {
        if (!tabName) tabName = "dashboard";
        const navs = document.querySelectorAll(".nav-item");
        const screens = document.querySelectorAll(".tab-screen");
        const titleEl = document.getElementById("currentTabTitle");

        navs.forEach(item => {
            const targetTab = item.dataset.tab || item.getAttribute("data-tab");
            if (targetTab === tabName) {
                item.classList.add("active");
                if (titleEl) titleEl.innerText = item.innerText.trim();
            } else {
                item.classList.remove("active");
            }
        });

        screens.forEach(screen => {
            if (screen.id === `screen-${tabName}`) {
                screen.classList.add("active");
                screen.style.display = "block";
            } else {
                screen.classList.remove("active");
                screen.style.display = "none";
            }
        });

        // Trigger data reload for specific tabs
        try {
            if (tabName === "dashboard" && typeof window.loadDashboardStats === "function") window.loadDashboardStats();
            if (tabName === "prodlog" && typeof window.loadProdLogPageData === "function") window.loadProdLogPageData();
            if (tabName === "schedules" && typeof window.loadSchedules === "function") window.loadSchedules();
            if (tabName === "parts" && typeof window.loadParts === "function") window.loadParts();
            if (tabName === "machines" && typeof window.loadMachines === "function") window.loadMachines();
            if (tabName === "operators" && typeof window.loadOperators === "function") window.loadOperators();
            if (tabName === "tooling" && typeof window.loadTooling === "function") window.loadTooling();
        } catch (e) {
            console.error("Error switching tab:", e);
        }
    };

    navs.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabName = item.dataset.tab || item.getAttribute("data-tab");
            window.switchTab(tabName);
        });
    });

    // Check auth and load initial data
    checkUserAuth();
    loadDropdowns();

    // --- API Loaders ---

    // 1. Dashboard Stats
    window.recentDashboardLogs = [];

    function renderDashboardData(data) {
        if (!data) return;
        const activeM = document.getElementById("statActiveMachines");
        const todayP = document.getElementById("statTodayProduced");
        const pendingQ = document.getElementById("statPendingQty");
        const todayS = document.getElementById("statTodayScrap");

        if (activeM) activeM.innerText = `${data.active_machines || 0} / ${data.total_machines || 0}`;
        if (todayP) todayP.innerText = data.today_produced || 0;
        if (pendingQ) pendingQ.innerText = (data.pending_qty || 0).toLocaleString();
        if (todayS) todayS.innerText = data.today_scrap || 0;

        window.recentDashboardLogs = data.recent_logs || [];
        const tbody = document.getElementById("dashboardLogTable");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (!data.recent_logs || data.recent_logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: var(--text-secondary);">No production logs recorded yet</td></tr>`;
            return;
        }

        data.recent_logs.forEach((log, index) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.innerHTML = `
                <td>${log.log_date || '-'}</td>
                <td><span class="badge badge-success">${log.shift || 'General'}</span></td>
                <td><strong>${log.machine_name || '-'}</strong></td>
                <td>${log.operator_name || '-'}</td>
                <td><strong>${log.part_no || '-'}</strong></td>
                <td>Opn ${log.opn_no || '10'}</td>
                <td><span class="badge badge-success">${log.qty_produced || 0}</span></td>
                <td><span class="badge ${log.scrap_qty > 0 ? 'badge-danger' : 'badge-success'}">${log.scrap_qty || 0}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewLogSlNoModal(${index})">
                        <i class="fa-solid fa-list-ol"></i> View Sl Nos
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteProductionLog(${log.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tr.onclick = () => viewLogSlNoModal(index);
            tbody.appendChild(tr);
        });

        // Render Recent Quality Inspection Logs table on Dashboard
        const inspTbody = document.getElementById("recentInspectionLogsBody");
        if (inspTbody) {
            inspTbody.innerHTML = "";
            const inspLogs = data.recent_inspection_logs || [];
            if (inspLogs.length === 0) {
                inspTbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">No quality inspection logs recorded yet</td></tr>`;
            } else {
                inspLogs.forEach(r => {
                    const tr = document.createElement("tr");
                    tr.style.cursor = "pointer";

                    let totalReadings = 0;
                    try {
                        const rObj = JSON.parse(r.readings_json || "{}");
                        Object.values(rObj).forEach(row => {
                            Object.values(row).forEach(v => {
                                if (v !== "" && !isNaN(v)) {
                                    totalReadings++;
                                }
                            });
                        });
                    } catch(e){}

                    const statusBadge = totalReadings > 0 
                        ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Recorded (${totalReadings})</span>`
                        : `<span class="badge badge-warning">Template Only</span>`;

                    tr.innerHTML = `
                        <td><strong style="color: var(--primary);">${r.report_code || 'IR-' + r.id}</strong></td>
                        <td>${r.inspection_date || '-'}</td>
                        <td><strong>${r.part_no}</strong></td>
                        <td>Opn ${r.opn_no}</td>
                        <td>${r.batch_qty} pcs</td>
                        <td>${r.machine_name || '-'}</td>
                        <td>${r.operator_name || '-'}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewSavedInspectionReportModal(${r.id})" title="View Full Report">
                                    <i class="fa-solid fa-eye" style="color: var(--primary);"></i> View
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteInspectionReport(${r.id})" title="Delete">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tr.onclick = () => viewSavedInspectionReportModal(r.id);
                    inspTbody.appendChild(tr);
                });
            }
        }
    }

    async function loadDashboardStats() {
        const tbody = document.getElementById("dashboardLogTable");
        const cachedStats = localStorage.getItem("cached_dashboard_stats");
        if (cachedStats) {
            try {
                const data = JSON.parse(cachedStats);
                renderDashboardData(data);
            } catch(e){}
        }

        try {
            const res = await fetch("/api/dashboard/stats");
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("cached_dashboard_stats", JSON.stringify(data));
                renderDashboardData(data);
            } else if (tbody && tbody.innerHTML.includes("Loading")) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: var(--text-secondary);">No production logs recorded yet</td></tr>`;
            }
        } catch (err) {
            console.error("Error loading dashboard stats:", err);
            if (tbody && tbody.innerHTML.includes("Loading")) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: var(--text-secondary);">No production logs recorded yet</td></tr>`;
            }
        }
    }

    window.deleteProductionLog = async function(id) {
        if (!confirm("Are you sure you want to delete this production log entry?")) return;
        try {
            const res = await fetch(`/api/production-logs/${id}`, { method: "DELETE" });
            if (res.ok) {
                loadDashboardStats();
                if (typeof loadSchedules === "function") loadSchedules();
            }
        } catch (err) {
            console.error("Error deleting production log:", err);
        }
    };

    window.seedDefaultData = async function() {
        if (!confirm("Are you sure you want to restore default master data from Excel files?")) return;
        try {
            const res = await fetch("/api/seed-default-data", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                alert(data.message || "Sample master data restored successfully!");
                loadDashboardStats();
                if (typeof loadMachines === "function") loadMachines();
                if (typeof loadOperators === "function") loadOperators();
                if (typeof loadParts === "function") loadParts();
                if (typeof loadSchedules === "function") loadSchedules();
                if (typeof loadTooling === "function") loadTooling();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error seeding default data:", err);
        }
    };

    window.viewLogSlNoModal = function(index) {
        const log = window.recentDashboardLogs[index];
        if (!log) return;

        const body = document.getElementById("slNoModalDetailsBody");
        if (!body) return;

        const rawSlNos = (log.completed_sl_nos || "").split(",").map(s => s.trim()).filter(s => s.length > 0 && !isNaN(s)).map(Number);
        const slSet = new Set(rawSlNos);

        let gridSize = 60;
        if (allSchedules && log.part_no) {
            const sch = allSchedules.find(s => s.part_no && s.part_no.toUpperCase() === log.part_no.toUpperCase());
            if (sch && sch.sch_qty > 0) gridSize = sch.sch_qty;
        }
        if (rawSlNos.length > 0) {
            const maxLogged = Math.max(...rawSlNos);
            if (maxLogged > gridSize) gridSize = maxLogged;
        }

        let gridHtml = `<div class="number-grid" style="margin-top: 15px;">`;
        for (let i = 1; i <= gridSize; i++) {
            const isDone = slSet.has(i);
            gridHtml += `<div class="grid-cell ${isDone ? 'done' : ''}" style="cursor: default;">${i}</div>`;
        }
        gridHtml += `</div>`;

        body.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.88rem; background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
                <div><strong>Part No:</strong> <span style="color: var(--primary-dark); font-weight:700;">${log.part_no}</span></div>
                <div><strong>Opn No:</strong> Opn ${log.opn_no || '10'}</div>
                <div><strong>Operator:</strong> ${log.operator_name}</div>
                <div><strong>Shift & Date:</strong> ${log.shift} (${log.log_date})</div>
                <div><strong>Machine:</strong> ${log.machine_name}</div>
                <div><strong>Qty Produced:</strong> ${log.qty_produced} pcs (Scrap: ${log.scrap_qty})</div>
            </div>

            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 6px;">
                Produced Serial Numbers (${rawSlNos.length} pcs):
            </div>
            <div style="font-size: 0.85rem; color: var(--primary-dark); word-wrap: break-word; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-weight: 600; margin-bottom: 8px;">
                ${rawSlNos.length > 0 ? rawSlNos.sort((a,b)=>a-b).join(", ") : 'No specific Sl Nos recorded'}
            </div>

            ${gridHtml}
        `;

        openModal("slNoDetailsModal");
    };

    // 2. Dropdowns for Production Logger
    function getCurrentScheduleQty() {
        const pElem = document.getElementById("logPart");
        const partNo = pElem ? pElem.value.trim() : "";
        if (!partNo || !allSchedules) return 30;
        const sch = allSchedules.find(s => s.part_no && s.part_no.trim().toUpperCase() === partNo.toUpperCase());
        if (sch) {
            if (sch.total_sch_qty && sch.total_sch_qty > 0) return sch.total_sch_qty;
            if (sch.sch_qty && sch.sch_qty > 0) return sch.sch_qty;
        }
        return 30;
    }

    async function loadDropdowns() {
        try {
            const [mRes, oRes, pRes, sRes] = await Promise.all([
                fetch("/api/machines"),
                fetch("/api/operators"),
                fetch("/api/parts"),
                fetch("/api/schedules")
            ]);
            const machines = await mRes.json();
            const operators = await oRes.json();
            allParts = await pRes.json();
            allSchedules = await sRes.json();

            // Populate Machines Datalist
            const mList = document.getElementById("machinesDatalist");
            if (mList) {
                mList.innerHTML = machines.map(m => `<option value="${m.name}"></option>`).join("");
            }

            // Populate Operators Datalist
            const oList = document.getElementById("operatorsDatalist");
            if (oList) {
                oList.innerHTML = operators.map(o => `<option value="${o.name}"></option>`).join("");
            }

            // Populate Scheduled Parts Datalist ONLY from Work Schedules (Do not fallback to Part Master)
            const pList = document.getElementById("partsDatalist");
            if (pList) {
                const scheduledPartNos = new Set();
                if (allSchedules && allSchedules.length > 0) {
                    allSchedules.forEach(s => { if (s.part_no && s.part_no.trim()) scheduledPartNos.add(s.part_no.trim()); });
                }
                const partList = Array.from(scheduledPartNos);
                pList.innerHTML = partList.map(pNo => `<option value="${pNo}"></option>`).join("");
            }

            const schPartSelect = document.getElementById("schPartNoSelect");
            if (schPartSelect) {
                schPartSelect.innerHTML = `<option value="">-- Select Part Number --</option>`;
                allParts.forEach(p => {
                    schPartSelect.innerHTML += `<option value="${p.part_no}">${p.part_no}</option>`;
                });
            }

            restoreDeviceStationSettings();
        } catch (err) {
            console.error("Error loading dropdowns:", err);
        }
    }

    let lastSelectedPartNo = "";

    window.handleLoggerPartChange = function() {
        const pElem = document.getElementById("logPart");
        const opnSelect = document.getElementById("logOpnNo");
        if (!opnSelect) return;

        const partNo = pElem ? pElem.value.trim() : "";
        if (partNo && partNo.toUpperCase() === lastSelectedPartNo.toUpperCase()) {
            return; // Part hasn't changed, keep selected operation!
        }
        lastSelectedPartNo = partNo;

        opnSelect.innerHTML = `<option value="">Select Opn...</option>`;

        if (partNo && allParts) {
            const part = allParts.find(p => p.part_no.toUpperCase() === partNo.toUpperCase());
            if (part && part.operations && part.operations.length > 0) {
                const sortedOps = part.operations.slice().sort((a, b) => {
                    const numA = parseFloat((String(a.opn_no).match(/\d+/) || [0])[0]);
                    const numB = parseFloat((String(b.opn_no).match(/\d+/) || [0])[0]);
                    return numA - numB;
                });

                sortedOps.forEach(op => {
                    const match = String(op.opn_no).match(/\d+/);
                    const cleanNum = match ? match[0] : String(op.opn_no).trim();
                    opnSelect.innerHTML += `<option value="${cleanNum}">Opn ${cleanNum}</option>`;
                });
                opnSelect.selectedIndex = 1; // Auto-select initial operation (e.g. Opn 20)
            } else {
                opnSelect.innerHTML += `<option value="10">Opn 10</option>`;
                opnSelect.selectedIndex = 1;
            }
        } else if (partNo) {
            opnSelect.innerHTML += `<option value="10">Opn 10</option>`;
            opnSelect.innerHTML += `<option value="20">Opn 20</option>`;
            opnSelect.selectedIndex = 1;
        }

        fetchCompletedSlNos();
    };

    // --- Operator Serial Number Tracking (Dynamic Grid matching Schedule Qty) ---
    let selectedSlNos = new Set();
    let alreadyCompletedSlNos = new Set();
    let prevCompletedSlNos = new Set();
    let availableSlNos = new Set();
    let isFirstOperation = true;
    let previousOpnNo = null;

    window.fetchCompletedSlNos = async function fetchCompletedSlNos() {
        const pElem = document.getElementById("logPart");
        const opnElem = document.getElementById("logOpnNo");
        const partNo = pElem ? pElem.value.trim() : "";
        const opnNo = opnElem ? opnElem.value.trim() : "";

        selectedSlNos.clear();
        alreadyCompletedSlNos.clear();
        prevCompletedSlNos.clear();
        availableSlNos.clear();

        if (!partNo || !opnNo) {
            renderOperatorGrid();
            return;
        }

        try {
            const res = await fetch(`/api/production-logs/sl-nos?part_no=${encodeURIComponent(partNo)}&opn_no=${encodeURIComponent(opnNo)}`);
            if (res.ok) {
                const data = await res.json();
                alreadyCompletedSlNos = new Set(data.completed_sl_nos || []);
                prevCompletedSlNos = new Set(data.prev_completed_sl_nos || []);
                isFirstOperation = (data.is_first_opn === true);
                previousOpnNo = data.prev_opn_no;

                const maxGrid = getCurrentScheduleQty();
                if (isFirstOperation) {
                    // First Operation: All serial numbers NOT YET logged in this operation are available!
                    const availList = [];
                    for (let i = 1; i <= maxGrid; i++) {
                        if (!alreadyCompletedSlNos.has(i)) {
                            availList.push(i);
                        }
                    }
                    availableSlNos = new Set(availList);
                } else {
                    // Subsequent Operation: Available = (Completed in Prev Opn) MINUS (Already logged in Curr Opn)
                    const availList = (data.prev_completed_sl_nos || []).filter(s => !alreadyCompletedSlNos.has(s));
                    availableSlNos = new Set(availList);
                }
            }
        } catch (err) {
            console.error("Error fetching completed Sl Nos:", err);
        }

        renderOperatorGrid();
    };

    const opnSelectElem = document.getElementById("logOpnNo");
    if (opnSelectElem) {
        opnSelectElem.addEventListener("change", window.fetchCompletedSlNos);
        opnSelectElem.addEventListener("input", window.fetchCompletedSlNos);
    }

    function strCleanOpn(num) {
        return (typeof num === 'number' && Number.isInteger(num)) ? String(num) : String(num);
    }

    window.renderOperatorGrid = function renderOperatorGrid() {
        const maxGrid = getCurrentScheduleQty();
        const grid = document.getElementById("operatorNumberGrid");
        if (!grid) return;
        grid.innerHTML = "";

        const opnElem = document.getElementById("logOpnNo");
        const currentOpnNo = opnElem ? opnElem.value : "";

        const legendPrev = document.getElementById("legendPrevOpn");
        if (legendPrev) {
            legendPrev.style.display = "none";
        }

        const alertBanner = document.getElementById("opnGridStatusBanner");
        if (alertBanner) {
            if (!currentOpnNo) {
                alertBanner.className = "alert alert-warning";
                alertBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Please select an Operation No</strong> above to view available serial numbers.`;
                alertBanner.style.display = "block";
            } else if (isFirstOperation) {
                const availCount = availableSlNos.size;
                alertBanner.className = "alert alert-info";
                alertBanner.innerHTML = `<i class="fa-solid fa-circle-info"></i> <strong>Initial Operation (Opn ${currentOpnNo}):</strong> Showing ${availCount} remaining serial numbers available (White). Click boxes to select for Opn ${currentOpnNo} (Light Green).`;
                alertBanner.style.display = "block";
            } else {
                const availCount = availableSlNos.size;
                if (availCount > 0) {
                    alertBanner.className = "alert alert-success";
                    alertBanner.innerHTML = `<i class="fa-solid fa-check-circle"></i> <strong>Opn ${currentOpnNo} Active:</strong> Showing ${availCount} serial numbers received from Opn ${previousOpnNo || 'Prev'} (White). Click boxes to select for Opn ${currentOpnNo} (Light Green).`;
                } else {
                    alertBanner.className = "alert alert-warning";
                    alertBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Opn ${currentOpnNo}:</strong> No serial numbers are currently available from Opn ${previousOpnNo || 'Prev'}. Complete Opn ${previousOpnNo || 'Prev'} first to move parts forward.`;
                }
                alertBanner.style.display = "block";
            }
        }

        for (let i = 1; i <= maxGrid; i++) {
            const cell = document.createElement("div");
            const isAvailable = availableSlNos.has(i);
            const isSelectedNow = selectedSlNos.has(i);

            if (!currentOpnNo) {
                cell.className = `grid-cell disabled`;
                cell.innerText = i;
                cell.title = `Sl No ${i} (Locked - Select an Operation No first)`;
                cell.onclick = () => {
                    alert("Please select an Operation No before selecting serial numbers!");
                };
            } else if (isAvailable) {
                // Available for this operation: Render WHITE (#ffffff) by default, turns LIGHT GREEN (#86efac) on selection!
                cell.className = `grid-cell ${isSelectedNow ? 'done' : 'pending'}`;
                cell.innerText = i;
                cell.title = `Sl No ${i} ${isSelectedNow ? '(Selected - Light Green)' : '(Available for Opn ' + currentOpnNo + ' - Click to pick)'}`;

                cell.onclick = () => {
                    if (selectedSlNos.has(i)) {
                        selectedSlNos.delete(i);
                    } else {
                        selectedSlNos.add(i);
                    }
                    renderOperatorGrid();
                };
            } else {
                // Not in available pool for this operation
                const isAlreadyLoggedHere = alreadyCompletedSlNos.has(i);
                cell.className = `grid-cell disabled`;
                cell.innerText = i;
                if (isAlreadyLoggedHere) {
                    cell.title = `Sl No ${i} (Completed in Opn ${currentOpnNo} - Moved to Next Opn)`;
                    cell.onclick = () => {
                        alert(`Sl No ${i} has already been logged for Opn ${currentOpnNo} and moved to the next operation!`);
                    };
                } else if (!isFirstOperation) {
                    cell.title = `Sl No ${i} (Locked - Pending completion in Opn ${previousOpnNo || 'Prev'})`;
                    cell.onclick = () => {
                        alert(`Sl No ${i} is not available for Opn ${currentOpnNo} yet. It must first be completed in Opn ${previousOpnNo || 'Prev'}!`);
                    };
                } else {
                    cell.title = `Sl No ${i} (Not Available)`;
                }
            }
            grid.appendChild(cell);
        }

        syncSlNosWithForm(maxGrid);
    }

    function syncSlNosWithForm(maxGrid = 60) {
        const opnElem = document.getElementById("logOpnNo");
        const currentOpnNo = opnElem ? opnElem.value : "";

        const totalCompletedInThisOpn = new Set([...selectedSlNos, ...alreadyCompletedSlNos]);
        const sortedList = Array.from(selectedSlNos).sort((a, b) => a - b);
        
        // Auto update Qty Produced input field to count of newly selected Sl Nos
        document.getElementById("logQtyProduced").value = selectedSlNos.size;

        // Displays
        const chartTitle = document.getElementById("chartTitleText");
        const countDisplay = document.getElementById("gridCountDisplay");
        const totalBadge = document.getElementById("chartTotalBadge");
        const progressFill = document.getElementById("gridProgressFill");
        const listText = document.getElementById("completedSlNoListText");

        if (chartTitle) {
            chartTitle.innerHTML = currentOpnNo ? `<i class="fa-solid fa-list-ol"></i> Part Serial Number (Sl No) Chart — <span style="color: var(--primary);">Opn ${currentOpnNo}</span>` : `<i class="fa-solid fa-list-ol"></i> Part Serial Number (Sl No) Chart`;
        }

        if (countDisplay) {
            countDisplay.innerText = `${totalCompletedInThisOpn.size} / ${maxGrid} Sl Nos`;
        }

        if (totalBadge) {
            if (!currentOpnNo) {
                totalBadge.className = "badge badge-warning";
                totalBadge.innerText = "Select Operation No";
            } else if (isFirstOperation) {
                totalBadge.className = "badge badge-success";
                totalBadge.innerText = `Available to Log: ${availableSlNos.size} Sl Nos`;
            } else {
                totalBadge.className = "badge badge-primary";
                totalBadge.innerText = `Received from Opn ${previousOpnNo || 'Prev'}: ${availableSlNos.size} Sl Nos`;
            }
        }

        if (progressFill) {
            const pct = Math.min(100, Math.round((totalCompletedInThisOpn.size / maxGrid) * 100));
            progressFill.style.width = `${pct}%`;
        }

        if (listText) {
            listText.innerText = sortedList.length > 0 ? sortedList.join(", ") : "None selected";
        }

        if (typeof syncLoggerInspectionSection === "function") {
            syncLoggerInspectionSection();
        }
    }

    window.selectAllSlNos = function(factor = 1.0) {
        const maxGrid = getCurrentScheduleQty();
        const limit = Math.round(maxGrid * factor);
        for (let i = 1; i <= limit; i++) {
            selectedSlNos.add(i);
        }
        renderOperatorGrid();
    };

    window.clearSlNoSelection = function() {
        selectedSlNos.clear();
        renderOperatorGrid();
    };

    // Device Persistence Helper Functions (Hold Machine, Operator, Part Number per device)
    function saveDeviceStationSettings() {
        const mInput = document.getElementById("logMachine");
        const oInput = document.getElementById("logOperator");
        const pInput = document.getElementById("logPart");

        if (mInput && mInput.value.trim()) localStorage.setItem("saved_logMachine", mInput.value.trim());
        if (oInput && oInput.value.trim()) localStorage.setItem("saved_logOperator", oInput.value.trim());
        if (pInput && pInput.value.trim()) localStorage.setItem("saved_logPart", pInput.value.trim());
    }

    function restoreDeviceStationSettings() {
        const mInput = document.getElementById("logMachine");
        const oInput = document.getElementById("logOperator");
        const pInput = document.getElementById("logPart");

        const savedMachine = localStorage.getItem("saved_logMachine") || "";
        const savedOperator = localStorage.getItem("saved_logOperator") || "";
        const savedPart = localStorage.getItem("saved_logPart") || "";

        if (mInput && savedMachine) mInput.value = savedMachine;
        if (oInput && savedOperator) {
            oInput.value = savedOperator;
            const badge = document.getElementById("chartOperatorBadge");
            if (badge) badge.innerText = `Operator: ${savedOperator}`;
        }
        if (pInput && savedPart) {
            pInput.value = savedPart;
            handleLoggerPartChange();
        }
    }

    // Event listeners to sync inputs & persist device station settings
    const logMInput = document.getElementById("logMachine");
    if (logMInput) {
        logMInput.addEventListener("input", () => { saveDeviceStationSettings(); syncLoggerInspectionSection(); });
        logMInput.addEventListener("change", () => { saveDeviceStationSettings(); syncLoggerInspectionSection(); });
    }

    const logOpInput = document.getElementById("logOperator");
    if (logOpInput) {
        const updateOpBadge = (val) => {
            saveDeviceStationSettings();
            syncLoggerInspectionSection();
            const opName = val || "None";
            const badge = document.getElementById("chartOperatorBadge");
            if (badge) badge.innerText = `Operator: ${opName}`;
        };
        logOpInput.addEventListener("input", (e) => updateOpBadge(e.target.value));
        logOpInput.addEventListener("change", (e) => updateOpBadge(e.target.value));
    }

    const logPInput = document.getElementById("logPart");
    if (logPInput) {
        logPInput.addEventListener("input", () => { saveDeviceStationSettings(); syncLoggerInspectionSection(); });
        logPInput.addEventListener("change", () => { saveDeviceStationSettings(); syncLoggerInspectionSection(); });
    }

    const logOpnSelectElem = document.getElementById("logOpnNo");
    if (logOpnSelectElem) {
        logOpnSelectElem.addEventListener("change", () => syncLoggerInspectionSection());
        logOpnSelectElem.addEventListener("input", () => syncLoggerInspectionSection());
    }

    // --- Production Logger Integrated Quality Inspection Section ---
    window.currentLoggerReportCode = "";

    window.syncLoggerInspectionSection = async function() {
        const body = document.getElementById("loggerInspectionBody");
        const codeBadge = document.getElementById("loggerReportCodeBadge");
        if (!body) return;

        const partNo = document.getElementById("logPart")?.value.trim() || "";
        const opnNo = document.getElementById("logOpnNo")?.value.trim() || "";
        const machine = document.getElementById("logMachine")?.value.trim() || "";
        const operator = document.getElementById("logOperator")?.value.trim() || "";

        if (!partNo || !opnNo) {
            body.innerHTML = `
                <div class="text-center" style="padding: 15px; color: #64748b; font-size: 0.82rem;">
                    <i class="fa-solid fa-circle-info"></i> Select Part Number & Operation No above to load the Quality Inspection Report.
                </div>
            `;
            if (codeBadge) codeBadge.innerText = "-";
            return;
        }

        const sortedSlNos = Array.from(selectedSlNos).sort((a, b) => a - b);
        const compSlNoVal = sortedSlNos.length > 0 ? String(sortedSlNos[0]) : "1";

        try {
            const [pRes, cRes] = await Promise.all([
                fetch(`/api/inspection-parameters?part_no=${encodeURIComponent(partNo)}&opn_no=${encodeURIComponent(opnNo)}`),
                fetch(`/api/inspection-reports/next-code?part_no=${encodeURIComponent(partNo)}&opn_no=${encodeURIComponent(opnNo)}`)
            ]);

            const params = await pRes.json();
            const codeData = await cRes.json();
            window.currentLoggerReportCode = codeData.report_code || `${partNo.toUpperCase()}-${opnNo}-${new Date().toISOString().slice(5,10).replace('-','')}-001`;

            if (codeBadge) codeBadge.innerText = window.currentLoggerReportCode;

            const schBatchQty = typeof getCurrentScheduleQty === "function" ? getCurrentScheduleQty() : 30;

            let html = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 4px; font-size: 0.75rem;">
                    <div><strong>Date:</strong> ${new Date().toISOString().split('T')[0]}</div>
                    <div><strong>Part No:</strong> <span style="color:var(--primary); font-weight:700;">${partNo}</span></div>
                    <div><strong>Opn:</strong> ${opnNo}</div>
                    <div><strong>Batch Qty:</strong> ${schBatchQty} pcs</div>
                    <div><strong>Machine:</strong> ${machine || '-'}</div>
                    <div><strong>Operator:</strong> ${operator || '-'}</div>
                </div>

                <div class="table-responsive" style="overflow-x: hidden; width: 100%; border: 1px solid #cbd5e1; border-radius: 6px;">
                    <table class="data-table" id="loggerMatrixTable" style="font-size: 0.75rem; border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="width: 32%; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Desc</th>
                                <th style="width: 17%; text-align: right; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Nom</th>
                                <th style="width: 14%; text-align: right; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Lo</th>
                                <th style="width: 14%; text-align: right; border-bottom: 2px solid #cbd5e1; border-right: 2px solid #cbd5e1; padding: 4px 2px;">Hi</th>
                                <th style="width: 23%; text-align: center; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">
                                    Reading<br>
                                    <input type="text" class="logger-comp-sl" data-col="0" value="${compSlNoVal}" placeholder="Sl No" inputmode="decimal" style="width: 90%; max-width: 58px; text-align: center; font-size: 0.72rem; font-weight: 700; padding: 1px 2px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; background: #ffffff;">
                                </th>
                            </tr>
                        </thead>
                        <tbody id="loggerMatrixBody">
            `;

            if (!params || params.length === 0) {
                html += `<tr><td colspan="5" class="text-center" style="padding: 12px;">No parameters configured in Part Master for ${partNo} (Opn ${opnNo}).</td></tr>`;
            } else {
                params.forEach((p, pIdx) => {
                    const nom = parseFloat(p.nominal_dimension || 0);
                    const lo = parseFloat(p.lo_tol || 0);
                    const hi = parseFloat(p.hi_tol || 0);

                    html += `
                        <tr data-param-id="${p.id}">
                            <td style="width: 32%; padding: 4px 2px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.description}">
                                ${p.description}
                            </td>
                            <td style="width: 17%; padding: 4px 2px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 0.72rem;">
                                ${nom}
                            </td>
                            <td style="width: 14%; padding: 4px 2px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 0.72rem;">
                                ${lo}
                            </td>
                            <td style="width: 14%; padding: 4px 2px; border-bottom: 1px solid #e2e8f0; border-right: 2px solid #cbd5e1; text-align: right; font-size: 0.72rem;">
                                ${hi}
                            </td>
                            <td style="width: 23%; padding: 2px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                                <input type="number" step="0.001" inputmode="decimal" class="logger-reading form-control" data-nom="${nom}" data-lo="${lo}" data-hi="${hi}" data-col="0" value="" oninput="validateLoggerReadingCell(this)" style="width: 90%; max-width: 58px; padding: 3px 2px; font-size: 0.75rem; text-align: center; background-color: #ffffff; color: #000000; font-weight: 700;">
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 6px; font-size: 0.72rem; color: #64748b; display: flex; gap: 12px;">
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 2px; vertical-align: middle;"></span> In Spec</span>
                    <span><span style="display: inline-block; width: 10px; height: 10px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 2px; vertical-align: middle;"></span> Out Spec</span>
                </div>
            `;

            body.innerHTML = html;
        } catch (err) {
            console.error("Error syncing logger inspection section:", err);
        }
    };

    window.validateLoggerReadingCell = function(inputElem) {
        const nom = parseFloat(inputElem.getAttribute("data-nom") || 0);
        const lo = parseFloat(inputElem.getAttribute("data-lo") || 0);
        const hi = parseFloat(inputElem.getAttribute("data-hi") || 0);
        const minVal = nom - lo;
        const maxVal = nom + hi;

        const valStr = inputElem.value.trim();
        if (valStr !== '' && !isNaN(valStr)) {
            const v = parseFloat(valStr);
            if (v >= minVal && v <= maxVal) {
                inputElem.style.backgroundColor = '#d1fae5';
                inputElem.style.color = '#065f46';
            } else {
                inputElem.style.backgroundColor = '#fee2e2';
                inputElem.style.color = '#991b1b';
            }
        } else {
            inputElem.style.backgroundColor = '#ffffff';
            inputElem.style.color = '#000000';
        }
    };

    window.saveLoggerInspectionReportData = async function() {
        const partNo = document.getElementById("logPart")?.value.trim() || "";
        const opnNo = document.getElementById("logOpnNo")?.value.trim() || "";

        if (!partNo || !opnNo) {
            alert("Please select Part Number and Operation No first.");
            return;
        }

        const rows = document.querySelectorAll("#loggerMatrixBody tr");
        const compInputs = document.querySelectorAll(".logger-comp-sl");
        const compSlList = [];
        compInputs.forEach(i => compSlList.push(i.value.trim()));
        const compSlNosStr = compSlList.join(",");

        const readingsObj = {};
        rows.forEach((tr, pIdx) => {
            const pId = tr.getAttribute("data-param-id") || `param_${pIdx + 1}`;
            const rowReadings = {};
            const readingInputs = tr.querySelectorAll(".logger-reading");
            readingInputs.forEach(inp => {
                const col = inp.getAttribute("data-col");
                rowReadings[`col_${col}`] = inp.value;
            });
            readingsObj[pId] = rowReadings;
        });

        const schBatchQty = typeof getCurrentScheduleQty === "function" ? getCurrentScheduleQty() : 30;
        const reportPayload = {
            report_code: window.currentLoggerReportCode,
            part_no: partNo,
            opn_no: opnNo,
            batch_qty: schBatchQty,
            machine_name: document.getElementById("logMachine")?.value || "",
            operator_name: document.getElementById("logOperator")?.value || "",
            comp_sl_nos: compSlNosStr,
            readings_json: JSON.stringify(readingsObj)
        };

        try {
            const res = await fetch("/api/inspection-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reportPayload)
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Quality Inspection Report saved successfully!\nTraceability ID: ${data.report_code}`);
                loadDashboardStats();
                syncLoggerInspectionSection();
            } else {
                alert("Failed to save inspection report.");
            }
        } catch (err) {
            console.error("Error saving inspection report:", err);
        }
    };

    window.viewSavedInspectionReportModal = async function(reportId) {
        try {
            const res = await fetch(`/api/inspection-reports/by-id/${reportId}`);
            if (!res.ok) return alert("Report not found");
            const r = await res.json();

            document.getElementById("viewReportCodeBadge").innerText = r.report_code || `IR-${r.id}`;
            document.getElementById("viewReportTitle").innerText = `Saved Quality Inspection Report (${r.part_no} - Opn ${r.opn_no})`;

            const pRes = await fetch(`/api/inspection-parameters?part_no=${encodeURIComponent(r.part_no)}&opn_no=${encodeURIComponent(r.opn_no)}`);
            const params = await pRes.json();

            const compList = r.comp_sl_nos ? r.comp_sl_nos.split(",") : ["1","2","3","4","5"];
            let readingsObj = {};
            try { readingsObj = JSON.parse(r.readings_json || "{}"); } catch(e){}

            let html = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; font-size: 0.78rem;">
                    <div><strong>Date:</strong> ${r.inspection_date || '-'}</div>
                    <div><strong>Part No:</strong> <span style="color:var(--primary); font-weight:700;">${r.part_no}</span></div>
                    <div><strong>Opn No:</strong> Opn ${r.opn_no}</div>
                    <div><strong>Batch Qty:</strong> ${r.batch_qty} pcs</div>
                    <div><strong>Machine:</strong> ${r.machine_name || '-'}</div>
                    <div><strong>Operator:</strong> ${r.operator_name || '-'}</div>
                </div>

                <div class="table-responsive" style="overflow-x: auto; max-height: 380px; border: 1px solid #cbd5e1; border-radius: 6px;">
                    <table class="data-table" style="font-size: 0.78rem; border-collapse: separate; border-spacing: 0; min-width: 580px;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="position: sticky; left: 0px; z-index: 4; background: #f1f5f9; width: 105px;">Desc</th>
                                <th style="position: sticky; left: 105px; z-index: 4; background: #f1f5f9; width: 60px; text-align: right;">Nom</th>
                                <th style="position: sticky; left: 165px; z-index: 4; background: #f1f5f9; width: 50px; text-align: right;">Lo</th>
                                <th style="position: sticky; left: 215px; z-index: 4; background: #f1f5f9; width: 50px; text-align: right; border-right: 2px solid #cbd5e1;">Hi</th>
                                ${compList.map(c => `<th style="width: 62px; text-align: center;">C<br><strong>${c}</strong></th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (!params || params.length === 0) {
                html += `<tr><td colspan="9" class="text-center" style="padding: 12px;">No parameter definitions recorded.</td></tr>`;
            } else {
                params.forEach((p, pIdx) => {
                    const nom = parseFloat(p.nominal_dimension || 0);
                    const lo = parseFloat(p.lo_tol || 0);
                    const hi = parseFloat(p.hi_tol || 0);
                    const minVal = nom - lo;
                    const maxVal = nom + hi;

                    const rowVals = readingsObj[p.id] || readingsObj[`param_${pIdx + 1}`] || {};

                    html += `
                        <tr>
                            <td style="position: sticky; left: 0px; z-index: 2; background: #ffffff; width: 105px; font-weight: 600;">${p.description}</td>
                            <td style="position: sticky; left: 105px; z-index: 2; background: #ffffff; width: 60px; text-align: right;">${nom}</td>
                            <td style="position: sticky; left: 165px; z-index: 2; background: #ffffff; width: 50px; text-align: right;">${lo}</td>
                            <td style="position: sticky; left: 215px; z-index: 2; background: #ffffff; width: 50px; text-align: right; border-right: 2px solid #cbd5e1;">${hi}</td>
                    `;

                    for (let col = 0; col < compList.length; col++) {
                        const val = rowVals[`col_${col}`] !== undefined ? rowVals[`col_${col}`] : "";
                        let bg = "#ffffff";
                        let fg = "#000000";
                        if (val !== "" && !isNaN(val)) {
                            const v = parseFloat(val);
                            if (v >= minVal && v <= maxVal) { bg = "#d1fae5"; fg = "#065f46"; }
                            else { bg = "#fee2e2"; fg = "#991b1b"; }
                        }
                        html += `<td style="text-align: center; background-color: ${bg}; color: ${fg}; font-weight: 700;">${val !== "" ? val : "-"}</td>`;
                    }
                    html += `</tr>`;
                });
            }

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            document.getElementById("viewReportBody").innerHTML = html;
            openModal("viewSavedReportModal");
        } catch(e) {
            console.error("Error viewing saved report:", e);
        }
    };

    window.deleteInspectionReport = async function(reportId) {
        if (!confirm("Are you sure you want to delete this inspection report instance?")) return;
        try {
            const res = await fetch(`/api/inspection-reports/${reportId}`, { method: "DELETE" });
            if (res.ok) {
                loadDashboardStats();
            } else {
                alert("Failed to delete inspection report.");
            }
        } catch(e) {
            console.error("Error deleting inspection report:", e);
        }
    };

    function resetLoggerForm() {
        const qtyInput = document.getElementById("logQtyProduced");
        const scrapInput = document.getElementById("logScrapQty");
        if (qtyInput) qtyInput.value = "0";
        if (scrapInput) scrapInput.value = "0";

        selectedSlNos.clear();

        // Restore & hold Machine, Operator, and Part Number for this device
        restoreDeviceStationSettings();
        syncLoggerInspectionSection();
    }

    async function loadProdLogPageData() {
        await loadDropdowns();
        restoreDeviceStationSettings();
        syncLoggerInspectionSection();
    }

    // Submit Log Form
    document.getElementById("prodLogForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        saveDeviceStationSettings();

        const completedSlNosStr = Array.from(selectedSlNos).sort((a, b) => a - b).join(",");
        
        const payload = {
            machine_name: document.getElementById("logMachine").value,
            operator_name: document.getElementById("logOperator").value,
            part_no: document.getElementById("logPart").value,
            opn_no: document.getElementById("logOpnNo").value,
            qty_produced: selectedSlNos.size,
            scrap_qty: parseInt(document.getElementById("logScrapQty").value) || 0,
            completed_sl_nos: completedSlNosStr
        };

        try {
            const res = await fetch("/api/production-logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const prodLogData = await res.json();

                // Save Quality Inspection Report instance with unique Traceability ID e.g. W04-20-0828-001
                const rows = document.querySelectorAll("#loggerMatrixBody tr");
                if (rows && rows.length > 0) {
                    const compInputs = document.querySelectorAll(".logger-comp-sl");
                    const compSlList = [];
                    compInputs.forEach(i => compSlList.push(i.value.trim()));
                    const compSlNosStr = compSlList.join(",");

                    const readingsObj = {};
                    rows.forEach((tr, pIdx) => {
                        const pId = tr.getAttribute("data-param-id") || `param_${pIdx + 1}`;
                        const rowReadings = {};
                        const readingInputs = tr.querySelectorAll(".logger-reading");
                        readingInputs.forEach(inp => {
                            const col = inp.getAttribute("data-col");
                            rowReadings[`col_${col}`] = inp.value;
                        });
                        readingsObj[pId] = rowReadings;
                    });

                    const schBatchQty = typeof getCurrentScheduleQty === "function" ? getCurrentScheduleQty() : 30;
                    const reportPayload = {
                        report_code: window.currentLoggerReportCode,
                        prod_log_id: prodLogData.id,
                        part_no: document.getElementById("logPart").value,
                        opn_no: document.getElementById("logOpnNo").value,
                        batch_qty: schBatchQty,
                        machine_name: document.getElementById("logMachine").value,
                        operator_name: document.getElementById("logOperator").value,
                        comp_sl_nos: compSlNosStr,
                        readings_json: JSON.stringify(readingsObj)
                    };

                    await fetch("/api/inspection-reports", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(reportPayload)
                    });
                }

                alert(`Saved Production Record & Quality Inspection Report!\nSl Nos completed: ${completedSlNosStr || 'None'}\nTraceability ID: ${window.currentLoggerReportCode}`);
                resetLoggerForm();
                await loadDropdowns();
                loadDashboardStats();
            } else {
                alert("Failed to save production record.");
            }
        } catch (err) {
            console.error("Error saving log:", err);
        }
    });

    // 3. Schedules
    let allSchedules = [];
    async function loadSchedules() {
        try {
            const cached = localStorage.getItem("cached_schedules");
            if (cached) {
                try {
                    allSchedules = JSON.parse(cached);
                    renderSchedules(allSchedules);
                } catch(e){}
            }
            const res = await fetch("/api/schedules");
            if (res.ok) {
                allSchedules = await res.json();
                localStorage.setItem("cached_schedules", JSON.stringify(allSchedules));
                renderSchedules(allSchedules);
            }
            
            // Sync partsDatalist in Production Logger to strictly match active Work Schedules
            const pList = document.getElementById("partsDatalist");
            if (pList) {
                const scheduledPartNos = new Set();
                if (allSchedules && allSchedules.length > 0) {
                    allSchedules.forEach(s => { if (s.part_no && s.part_no.trim()) scheduledPartNos.add(s.part_no.trim()); });
                }
                const partList = Array.from(scheduledPartNos);
                pList.innerHTML = partList.map(pNo => `<option value="${pNo}"></option>`).join("");
            }
        } catch (err) {
            console.error("Error loading schedules:", err);
        }
    }

    function renderSchedules(data) {
        const tbody = document.getElementById("schedulesTableBody");
        tbody.innerHTML = "";
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No schedules found</td></tr>`;
            return;
        }

        data.forEach(s => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong style="color: var(--primary-dark); font-size: 1rem;">${s.part_no}</strong></td>
                <td><strong>${s.sch_qty}</strong></td>
                <td><span class="badge badge-success">Opn ${s.opn_no}</span></td>
                <td>${s.desc || '-'}</td>
                <td><span class="badge badge-success" style="font-weight: 700;">${s.qty_prod}</span></td>
                <td><span class="badge ${s.balance > 0 ? 'badge-warning' : 'badge-success'}">${s.balance}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteSchedule(${s.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.filterSchedules = function() {
        const q = document.getElementById("schSearch").value.toLowerCase();
        const filtered = allSchedules.filter(s => 
            (s.part_no && s.part_no.toLowerCase().includes(q)) || 
            (s.desc && s.desc.toLowerCase().includes(q)) ||
            (s.opn_no && String(s.opn_no).toLowerCase().includes(q))
        );
        renderSchedules(filtered);
    };

    document.getElementById("addScheduleForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const selectedPart = document.getElementById("schPartNoSelect").value;
        const schQty = parseInt(document.getElementById("schQty").value) || 0;

        if (!selectedPart) {
            alert("Please select a Part Number from Part Master");
            return;
        }

        const payload = {
            part_no: selectedPart,
            total_sch_qty: schQty,
            balance_to_produce: schQty
        };

        try {
            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal("scheduleModal");
                loadSchedules();
                loadDashboardStats();
            }
        } catch (err) {
            console.error("Error creating schedule:", err);
        }
    });

    window.deleteSchedule = async function(id) {
        if (!confirm("Delete schedule item?")) return;
        try {
            const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
            if (res.ok) loadSchedules();
        } catch (err) {
            console.error("Error deleting schedule:", err);
        }
    };

    window.clearAllSchedules = async function() {
        if (!confirm("Are you sure you want to clear ALL work schedules? This action cannot be undone.")) return;
        try {
            const res = await fetch("/api/schedules/clear-all", { method: "DELETE" });
            if (res.ok) {
                alert("All work schedules cleared successfully!");
                localStorage.removeItem("cached_schedules");
                loadSchedules();
                loadDashboardStats();
            } else {
                alert("Failed to clear schedules.");
            }
        } catch (err) {
            console.error("Error clearing schedules:", err);
        }
    };

    window.triggerScheduleExcelImport = function() {
        document.getElementById("schExcelInput").click();
    };

    window.handleScheduleExcelUpload = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/schedules/import-excel", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || "Work Schedules Excel imported successfully!");
                loadSchedules();
                loadDashboardStats();
            } else {
                const errData = await res.json();
                alert("Import failed: " + (errData.detail || "Unknown error"));
            }
        } catch (err) {
            console.error("Error importing Excel:", err);
            alert("Error uploading file: " + err.message);
        } finally {
            event.target.value = "";
        }
    };

    // 4. Parts
    let allParts = [];
    async function loadParts() {
        try {
            const cached = localStorage.getItem("cached_parts");
            if (cached) {
                try {
                    allParts = JSON.parse(cached);
                    renderParts(allParts);
                } catch(e){}
            }
            const res = await fetch("/api/parts");
            if (res.ok) {
                allParts = await res.json();
                localStorage.setItem("cached_parts", JSON.stringify(allParts));
                renderParts(allParts);
            }
        } catch (err) {
            console.error("Error loading parts:", err);
        }
    }

    function renderParts(data) {
        const tbody = document.getElementById("partsTableBody");
        tbody.innerHTML = "";
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No parts found</td></tr>`;
            return;
        }

        data.forEach((p, index) => {
            const tr = document.createElement("tr");
            const opCount = p.operations ? p.operations.length : 0;
            
            tr.innerHTML = `
                <td>
                    <strong style="font-size: 1.05rem; color: var(--primary-dark);">${p.part_no}</strong>
                    ${p.family ? `<br><small style="color:var(--text-secondary);">${p.family} ${p.forge_pn ? '| ' + p.forge_pn : ''}</small>` : ''}
                </td>
                <td>
                    <span class="badge badge-success" style="font-size: 0.88rem; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onclick="viewPartOperations(${index})">
                        <i class="fa-solid fa-layer-group"></i> ${opCount} Operations (Click for Details)
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" style="border-color: var(--primary); color: var(--primary); font-weight: 600;" onclick="openPartInspectionModal('${p.part_no}')">
                        <i class="fa-solid fa-clipboard-check" style="color: var(--primary);"></i> Inspection Reports (${opCount})
                    </button>
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-sm btn-outline" onclick="viewPartOperations(${index})">
                            <i class="fa-solid fa-list"></i> Details (${opCount})
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletePart(${p.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.viewPartOperations = function(index) {
        const p = allParts[index];
        if (!p) return;

        const title = document.getElementById("partOpModalTitle");
        const body = document.getElementById("partOpModalBody");
        if (title) title.innerHTML = `<i class="fa-solid fa-cubes"></i> Operations for Part: <span style="color:var(--primary-dark);">${p.part_no}</span>`;

        let rowsHtml = "";
        if (p.operations && p.operations.length > 0) {
            p.operations.forEach(op => {
                let ctDisplay = "-";
                if (op.cycle_time && op.cycle_time > 0) {
                    ctDisplay = op.cycle_time + " min";
                } else if (op.machine_name && !isNaN(op.machine_name)) {
                    ctDisplay = op.machine_name + " min";
                }

                rowsHtml += `
                    <tr>
                        <td><span class="badge badge-success">Opn ${op.opn_no}</span></td>
                        <td><strong>${op.description || '-'}</strong></td>
                        <td><span style="font-weight: 700; color: var(--primary-dark);">${ctDisplay}</span></td>
                    </tr>
                `;
            });
        } else {
            rowsHtml = `<tr><td colspan="3" class="text-center">No operations added for this part yet</td></tr>`;
        }

        body.innerHTML = `
            <div class="table-responsive" style="margin-bottom: 15px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Opn No</th>
                            <th>Description</th>
                            <th>Cycle Time (CT)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        openModal("partOperationsModal");
    };

    window.triggerPartExcelImport = function() {
        document.getElementById("partExcelInput").click();
    };

    window.handlePartExcelUpload = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/parts/import-excel", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || "Parts & Operations Excel imported successfully!");
                loadParts();
                loadDropdowns();
            } else {
                const errData = await res.json();
                alert("Import failed: " + (errData.detail || "Unknown error"));
            }
        } catch (err) {
            console.error("Error importing Excel:", err);
            alert("Error uploading file: " + err.message);
        } finally {
            event.target.value = "";
        }
    };

    window.deletePart = async function(id) {
        if (!confirm("Are you sure you want to delete this part and all its operations?")) return;
        try {
            const res = await fetch(`/api/parts/${id}`, { method: "DELETE" });
            if (res.ok) {
                loadParts();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error deleting part:", err);
        }
    };

    window.clearAllParts = async function() {
        if (!confirm("Are you sure you want to clear ALL parts and operations? This action cannot be undone.")) return;
        try {
            const res = await fetch("/api/parts/clear-all", { method: "DELETE" });
            if (res.ok) {
                alert("All parts cleared successfully!");
                loadParts();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error clearing parts:", err);
        }
    };

    window.filterParts = function() {
        const q = document.getElementById("partSearch").value.toLowerCase();
        const filtered = allParts.filter(p => 
            (p.part_no && p.part_no.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.family && p.family.toLowerCase().includes(q))
        );
        renderParts(filtered);
    };

    document.getElementById("addPartForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            part_no: document.getElementById("partNo").value,
            customer: document.getElementById("partCustomer").value,
            dept: document.getElementById("partDept").value,
            family: document.getElementById("partFamily").value,
            forge_pn: document.getElementById("partForge").value,
            description: document.getElementById("partDesc").value
        };

        try {
            const res = await fetch("/api/parts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal("partModal");
                loadParts();
            }
        } catch (err) {
            console.error("Error adding part:", err);
        }
    });

    // 5. Machines
    let allMachines = [];
    async function loadMachines() {
        try {
            const cached = localStorage.getItem("cached_machines");
            if (cached) {
                try {
                    allMachines = JSON.parse(cached);
                    renderMachines(allMachines);
                } catch(e){}
            }
            const res = await fetch("/api/machines");
            if (res.ok) {
                allMachines = await res.json();
                localStorage.setItem("cached_machines", JSON.stringify(allMachines));
                renderMachines(allMachines);
            }
        } catch (err) {
            console.error("Error loading machines:", err);
        }
    }

    function renderMachines(data) {
        const tbody = document.getElementById("machinesTableBody");
        tbody.innerHTML = "";
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">No machines found</td></tr>`;
            return;
        }

        data.forEach(m => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${m.id}</td>
                <td><strong>${m.name}</strong></td>
                <td>${m.dept}</td>
                <td><span class="badge ${m.status === 'Active' ? 'badge-success' : 'badge-warning'}">${m.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteMachine(${m.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.filterMachines = function() {
        const q = document.getElementById("machineSearch").value.toLowerCase();
        const filtered = allMachines.filter(m => 
            (m.name && m.name.toLowerCase().includes(q)) ||
            (m.dept && m.dept.toLowerCase().includes(q))
        );
        renderMachines(filtered);
    };

    document.getElementById("addMachineForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById("machineName").value,
            dept: document.getElementById("machineDept").value,
            status: "Active"
        };
        try {
            const res = await fetch("/api/machines", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal("machineModal");
                loadMachines();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error adding machine:", err);
        }
    });

    window.deleteMachine = async function(id) {
        if (!confirm("Delete machine?")) return;
        try {
            const res = await fetch(`/api/machines/${id}`, { method: "DELETE" });
            if (res.ok) loadMachines();
        } catch (err) {
            console.error("Error deleting machine:", err);
        }
    };

    window.clearAllMachines = async function() {
        if (!confirm("Are you sure you want to clear ALL machines? This action cannot be undone.")) return;
        try {
            const res = await fetch("/api/machines/clear-all", { method: "DELETE" });
            if (res.ok) {
                alert("All machines cleared successfully!");
                localStorage.removeItem("cached_machines");
                loadMachines();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error clearing machines:", err);
        }
    };

    window.triggerMachineExcelImport = function() {
        document.getElementById("machineExcelInput").click();
    };

    window.handleMachineExcelUpload = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/machines/import-excel", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || "Excel file imported successfully!");
                loadMachines();
                loadDropdowns();
            } else {
                const errData = await res.json();
                alert("Import failed: " + (errData.detail || "Unknown error"));
            }
        } catch (err) {
            console.error("Error importing Excel:", err);
            alert("Error uploading file: " + err.message);
        } finally {
            event.target.value = "";
        }
    };

    // 6. Operators
    let allOperators = [];
    async function loadOperators() {
        try {
            const cached = localStorage.getItem("cached_operators");
            if (cached) {
                try {
                    allOperators = JSON.parse(cached);
                    renderOperators(allOperators);
                } catch(e){}
            }
            const res = await fetch("/api/operators");
            if (res.ok) {
                allOperators = await res.json();
                localStorage.setItem("cached_operators", JSON.stringify(allOperators));
                renderOperators(allOperators);
            }
        } catch (err) {
            console.error("Error loading operators:", err);
        }
    }

    function renderOperators(data) {
        const tbody = document.getElementById("operatorsTableBody");
        tbody.innerHTML = "";
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">No operators found</td></tr>`;
            return;
        }

        data.forEach(o => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${o.id}</td>
                <td><strong>${o.name}</strong></td>
                <td>${o.dept}</td>
                <td>${o.designation}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteOperator(${o.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.filterOperators = function() {
        const q = document.getElementById("operatorSearch").value.toLowerCase();
        const filtered = allOperators.filter(o => 
            (o.name && o.name.toLowerCase().includes(q)) ||
            (o.dept && o.dept.toLowerCase().includes(q))
        );
        renderOperators(filtered);
    };

    document.getElementById("addOperatorForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById("operatorName").value,
            dept: document.getElementById("operatorDept").value,
            designation: document.getElementById("operatorDesig").value
        };
        try {
            const res = await fetch("/api/operators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal("operatorModal");
                loadOperators();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error adding operator:", err);
        }
    });

    window.deleteOperator = async function(id) {
        if (!confirm("Delete operator?")) return;
        try {
            const res = await fetch(`/api/operators/${id}`, { method: "DELETE" });
            if (res.ok) loadOperators();
        } catch (err) {
            console.error("Error deleting operator:", err);
        }
    };

    window.clearAllOperators = async function() {
        if (!confirm("Are you sure you want to clear ALL operators? This action cannot be undone.")) return;
        try {
            const res = await fetch("/api/operators/clear-all", { method: "DELETE" });
            if (res.ok) {
                alert("All operators cleared successfully!");
                loadOperators();
                loadDropdowns();
            }
        } catch (err) {
            console.error("Error clearing operators:", err);
        }
    };

    window.triggerOperatorExcelImport = function() {
        document.getElementById("operatorExcelInput").click();
    };

    window.handleOperatorExcelUpload = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/operators/import-excel", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || "Excel file imported successfully!");
                loadOperators();
                loadDropdowns();
            } else {
                const errData = await res.json();
                alert("Import failed: " + (errData.detail || "Unknown error"));
            }
        } catch (err) {
            console.error("Error importing Excel:", err);
            alert("Error uploading file: " + err.message);
        } finally {
            event.target.value = "";
        }
    };

    // 7. Tooling
    let allTooling = [];
    async function loadTooling() {
        try {
            const res = await fetch("/api/tooling");
            allTooling = await res.json();
            renderTooling(allTooling);
        } catch (err) {
            console.error("Error loading tooling:", err);
        }
    }

    function renderTooling(data) {
        const tbody = document.getElementById("toolingTableBody");
        tbody.innerHTML = "";
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No tooling specs found</td></tr>`;
            return;
        }

        data.forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${t.id}</td>
                <td><strong>${t.insert_spec}</strong></td>
                <td>${t.no_of_edges}</td>
                <td>${t.current_usage}</td>
                <td>${t.max_life}</td>
                <td><span class="badge badge-success">${t.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteTooling(${t.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.deleteTooling = async function(id) {
        if (!confirm("Delete tooling item?")) return;
        try {
            const res = await fetch(`/api/tooling/${id}`, { method: "DELETE" });
            if (res.ok) loadTooling();
        } catch (err) {
            console.error("Error deleting tooling:", err);
        }
    };

    window.clearAllTooling = async function() {
        if (!confirm("Are you sure you want to clear ALL tooling items? This action cannot be undone.")) return;
        try {
            const res = await fetch("/api/tooling/clear-all", { method: "DELETE" });
            if (res.ok) {
                alert("All tooling items cleared successfully!");
                loadTooling();
            }
        } catch (err) {
            console.error("Error clearing tooling:", err);
        }
    };

    window.filterTooling = function() {
        const q = document.getElementById("toolingSearch").value.toLowerCase();
        const filtered = allTooling.filter(t => t.insert_spec && t.insert_spec.toLowerCase().includes(q));
        renderTooling(filtered);
    };

    document.getElementById("addToolingForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            insert_spec: document.getElementById("toolSpec").value,
            no_of_edges: parseInt(document.getElementById("toolEdges").value) || 1,
            max_life: parseInt(document.getElementById("toolMaxLife").value) || 1000,
            current_usage: 0,
            status: "Good"
        };
        try {
            const res = await fetch("/api/tooling", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeModal("toolingModal");
                loadTooling();
            }
        } catch (err) {
            console.error("Error adding tooling:", err);
        }
    });

    // --- Quality Inspection Report Modal Functions ---
    window.currentInspectionPartNo = "";
    window.currentInspectionOpnNo = "";
    window.currentInspectionParams = [];
    window.currentInspectionReport = null;

    window.openPartInspectionModal = async function(partNo) {
        window.currentInspectionPartNo = partNo;
        const part = allParts.find(p => p.part_no.toUpperCase() === partNo.toUpperCase());
        
        let opList = [];
        if (part && part.operations && part.operations.length > 0) {
            const sortedOps = part.operations.slice().sort((a, b) => {
                const numA = parseFloat((String(a.opn_no).match(/\d+/) || [0])[0]);
                const numB = parseFloat((String(b.opn_no).match(/\d+/) || [0])[0]);
                return numA - numB;
            });
            opList = sortedOps.map(op => {
                const m = String(op.opn_no).match(/\d+/);
                return m ? m[0] : String(op.opn_no).trim();
            });
        } else {
            opList = ["20", "30", "40"];
        }

        const tabsContainer = document.getElementById("inspectionOpnTabs");
        if (tabsContainer) {
            tabsContainer.innerHTML = opList.map((op, idx) => `
                <button type="button" class="role-tab ${idx === 0 ? 'active' : ''}" onclick="switchInspectionOpnTab('${partNo}', '${op}', this)">
                    <i class="fa-solid fa-clipboard-check"></i> Opn ${op} Inspection
                </button>
            `).join("");
        }

        window.currentInspectionOpnNo = opList[0] || "20";
        openModal("partInspectionModal");
        await loadInspectionReportForOpn(partNo, window.currentInspectionOpnNo);
    };

    window.switchInspectionOpnTab = async function(partNo, opnNo, btnElem) {
        window.currentInspectionOpnNo = opnNo;
        const tabs = document.querySelectorAll("#inspectionOpnTabs .role-tab");
        tabs.forEach(t => t.classList.remove("active"));
        if (btnElem) btnElem.classList.add("active");
        await loadInspectionReportForOpn(partNo, opnNo);
    };

    window.loadInspectionReportForOpn = async function(partNo, opnNo) {
        const title = document.getElementById("inspectionModalTitle");
        const body = document.getElementById("inspectionModalBody");
        if (title) {
            title.innerHTML = `<i class="fa-solid fa-clipboard-check" style="color: var(--primary);"></i> Quality Inspection Report — Part <span style="color:var(--primary-dark);">${partNo}</span> (Opn ${opnNo})`;
        }
        if (!body) return;
        body.innerHTML = `<div class="text-center" style="padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading inspection data...</div>`;

        try {
            const [pRes, rRes] = await Promise.all([
                fetch(`/api/inspection-parameters?part_no=${encodeURIComponent(partNo)}&opn_no=${encodeURIComponent(opnNo)}`),
                fetch(`/api/inspection-reports?part_no=${encodeURIComponent(partNo)}&opn_no=${encodeURIComponent(opnNo)}`)
            ]);

            window.currentInspectionParams = await pRes.json();
            window.currentInspectionReport = await rRes.json();

            renderInspectionReportMatrix();
        } catch (err) {
            console.error("Error loading inspection report:", err);
            if (body) body.innerHTML = `<div class="alert alert-danger">Error loading inspection report.</div>`;
        }
    };

    window.renderInspectionReportMatrix = function() {
        const body = document.getElementById("inspectionModalBody");
        if (!body) return;

        const report = window.currentInspectionReport || {};
        const params = window.currentInspectionParams || [];

        const compSlNos = (report.comp_sl_nos || "1,2,3,4,5").split(",").map(s => s.trim());
        while (compSlNos.length < 5) {
            compSlNos.push(String(compSlNos.length + 1));
        }

        let readings = {};
        try {
            readings = JSON.parse(report.readings_json || "{}");
        } catch (e) {
            readings = {};
        }

        let html = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 4px; font-size: 0.75rem;">
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Date</label>
                    <input type="date" id="inspDate" value="${report.inspection_date || new Date().toISOString().split('T')[0]}" class="form-control" style="padding: 1px 3px; font-size: 0.75rem;">
                </div>
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Part No</label>
                    <input type="text" id="inspPartNo" value="${window.currentInspectionPartNo}" class="form-control" style="padding: 1px 3px; font-size: 0.75rem; font-weight: 700;">
                </div>
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Opn No</label>
                    <input type="text" id="inspOpnNo" value="${window.currentInspectionOpnNo}" class="form-control" style="padding: 1px 3px; font-size: 0.75rem; font-weight: 700;">
                </div>
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Batch Qty</label>
                    <input type="number" id="inspBatchQty" value="${report.batch_qty || 1}" class="form-control" style="padding: 1px 3px; font-size: 0.75rem;">
                </div>
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Machine</label>
                    <input type="text" id="inspMachine" value="${report.machine_name || ''}" placeholder="e.g. AMS" class="form-control" style="padding: 1px 3px; font-size: 0.75rem;">
                </div>
                <div>
                    <label style="font-weight:700; color:#475569; font-size:0.7rem;">Operator</label>
                    <input type="text" id="inspOperator" value="${report.operator_name || ''}" placeholder="e.g. ABHISHEK" class="form-control" style="padding: 1px 3px; font-size: 0.75rem;">
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <h4 style="font-size: 0.82rem; font-weight: 700; margin: 0;"><i class="fa-solid fa-sliders"></i> Parameters & Measurement Reading</h4>
                <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 0.75rem;" onclick="addInspectionParamRow()">
                    <i class="fa-solid fa-plus"></i> Add Row
                </button>
            </div>

            <div class="table-responsive" style="overflow-x: hidden; width: 100%; border: 1px solid #cbd5e1; border-radius: 6px;">
                <table class="data-table" id="inspectionMatrixTable" style="font-size: 0.75rem; border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="width: 30%; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Desc</th>
                            <th style="width: 16%; text-align: right; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Nom</th>
                            <th style="width: 13%; text-align: right; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">Lo</th>
                            <th style="width: 13%; text-align: right; border-bottom: 2px solid #cbd5e1; border-right: 2px solid #cbd5e1; padding: 4px 2px;">Hi</th>
                            <th style="width: 22%; text-align: center; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;">
                                Reading<br>
                                <input type="text" class="insp-comp-sl" data-col="0" value="${compSlNos[0] || '1'}" placeholder="Sl No" inputmode="decimal" style="width: 90%; max-width: 58px; text-align: center; font-size: 0.72rem; font-weight: 700; padding: 1px 2px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 2px; background: #ffffff;">
                            </th>
                            <th style="width: 6%; border-bottom: 2px solid #cbd5e1; padding: 4px 2px;"></th>
                        </tr>
                    </thead>
                    <tbody id="inspectionMatrixBody">
        `;

        if (params.length === 0) {
            html += `<tr><td colspan="6" class="text-center" style="padding: 15px;">No inspection parameters defined. Click '+ Add Row' to add.</td></tr>`;
        } else {
            params.forEach((p, pIdx) => {
                const paramReadings = readings[p.id] || readings[`temp_${pIdx + 1}`] || {};
                const nom = parseFloat(p.nominal_dimension || 0);
                const lo = parseFloat(p.lo_tol || 0);
                const hi = parseFloat(p.hi_tol || 0);
                const minVal = nom - lo;
                const maxVal = nom + hi;

                const valStr = paramReadings[`col_0`] !== undefined ? paramReadings[`col_0`] : (paramReadings[`col_1`] || '');
                let cellBg = '#ffffff';
                let cellColor = '#000000';
                if (valStr !== '' && !isNaN(valStr)) {
                    const v = parseFloat(valStr);
                    if (v >= minVal && v <= maxVal) {
                        cellBg = '#d1fae5';
                        cellColor = '#065f46';
                    } else {
                        cellBg = '#fee2e2';
                        cellColor = '#991b1b';
                    }
                }

                html += `
                    <tr data-param-id="${p.id || ''}">
                        <td style="width: 30%; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                            <input type="text" class="param-desc form-control" value="${p.description || ''}" style="width: 95%; padding: 2px 2px; font-size: 0.72rem;">
                        </td>
                        <td style="width: 16%; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                            <input type="number" step="0.001" inputmode="decimal" class="param-nom form-control" value="${nom}" onchange="recalculateToleranceColors()" style="width: 92%; padding: 2px 1px; font-size: 0.72rem; text-align: right;">
                        </td>
                        <td style="width: 13%; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                            <input type="number" step="0.001" inputmode="decimal" class="param-lo form-control" value="${lo}" onchange="recalculateToleranceColors()" style="width: 92%; padding: 2px 1px; font-size: 0.72rem; text-align: right;">
                        </td>
                        <td style="width: 13%; padding: 2px; border-bottom: 1px solid #e2e8f0; border-right: 2px solid #cbd5e1;">
                            <input type="number" step="0.001" inputmode="decimal" class="param-hi form-control" value="${hi}" onchange="recalculateToleranceColors()" style="width: 92%; padding: 2px 1px; font-size: 0.72rem; text-align: right;">
                        </td>
                        <td style="width: 22%; padding: 2px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <input type="number" step="0.001" inputmode="decimal" class="insp-reading form-control" data-col="0" value="${valStr}" oninput="validateReadingCell(this)" style="width: 90%; max-width: 58px; padding: 2px 2px; font-size: 0.75rem; text-align: center; background-color: ${cellBg}; color: ${cellColor}; font-weight: 700;">
                        </td>
                        <td style="width: 6%; text-align: center; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                            <button type="button" class="btn btn-sm btn-danger" style="padding: 1px 3px; font-size: 0.68rem;" onclick="removeInspectionParamRow(this)">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                <div style="font-size: 0.72rem; color: #64748b;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 2px; vertical-align: middle; margin-right: 3px;"></span> In Spec
                    <span style="display: inline-block; width: 10px; height: 10px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 2px; vertical-align: middle; margin-left: 8px; margin-right: 3px;"></span> Out Spec
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('partInspectionModal')">Close</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="saveInspectionReportData()">
                        <i class="fa-solid fa-floppy-disk"></i> Save Report
                    </button>
                </div>
            </div>
        `;

        body.innerHTML = html;
    };

    window.validateReadingCell = function(inputElem) {
        const tr = inputElem.closest("tr");
        if (!tr) return;

        const nom = parseFloat(tr.querySelector(".param-nom")?.value || 0);
        const lo = parseFloat(tr.querySelector(".param-lo")?.value || 0);
        const hi = parseFloat(tr.querySelector(".param-hi")?.value || 0);
        const minVal = nom - lo;
        const maxVal = nom + hi;

        const valStr = inputElem.value.trim();
        if (valStr !== '' && !isNaN(valStr)) {
            const v = parseFloat(valStr);
            if (v >= minVal && v <= maxVal) {
                inputElem.style.backgroundColor = '#d1fae5';
                inputElem.style.color = '#065f46';
            } else {
                inputElem.style.backgroundColor = '#fee2e2';
                inputElem.style.color = '#991b1b';
            }
        } else {
            inputElem.style.backgroundColor = '#ffffff';
            inputElem.style.color = '#000000';
        }
    };

    window.recalculateToleranceColors = function() {
        const rows = document.querySelectorAll("#inspectionMatrixBody tr");
        rows.forEach(tr => {
            const inputs = tr.querySelectorAll(".insp-reading");
            inputs.forEach(inp => validateReadingCell(inp));
        });
    };

    window.addInspectionParamRow = function() {
        const tbody = document.getElementById("inspectionMatrixBody");
        if (!tbody) return;

        const rows = tbody.querySelectorAll("tr");
        const idx = rows.length + 1;

        const tr = document.createElement("tr");
        tr.setAttribute("data-param-id", "");

        let html = `
            <td style="position: sticky; left: 0px; z-index: 2; background: #ffffff; width: 105px; min-width: 105px; max-width: 105px; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                <input type="text" class="param-desc form-control" placeholder="Desc" style="width: 101px; padding: 2px 4px; font-size: 0.78rem;">
            </td>
            <td style="position: sticky; left: 105px; z-index: 2; background: #ffffff; width: 60px; min-width: 60px; max-width: 60px; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                <input type="number" step="0.001" class="param-nom form-control" value="0.0" onchange="recalculateToleranceColors()" style="width: 56px; padding: 2px 2px; font-size: 0.78rem; text-align: right;">
            </td>
            <td style="position: sticky; left: 165px; z-index: 2; background: #ffffff; width: 50px; min-width: 50px; max-width: 50px; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                <input type="number" step="0.001" class="param-lo form-control" value="0.0" onchange="recalculateToleranceColors()" style="width: 46px; padding: 2px 2px; font-size: 0.78rem; text-align: right;">
            </td>
            <td style="position: sticky; left: 215px; z-index: 2; background: #ffffff; width: 50px; min-width: 50px; max-width: 50px; padding: 2px; border-bottom: 1px solid #e2e8f0; border-right: 2px solid #cbd5e1; box-shadow: 3px 0 5px rgba(0,0,0,0.06);">
                <input type="number" step="0.001" class="param-hi form-control" value="0.0" onchange="recalculateToleranceColors()" style="width: 46px; padding: 2px 2px; font-size: 0.78rem; text-align: right;">
            </td>
        `;

        for (let col = 0; col < 5; col++) {
            html += `<td style="padding: 2px; text-align: center; border-bottom: 1px solid #e2e8f0; width: 62px; min-width: 62px;"><input type="number" step="0.001" class="insp-reading form-control" data-col="${col}" value="" oninput="validateReadingCell(this)" style="width: 58px; padding: 2px 2px; font-size: 0.78rem; text-align: center; background-color: #ffffff; color: #000000; font-weight: 600;"></td>`;
        }

        html += `
            <td style="text-align: center; padding: 2px; border-bottom: 1px solid #e2e8f0;">
                <button type="button" class="btn btn-sm btn-danger" style="padding: 1px 4px; font-size: 0.7rem;" onclick="removeInspectionParamRow(this)">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        `;

        tr.innerHTML = html;
        tbody.appendChild(tr);
    };

    window.removeInspectionParamRow = function(btnElem) {
        const tr = btnElem.closest("tr");
        if (tr) tr.remove();
        reindexParamRows();
    };

    function reindexParamRows() {
        const rows = document.querySelectorAll("#inspectionMatrixBody tr");
        rows.forEach((tr, i) => {
            const td = tr.querySelector("td");
            if (td) td.innerText = i + 1;
        });
    }

    window.saveInspectionReportData = async function() {
        const partNo = document.getElementById("inspPartNo")?.value.trim() || window.currentInspectionPartNo;
        const opnNo = document.getElementById("inspOpnNo")?.value.trim() || window.currentInspectionOpnNo;
        const batchQty = parseInt(document.getElementById("inspBatchQty")?.value || 10);
        const machine = document.getElementById("inspMachine")?.value.trim() || "";
        const operator = document.getElementById("inspOperator")?.value.trim() || "";
        const inspDate = document.getElementById("inspDate")?.value || "";

        // Collect Component Sl Nos
        const compInputs = document.querySelectorAll(".insp-comp-sl");
        const compSlList = [];
        compInputs.forEach(i => compSlList.push(i.value.trim()));
        const compSlNosStr = compSlList.join(",");

        // Collect Parameters
        const rows = document.querySelectorAll("#inspectionMatrixBody tr");
        const paramPayloadList = [];
        const readingsObj = {};

        rows.forEach((tr, pIdx) => {
            const desc = tr.querySelector(".param-desc")?.value.trim() || "";
            const nom = parseFloat(tr.querySelector(".param-nom")?.value || 0);
            const lo = parseFloat(tr.querySelector(".param-lo")?.value || 0);
            const hi = parseFloat(tr.querySelector(".param-hi")?.value || 0);

            if (desc) {
                paramPayloadList.push({
                    part_no: partNo,
                    opn_no: opnNo,
                    sl_no: pIdx + 1,
                    description: desc,
                    nominal_dimension: nom,
                    lo_tol: lo,
                    hi_tol: hi
                });

                const pId = tr.getAttribute("data-param-id") || `temp_${pIdx + 1}`;
                const rowReadings = {};
                const readingInputs = tr.querySelectorAll(".insp-reading");
                readingInputs.forEach(inp => {
                    const col = inp.getAttribute("data-col");
                    rowReadings[`col_${col}`] = inp.value;
                });
                readingsObj[pId] = rowReadings;
            }
        });

        try {
            // Save parameters first
            if (paramPayloadList.length > 0) {
                await fetch("/api/inspection-parameters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(paramPayloadList)
                });
            }

            // Save report metadata & readings
            const reportPayload = {
                part_no: partNo,
                opn_no: opnNo,
                batch_qty: batchQty,
                machine_name: machine,
                operator_name: operator,
                inspection_date: inspDate,
                comp_sl_nos: compSlNosStr,
                readings_json: JSON.stringify(readingsObj)
            };

            const res = await fetch("/api/inspection-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reportPayload)
            });

            if (res.ok) {
                alert(`Inspection Report for Part ${partNo} (Opn ${opnNo}) saved successfully!`);
                await loadInspectionReportForOpn(partNo, opnNo);
            } else {
                alert("Failed to save Inspection Report.");
            }
        } catch (err) {
            console.error("Error saving inspection report:", err);
            alert("Error saving inspection report.");
        }
    };

    // Excel Export Helpers
    window.exportProductionLogsExcel = function() {
        window.location.href = "/api/export/production-logs/excel";
    };

    window.exportInspectionLogsExcel = function() {
        window.location.href = "/api/export/inspection-reports/excel";
    };

    // Bind Data Loaders to window
    window.loadDashboardStats = loadDashboardStats;
    window.loadProdLogPageData = loadProdLogPageData;
    window.loadSchedules = loadSchedules;
    window.loadParts = loadParts;
    window.loadMachines = loadMachines;
    window.loadOperators = loadOperators;
    window.loadTooling = loadTooling;

    // Modal Helpers
    window.openModal = function(id) {
        document.getElementById(id).classList.add("active");
    };

    window.closeModal = function(id) {
        document.getElementById(id).classList.remove("active");
    };
});
