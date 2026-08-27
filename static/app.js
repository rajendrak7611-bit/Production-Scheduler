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

    window.switchTab = function(tabName) {
        navItems.forEach(item => {
            if (item.dataset.tab === tabName) {
                item.classList.add("active");
                tabTitle.innerText = item.innerText.trim();
            } else {
                item.classList.remove("active");
            }
        });

        tabScreens.forEach(screen => {
            if (screen.id === `screen-${tabName}`) {
                screen.classList.add("active");
            } else {
                screen.classList.remove("active");
            }
        });

        // Trigger data reload for specific tabs
        if (tabName === "dashboard") loadDashboardStats();
        if (tabName === "prodlog") loadProdLogPageData();
        if (tabName === "schedules") loadSchedules();
        if (tabName === "parts") loadParts();
        if (tabName === "machines") loadMachines();
        if (tabName === "operators") loadOperators();
        if (tabName === "tooling") loadTooling();
    };

    navItems.forEach(item => {
        item.addEventListener("click", () => switchTab(item.dataset.tab));
    });

    // Initial Loads
    loadDashboardStats();
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
        const partNo = pElem ? pElem.value : "";
        if (!partNo || !allSchedules) return 60;
        const sch = allSchedules.find(s => s.part_no && s.part_no.toUpperCase() === partNo.toUpperCase());
        return (sch && sch.sch_qty > 0) ? sch.sch_qty : 60;
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
    let isFirstOperation = true;
    let previousOpnNo = null;

    async function fetchCompletedSlNos() {
        const pElem = document.getElementById("logPart");
        const opnElem = document.getElementById("logOpnNo");
        const partNo = pElem ? pElem.value.trim() : "";
        const opnNo = opnElem ? opnElem.value.trim() : "";

        selectedSlNos.clear();
        alreadyCompletedSlNos.clear();
        prevCompletedSlNos.clear();
        
        const cleanOpnNum = parseFloat((opnNo.match(/\d+/) || [10])[0]);
        isFirstOperation = (cleanOpnNum <= 10);
        previousOpnNo = (cleanOpnNum > 10) ? strCleanOpn(cleanOpnNum - 10) : null;

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
                isFirstOperation = data.is_first_opn !== false;
                previousOpnNo = data.prev_opn_no || previousOpnNo;
            }
        } catch (err) {
            console.error("Error fetching completed Sl Nos:", err);
        }

        renderOperatorGrid();
    }

    function strCleanOpn(num) {
        return (typeof num === 'number' && Number.isInteger(num)) ? String(num) : String(num);
    }

    function renderOperatorGrid() {
        const maxGrid = getCurrentScheduleQty();
        const grid = document.getElementById("operatorNumberGrid");
        if (!grid) return;
        grid.innerHTML = "";

        const opnElem = document.getElementById("logOpnNo");
        const currentOpnNo = opnElem ? opnElem.value : "";

        const legendPrev = document.getElementById("legendPrevOpn");
        if (legendPrev) {
            legendPrev.style.display = (!currentOpnNo || isFirstOperation) ? "none" : "inline-flex";
        }

        for (let i = 1; i <= maxGrid; i++) {
            const cell = document.createElement("div");

            if (!currentOpnNo) {
                // No operation selected yet: Lock all grid cells
                cell.className = `grid-cell disabled`;
                cell.innerText = i;
                cell.title = `Sl No ${i} (Locked - Select an Operation No first)`;
                cell.onclick = () => {
                    alert("Please select an Operation No before selecting serial numbers!");
                };
            } else if (isFirstOperation) {
                // First Operation (e.g. Opn 20 for H44): Random selection allowed
                const isSelectedNow = selectedSlNos.has(i);
                const isAlreadyDone = alreadyCompletedSlNos.has(i);
                const isGreen = isSelectedNow || isAlreadyDone;

                cell.className = `grid-cell ${isGreen ? 'done' : 'pending'}`;
                cell.innerText = i;
                cell.title = `Sl No ${i} ${isGreen ? '(Selected - Light Green)' : '(Click to pick)'}`;

                cell.onclick = () => {
                    if (selectedSlNos.has(i)) {
                        selectedSlNos.delete(i);
                    } else {
                        selectedSlNos.add(i);
                    }
                    renderOperatorGrid();
                };
            } else {
                // Subsequent Operation (e.g. Opn 30 for H44): Must be completed in previous operation (Light Blue)
                const isSelectedNow = selectedSlNos.has(i);
                const isAlreadyDone = alreadyCompletedSlNos.has(i);
                const isPrevDone = prevCompletedSlNos.has(i);
                const isGreen = isSelectedNow || isAlreadyDone;

                if (isPrevDone) {
                    // Completed in Opn 20 -> Light Blue, turns Light Green on selection
                    cell.className = `grid-cell ${isGreen ? 'done' : 'prev-done'}`;
                    cell.innerText = i;
                    cell.title = `Sl No ${i} ${isGreen ? '(Selected - Light Green)' : '(Completed in Opn ' + (previousOpnNo || 'Prev') + ' - Light Blue - Click to pick)'}`;

                    cell.onclick = () => {
                        if (selectedSlNos.has(i)) {
                            selectedSlNos.delete(i);
                        } else {
                            selectedSlNos.add(i);
                        }
                        renderOperatorGrid();
                    };
                } else {
                    // Locked / Disabled because previous operation (Opn 20) is NOT completed
                    cell.className = `grid-cell disabled`;
                    cell.innerText = i;
                    cell.title = `Sl No ${i} (Locked - Operation Opn ${previousOpnNo || ''} not completed yet)`;

                    cell.onclick = () => {
                        alert(`Sl No ${i} cannot be selected because previous Operation (Opn ${previousOpnNo || ''}) is not completed yet!`);
                    };
                }
            }
            grid.appendChild(cell);
        }

        syncSlNosWithForm(maxGrid);
    }

    function syncSlNosWithForm(maxGrid = 60) {
        const totalSelected = new Set([...selectedSlNos, ...alreadyCompletedSlNos]);
        const sortedList = Array.from(selectedSlNos).sort((a, b) => a - b);
        
        // Auto update Qty Produced input field to count of newly selected Sl Nos
        document.getElementById("logQtyProduced").value = selectedSlNos.size;

        // Displays
        const countDisplay = document.getElementById("gridCountDisplay");
        const totalBadge = document.getElementById("chartTotalBadge");
        const progressFill = document.getElementById("gridProgressFill");
        const listText = document.getElementById("completedSlNoListText");

        if (countDisplay) countDisplay.innerText = `${totalSelected.size} / ${maxGrid} Sl Nos`;
        if (totalBadge) totalBadge.innerText = `Completed: ${totalSelected.size} Sl Nos`;
        if (progressFill) {
            const pct = Math.min(100, Math.round((totalSelected.size / maxGrid) * 100));
            progressFill.style.width = `${pct}%`;
        }
        if (listText) {
            listText.innerText = sortedList.length > 0 ? sortedList.join(", ") : "None selected";
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

    // Event listeners to sync dropdowns with Serial Number Grid
    const logOpInput = document.getElementById("logOperator");
    if (logOpInput) {
        const updateOpBadge = (val) => {
            const opName = val || "None";
            const badge = document.getElementById("chartOperatorBadge");
            if (badge) badge.innerText = `Operator: ${opName}`;
        };
        logOpInput.addEventListener("input", (e) => updateOpBadge(e.target.value));
        logOpInput.addEventListener("change", (e) => updateOpBadge(e.target.value));
    }

    function resetLoggerForm() {
        lastSelectedPartNo = "";
        const mInput = document.getElementById("logMachine");
        const oInput = document.getElementById("logOperator");
        const pInput = document.getElementById("logPart");
        const opnSelect = document.getElementById("logOpnNo");
        const qtyInput = document.getElementById("logQtyProduced");
        const scrapInput = document.getElementById("logScrapQty");

        if (mInput) mInput.value = "";
        if (oInput) oInput.value = "";
        if (pInput) pInput.value = "";
        if (opnSelect) opnSelect.innerHTML = `<option value="">Select Operation...</option>`;
        if (qtyInput) qtyInput.value = "0";
        if (scrapInput) scrapInput.value = "0";

        selectedSlNos.clear();
        alreadyCompletedSlNos.clear();
        prevCompletedSlNos.clear();
        isFirstOperation = true;
        previousOpnNo = null;

        const badge = document.getElementById("chartOperatorBadge");
        if (badge) badge.innerText = "Operator: None";

        renderOperatorGrid();
    }

    async function loadProdLogPageData() {
        resetLoggerForm();
        await loadDropdowns();
    }

    // Submit Log Form
    document.getElementById("prodLogForm").addEventListener("submit", async (e) => {
        e.preventDefault();
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
                alert(`Saved record! Sl Nos completed: ${completedSlNosStr || 'None'}`);
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
            tbody.innerHTML = `<tr><td colspan="3" class="text-center">No parts found</td></tr>`;
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

    // Modal Helpers
    window.openModal = function(id) {
        document.getElementById(id).classList.add("active");
    };

    window.closeModal = function(id) {
        document.getElementById(id).classList.remove("active");
    };
});
