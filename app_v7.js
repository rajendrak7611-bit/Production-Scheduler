/* ============================================================
   PRODUCTION SCHEDULER — APPLICATION LOGIC
   Manual entry for Machines, Parts, Operations (Cycle + Setup)
   ============================================================ */

// ==================== CONSTANTS ====================
const BASE_PX_PER_HOUR = 70;
const STORAGE_KEY = 'prodSchedulerData';

// ==================== STATE ====================
const state = {
    machines: [],
    parts: [],
    opsPerPart: 5,
    schedule: null,
    selectedPart: null,
    zoomLevel: 1,
    algorithm: 'balanced',
    isScheduled: false,
    expandedParts: new Set(),
    startDate: new Date().toISOString().slice(0, 16),
    editingPartId: null,
    editingMachineId: null,
    formOperations: [],
    productionLogs: [],
    operators: [],
    productionLines: [],
    users: [],
    currentMasterSubTab: 'machines',
    inspectionReports: [],
    editingSpecOpIdx: null,
    activeInspectionReportId: null,
    editingToolOpIdx: null,
};

// ==================== COLOR PALETTE ====================
function getPartColor(index) {
    const hue = (index * 137.508) % 360;
    const sat = 58 + (index % 3) * 8;
    const lit = 48 + (index % 4) * 4;
    return {
        bg: `hsla(${hue}, ${sat}%, ${lit}%, 0.82)`,
        border: `hsl(${hue}, ${sat + 10}%, ${lit + 12}%)`,
        solid: `hsl(${hue}, ${sat}%, ${lit}%)`,
    };
}

// ==================== FORM LOGIC ====================

function openMachineForm(id = null) {
    state.editingMachineId = id;
    const title = document.getElementById('machine-form-title');
    const input = document.getElementById('machine-form-name');
    if (id !== null) {
        title.textContent = 'Edit Machine';
        const machine = state.machines.find(m => m.id === id);
        input.value = machine ? machine.name : '';
    } else {
        title.textContent = 'Add Machine';
        input.value = '';
    }
    switchView('machine-form');
}

function closeMachineForm() {
    state.editingMachineId = null;
    switchView('masters');
}

function saveMachineForm() {
    const name = document.getElementById('machine-form-name').value.trim();
    if (!name) {
        showNotification('⚠️ Machine name cannot be empty', 'error');
        return;
    }
    if (state.editingMachineId !== null) {
        const machine = state.machines.find(m => m.id === state.editingMachineId);
        if (machine) machine.name = name;
    } else {
        const id = state.machines.length > 0 ? Math.max(...state.machines.map(m => m.id)) + 1 : 1;
        state.machines.push({ id, name });
    }
    saveData();
    renderMachineGrid();
    updateCounts();
    updateAllMachineDropdowns();
    closeMachineForm();
}

function openPartForm(id = null, isDbPart = false) {
    state.isEditingDatabasePart = isDbPart;
    state.editingPartId = id;
    const title = document.getElementById('part-form-title');
    const nameInput = document.getElementById('part-form-name');
    const qtyInput = document.getElementById('part-form-qty');
    const priorityInput = document.getElementById('part-form-priority');
    
    if (id !== null) {
        title.textContent = isDbPart ? 'Edit Master Part' : 'Edit Part';
        const sourceArray = isDbPart ? state.partDatabase : state.parts;
        const part = sourceArray.find(p => p.id === id);
        if (part) {
            nameInput.value = part.name;
            qtyInput.value = part.quantity || 1;
            priorityInput.value = part.priority || 5;
            // deep copy operations for editing
            state.formOperations = (part.operations && Array.isArray(part.operations)) 
                ? JSON.parse(JSON.stringify(part.operations)) 
                : [];
        }
    } else {
        title.textContent = isDbPart ? 'Create Master Part' : 'Add Part';
        nameInput.value = '';
        qtyInput.value = 1;
        priorityInput.value = 5;
        state.formOperations = [{
            opIndex: 0,
            priority: 5,
            opName: 'Operation 1',
            machineId: state.machines.length > 0 ? state.machines[0].id : null,
            cycleTime: 0,
            setupTime: 0,
        }];
    }
    renderPartFormOps();
    switchView('part-form');
}

function closePartForm() {
    const isDb = state.isEditingDatabasePart;
    state.editingPartId = null;
    state.isEditingDatabasePart = false;
    state.formOperations = [];
    switchView(isDb ? 'database' : 'parts');
}

function isChecklistItemConfigured(item) {
    if (!item) return false;
    const hasDesc = item.desc && item.desc.trim() !== '';
    const hasDimen = item.dimen !== null && item.dimen !== undefined && !isNaN(item.dimen);
    const hasLoTol = item.loTol !== null && item.loTol !== undefined && !isNaN(item.loTol);
    const hasHiTol = item.hiTol !== null && item.hiTol !== undefined && !isNaN(item.hiTol);
    return hasDesc || hasDimen || hasLoTol || hasHiTol;
}

function isToolSpecItemConfigured(item) {
    if (!item) return false;
    return (item.tool && item.tool.trim() !== '') ||
           (item.holder && item.holder.trim() !== '') ||
           (item.length && item.length.trim() !== '') ||
           (item.insert && item.insert.trim() !== '');
}

// ==================== CHECKLIST SPEC MODAL ====================

function openChecklistSpecModal(opIdx) {
    state.editingSpecOpIdx = opIdx;
    const op = state.formOperations[opIdx];
    if (!op) return;

    if (!op.inspectionChecklist || !Array.isArray(op.inspectionChecklist)) {
        op.inspectionChecklist = [];
    }
    
    const list = [];
    for (let i = 0; i < 10; i++) {
        const item = op.inspectionChecklist[i] || { desc: '', dimen: '', loTol: '', hiTol: '' };
        list.push(item);
    }
    op.inspectionChecklist = list;

    const tbody = document.getElementById('spec-modal-tbody');
    tbody.innerHTML = list.map((item, idx) => `
        <tr>
            <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
            <td>
                <input type="text" class="input spec-desc-input" value="${escapeHtml(item.desc || '')}" placeholder="e.g. Length" style="font-size: 0.8rem; height: 32px;">
            </td>
            <td>
                <input type="number" step="0.001" class="input spec-dimen-input" value="${item.dimen !== undefined && item.dimen !== null ? item.dimen : ''}" placeholder="0.00" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
            <td>
                <input type="number" step="0.001" class="input spec-loTol-input" value="${item.loTol !== undefined && item.loTol !== null ? item.loTol : ''}" placeholder="-0.00" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
            <td>
                <input type="number" step="0.001" class="input spec-hiTol-input" value="${item.hiTol !== undefined && item.hiTol !== null ? item.hiTol : ''}" placeholder="+0.00" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
        </tr>
    `).join('');

    document.getElementById('spec-modal').classList.add('active');
}

function closeChecklistSpecModal() {
    state.editingSpecOpIdx = null;
    document.getElementById('spec-modal').classList.remove('active');
}

function saveChecklistSpecModal() {
    const opIdx = state.editingSpecOpIdx;
    if (opIdx === null || opIdx === undefined) return;
    const op = state.formOperations[opIdx];
    if (!op) return;

    const list = [];
    const rows = document.querySelectorAll('#spec-modal-tbody tr');
    rows.forEach(tr => {
        const desc = tr.querySelector('.spec-desc-input').value.trim();
        const dimenVal = tr.querySelector('.spec-dimen-input').value;
        const loTolVal = tr.querySelector('.spec-loTol-input').value;
        const hiTolVal = tr.querySelector('.spec-hiTol-input').value;

        const dimen = dimenVal !== '' ? parseFloat(dimenVal) : null;
        const loTol = loTolVal !== '' ? parseFloat(loTolVal) : null;
        const hiTol = hiTolVal !== '' ? parseFloat(hiTolVal) : null;

        list.push({ desc, dimen, loTol, hiTol });
    });

    op.inspectionChecklist = list;
    closeChecklistSpecModal();
    renderPartFormOps();
    showNotification('📋 Specifications saved to operation routing', 'success');
}

function openToolSpecModal(opIdx) {
    state.editingToolOpIdx = opIdx;
    const op = state.formOperations[opIdx];
    if (!op) return;

    document.getElementById('tool-spec-modal-title').textContent = `Configure Tool Specifications - Op ${opIdx + 1}: ${op.opName || 'Unnamed'}`;

    if (!op.toolSpec || !Array.isArray(op.toolSpec)) {
        op.toolSpec = [];
    }

    const list = [];
    for (let i = 0; i < 10; i++) {
        const item = op.toolSpec[i] || { tool: '', holder: '', length: '', insert: '' };
        list.push(item);
    }
    op.toolSpec = list;

    const tbody = document.getElementById('tool-spec-modal-tbody');
    tbody.innerHTML = list.map((item, idx) => `
        <tr>
            <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
            <td>
                <input type="text" class="input tool-name-input" value="${escapeHtml(item.tool || '')}" placeholder="e.g. Roughing Boring Bar" style="font-size: 0.8rem; height: 32px;">
            </td>
            <td>
                <input type="text" class="input tool-holder-input" value="${escapeHtml(item.holder || '')}" placeholder="e.g. BT50-FMA25.4-45" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
            <td>
                <input type="text" class="input tool-length-input" value="${escapeHtml(item.length || '')}" placeholder="e.g. 150 mm" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
            <td>
                <input type="text" class="input tool-insert-input" value="${escapeHtml(item.insert || '')}" placeholder="e.g. WNMG 080408" style="font-size: 0.8rem; height: 32px; text-align: center;">
            </td>
        </tr>
    `).join('');

    document.getElementById('tool-spec-modal').classList.add('active');
}

function closeToolSpecModal() {
    state.editingToolOpIdx = null;
    document.getElementById('tool-spec-modal').classList.remove('active');
}

function saveToolSpecModal() {
    const opIdx = state.editingToolOpIdx;
    if (opIdx === null || opIdx === undefined) return;
    const op = state.formOperations[opIdx];
    if (!op) return;

    const list = [];
    const rows = document.querySelectorAll('#tool-spec-modal-tbody tr');
    rows.forEach(tr => {
        const tool = tr.querySelector('.tool-name-input').value.trim();
        const holder = tr.querySelector('.tool-holder-input').value.trim();
        const length = tr.querySelector('.tool-length-input').value.trim();
        const insert = tr.querySelector('.tool-insert-input').value.trim();
        list.push({ tool, holder, length, insert });
    });

    op.toolSpec = list;
    closeToolSpecModal();
    renderPartFormOps();
    showNotification('🛠️ Tool specifications saved to operation routing', 'success');
}

function syncFormOperationsFromDOM() {
    document.querySelectorAll('#part-form-ops-tbody tr').forEach(tr => {
        const idx = parseInt(tr.dataset.idx);
        const op = state.formOperations[idx];
        if(op) {
            op.priority = parseInt(tr.querySelector('.op-priority-input').value) || 5;
            op.opName = tr.querySelector('.op-name-input').value;
            const mId = tr.querySelector('.op-machine').value;
            op.machineId = mId ? parseInt(mId) : null;
            op.cycleTime = Math.max(0, parseFloat(tr.querySelector('.op-cycle').value) || 0);
            op.setupTime = Math.max(0, parseFloat(tr.querySelector('.op-setup').value) || 0);
        }
    });
}

function savePartForm() {
    const name = document.getElementById('part-form-name').value.trim();
    const qty = parseInt(document.getElementById('part-form-qty').value) || 1;
    const priority = parseInt(document.getElementById('part-form-priority').value) || 5;
    
    if (!name) {
        showNotification('⚠️ Part name cannot be empty', 'error');
        return;
    }
    
    // Read operations from form DOM in case they changed before blur
    syncFormOperationsFromDOM();

    const targetArray = state.isEditingDatabasePart ? state.partDatabase : state.parts;

    if (state.editingPartId !== null) {
        const part = targetArray.find(p => p.id === state.editingPartId);
        if (part) {
            part.name = name;
            part.quantity = qty;
            part.priority = priority;
            part.operations = state.formOperations.map(op => ({
                ...op,
                quantity: op.quantity !== undefined ? op.quantity : qty
            }));
        }
    } else {
        const id = targetArray.length > 0 ? Math.max(...targetArray.map(p => p.id)) + 1 : 1;
        targetArray.push({
            id,
            name,
            quantity: qty,
            priority: priority,
            operations: state.formOperations.map(op => ({
                ...op,
                quantity: qty
            })),
            color: getPartColor(targetArray.length),
        });
    }
    
    saveData();
    closePartForm();
    if (state.isEditingDatabasePart) {
        renderDatabaseList();
    } else {
        renderPartsList();
        renderCompletionSummary();
        updateCounts();
    }
}

function updatePartFormTotals() {
    let totalSetup = 0;
    let totalCycle = 0;
    const qty = parseInt(document.getElementById('part-form-qty').value) || 1;

    document.querySelectorAll('#part-form-ops-tbody tr').forEach(tr => {
        const cycle = Math.max(0, parseFloat(tr.querySelector('.op-cycle').value) || 0);
        const setup = Math.max(0, parseFloat(tr.querySelector('.op-setup').value) || 0);
        
        totalCycle += cycle;
        totalSetup += setup;
        
        const processTime = setup + (cycle * qty);
        
        const totalCell = tr.querySelector('.row-total-cell');
        if (totalCell) totalCell.textContent = `${Number(processTime.toFixed(1))}m`;
    });

    const totalTime = totalSetup + (totalCycle * qty);
    document.getElementById('part-form-total-cycle').textContent = `${Number(totalCycle.toFixed(1))}m`;
    document.getElementById('part-form-total-setup').textContent = `${Number(totalSetup.toFixed(1))}m`;
    document.getElementById('part-form-total-time').textContent = `${Number(totalTime.toFixed(1))}m`;
}

function renderPartFormOps() {
    const tbody = document.getElementById('part-form-ops-tbody');
    let totalSetup = 0;
    let totalCycle = 0;
    const qty = parseInt(document.getElementById('part-form-qty').value) || 1;

    tbody.innerHTML = state.formOperations.map((op, idx) => {
        op.opIndex = idx; // ensure ordered
        totalSetup += op.setupTime || 0;
        totalCycle += op.cycleTime || 0;
        const processTime = (op.setupTime || 0) + ((op.cycleTime || 0) * qty);
        
        return `
            <tr data-idx="${idx}">
                <td class="op-num">Op ${idx + 1}</td>
                <td><input type="number" class="input op-priority-input" value="${op.priority || 5}" min="1" max="10"></td>
                <td><input type="text" class="input op-name-input" value="${escapeHtml(op.opName || '')}"></td>
                <td>
                    <select class="op-machine">
                        <option value="">— Select —</option>
                        ${state.machines.map(m => `<option value="${m.id}" ${op.machineId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="number" step="0.1" class="input-sm time-input op-cycle" min="0" value="${op.cycleTime || 0}">
                    <span class="time-unit">min</span>
                </td>
                <td>
                    <input type="number" step="0.1" class="input-sm time-input op-setup" min="0" value="${op.setupTime || 0}">
                    <span class="time-unit">min</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-ghost btn-configure-specs" data-idx="${idx}" style="color: var(--accent-primary); border: 1px solid var(--border-subtle); padding: 4px 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 0.72rem; height: 30px;">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 4.5h3M4.5 6.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                        <span>${(op.inspectionChecklist && op.inspectionChecklist.some(isChecklistItemConfigured)) ? '📋 Configured' : '📋 Configure'}</span>
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-ghost btn-configure-tools" data-idx="${idx}" style="color: var(--accent-primary); border: 1px solid var(--border-subtle); padding: 4px 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 0.72rem; height: 30px;">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3h6v6H3V3z" stroke="currentColor" stroke-width="1.2"/><path d="M5 2v1M7 2v1M5 9v1M7 9v1M2 5h1M2 7h1M9 5h1M9 7h1" stroke="currentColor" stroke-width="1.2"/></svg>
                        <span>${(op.toolSpec && op.toolSpec.some(isToolSpecItemConfigured)) ? '🛠️ Configured' : '🛠️ Configure'}</span>
                    </button>
                </td>
                <td class="row-total-cell" style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted)">
                    ${Number(processTime.toFixed(1))}m
                </td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-ghost btn-remove-form-op" data-idx="${idx}" style="padding:4px">
                        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    const totalTime = totalSetup + (totalCycle * qty);
    document.getElementById('part-form-total-cycle').textContent = `${Number(totalCycle.toFixed(1))}m`;
    document.getElementById('part-form-total-setup').textContent = `${Number(totalSetup.toFixed(1))}m`;
    document.getElementById('part-form-total-time').textContent = `${Number(totalTime.toFixed(1))}m`;

    // Attach listeners
    tbody.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', () => {
            updatePartFormTotals();
        });
        el.addEventListener('change', () => {
            syncFormOperationsFromDOM();
            updatePartFormTotals();
        });
    });
    tbody.querySelectorAll('.btn-remove-form-op').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.formOperations.length <= 1) return;
            syncFormOperationsFromDOM();
            state.formOperations.splice(parseInt(btn.dataset.idx), 1);
            renderPartFormOps();
        });
    });
    tbody.querySelectorAll('.btn-configure-specs').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = parseInt(btn.dataset.idx);
            syncFormOperationsFromDOM();
            openChecklistSpecModal(idx);
        });
    });
    tbody.querySelectorAll('.btn-configure-tools').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = parseInt(btn.dataset.idx);
            syncFormOperationsFromDOM();
            openToolSpecModal(idx);
        });
    });
}

// ==================== DATA MANAGEMENT ====================

function removeMachine(id) {
    state.machines = state.machines.filter(m => m.id !== id);
    // Remove operations assigned to this machine
    state.parts.forEach(part => {
        part.operations.forEach(op => {
            if (op.machineId === id) op.machineId = null;
        });
    });
    saveData();
    renderMachineGrid();
    renderPartsList();
    updateCounts();
}

function removePart(id) {
    state.parts = state.parts.filter(p => p.id !== id);
    state.expandedParts.delete(id);
    // Recolor remaining parts
    state.parts.forEach((p, i) => { p.color = getPartColor(i); });
    saveData();
    renderPartsList();
    renderCompletionSummary();
    updateCounts();
}

function removeDbPart(id) {
    state.partDatabase = state.partDatabase.filter(p => p.id !== id);
    saveData();
    renderDatabaseList();
}

// ==================== PERSISTENCE ====================

function saveData() {
    try {
        const data = {
            machines: state.machines,
            parts: state.parts,
            partDatabase: state.partDatabase,
            opsPerPart: state.opsPerPart,
            productionLogs: state.productionLogs,
            operators: state.operators,
            productionLines: state.productionLines,
            users: state.users,
            inspectionReports: state.inspectionReports,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage might not be available */ }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        state.machines = data.machines || [];
        state.parts = (data.parts || []).map((p, i) => {
            const part = { ...p, color: getPartColor(i) };
            part.operations = (part.operations || []).map(op => ({
                ...op,
                quantity: op.quantity !== undefined ? op.quantity : part.quantity || 1,
                inspectionSpecs: op.inspectionSpecs || ''
            }));
            return part;
        });
        state.partDatabase = (data.partDatabase || []).map(p => ({
            ...p,
            operations: (p.operations || []).map(op => ({
                ...op,
                inspectionSpecs: op.inspectionSpecs || ''
            }))
        }));
        state.opsPerPart = data.opsPerPart || 5;
        state.productionLogs = data.productionLogs || [];
        state.operators = data.operators || [];
        state.productionLines = data.productionLines || [];
        state.users = data.users || [];
        state.inspectionReports = data.inspectionReports || [];
        return state.machines.length > 0 || state.parts.length > 0 || state.partDatabase.length > 0 || state.productionLogs.length > 0 || state.operators.length > 0 || state.productionLines.length > 0 || state.users.length > 0 || state.inspectionReports.length > 0;
    } catch (e) { return false; }
}

function clearAllData() {
    state.machines = [];
    state.parts = [];
    state.partDatabase = [];
    state.productionLogs = [];
    state.operators = [];
    state.productionLines = [];
    state.users = [];
    state.inspectionReports = [];
    state.schedule = null;
    state.isScheduled = false;
    state.selectedPart = null;
    state.expandedParts.clear();
    localStorage.removeItem(STORAGE_KEY);
    renderMachineGrid();
    renderPartsList();
    renderProductionLogs();
    renderOperatorList();
    renderProductionLines();
    renderUsers();
    renderInspectionReports();
    updateCounts();
    showNotification('All data cleared', 'info');
}

// ==================== SAMPLE DATA ====================

function generateSampleData() {
    state.machines = [];
    state.parts = [];
    state.expandedParts.clear();

    // 20 machines with realistic names
    const machineTypes = [
        'CNC Lathe', 'VMC', 'HMC', 'Drill Press', 'Milling', 'Grinder',
        'Boring', 'Shaper', 'Planer', 'Broaching', 'Honing', 'Lapping',
        'EDM Wire', 'EDM Sink', 'Laser Cut', 'Plasma', 'Welding', 'Heat Treat',
        'Surface Grind', 'Cylindrical Grind'
    ];
    for (let i = 0; i < 20; i++) {
        state.machines.push({
            id: i + 1,
            name: machineTypes[i] || `Machine ${i + 1}`,
        });
    }

    // 50 parts with realistic names
    const partPrefixes = ['Shaft', 'Gear', 'Housing', 'Bracket', 'Flange', 'Bushing', 'Sleeve', 'Cover', 'Pin', 'Spacer',
        'Collar', 'Plug', 'Nut', 'Washer', 'Stud', 'Rod', 'Plate', 'Block', 'Ring', 'Cap',
        'Bearing', 'Coupler', 'Adapter', 'Mount', 'Base', 'Frame', 'Arm', 'Lever', 'Cam', 'Piston',
        'Valve', 'Nozzle', 'Hub', 'Disc', 'Drum', 'Cylinder', 'Spring', 'Clamp', 'Guide', 'Rail',
        'Spindle', 'Arbor', 'Mandrel', 'Chuck', 'Fixture', 'Jig', 'Die', 'Punch', 'Anvil', 'Hammer'];

    state.opsPerPart = 5;

    for (let i = 0; i < 50; i++) {
        const usedMachines = new Set();
        const numOps = Math.floor(Math.random() * 5) + 2; // 2 to 6 operations
        const operations = Array.from({ length: numOps }, (_, j) => {
            let machineId;
            do {
                machineId = state.machines[Math.floor(Math.random() * state.machines.length)].id;
            } while (usedMachines.has(machineId) && usedMachines.size < state.machines.length);
            usedMachines.add(machineId);

            const opNames = ['Turning', 'Milling', 'Drilling', 'Grinding', 'Boring', 'Facing', 'Threading', 'Knurling', 'Tapping', 'Reaming', 'Chamfering', 'Deburring', 'Polishing', 'Hardening', 'Tempering'];
            return {
                opIndex: j,
                opName: opNames[j % opNames.length],
                machineId,
                cycleTime: 10 + Math.floor(Math.random() * 70),
                setupTime: 5 + Math.floor(Math.random() * 25),
            };
        });

        const quantity = Math.floor(Math.random() * 20) + 1;
        state.parts.push({
            id: i + 1,
            name: partPrefixes[i] || `Part ${i + 1}`,
            quantity: quantity,
            operations: operations.map(op => ({ ...op, quantity: quantity })),
            color: getPartColor(i),
        });
    }

    // Default Operators
    state.operators = [
        { id: 1, name: 'Alice Smith', present: true, availableHours: 8 },
        { id: 2, name: 'Bob Jones', present: true, availableHours: 8 },
        { id: 3, name: 'Charlie Brown', present: true, availableHours: 6 },
    ];

    // Default Production Lines
    state.productionLines = [
        { id: 1, name: 'Assembly Line A', code: 'L-A', description: 'Main mechanical assembly line' },
        { id: 2, name: 'Packaging Line B', code: 'L-B', description: 'Final product packaging line' },
    ];

    // Default Users
    state.users = [
        { id: 1, username: 'admin', fullName: 'System Administrator', role: 'Admin' },
        { id: 2, username: 'john_planner', fullName: 'John Doe', role: 'Planner' },
    ];

    saveData();
    const opsInput = document.getElementById('ops-per-part');
    if (opsInput) opsInput.value = state.opsPerPart;
    renderMachineGrid();
    renderPartsList();
    renderOperatorList();
    renderProductionLines();
    renderUsers();
    updateCounts();
    showNotification('✨ Sample data loaded: 20 machines, 50 parts, 3 operators, 2 lines, 2 users', 'success');
}

// ==================== SCHEDULING ALGORITHMS ====================

function getProcessingTime(op, quantity = 1) {
    return (op.setupTime || 0) + ((op.cycleTime || 0) * quantity);
}

function getTotalTime(part) {
    return part.operations.reduce((sum, op) => sum + getProcessingTime(op, op.quantity !== undefined ? op.quantity : part.quantity || 1), 0);
}

function listSchedule(partOrder) {
    const machineAvail = {};
    state.machines.forEach(m => { machineAvail[m.id] = 0; });

    for (const part of partOrder) {
        let prevOpEnd = 0;
        for (const op of part.operations) {
            if (op.machineId == null) continue;
            const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
            const total = getProcessingTime(op, opQty);
            if (total <= 0) continue;
            const start = Math.max(prevOpEnd, machineAvail[op.machineId] || 0);
            op._startTime = start;
            op._setupEnd = start + (op.setupTime || 0);
            op._endTime = start + total;
            machineAvail[op.machineId] = op._endTime;
            prevOpEnd = op._endTime;
        }
    }

    return machineAvail;
}

function scheduleBalanced() {
    const machineAvail = {};
    state.machines.forEach(m => { machineAvail[m.id] = 0; });

    const partCount = state.parts.length;
    const compProgress = new Array(partCount).fill(0);
    const compAvail = new Array(partCount).fill(0);

    // Reset all ops
    state.parts.forEach(part => {
        part.operations.forEach(op => {
            op._startTime = null; op._setupEnd = null; op._endTime = null;
        });
    });

    const totalOps = state.parts.reduce((s, p) => s + p.operations.length, 0);
    let scheduled = 0;

    while (scheduled < totalOps) {
        let bestIdx = -1;
        let bestStart = Infinity;

        for (let c = 0; c < partCount; c++) {
            if (compProgress[c] >= state.parts[c].operations.length) continue;
            const op = state.parts[c].operations[compProgress[c]];
            const part = state.parts[c];
            const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
            if (op.machineId == null || getProcessingTime(op, opQty) <= 0) {
                // Skip invalid operations
                op._startTime = compAvail[c]; op._setupEnd = compAvail[c]; op._endTime = compAvail[c];
                compProgress[c]++;
                scheduled++;
                continue;
            }
            const start = Math.max(compAvail[c], machineAvail[op.machineId] || 0);
            
            if (start < bestStart) { 
                bestStart = start; 
                bestIdx = c; 
            } else if (start === bestStart && bestIdx !== -1) {
                // Tiebreaker logic for identical start times
                const currentOp = state.parts[bestIdx].operations[compProgress[bestIdx]];
                const currentPart = state.parts[bestIdx];
                
                const candOpPri = op.priority || 5;
                const currOpPri = currentOp.priority || 5;
                
                if (candOpPri < currOpPri) {
                    bestIdx = c;
                } else if (candOpPri === currOpPri) {
                    const candPartPri = part.priority || 5;
                    const currPartPri = currentPart.priority || 5;
                    if (candPartPri < currPartPri) {
                        bestIdx = c;
                      }
                }
            }
        }

        if (bestIdx === -1) break;

        const part = state.parts[bestIdx];
        const op = part.operations[compProgress[bestIdx]];
        const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
        const total = getProcessingTime(op, opQty);
        op._startTime = bestStart;
        op._setupEnd = bestStart + (op.setupTime || 0);
        op._endTime = bestStart + total;

        machineAvail[op.machineId] = op._endTime;
        compAvail[bestIdx] = op._endTime;
        compProgress[bestIdx]++;
        scheduled++;
    }

    return machineAvail;
}

function runSchedulingAlgorithm(algorithm) {
    // Reset all scheduled times
    state.parts.forEach(part => {
        part.operations.forEach(op => {
            op._startTime = null; op._setupEnd = null; op._endTime = null;
        });
    });

    // Filter parts with valid operations
    const validParts = state.parts.filter(p =>
        p.operations.some(op => op.machineId != null && getProcessingTime(op, op.quantity !== undefined ? op.quantity : p.quantity || 1) > 0)
    );

    if (validParts.length === 0) {
        state.schedule = null;
        state.isScheduled = false;
        return;
    }

    let machineAvail;

    if (algorithm === 'balanced') {
        machineAvail = scheduleBalanced();
    } else {
        let sorted = [...validParts];
        switch (algorithm) {
            case 'spt': sorted.sort((a, b) => (a.priority || 5) - (b.priority || 5) || getTotalTime(a) - getTotalTime(b)); break;
            case 'lpt': sorted.sort((a, b) => (a.priority || 5) - (b.priority || 5) || getTotalTime(b) - getTotalTime(a)); break;
            case 'fifo': sorted.sort((a, b) => (a.priority || 5) - (b.priority || 5) || a.id - b.id); break;
            case 'critical':
                sorted.sort((a, b) => {
                    const pDiff = (a.priority || 5) - (b.priority || 5);
                    if (pDiff !== 0) return pDiff;
                    const maxA = Math.max(...a.operations.map(o => getProcessingTime(o, o.quantity !== undefined ? o.quantity : a.quantity || 1)));
                    const maxB = Math.max(...b.operations.map(o => getProcessingTime(o, o.quantity !== undefined ? o.quantity : b.quantity || 1)));
                    return maxB - maxA;
                });
                break;
        }
        machineAvail = listSchedule(sorted);
    }

    const makespan = Math.max(0, ...Object.values(machineAvail));
    const totalWork = state.parts.reduce((s, p) =>
        s + p.operations.reduce((ss, o) => ss + getProcessingTime(o, o.quantity !== undefined ? o.quantity : p.quantity || 1), 0), 0);
    const numMachines = state.machines.length || 1;
    const totalCapacity = makespan * numMachines;
    const utilization = totalCapacity > 0 ? (totalWork / totalCapacity) * 100 : 0;
    const totalIdle = totalCapacity - totalWork;
    const totalSetup = state.parts.reduce((s, p) =>
        s + p.operations.reduce((ss, o) => ss + (o.setupTime || 0), 0), 0);
    const totalCycle = state.parts.reduce((s, p) =>
        s + p.operations.reduce((ss, o) => ss + (o.cycleTime || 0) * (o.quantity !== undefined ? o.quantity : p.quantity || 1), 0), 0);
    const scheduledOps = state.parts.reduce((s, p) =>
        s + p.operations.filter(o => o._startTime != null && o._endTime != null && o._endTime > o._startTime).length, 0);

    state.schedule = { makespan, utilization, totalIdle, totalSetup, totalCycle, scheduledOps, machineAvail };
    state.isScheduled = true;
}

// ==================== RENDERING — SETUP VIEW ====================

function renderMachineGrid() {
    const grid = document.getElementById('machine-list');
    if (state.machines.length === 0) {
        grid.innerHTML = `<div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v3M18 2v3M7 11h4M7 14h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="12.5" r="2.5" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>No machines added yet. Click "Add Machine" to start.</span>
        </div>`;
        return;
    }

    grid.innerHTML = state.machines.map((m, i) => `
        <div class="machine-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="color:var(--text-muted); font-size:0.8rem; font-family:'JetBrains Mono',monospace;">#${i + 1}</span>
                <span style="font-weight:500; font-size:0.9rem;">${escapeHtml(m.name)}</span>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-ghost btn-edit-machine" data-id="${m.id}" style="color:var(--accent-primary)">Edit</button>
                <button class="btn btn-sm btn-ghost btn-remove-machine" data-id="${m.id}" style="color:var(--color-error)">Remove</button>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.btn-edit-machine').forEach(btn => {
        btn.addEventListener('click', () => openMachineForm(parseInt(btn.dataset.id)));
    });
    grid.querySelectorAll('.btn-remove-machine').forEach(btn => {
        btn.addEventListener('click', () => removeMachine(parseInt(btn.dataset.id)));
    });
}

function renderPartsList() {
    const list = document.getElementById('parts-list');
    if (state.parts.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding:30px">
            <span style="font-size:0.82rem;color:var(--text-dimmed)">No parts added. Click "Add Part" or load sample data.</span>
        </div>`;
        return;
    }

    list.innerHTML = state.parts.map((part, idx) => {
        const totalTime = getTotalTime(part);
        return `
        <div class="part-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-card); border:1px solid var(--border-subtle); border-left:4px solid ${part.color.border}; border-radius:var(--radius-md); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:16px;">
                <span style="color:var(--text-muted); font-size:0.8rem; font-family:'JetBrains Mono',monospace;">#${idx + 1}</span>
                <span style="font-weight:600; font-size:1rem;">${escapeHtml(part.name)}</span>
                <span class="badge" style="background:var(--bg-surface); border:1px solid var(--border-subtle);">${part.quantity || 1} units</span>
                <span class="badge" style="background:var(--bg-surface); border:1px solid var(--border-subtle);">Priority ${part.priority || 5}</span>
                <span class="badge" style="background:var(--bg-surface);">${part.operations.length} Ops</span>
            </div>
            <div style="display:flex; align-items:center; gap:24px;">
                <span style="font-family:'JetBrains Mono',monospace; font-size:0.85rem; color:var(--text-primary);">Total Time: ${Number(totalTime.toFixed(1))}m</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-ghost btn-edit-part" data-id="${part.id}" style="color:var(--accent-primary)">Edit</button>
                    <button class="btn btn-sm btn-ghost btn-remove-part" data-id="${part.id}" style="color:var(--color-error)">Remove</button>
                </div>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-edit-part').forEach(btn => {
        btn.addEventListener('click', () => openPartForm(parseInt(btn.dataset.id)));
    });
    list.querySelectorAll('.btn-remove-part').forEach(btn => {
        btn.addEventListener('click', () => removePart(parseInt(btn.dataset.id)));
    });
}

function renderDatabaseList() {
    const list = document.getElementById('database-parts-list');
    document.getElementById('db-part-count').textContent = `${state.partDatabase.length} master part${state.partDatabase.length !== 1 ? 's' : ''}`;
    
    if (state.partDatabase.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding:30px">
            <span style="font-size:0.82rem;color:var(--text-dimmed)">No master parts. Click "Create Master Part" to add one.</span>
        </div>`;
        return;
    }

    list.innerHTML = state.partDatabase.map((part, idx) => {
        const totalTime = part.operations.reduce((sum, op) => sum + (op.setupTime || 0) + (op.cycleTime || 0), 0);
        return `
        <div class="part-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:16px;">
                <span style="color:var(--text-muted); font-size:0.8rem; font-family:'JetBrains Mono',monospace;">DB-${part.id}</span>
                <span style="font-weight:600; font-size:1rem;">${escapeHtml(part.name)}</span>
                <span class="badge" style="background:var(--bg-surface); border:1px solid var(--border-subtle);">Priority ${part.priority || 5}</span>
                <span class="badge" style="background:var(--bg-surface);">${part.operations.length} Ops</span>
            </div>
            <div style="display:flex; align-items:center; gap:24px;">
                <span style="font-family:'JetBrains Mono',monospace; font-size:0.85rem; color:var(--text-primary);">Base Time: ${Number(totalTime.toFixed(1))}m</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-sm btn-ghost btn-edit-db-part" data-id="${part.id}" style="color:var(--accent-primary)">Edit</button>
                    <button class="btn btn-sm btn-ghost btn-remove-db-part" data-id="${part.id}" style="color:var(--color-error)">Remove</button>
                </div>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.btn-edit-db-part').forEach(btn => {
        btn.addEventListener('click', () => openPartForm(parseInt(btn.dataset.id), true));
    });
    list.querySelectorAll('.btn-remove-db-part').forEach(btn => {
        btn.addEventListener('click', () => removeDbPart(parseInt(btn.dataset.id)));
    });
}

function updateCounts() {
    const machineCountEl = document.getElementById('machine-count');
    if (machineCountEl) {
        machineCountEl.textContent = `${state.machines.length} machine${state.machines.length !== 1 ? 's' : ''}`;
    }
    const partCountEl = document.getElementById('part-count');
    if (partCountEl) {
        partCountEl.textContent = `${state.parts.length} part${state.parts.length !== 1 ? 's' : ''}`;
    }
    const opCountEl = document.getElementById('operator-count');
    if (opCountEl) {
        opCountEl.textContent = `${state.operators.length} operator${state.operators.length !== 1 ? 's' : ''}`;
    }
}

// ==================== DATABASE MODAL ====================

function openAddFromDatabaseModal() {
    if (state.partDatabase.length === 0) {
        showNotification('⚠️ No master parts available in the Database.', 'error');
        return;
    }
    
    const listEl = document.getElementById('db-modal-list');
    listEl.innerHTML = state.partDatabase.map(part => `
        <div class="db-item" onclick="addPartFromDatabase(${part.id})">
            <div>
                <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(part.name)}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${part.operations.length} Operations</div>
            </div>
            <div style="display:flex; align-items:center;">
                <button class="btn btn-sm btn-ghost" style="color:var(--accent-primary)">Add</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('db-modal').classList.add('active');
}

function addPartFromDatabase(dbPartId) {
    const dbPart = state.partDatabase.find(p => p.id === dbPartId);
    if (!dbPart) return;
    
    const id = state.parts.length > 0 ? Math.max(...state.parts.map(p => p.id)) + 1 : 1;
    const operations = JSON.parse(JSON.stringify(dbPart.operations));
    
    state.parts.push({
        id,
        name: dbPart.name,
        quantity: 1,
        operations,
        color: getPartColor(state.parts.length),
    });
    
    saveData();
    renderPartsList();
    updateCounts();
    
    document.getElementById('db-modal').classList.remove('active');
    showNotification(`✅ Added ${escapeHtml(dbPart.name)} to schedule`, 'success');
}

// ==================== RENDERING — SCHEDULE VIEW ====================

function renderScheduleView() {
    renderDashboard();
    renderGanttChart();
    renderComponentTable();
    renderMachineUtilization();
}

function renderDashboard() {
    if (!state.schedule) {
        ['kpi-makespan','kpi-utilization','kpi-operations','kpi-idle','kpi-parts'].forEach(id => {
            document.getElementById(id).textContent = '—';
        });
        return;
    }
    const s = state.schedule;
    document.getElementById('kpi-makespan').textContent = formatTime(s.makespan);
    document.getElementById('kpi-utilization').textContent = `${s.utilization.toFixed(1)}%`;
    document.getElementById('kpi-operations').textContent = `${s.scheduledOps}`;
    document.getElementById('kpi-idle').textContent = formatTime(s.totalIdle);
    document.getElementById('kpi-parts').textContent = `${state.parts.length}`;

    document.querySelectorAll('.kpi-value').forEach(el => {
        el.style.animation = 'none'; el.offsetHeight;
        el.style.animation = 'kpiPulse 0.4s ease-out';
    });
}

function renderGanttChart() {
    const labelsEl = document.getElementById('gantt-labels');
    const timelineEl = document.getElementById('gantt-timeline');
    const canvasEl = document.getElementById('gantt-canvas');
    const viewportEl = document.getElementById('gantt-viewport');
    const timelineWrapper = document.querySelector('.gantt-timeline-wrapper');

    if (!state.isScheduled || !state.schedule || state.schedule.makespan <= 0) {
        labelsEl.innerHTML = '';
        timelineEl.innerHTML = '';
        canvasEl.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="12" width="14" height="6" rx="2" stroke="currentColor" stroke-width="2"/>
                <rect x="20" y="12" width="24" height="6" rx="2" stroke="currentColor" stroke-width="2" opacity="0.4"/>
                <rect x="4" y="22" width="24" height="6" rx="2" stroke="currentColor" stroke-width="2"/>
                <rect x="30" y="22" width="14" height="6" rx="2" stroke="currentColor" stroke-width="2" opacity="0.4"/>
                <rect x="4" y="32" width="18" height="6" rx="2" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span style="font-size:0.85rem;font-weight:500">Enter data in Setup tab and click "Run Schedule"</span>
        </div>`;
        return;
    }

    const makespan = state.schedule.makespan;
    const pxPerMin = (BASE_PX_PER_HOUR * state.zoomLevel) / 60;
    const chartWidth = makespan * pxPerMin + 60;
    const hourCount = Math.ceil(makespan / 60);
    let interval = 1;
    if (hourCount > 40) interval = 4;
    else if (hourCount > 20) interval = 2;

    // Labels — use machine names
    labelsEl.innerHTML = state.machines.map(m =>
        `<div class="gantt-label" data-machine="${m.id}" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>`
    ).join('');

    // Timeline
    let timeHTML = '';
    for (let h = 0; h <= hourCount; h += interval) {
        timeHTML += `<div class="time-marker" style="left:${h * 60 * pxPerMin}px">${formatTimelineLabel(h * 60)}</div>`;
    }
    timelineEl.innerHTML = timeHTML;
    timelineEl.style.width = `${chartWidth}px`;

    // Canvas
    let canvasHTML = '';
    for (const machine of state.machines) {
        let rowHTML = `<div class="gantt-row" data-machine="${machine.id}">`;

        // Grid lines
        for (let h = 0; h <= hourCount; h += interval) {
            rowHTML += `<div class="grid-line" style="left:${h * 60 * pxPerMin}px"></div>`;
        }

        // Bars
        state.parts.forEach((part, partIdx) => {
            part.operations.forEach(op => {
                if (op.machineId !== machine.id || op._startTime == null || op._endTime == null) return;
                const totalPx = (op._endTime - op._startTime) * pxPerMin;
                if (totalPx <= 0) return;

                const left = op._startTime * pxPerMin;
                const width = Math.max(totalPx, 2);
                const showLabel = width > 36;

                // Single bar showing both setup + cycle
                rowHTML += `<div class="gantt-bar"
                    data-part="${partIdx}" data-op="${op.opIndex}"
                    style="left:${left}px;width:${width}px;background:${part.color.bg};border-color:${part.color.border}"
                >${showLabel ? `<span class="bar-label">${escapeHtml(part.name)}</span>` : ''}</div>`;

                // Setup portion indicator (darker overlay on left portion)
                if (op.setupTime > 0 && op.cycleTime > 0) {
                    const setupWidth = op.setupTime * pxPerMin;
                    rowHTML += `<div style="position:absolute;top:3px;left:${left}px;width:${Math.min(setupWidth, width)}px;height:calc(var(--gantt-row-height) - 6px);background:rgba(0,0,0,0.25);border-radius:4px 0 0 4px;pointer-events:none;z-index:2"></div>`;
                }
            });
        });

        rowHTML += '</div>';
        canvasHTML += rowHTML;
    }

    canvasEl.innerHTML = canvasHTML;
    canvasEl.style.width = `${chartWidth}px`;

    // Sync scrolls
    viewportEl.onscroll = () => {
        timelineWrapper.scrollLeft = viewportEl.scrollLeft;
        document.getElementById('gantt-labels').scrollTop = viewportEl.scrollTop;
    };

    // Bar events
    canvasEl.querySelectorAll('.gantt-bar').forEach(bar => {
        bar.addEventListener('mouseenter', handleBarMouseEnter);
        bar.addEventListener('mouseleave', handleBarMouseLeave);
        bar.addEventListener('click', handleBarClick);
    });

    animateGanttBars();
    document.getElementById('zoom-label').textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

function renderComponentTable() {
    const tbody = document.getElementById('component-tbody');
    if (!state.isScheduled) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dimmed)">No schedule data</td></tr>`;
        return;
    }

    const scheduled = state.parts.filter(p =>
        p.operations.some(o => o._startTime != null && o._endTime != null && o._endTime > o._startTime)
    );

    scheduled.sort((a, b) => {
        const aStart = Math.min(...a.operations.filter(o => o._startTime != null).map(o => o._startTime));
        const bStart = Math.min(...b.operations.filter(o => o._startTime != null).map(o => o._startTime));
        return aStart - bStart;
    });

    tbody.innerHTML = scheduled.map((part, partIdx) => {
        const validOps = part.operations.filter(o => o._startTime != null && o._endTime != null && o._endTime > o._startTime);
        if (validOps.length === 0) return '';

        const start = Math.min(...validOps.map(o => o._startTime));
        const end = Math.max(...validOps.map(o => o._endTime));
        const totalSetup = part.operations.reduce((s, o) => s + (o.setupTime || 0), 0);
        const totalCycle = part.operations.reduce((s, o) => s + (o.cycleTime || 0), 0);
        const totalTime = totalSetup + totalCycle;
        const globalIdx = state.parts.indexOf(part);
        const isSelected = state.selectedPart === globalIdx;

        const opDots = part.operations.map(op => {
            if (op._startTime == null) return '';
            const mName = state.machines.find(m => m.id === op.machineId)?.name || '?';
            return `<span class="op-dot" style="background:${part.color.solid}" 
                title="Op${op.opIndex + 1}: ${mName} — C:${op.cycleTime}m S:${op.setupTime}m (${formatTime(op._startTime)}→${formatTime(op._endTime)})"></span>`;
        }).join('');

        return `<tr data-part="${globalIdx}" class="${isSelected ? 'selected' : ''}">
            <td><span class="comp-indicator" style="background:${part.color.solid}"></span>${escapeHtml(part.name)}</td>
            <td>${totalSetup}m</td>
            <td>${totalCycle}m</td>
            <td style="font-weight:600">${totalTime}m</td>
            <td>${formatTimeShort(start)}</td>
            <td>${formatTimeShort(end)}</td>
            <td class="op-dots">${opDots}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-part]').forEach(row => {
        row.addEventListener('click', () => selectPartById(parseInt(row.dataset.part)));
    });
}

function renderMachineUtilization() {
    const container = document.getElementById('machine-bars');
    if (!state.isScheduled || !state.schedule) {
        container.innerHTML = `<div class="empty-state" style="padding:20px"><span style="color:var(--text-dimmed);font-size:0.82rem">No data</span></div>`;
        return;
    }

    const makespan = state.schedule.makespan;
    const machineUtils = state.machines.map(machine => {
        let busyTime = 0;
        state.parts.forEach(part => {
            part.operations.forEach(op => {
                if (op.machineId === machine.id && op._startTime != null && op._endTime != null) {
                    busyTime += (op._endTime - op._startTime);
                }
            });
        });
        return { machine, busyTime, utilization: makespan > 0 ? (busyTime / makespan) * 100 : 0 };
    });

    machineUtils.sort((a, b) => b.utilization - a.utilization);

    container.innerHTML = machineUtils.map(({ machine, utilization }) => {
        let barColor = 'var(--color-success)';
        let colorClass = 'text-success';
        if (utilization < 40) { barColor = 'var(--color-error)'; colorClass = 'text-error'; }
        else if (utilization < 65) { barColor = 'var(--color-warning)'; colorClass = 'text-warning'; }

        return `<div class="machine-bar-row">
            <span class="machine-bar-label" title="${escapeHtml(machine.name)}">${escapeHtml(machine.name)}</span>
            <div class="machine-bar-track">
                <div class="machine-bar-fill" style="width:${utilization}%;background:${barColor}"></div>
            </div>
            <span class="machine-bar-value ${colorClass}">${utilization.toFixed(0)}%</span>
        </div>`;
    }).join('');
}

// ==================== GANTT INTERACTIONS ====================

function animateGanttBars() {
    document.querySelectorAll('.gantt-bar').forEach((bar, i) => {
        bar.style.opacity = '0';
        bar.style.transform = 'scaleX(0)';
        bar.style.transformOrigin = 'left center';
        const delay = Math.min(i * 2, 500);
        setTimeout(() => {
            bar.style.transition = `opacity 0.3s ease ${delay}ms, transform 0.4s var(--ease-spring) ${delay}ms`;
            bar.style.opacity = '1';
            bar.style.transform = 'scaleX(1)';
        }, 10);
    });
}

function handleBarMouseEnter(e) {
    const bar = e.currentTarget;
    const partIdx = parseInt(bar.dataset.part);
    const opIndex = parseInt(bar.dataset.op);
    const part = state.parts[partIdx];
    if (!part) return;
    const op = part.operations[opIndex];
    const machine = state.machines.find(m => m.id === op.machineId);

    const tooltip = document.getElementById('tooltip');
    const opLabel = op.opName ? escapeHtml(op.opName) : `Op ${opIndex + 1}`;
    const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
    tooltip.innerHTML = `
        <div class="tooltip-header" style="border-color:${part.color.border}">
            <strong>${escapeHtml(part.name)}</strong> (Qty: ${opQty} / ${part.quantity || 1}) — ${opLabel}
        </div>
        <div class="tooltip-body">
            <div>Machine: <strong>${machine ? escapeHtml(machine.name) : '—'}</strong></div>
            <div>Setup Time: <strong>${op.setupTime || 0} min</strong></div>
            <div>Cycle Time: <strong>${op.cycleTime || 0} min x ${opQty}</strong></div>
            <div>Total: <strong>${getProcessingTime(op, opQty)} min</strong></div>
            <div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border-subtle)">
                Start: <strong>${formatDateTime(op._startTime)}</strong> → End: <strong>${formatDateTime(op._endTime)}</strong>
            </div>
        </div>`;

    const rect = bar.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.classList.add('visible');

    if (state.selectedPart === null) highlightPart(partIdx);
}

function handleBarMouseLeave() {
    document.getElementById('tooltip').classList.remove('visible');
    if (state.selectedPart === null) unhighlightAll();
}

function handleBarClick(e) {
    selectPartById(parseInt(e.currentTarget.dataset.part));
}

function selectPartById(idx) {
    if (state.selectedPart === idx) { state.selectedPart = null; unhighlightAll(); }
    else { state.selectedPart = idx; highlightPart(idx); }
    renderComponentTable();
}

function highlightPart(idx) {
    document.querySelectorAll('.gantt-bar').forEach(bar => {
        const barPart = parseInt(bar.dataset.part);
        bar.classList.toggle('dimmed', barPart !== idx);
        bar.classList.toggle('highlighted', barPart === idx);
    });
}

function unhighlightAll() {
    document.querySelectorAll('.gantt-bar').forEach(bar => {
        bar.classList.remove('dimmed', 'highlighted');
    });
}

// ==================== ZOOM ====================

function zoomIn() { state.zoomLevel = Math.min(state.zoomLevel * 1.35, 6); renderGanttChart(); }
function zoomOut() { state.zoomLevel = Math.max(state.zoomLevel / 1.35, 0.15); renderGanttChart(); }
function zoomFit() {
    if (!state.schedule || state.schedule.makespan <= 0) return;
    const viewport = document.getElementById('gantt-viewport');
    const w = viewport.clientWidth - 20;
    state.zoomLevel = w / (state.schedule.makespan / 60 * BASE_PX_PER_HOUR);
    state.zoomLevel = Math.max(state.zoomLevel, 0.1);
    renderGanttChart();
}

// ==================== SEARCH ====================

function searchPart(query) {
    if (!query.trim()) { state.selectedPart = null; unhighlightAll(); renderComponentTable(); return; }
    const q = query.toLowerCase().trim();
    const idx = state.parts.findIndex(p => p.name.toLowerCase().includes(q));
    if (idx >= 0) {
        selectPartById(idx);
        const row = document.querySelector(`#component-tbody tr[data-part="${idx}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==================== OPERATOR DATABASE ====================

function renderOperatorList() {
    const list = document.getElementById('operator-list');
    if (!list) return;

    if (state.operators.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding:30px; text-align: center;">
                <span style="font-size:0.82rem;color:var(--text-dimmed)">No operators configured. Add your first operator.</span>
            </div>
        `;
        return;
    }

    list.innerHTML = state.operators.map((op, idx) => `
        <div class="machine-card" style="display: flex; flex-direction: column; gap: 10px; padding: 14px; min-width: 220px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="machine-num">#${idx + 1}</span>
                    <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(op.name)}</span>
                </div>
                <button class="btn-icon delete-operator-btn" data-id="${op.id}" title="Remove Operator" style="color:var(--color-error); padding: 2px;">
                    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        </div>
    `).join('');

    // Bind delete events
    list.querySelectorAll('.delete-operator-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const op = state.operators.find(o => o.id === id);
            if (op && confirm(`Remove operator "${op.name}"?`)) {
                state.operators = state.operators.filter(o => o.id !== id);
                saveData();
                renderOperatorList();
                updateCounts();
                showNotification('Operator removed', 'info');
            }
        });
    });
}

function saveOperator() {
    const nameInput = document.getElementById('operator-form-name');
    const name = nameInput.value.trim();

    if (!name) {
        showNotification('⚠️ Please enter an Operator Name', 'error');
        return;
    }

    // Check duplicate
    if (state.operators.some(o => o.name.toLowerCase() === name.toLowerCase())) {
        showNotification('⚠️ An operator with this name already exists', 'error');
        return;
    }

    const id = state.operators.length > 0 ? Math.max(...state.operators.map(o => o.id)) + 1 : 1;
    state.operators.push({ id, name, present: true, availableHours: 8 });
    saveData();
    
    nameInput.value = '';
    renderOperatorList();
    updateCounts();
    showNotification('✅ Operator added successfully', 'success');
}

function populateOperatorDropdown() {
    const select = document.getElementById('log-operator');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">— Select Operator —</option>';

    state.operators.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.name;
        opt.textContent = op.name;
        if (op.name === currentVal) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

function switchMasterSubView(subTab) {
    state.currentMasterSubTab = subTab;
    document.querySelectorAll('.subpanel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
    });

    const activePanel = document.getElementById(`subpanel-${subTab}`);
    if (activePanel) activePanel.style.display = 'block';

    const activeBtn = document.querySelector(`.sub-tab-btn[data-subtab="${subTab}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--bg-card)';
        activeBtn.style.color = 'var(--text-primary)';
    }
}

function renderProductionLines() {
    const list = document.getElementById('line-list');
    if (!list) return;

    if (state.productionLines.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding:30px; text-align: center;">
                <span style="font-size:0.82rem;color:var(--text-dimmed)">No production lines configured. Add a production line.</span>
            </div>
        `;
        return;
    }

    list.innerHTML = state.productionLines.map((line, idx) => `
        <div class="machine-card" style="display: flex; flex-direction: column; gap: 8px; padding: 14px; min-width: 220px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="machine-num">#${idx + 1}</span>
                    <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(line.name)}</span>
                </div>
                <button class="btn-icon delete-line-btn" data-id="${line.id}" title="Remove Production Line" style="color:var(--color-error); padding: 2px;">
                    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
                <div>Code: <strong style="color: var(--text-primary); font-family: monospace;">${escapeHtml(line.code || '—')}</strong></div>
                <div>${escapeHtml(line.description || 'No description provided.')}</div>
            </div>
        </div>
    `).join('');

    // Bind delete events
    list.querySelectorAll('.delete-line-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const line = state.productionLines.find(l => l.id === id);
            if (line && confirm(`Remove production line "${line.name}"?`)) {
                state.productionLines = state.productionLines.filter(l => l.id !== id);
                saveData();
                renderProductionLines();
                showNotification('Production line removed', 'info');
            }
        });
    });
}

function saveProductionLine() {
    const nameInput = document.getElementById('line-form-name');
    const codeInput = document.getElementById('line-form-code');
    const descInput = document.getElementById('line-form-desc');

    const name = nameInput.value.trim();
    const code = codeInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
        showNotification('⚠️ Please enter a Production Line Name', 'error');
        return;
    }

    if (state.productionLines.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        showNotification('⚠️ A production line with this name already exists', 'error');
        return;
    }

    const id = state.productionLines.length > 0 ? Math.max(...state.productionLines.map(l => l.id)) + 1 : 1;
    state.productionLines.push({ id, name, code, description });
    saveData();

    nameInput.value = '';
    codeInput.value = '';
    descInput.value = '';
    renderProductionLines();
    showNotification('✅ Production line added successfully', 'success');
}

function renderUsers() {
    const tbody = document.getElementById('user-tbody');
    if (!tbody) return;

    if (state.users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No system users configured yet.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = state.users.map((user, idx) => `
        <tr>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${escapeHtml(user.username)}</td>
            <td><strong>${escapeHtml(user.fullName)}</strong></td>
            <td><span class="badge badge-outline" style="font-size:0.75rem;">${escapeHtml(user.role)}</span></td>
            <td style="text-align: center;">
                <button class="btn-icon delete-user-btn" data-id="${user.id}" title="Delete User" style="color: var(--color-error); padding: 2px;">
                    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Bind delete events
    tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const user = state.users.find(u => u.id === id);
            if (user && confirm(`Remove system user "${user.username}"?`)) {
                state.users = state.users.filter(u => u.id !== id);
                saveData();
                renderUsers();
                showNotification('User removed', 'info');
            }
        });
    });
}

function saveUser() {
    const usernameInput = document.getElementById('user-form-username');
    const fullnameInput = document.getElementById('user-form-fullname');
    const roleSelect = document.getElementById('user-form-role');

    const username = usernameInput.value.trim();
    const fullName = fullnameInput.value.trim();
    const role = roleSelect.value;

    if (!username) {
        showNotification('⚠️ Please enter a Username', 'error');
        return;
    }
    if (!fullName) {
        showNotification('⚠️ Please enter Full Name', 'error');
        return;
    }

    if (state.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        showNotification('⚠️ A user with this username already exists', 'error');
        return;
    }

    const id = state.users.length > 0 ? Math.max(...state.users.map(u => u.id)) + 1 : 1;
    state.users.push({ id, username, fullName, role });
    saveData();

    usernameInput.value = '';
    fullnameInput.value = '';
    renderUsers();
    showNotification('✅ System user added successfully', 'success');
}

// ==================== PRODUCTION LOGS ====================

function populateLogPartOpDropdown() {
    const select = document.getElementById('log-part-op');
    if (!select) return;
    
    // Clear previous dynamic items
    select.innerHTML = '<option value="">— Select Op —</option>';
    
    state.parts.forEach(part => {
        part.operations.forEach((op, opIndex) => {
            const machine = state.machines.find(m => m.id === op.machineId);
            const machineName = machine ? machine.name : 'Unassigned';
            const optValue = `${part.id}-${opIndex}`;
            const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
            const optText = `${part.name} - Op ${opIndex + 1}: ${op.opName || 'Unnamed'} (${opQty}/${part.quantity || 1} units remaining on ${machineName})`;
            
            const opt = document.createElement('option');
            opt.value = optValue;
            opt.textContent = optText;
            select.appendChild(opt);
        });
    });
}

function renderProductionLogs() {
    const tbody = document.getElementById('log-tbody');
    if (!tbody) return;
    
    if (!state.productionLogs || state.productionLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No production logs recorded yet.</td>
            </tr>
        `;
        renderCompletionSummary();
        return;
    }
    
    tbody.innerHTML = state.productionLogs.map((log, index) => {
        // Find part/op names
        const part = state.parts.find(p => p.id === log.partId);
        const partName = part ? part.name : 'Unknown Part';
        const op = part ? part.operations[log.opIndex] : null;
        const opName = op ? `Op ${log.opIndex + 1}: ${op.opName || 'Unnamed'}` : `Op ${log.opIndex + 1}`;
        
        const machine = op ? state.machines.find(m => m.id === op.machineId) : null;
        const machineName = machine ? machine.name : 'Unassigned';
        
        return `
            <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${log.date}</td>
                <td><strong>${escapeHtml(partName)}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(opName)}</span></td>
                <td><span class="badge badge-outline">${escapeHtml(machineName)}</span></td>
                <td>${escapeHtml(log.operator)}</td>
                <td><span class="badge badge-sm">${escapeHtml(log.shift)}</span></td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${log.hours}h</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${log.qty}</td>
                <td style="text-align: center;">
                    <button class="btn-icon delete-log-btn" data-index="${index}" title="Delete log entry" style="color: var(--color-error); padding: 2px;">
                        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Bind delete event listeners
    tbody.querySelectorAll('.delete-log-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            const log = state.productionLogs[idx];
            if (log) {
                const part = state.parts.find(p => p.id === log.partId);
                const op = part ? part.operations[log.opIndex] : null;
                if (op) {
                    op.quantity = (op.quantity !== undefined ? op.quantity : part.quantity || 1) + log.qty;
                }
            }
            state.productionLogs.splice(idx, 1);
            saveData();
            renderProductionLogs();
            renderPartsList();
            if (state.isScheduled) {
                runSchedulingAlgorithm(state.algorithm);
                renderScheduleView();
            }
            populateLogPartOpDropdown();
            showNotification('Log entry deleted and quantity restored', 'info');
        });
    });

    renderCompletionSummary();
}

function renderCompletionSummary() {
    const tbody = document.getElementById('completion-summary-tbody');
    if (!tbody) return;

    if (state.parts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No parts added. Add parts first.</td>
            </tr>
        `;
        return;
    }

    let rowsHtml = '';
    state.parts.forEach(part => {
        part.operations.forEach((op, opIndex) => {
            const completed = state.productionLogs
                .filter(log => log.partId === part.id && log.opIndex === opIndex)
                .reduce((sum, log) => sum + log.qty, 0);

            const total = part.quantity || 1;
            const remaining = Math.max(0, total - completed);
            const pct = Math.min(100, Math.round((completed / total) * 100));

            let barColor = 'var(--accent-primary)';
            let statusText = 'In Progress';
            if (completed >= total) {
                barColor = 'var(--color-success)';
                statusText = 'Completed';
            } else if (completed === 0) {
                barColor = 'var(--border-subtle)';
                statusText = 'Not Started';
            }

            rowsHtml += `
                <tr>
                    <td><strong>${escapeHtml(part.name)}</strong></td>
                    <td>Op ${opIndex + 1}: ${escapeHtml(op.opName || 'Unnamed')}</td>
                    <td style="text-align: center; font-family: 'JetBrains Mono', monospace;">${total}</td>
                    <td style="text-align: center; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${completed > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'}">${completed}</td>
                    <td style="text-align: center; font-family: 'JetBrains Mono', monospace; color: ${remaining > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">${remaining}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="flex: 1; background: var(--bg-surface); height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-subtle);">
                                <div style="background: ${barColor}; width: ${pct}%; height: 100%;"></div>
                            </div>
                            <span style="font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; min-width: 32px; text-align: right;">${pct}%</span>
                            <span class="badge ${completed >= total ? 'badge-success' : (completed > 0 ? 'badge-outline' : 'badge-ghost')}" style="font-size: 0.65rem; padding: 2px 6px;">${statusText}</span>
                        </div>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = rowsHtml;
}

function saveProductionLog() {
    const partOpVal = document.getElementById('log-part-op').value;
    const dateVal = document.getElementById('log-date').value;
    const operatorVal = document.getElementById('log-operator').value.trim();
    const shiftVal = document.getElementById('log-shift').value;
    const hoursVal = parseFloat(document.getElementById('log-hours').value);
    const qtyVal = parseInt(document.getElementById('log-qty').value);
    
    if (!partOpVal) {
        showNotification('⚠️ Please select a Part and Operation', 'error');
        return;
    }
    if (!dateVal) {
        showNotification('⚠️ Please select a Date', 'error');
        return;
    }
    if (!operatorVal) {
        showNotification('⚠️ Please enter Operator Name', 'error');
        return;
    }
    if (isNaN(hoursVal) || hoursVal <= 0) {
        showNotification('⚠️ Please enter valid Actual Hours', 'error');
        return;
    }
    if (isNaN(qtyVal) || qtyVal <= 0) {
        showNotification('⚠️ Please enter valid Qty Completed', 'error');
        return;
    }
    
    const [partIdStr, opIndexStr] = partOpVal.split('-');
    const partId = parseInt(partIdStr);
    const opIndex = parseInt(opIndexStr);

    const part = state.parts.find(p => p.id === partId);
    if (!part) {
        showNotification('⚠️ Selected part not found', 'error');
        return;
    }

    const op = part.operations[opIndex];
    if (!op) {
        showNotification('⚠️ Selected operation not found', 'error');
        return;
    }

    const opQty = op.quantity !== undefined ? op.quantity : part.quantity || 1;
    if (qtyVal > opQty) {
        if (!confirm(`Warning: Logged quantity (${qtyVal}) exceeds remaining scheduled quantity for this operation (${opQty}). Set remaining quantity to 0?`)) {
            return;
        }
    }

    op.quantity = Math.max(0, opQty - qtyVal);
    
    const newLog = {
        id: Date.now(),
        partId,
        opIndex,
        date: dateVal,
        operator: operatorVal,
        shift: shiftVal,
        hours: hoursVal,
        qty: qtyVal
    };
    
    state.productionLogs.push(newLog);
    saveData();
    renderProductionLogs();
    renderPartsList();
    populateLogPartOpDropdown();
    if (state.isScheduled) {
        runSchedulingAlgorithm(state.algorithm);
        renderScheduleView();
    }
    
    // Reset form fields except operator and shift/date for convenient batch logging
    document.getElementById('log-part-op').value = '';
    document.getElementById('log-hours').value = '';
    document.getElementById('log-qty').value = '';
    
    showNotification('✅ Production log added and quantity updated successfully', 'success');
}

function exportLogsCSV() {
    if (state.productionLogs.length === 0) {
        showNotification('⚠️ No log entries to export', 'error');
        return;
    }
    
    let csv = 'Date,Part Name,Operation,Machine,Operator,Shift,Actual Hours,Qty Completed\r\n';
    
    state.productionLogs.forEach(log => {
        const part = state.parts.find(p => p.id === log.partId);
        const partName = part ? part.name : 'Unknown Part';
        const op = part ? part.operations[log.opIndex] : null;
        const opName = op ? `Op ${log.opIndex + 1}: ${op.opName || 'Unnamed'}` : `Op ${log.opIndex + 1}`;
        const machine = op ? state.machines.find(m => m.id === op.machineId) : null;
        const machineName = machine ? machine.name : 'Unassigned';
        
        const row = [
            log.date,
            `"${partName.replace(/"/g, '""')}"`,
            `"${opName.replace(/"/g, '""')}"`,
            `"${machineName.replace(/"/g, '""')}"`,
            `"${log.operator.replace(/"/g, '""')}"`,
            `"${log.shift.replace(/"/g, '""')}"`,
            log.hours,
            log.qty
        ].join(',');
        csv += row + '\r\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `production_logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportSummaryCSV() {
    if (state.parts.length === 0) {
        showNotification('⚠️ No parts to export summary for', 'error');
        return;
    }

    let csv = 'Part Name,Operation,Total Qty Required,Qty Completed,Qty Remaining,Completion Pct,Status\r\n';

    state.parts.forEach(part => {
        part.operations.forEach((op, opIndex) => {
            const completed = state.productionLogs
                .filter(log => log.partId === part.id && log.opIndex === opIndex)
                .reduce((sum, log) => sum + log.qty, 0);

            const total = part.quantity || 1;
            const remaining = Math.max(0, total - completed);
            const pct = Math.min(100, Math.round((completed / total) * 100));
            const statusText = completed >= total ? 'Completed' : (completed === 0 ? 'Not Started' : 'In Progress');

            const row = [
                `"${part.name.replace(/"/g, '""')}"`,
                `"Op ${opIndex + 1}: ${(op.opName || 'Unnamed').replace(/"/g, '""')}"`,
                total,
                completed,
                remaining,
                `${pct}%`,
                statusText
            ].join(',');
            csv += row + '\r\n';
        });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `operation_completion_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== QUALITY INSPECTION REPORTS ====================

function populateInspectionPartOpDropdown() {
    const select = document.getElementById('inspect-part-op');
    if (!select) return;

    select.innerHTML = '<option value="">— Select Op —</option>';

    state.parts.forEach(part => {
        part.operations.forEach((op, opIndex) => {
            const machine = state.machines.find(m => m.id === op.machineId);
            const machineName = machine ? machine.name : 'Unassigned';
            const optValue = `${part.id}-${opIndex}`;
            const optText = `${part.name} - Op ${opIndex + 1}: ${op.opName || 'Unnamed'} (on ${machineName})`;
            
            const opt = document.createElement('option');
            opt.value = optValue;
            opt.textContent = optText;
            select.appendChild(opt);
        });
    });

    // Reset spec block
    const specBox = document.getElementById('inspect-spec-box');
    if (specBox) specBox.style.display = 'none';
}

function handleInspectionPartOpChange() {
    const partOpVal = document.getElementById('inspect-part-op').value;
    const tbody = document.getElementById('inspect-checklist-tbody');
    if (!tbody) return;

    if (!partOpVal) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; color: var(--text-muted); padding: 40px;">Select an active part and operation to enter specifications and component checks.</td>
            </tr>
        `;
        return;
    }

    const [partIdStr, opIndexStr] = partOpVal.split('-');
    const partId = parseInt(partIdStr);
    const opIndex = parseInt(opIndexStr);

    const part = state.parts.find(p => p.id === partId);
    const op = part ? part.operations[opIndex] : null;

    if (!op || !op.inspectionChecklist || !op.inspectionChecklist.some(isChecklistItemConfigured)) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; color: var(--text-muted); padding: 40px;">⚠️ No specifications configured for this operation. Add parameters in the Part Form modal first.</td>
            </tr>
        `;
        return;
    }

    // Render the active rows
    tbody.innerHTML = op.inspectionChecklist.map((item, idx) => {
        if (!isChecklistItemConfigured(item)) return ''; // Skip empty rows

        const dimenText = item.dimen !== null && item.dimen !== undefined ? item.dimen : '—';
        const loText = item.loTol !== null && item.loTol !== undefined ? item.loTol : '—';
        const hiText = item.hiTol !== null && item.hiTol !== undefined ? item.hiTol : '—';

        // Generate 10 input fields for Comp 1 to Comp 10
        let compInputsHtml = '';
        for (let c = 1; c <= 10; c++) {
            compInputsHtml += `
                <td style="padding: 4px; text-align: center;">
                    <input type="number" step="0.001" class="input inspect-comp-input" 
                        data-row="${idx}" data-col="${c}" 
                        data-dimen="${item.dimen !== null ? item.dimen : ''}" 
                        data-lotol="${item.loTol !== null ? item.loTol : ''}" 
                        data-hitol="${item.hiTol !== null ? item.hiTol : ''}"
                        placeholder="—" style="font-size: 0.75rem; text-align: center; padding: 2px 4px; height: 26px; min-width: 60px;">
                </td>
            `;
        }

        return `
            <tr data-row="${idx}">
                <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
                <td><strong>${escapeHtml(item.desc || 'Parameter')}</strong></td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace;">${dimenText}</td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace; color: var(--color-error);">${loText}</td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace; color: var(--color-success);">${hiText}</td>
                ${compInputsHtml}
            </tr>
        `;
    }).join('');

    // Attach validation listeners
    tbody.querySelectorAll('.inspect-comp-input').forEach(input => {
        input.addEventListener('input', () => {
            validateChecklistInputs();
        });
    });
}

function validateChecklistInputs() {
    let hasFailures = false;
    let anyFilled = false;
    const inputs = document.querySelectorAll('.inspect-comp-input');
    
    inputs.forEach(input => {
        const valStr = input.value.trim();
        if (valStr === '') {
            input.style.background = '';
            input.style.color = '';
            input.style.borderColor = '';
            return;
        }

        anyFilled = true;
        const val = parseFloat(valStr);
        const dimen = parseFloat(input.dataset.dimen);
        const loTol = parseFloat(input.dataset.lotol);
        const hiTol = parseFloat(input.dataset.hitol);

        if (!isNaN(dimen)) {
            const min = dimen - Math.abs(isNaN(loTol) ? 0 : loTol);
            const max = dimen + Math.abs(isNaN(hiTol) ? 0 : hiTol);
            
            if (val < min || val > max) {
                input.style.background = 'var(--color-error-light, #fee2e2)';
                input.style.color = 'var(--color-error, #ef4444)';
                input.style.borderColor = '#f87171';
                hasFailures = true;
            } else {
                input.style.background = 'var(--color-success-light, #dcfce7)';
                input.style.color = 'var(--color-success, #22c55e)';
                input.style.borderColor = '#86efac';
            }
        }
    });

    // Auto-update status select if there is a failure detected
    const statusSelect = document.getElementById('inspect-status');
    if (statusSelect) {
        if (hasFailures) {
            statusSelect.value = 'Fail';
        } else if (anyFilled) {
            statusSelect.value = 'Pass';
        }
    }
}

function renderInspectionReports() {
    const tbody = document.getElementById('inspection-tbody');
    if (!tbody) return;

    if (!state.inspectionReports || state.inspectionReports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 20px;">No quality inspections recorded yet.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = state.inspectionReports.map((report, index) => {
        const part = state.parts.find(p => p.id === report.partId);
        const partName = part ? part.name : 'Unknown Part';
        const op = part ? part.operations[report.opIndex] : null;
        const opName = op ? `Op ${report.opIndex + 1}: ${op.opName || 'Unnamed'}` : `Op ${report.opIndex + 1}`;

        let badgeClass = 'badge-outline';
        if (report.status === 'Pass') badgeClass = 'badge-success';
        else if (report.status === 'Fail') badgeClass = 'badge-danger';
        else if (report.status === 'Conditional') badgeClass = 'badge-warning';

        return `
            <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${report.date}</td>
                <td><strong>${escapeHtml(partName)}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(opName)}</span></td>
                <td>${escapeHtml(report.inspector)}</td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace;">${report.qtyInspected}</td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace; color: var(--color-success); font-weight:600;">${report.qtyOk}</td>
                <td style="text-align: center; font-family: 'JetBrains Mono', monospace; color: var(--color-error); font-weight:600;">${report.qtyNg}</td>
                <td style="text-align: center;"><span class="badge ${badgeClass}">${report.status}</span></td>
                <td style="font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(report.remarks || '—')}</td>
                <td style="text-align: center;">
                    <button class="btn-icon load-inspection-btn" data-id="${report.id}" title="Retrieve inspection details" style="color: var(--accent-primary); padding: 2px; margin-right: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn-icon export-single-btn" data-id="${report.id}" title="Export this instance to Excel" style="color: var(--color-success); padding: 2px; margin-right: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    </button>
                    <button class="btn-icon delete-inspection-btn" data-index="${index}" title="Delete inspection report" style="color: var(--color-error); padding: 2px;">
                        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5.5 6.5v3.5M8.5 6.5v3.5M3.5 4l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.delete-inspection-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (confirm('Delete this quality inspection report?')) {
                state.inspectionReports.splice(idx, 1);
                saveData();
                renderInspectionReports();
                showNotification('Inspection report deleted', 'info');
            }
        });
    });

    tbody.querySelectorAll('.load-inspection-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            loadInspectionReport(id);
        });
    });

    tbody.querySelectorAll('.export-single-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            exportSingleReportCSV(id);
        });
    });
}

function loadInspectionReport(id) {
    const report = state.inspectionReports.find(r => r.id === id);
    if (!report) return;

    state.activeInspectionReportId = report.id;

    // Populate inputs
    document.getElementById('inspect-part-op').value = `${report.partId}-${report.opIndex}`;
    document.getElementById('inspect-inspector').value = report.inspector;
    document.getElementById('inspect-qty-inspected').value = report.qtyInspected;
    document.getElementById('inspect-qty-ok').value = report.qtyOk;
    document.getElementById('inspect-qty-ng').value = report.qtyNg;
    document.getElementById('inspect-status').value = report.status;
    document.getElementById('inspect-notes').value = report.remarks || '';

    // Render checklist
    handleInspectionPartOpChange();

    // Fill measurements
    if (report.measurements) {
        Object.keys(report.measurements).forEach(rowIdx => {
            const rowVals = report.measurements[rowIdx];
            rowVals.forEach((val, colIdx) => {
                const input = document.querySelector(`.inspect-comp-input[data-row="${rowIdx}"][data-col="${colIdx + 1}"]`);
                if (input) {
                    input.value = val !== null && val !== undefined ? val : '';
                }
            });
        });
    }

    validateChecklistInputs();
    showNotification('📋 Inspection report retrieved successfully', 'success');
}

function clearInspectionForm() {
    state.activeInspectionReportId = null;
    document.getElementById('inspect-part-op').value = '';
    document.getElementById('inspect-inspector').value = '';
    document.getElementById('inspect-qty-inspected').value = '';
    document.getElementById('inspect-qty-ok').value = '';
    document.getElementById('inspect-qty-ng').value = '';
    document.getElementById('inspect-status').value = 'Pass';
    document.getElementById('inspect-notes').value = '';
    handleInspectionPartOpChange();
}

function saveInspectionReport() {
    const partOpVal = document.getElementById('inspect-part-op').value;
    const inspectorVal = document.getElementById('inspect-inspector').value.trim();
    const qtyInspectedVal = parseInt(document.getElementById('inspect-qty-inspected').value) || 0;
    const qtyOkVal = parseInt(document.getElementById('inspect-qty-ok').value) || 0;
    const qtyNgVal = parseInt(document.getElementById('inspect-qty-ng').value) || 0;
    const statusVal = document.getElementById('inspect-status').value;
    const notesVal = document.getElementById('inspect-notes').value.trim();

    if (!partOpVal) {
        showNotification('⚠️ Please select a Part and Operation', 'error');
        return;
    }
    if (!inspectorVal) {
        showNotification('⚠️ Please enter Inspector name', 'error');
        return;
    }
    if (qtyInspectedVal <= 0) {
        showNotification('⚠️ Inspected quantity must be greater than 0', 'error');
        return;
    }
    if (qtyOkVal < 0 || qtyNgVal < 0) {
        showNotification('⚠️ OK and NG quantities cannot be negative', 'error');
        return;
    }
    if (qtyOkVal + qtyNgVal !== qtyInspectedVal) {
        showNotification('⚠️ Sum of OK Qty and NG Qty must equal Inspected Qty', 'error');
        return;
    }

    const [partIdStr, opIndexStr] = partOpVal.split('-');
    const partId = parseInt(partIdStr);
    const opIndex = parseInt(opIndexStr);

    // Collect measurements
    const measurements = {};
    document.querySelectorAll('.inspect-comp-input').forEach(input => {
        const row = input.dataset.row;
        const col = input.dataset.col;
        const val = input.value.trim() !== '' ? parseFloat(input.value) : null;
        if (!measurements[row]) {
            measurements[row] = [];
        }
        measurements[row][col - 1] = val;
    });

    if (state.activeInspectionReportId !== null) {
        // Update existing report
        const report = state.inspectionReports.find(r => r.id === state.activeInspectionReportId);
        if (report) {
            report.partId = partId;
            report.opIndex = opIndex;
            report.inspector = inspectorVal;
            report.qtyInspected = qtyInspectedVal;
            report.qtyOk = qtyOkVal;
            report.qtyNg = qtyNgVal;
            report.status = statusVal;
            report.remarks = notesVal;
            report.measurements = measurements;
            showNotification('✅ Inspection report updated successfully', 'success');
        }
    } else {
        // Create new report
        const report = {
            id: Date.now(),
            partId,
            opIndex,
            date: new Date().toISOString().slice(0, 10),
            inspector: inspectorVal,
            qtyInspected: qtyInspectedVal,
            qtyOk: qtyOkVal,
            qtyNg: qtyNgVal,
            status: statusVal,
            remarks: notesVal,
            measurements
        };
        if (!state.inspectionReports) state.inspectionReports = [];
        state.inspectionReports.push(report);
        showNotification('✅ Inspection report saved successfully', 'success');
    }

    saveData();
    renderInspectionReports();
    clearInspectionForm();
}

function exportInspectionsCSV() {
    if (!state.inspectionReports || state.inspectionReports.length === 0) {
        showNotification('⚠️ No inspection reports to export', 'error');
        return;
    }

    let csv = 'Date,Part Name,Operation,Inspector,Inspected Qty,OK Qty,NG Qty,Overall Status,Remarks,Parameter Sl.No,Parameter Desc,Nominal Dimen,Lo Tol,Hi Tol,Comp 1,Comp 2,Comp 3,Comp 4,Comp 5,Comp 6,Comp 7,Comp 8,Comp 9,Comp 10\r\n';

    state.inspectionReports.forEach(r => {
        const part = state.parts.find(p => p.id === r.partId);
        const partName = part ? part.name : 'Unknown Part';
        const op = part ? part.operations[r.opIndex] : null;
        const opName = op ? `Op ${r.opIndex + 1}: ${op.opName || 'Unnamed'}` : `Op ${r.opIndex + 1}`;

        const checklist = (op && op.inspectionChecklist) ? op.inspectionChecklist.filter(item => item.desc || item.dimen) : [];

        if (checklist.length === 0) {
            const row = [
                r.date,
                `"${partName.replace(/"/g, '""')}"`,
                `"${opName.replace(/"/g, '""')}"`,
                `"${r.inspector.replace(/"/g, '""')}"`,
                r.qtyInspected,
                r.qtyOk,
                r.qtyNg,
                r.status,
                `"${(r.remarks || '').replace(/"/g, '""')}"`,
                '—', '—', '—', '—', '—',
                '','','','','','','','','',''
            ].join(',');
            csv += row + '\r\n';
        } else {
            checklist.forEach((item, idx) => {
                const measurements = (r.measurements && r.measurements[idx]) ? r.measurements[idx] : [];
                const row = [
                    r.date,
                    `"${partName.replace(/"/g, '""')}"`,
                    `"${opName.replace(/"/g, '""')}"`,
                    `"${r.inspector.replace(/"/g, '""')}"`,
                    r.qtyInspected,
                    r.qtyOk,
                    r.qtyNg,
                    r.status,
                    `"${(r.remarks || '').replace(/"/g, '""')}"`,
                    idx + 1,
                    `"${(item.desc || 'Parameter').replace(/"/g, '""')}"`,
                    item.dimen !== null && item.dimen !== undefined ? item.dimen : '—',
                    item.loTol !== null && item.loTol !== undefined ? item.loTol : '—',
                    item.hiTol !== null && item.hiTol !== undefined ? item.hiTol : '—',
                    measurements[0] !== null && measurements[0] !== undefined ? measurements[0] : '',
                    measurements[1] !== null && measurements[1] !== undefined ? measurements[1] : '',
                    measurements[2] !== null && measurements[2] !== undefined ? measurements[2] : '',
                    measurements[3] !== null && measurements[3] !== undefined ? measurements[3] : '',
                    measurements[4] !== null && measurements[4] !== undefined ? measurements[4] : '',
                    measurements[5] !== null && measurements[5] !== undefined ? measurements[5] : '',
                    measurements[6] !== null && measurements[6] !== undefined ? measurements[6] : '',
                    measurements[7] !== null && measurements[7] !== undefined ? measurements[7] : '',
                    measurements[8] !== null && measurements[8] !== undefined ? measurements[8] : '',
                    measurements[9] !== null && measurements[9] !== undefined ? measurements[9] : ''
                ].join(',');
                csv += row + '\r\n';
            });
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `inspection_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCurrentReportCSV() {
    const partOpVal = document.getElementById('inspect-part-op').value;
    if (!partOpVal) {
        showNotification('⚠️ Please select an operation with a configured checklist first', 'error');
        return;
    }

    const [partIdStr, opIndexStr] = partOpVal.split('-');
    const partId = parseInt(partIdStr);
    const opIndex = parseInt(opIndexStr);

    const part = state.parts.find(p => p.id === partId);
    const op = part ? part.operations[opIndex] : null;

    if (!op || !op.inspectionChecklist || !op.inspectionChecklist.some(isChecklistItemConfigured)) {
        showNotification('⚠️ No active checklist configured to export', 'error');
        return;
    }

    const inspector = document.getElementById('inspect-inspector').value.trim() || 'Unassigned';
    const qtyInspected = document.getElementById('inspect-qty-inspected').value || '0';
    const qtyOk = document.getElementById('inspect-qty-ok').value || '0';
    const qtyNg = document.getElementById('inspect-qty-ng').value || '0';
    const status = document.getElementById('inspect-status').value;
    const remarks = document.getElementById('inspect-notes').value.trim() || 'None';
    const dateStr = new Date().toISOString().slice(0, 10);

    let csv = `Inspection Report Details\r\n`;
    csv += `Part Name,${part.name}\r\n`;
    csv += `Operation,Op ${opIndex + 1}: ${op.opName || 'Unnamed'}\r\n`;
    csv += `Date,${dateStr}\r\n`;
    csv += `Inspector,${inspector}\r\n`;
    csv += `Qty Inspected,${qtyInspected}\r\n`;
    csv += `Qty OK,${qtyOk}\r\n`;
    csv += `Qty NG,${qtyNg}\r\n`;
    csv += `Overall Status,${status}\r\n`;
    csv += `Remarks,${remarks}\r\n\r\n`;

    csv += 'Parameter Sl.No,Parameter Desc,Nominal Dimen,Lo Tol,Hi Tol,Comp 1,Comp 2,Comp 3,Comp 4,Comp 5,Comp 6,Comp 7,Comp 8,Comp 9,Comp 10\r\n';

    const activeChecklist = op.inspectionChecklist.filter(isChecklistItemConfigured);
    activeChecklist.forEach((item, idx) => {
        const comps = [];
        for (let c = 1; c <= 10; c++) {
            const input = document.querySelector(`.inspect-comp-input[data-row="${op.inspectionChecklist.indexOf(item)}"][data-col="${c}"]`);
            comps.push(input && input.value.trim() !== '' ? input.value : '');
        }

        const row = [
            idx + 1,
            `"${(item.desc || 'Parameter').replace(/"/g, '""')}"`,
            item.dimen !== null && item.dimen !== undefined ? item.dimen : '—',
            item.loTol !== null && item.loTol !== undefined ? item.loTol : '—',
            item.hiTol !== null && item.hiTol !== undefined ? item.hiTol : '—',
            ...comps
        ].join(',');
        csv += row + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${part.name.replace(/[\/\\?%*:|"<>\s]/g, '_')}_Op${opIndex + 1}_InspectionReport.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportSingleReportCSV(reportId) {
    const report = state.inspectionReports.find(r => r.id === reportId);
    if (!report) return;

    const part = state.parts.find(p => p.id === report.partId);
    const partName = part ? part.name : 'Unknown Part';
    const op = part ? part.operations[report.opIndex] : null;
    const opName = op ? `Op ${report.opIndex + 1}: ${op.opName || 'Unnamed'}` : `Op ${report.opIndex + 1}`;

    const checklist = (op && op.inspectionChecklist) ? op.inspectionChecklist.filter(isChecklistItemConfigured) : [];

    let csv = `Inspection Report Details\r\n`;
    csv += `Part Name,${partName}\r\n`;
    csv += `Operation,${opName}\r\n`;
    csv += `Date,${report.date}\r\n`;
    csv += `Inspector,${report.inspector}\r\n`;
    csv += `Qty Inspected,${report.qtyInspected}\r\n`;
    csv += `Qty OK,${report.qtyOk}\r\n`;
    csv += `Qty NG,${report.qtyNg}\r\n`;
    csv += `Overall Status,${report.status}\r\n`;
    csv += `Remarks,${report.remarks || 'None'}\r\n\r\n`;

    csv += 'Parameter Sl.No,Parameter Desc,Nominal Dimen,Lo Tol,Hi Tol,Comp 1,Comp 2,Comp 3,Comp 4,Comp 5,Comp 6,Comp 7,Comp 8,Comp 9,Comp 10\r\n';

    if (checklist.length === 0) {
        csv += '—,No active specifications checklist configured for this operation.,—,—,—,,,,,,,,,,\r\n';
    } else {
        checklist.forEach((item, idx) => {
            const measurements = (report.measurements && report.measurements[idx]) ? report.measurements[idx] : [];
            const row = [
                idx + 1,
                `"${(item.desc || 'Parameter').replace(/"/g, '""')}"`,
                item.dimen !== null && item.dimen !== undefined ? item.dimen : '—',
                item.loTol !== null && item.loTol !== undefined ? item.loTol : '—',
                item.hiTol !== null && item.hiTol !== undefined ? item.hiTol : '—',
                measurements[0] !== null && measurements[0] !== undefined ? measurements[0] : '',
                measurements[1] !== null && measurements[1] !== undefined ? measurements[1] : '',
                measurements[2] !== null && measurements[2] !== undefined ? measurements[2] : '',
                measurements[3] !== null && measurements[3] !== undefined ? measurements[3] : '',
                measurements[4] !== null && measurements[4] !== undefined ? measurements[4] : '',
                measurements[5] !== null && measurements[5] !== undefined ? measurements[5] : '',
                measurements[6] !== null && measurements[6] !== undefined ? measurements[6] : '',
                measurements[7] !== null && measurements[7] !== undefined ? measurements[7] : '',
                measurements[8] !== null && measurements[8] !== undefined ? measurements[8] : '',
                measurements[9] !== null && measurements[9] !== undefined ? measurements[9] : ''
            ].join(',');
            csv += row + '\r\n';
        });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateFormatted = report.date.replace(/[-]/g, '');
    link.setAttribute('download', `${partName.replace(/[\/\\?%*:|"<>\s]/g, '_')}_Op${report.opIndex + 1}_Inspection_${dateFormatted}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== VIEW SWITCHING ====================

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    const activeTab = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
    if (activeTab) activeTab.classList.add('active');

    const subtitle = document.getElementById('header-subtitle');
    if (viewName === 'masters') {
        subtitle.textContent = 'Master Setup — Configure system settings';
        renderMachineGrid();
        renderOperatorList();
        renderProductionLines();
        renderUsers();
        switchMasterSubView(state.currentMasterSubTab);
    } else if (viewName === 'parts') {
        subtitle.textContent = 'Step 2 — Define parts & operations';
    } else if (viewName === 'database') {
        subtitle.textContent = 'Master Data — Manage Part Templates';
        renderDatabaseList();
    } else if (viewName === 'production-log') {
        subtitle.textContent = 'Production Log — Track actual production work';
        // Set default date to today
        const dateInput = document.getElementById('log-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        populateLogPartOpDropdown();
        populateOperatorDropdown();
        renderProductionLogs();
    } else if (viewName === 'inspections') {
        subtitle.textContent = 'Quality Inspections — Record OK/NG reports per operation';
        populateInspectionPartOpDropdown();
        renderInspectionReports();
    } else {
        subtitle.textContent = 'Step 3 — Analyze your schedule';
    }

    if (viewName === 'schedule' && state.isScheduled) {
        renderScheduleView();
        requestAnimationFrame(() => setTimeout(zoomFit, 100));
    }
}

// ==================== UTILITIES ====================

function formatTime(minutes) {
    if (minutes == null) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDateTime(minutes) {
    if (minutes == null) return '—';
    if (!state.startDate) return formatTime(minutes);
    const d = new Date(state.startDate);
    d.setMinutes(d.getMinutes() + minutes);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day} ${hr}:${min}`;
}

function formatTimelineLabel(minutes) {
    if (!state.startDate) return `${Math.floor(minutes / 60)}h`;
    const d = new Date(state.startDate);
    d.setMinutes(d.getMinutes() + minutes);
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    if (hr === '00' && min === '00') {
         const month = d.toLocaleString('en-US', { month: 'short' });
         const day = d.getDate();
         return `${month} ${day}`;
    }
    return `${hr}:${min}`;
}

function formatTimeShort(minutes) {
    if (minutes == null) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== EXPORT / IMPORT ====================

function exportData() {
    if (state.machines.length === 0 && state.parts.length === 0) {
        showNotification('⚠️ Nothing to save — add machines and parts first', 'error');
        return;
    }

    const exportObj = {
        _format: 'ProductionScheduler_v1',
        exportedAt: new Date().toISOString(),
        startDate: state.startDate,
        opsPerPart: state.opsPerPart,
        machines: state.machines.map(m => ({ id: m.id, name: m.name })),
        parts: state.parts.map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            priority: p.priority || 5,
            operations: p.operations.map(op => ({
                opIndex: op.opIndex,
                priority: op.priority || 5,
                opName: op.opName,
                machineId: op.machineId,
                cycleTime: op.cycleTime,
                setupTime: op.setupTime,
                inspectionSpecs: op.inspectionSpecs || ''
            })),
        })),
        partDatabase: state.partDatabase.map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            priority: p.priority || 5,
            operations: p.operations.map(op => ({
                opIndex: op.opIndex,
                priority: op.priority || 5,
                opName: op.opName,
                machineId: op.machineId,
                cycleTime: op.cycleTime,
                setupTime: op.setupTime,
                inspectionSpecs: op.inspectionSpecs || ''
            })),
        })),
        productionLogs: state.productionLogs,
        operators: state.operators,
        productionLines: state.productionLines,
        users: state.users,
        inspectionReports: state.inspectionReports || []
    };

    const json = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    a.download = `schedule_data_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`💾 Data saved as ${a.download}`, 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validate format
            if (!data.machines || !data.parts) {
                showNotification('⚠️ Invalid file format — missing machines or parts', 'error');
                return;
            }

            state.machines = data.machines || [];
            state.startDate = data.startDate || new Date().toISOString().slice(0, 16);
            state.opsPerPart = data.opsPerPart || 5;
            state.parts = (data.parts || []).map((p, i) => {
                const part = {
                    ...p,
                    quantity: p.quantity || 1,
                    color: getPartColor(i),
                };
                part.operations = (part.operations || []).map(op => ({
                    ...op,
                    quantity: op.quantity !== undefined ? op.quantity : part.quantity || 1,
                    inspectionSpecs: op.inspectionSpecs || ''
                }));
                return part;
            });
            state.partDatabase = (data.partDatabase || []).map(p => ({
                ...p,
                operations: (p.operations || []).map(op => ({
                    ...op,
                    inspectionSpecs: op.inspectionSpecs || ''
                }))
            }));
            state.productionLogs = data.productionLogs || [];
            state.operators = data.operators || [];
            state.productionLines = data.productionLines || [];
            state.users = data.users || [];
            state.inspectionReports = data.inspectionReports || [];
            state.schedule = null;
            state.isScheduled = false;
            state.selectedPart = null;
            state.expandedParts.clear();

            saveData();
            const opsInput = document.getElementById('ops-per-part');
            if (opsInput) opsInput.value = state.opsPerPart;
            renderMachineGrid();
            renderPartsList();
            renderProductionLogs();
            renderOperatorList();
            renderProductionLines();
            renderUsers();
            renderInspectionReports();
            populateOperatorDropdown();
            populateLogPartOpDropdown();
            populateInspectionPartOpDropdown();
            updateCounts();

            showNotification(`📂 Loaded ${state.machines.length} machines, ${state.parts.length} parts, ${state.productionLogs.length} logs, ${state.operators.length} operators, ${state.productionLines.length} lines, and ${state.users.length} users`, 'success');
        } catch (err) {
            showNotification(`⚠️ Failed to read file: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

function importExcelData(file) {
    if (!window.XLSX) {
        showNotification('⚠️ Excel parser not loaded yet. Please try again.', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (rows.length === 0) {
                showNotification('⚠️ Excel file is empty.', 'error');
                return;
            }

            let newPartsCount = 0;
            let newMachinesCount = 0;
            const partsMap = new Map();
            
            rows.forEach(row => {
                const getCol = (name) => {
                    const key = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
                    return key ? row[key] : undefined;
                };

                const partName = getCol('Part Name');
                if (!partName) return; 
                
                if (!partsMap.has(partName)) {
                    partsMap.set(partName, {
                        name: partName.toString(),
                        priority: parseInt(getCol('Part Priority')) || 5,
                        operations: []
                    });
                }
                
                const part = partsMap.get(partName);
                
                const machineName = getCol('Machine Name') ? getCol('Machine Name').toString() : null;
                const opName = getCol('Operation Name') ? getCol('Operation Name').toString() : 'Operation';
                
                let machineId = null;
                if (machineName) {
                    let machine = state.machines.find(m => m.name.toLowerCase() === machineName.toLowerCase());
                    if (!machine) {
                        machineId = state.machines.length > 0 ? Math.max(...state.machines.map(m => m.id)) + 1 : 1;
                        state.machines.push({
                            id: machineId,
                            name: machineName
                        });
                        newMachinesCount++;
                    } else {
                        machineId = machine.id;
                    }
                }
                
                part.operations.push({
                    opIndex: part.operations.length,
                    priority: parseInt(getCol('Operation Priority')) || 5,
                    opName: opName,
                    machineId: machineId,
                    cycleTime: Math.max(0, parseFloat(getCol('Cycle Time')) || 0),
                    setupTime: Math.max(0, parseFloat(getCol('Setup Time')) || 0)
                });
            });
            
            if (partsMap.size === 0) {
                showNotification('⚠️ No valid parts found. Check your column headers.', 'error');
                return;
            }

            partsMap.forEach((partData) => {
                const id = state.partDatabase.length > 0 ? Math.max(...state.partDatabase.map(p => p.id)) + 1 : 1;
                state.partDatabase.push({
                    id: id,
                    name: partData.name,
                    quantity: 1,
                    priority: partData.priority,
                    operations: partData.operations,
                    color: getPartColor(state.parts.length + state.partDatabase.length)
                });
                newPartsCount++;
            });

            saveData();
            if (newMachinesCount > 0) {
                renderMachineGrid();
            }
            renderDatabaseList();
            
            showNotification(`✅ Imported ${newPartsCount} master parts and created ${newMachinesCount} machines`, 'success');
        } catch (err) {
            console.error(err);
            showNotification('⚠️ Failed to parse Excel file. Make sure columns match.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function showNotification(message, type = 'info') {

    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    container.appendChild(notif);
    requestAnimationFrame(() => notif.classList.add('visible'));
    setTimeout(() => {
        notif.classList.remove('visible');
        setTimeout(() => notif.remove(), 300);
    }, 3500);
}

function exportScheduleCSV() {
    if (!state.schedule) {
        showNotification('⚠️ No schedule to export. Run schedule first.', 'error');
        return;
    }

    let csvContent = "Machine Name,Part Name,Operation Number,Operation Name,Quantity,Cycle Time (min),Setup Time (min),Total Process Time (min),Start Time,End Time\n";

    // Loop through machines and gather their tasks
    state.machines.forEach(machine => {
        const mName = machine.name.replace(/"/g, '""');
        
        let tasks = [];
        state.parts.forEach((part, partIdx) => {
            part.operations.forEach(op => {
                if (op.machineId === machine.id && op._startTime != null && op._endTime != null) {
                    tasks.push({ part, op, partIdx });
                }
            });
        });

        // Sort tasks by start time on this machine
        tasks.sort((a, b) => a.op._startTime - b.op._startTime);

        tasks.forEach(task => {
            const pName = task.part.name.replace(/"/g, '""');
            const opNum = task.op.opIndex + 1;
            const opName = task.op.opName ? task.op.opName.replace(/"/g, '""') : `Operation ${opNum}`;
            const qty = task.op.quantity !== undefined ? task.op.quantity : task.part.quantity || 1;
            const cycleTime = task.op.cycleTime || 0;
            const setupTime = task.op.setupTime || 0;
            const processTime = setupTime + (cycleTime * qty);
            
            const startTimeStr = state.startDate ? formatDateTime(task.op._startTime) : `${task.op._startTime}m`;
            const endTimeStr = state.startDate ? formatDateTime(task.op._endTime) : `${task.op._endTime}m`;
            
            csvContent += `"${mName}","${pName}",${opNum},"${opName}",${qty},${cycleTime},${setupTime},${processTime},"${startTimeStr}","${endTimeStr}"\n`;
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `schedule_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==================== INITIALIZATION ====================

function runScheduleAction() {
    if (state.machines.length === 0) {
        showNotification('⚠️ Add at least one machine first', 'error');
        switchView('masters');
        return;
    }
    if (state.parts.length === 0) {
        showNotification('⚠️ Add at least one part first', 'error');
        switchView('parts');
        return;
    }

    const validParts = state.parts.filter(p =>
        p.operations.some(op => op.machineId != null && getProcessingTime(op, p.quantity || 1) > 0)
    );
    if (validParts.length === 0) {
        showNotification('⚠️ At least one part needs operations with machine and time assigned', 'error');
        switchView('parts');
        return;
    }

    const algorithm = document.getElementById('algorithm-select').value;
    state.algorithm = algorithm;
    runSchedulingAlgorithm(algorithm);

    switchView('schedule');
    renderScheduleView();
    requestAnimationFrame(() => setTimeout(zoomFit, 150));

    const algoName = document.getElementById('algorithm-select').selectedOptions[0].text;
    showNotification(`✅ ${algoName} — Makespan: ${formatTime(state.schedule.makespan)}`, 'success');
}

function init() {
    // Load saved data
    const hasData = loadData();
    if (hasData) {
        document.getElementById('schedule-start').value = state.startDate;
        renderMachineGrid();
        renderPartsList();
        renderProductionLogs();
        renderOperatorList();
        renderProductionLines();
        renderUsers();
        renderInspectionReports();
        updateCounts();
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Sub-tab switching inside Master Setup
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMasterSubView(btn.dataset.subtab));
    });

    // Navigation buttons between views
    document.getElementById('btn-goto-parts').addEventListener('click', () => switchView('parts'));
    document.getElementById('btn-goto-machines').addEventListener('click', () => switchView('masters'));
    document.getElementById('btn-goto-schedule').addEventListener('click', runScheduleAction);

    // Add machine
    document.getElementById('btn-add-machine').addEventListener('click', () => openMachineForm(null));

    // Add part
    document.getElementById('btn-add-part').addEventListener('click', () => openPartForm(null, false));

    // Database Actions
    document.getElementById('btn-create-db-part').addEventListener('click', () => openPartForm(null, true));
    document.getElementById('btn-add-db-part').addEventListener('click', openAddFromDatabaseModal);
    document.getElementById('btn-close-db-modal').addEventListener('click', () => {
        document.getElementById('db-modal').classList.remove('active');
    });
    document.getElementById('btn-close-spec-modal').addEventListener('click', () => {
        closeChecklistSpecModal();
    });
    document.getElementById('btn-save-spec-modal').addEventListener('click', () => {
        saveChecklistSpecModal();
    });
    document.getElementById('btn-close-tool-spec-modal').addEventListener('click', () => {
        closeToolSpecModal();
    });
    document.getElementById('btn-save-tool-spec-modal').addEventListener('click', () => {
        saveToolSpecModal();
    });

    // Form buttons
    document.getElementById('btn-cancel-machine').addEventListener('click', closeMachineForm);
    document.getElementById('btn-save-machine').addEventListener('click', saveMachineForm);
    document.getElementById('btn-cancel-part').addEventListener('click', closePartForm);
    document.getElementById('btn-save-part').addEventListener('click', savePartForm);
    
    document.getElementById('btn-add-form-op').addEventListener('click', (e) => {
        e.preventDefault();
        syncFormOperationsFromDOM();
        state.formOperations.push({
            opIndex: state.formOperations.length,
            priority: 5,
            opName: `Operation ${state.formOperations.length + 1}`,
            machineId: state.machines.length > 0 ? state.machines[0].id : null,
            cycleTime: 0,
            setupTime: 0,
            inspectionSpecs: ''
        });
        renderPartFormOps();
    });
    
    // Auto-calculate on quantity change
    document.getElementById('part-form-qty').addEventListener('input', () => {
        updatePartFormTotals();
    });

    // Sample data
    document.getElementById('btn-sample').addEventListener('click', generateSampleData);

    // Clear machines
    document.getElementById('btn-clear-machines').addEventListener('click', () => {
        if (state.machines.length === 0) return;
        if (confirm('Remove all machines?')) {
            state.machines = [];
            state.parts.forEach(p => p.operations.forEach(op => { op.machineId = null; }));
            saveData();
            renderMachineGrid();
            updateCounts();
            showNotification('All machines cleared', 'info');
        }
    });

    // Clear parts
    document.getElementById('btn-clear-parts').addEventListener('click', () => {
        if (state.parts.length === 0) return;
        if (confirm('Remove all parts?')) {
            state.parts = [];
            state.expandedParts.clear();
            saveData();
            renderPartsList();
            updateCounts();
            showNotification('All parts cleared', 'info');
        }
    });

    // Save to file
    document.getElementById('btn-export').addEventListener('click', exportData);

    // Save Production Log Entry
    document.getElementById('btn-save-log').addEventListener('click', saveProductionLog);

    // Save Operator
    document.getElementById('btn-save-operator').addEventListener('click', saveOperator);

    // Save Production Line
    document.getElementById('btn-save-line').addEventListener('click', saveProductionLine);

    // Save User
    document.getElementById('btn-save-user').addEventListener('click', saveUser);

    // Save Quality Inspection
    document.getElementById('btn-save-inspection').addEventListener('click', saveInspectionReport);
    document.getElementById('btn-clear-inspection').addEventListener('click', clearInspectionForm);

    // Export Inspections to CSV (All)
    document.getElementById('btn-export-inspections-csv').addEventListener('click', exportInspectionsCSV);
    // Export Current Active Report to Excel
    document.getElementById('btn-export-current-report-csv').addEventListener('click', exportCurrentReportCSV);

    // Dynamic specs selection change
    document.getElementById('inspect-part-op').addEventListener('change', handleInspectionPartOpChange);

    // Export Logs to CSV
    document.getElementById('btn-export-log-csv').addEventListener('click', exportLogsCSV);

    // Export Summary to CSV
    document.getElementById('btn-export-summary-csv').addEventListener('click', exportSummaryCSV);

    // Load from file
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-import').click();
    });
    document.getElementById('file-import').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });

    // Excel Import
    const excelUpload = document.getElementById('excel-upload');
    if (excelUpload) {
        document.getElementById('btn-import-excel').addEventListener('click', () => {
            excelUpload.click();
        });
        excelUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importExcelData(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // Schedule start date change
    const startDateInput = document.getElementById('schedule-start');
    if (!hasData) startDateInput.value = state.startDate; // Set initial if no data loaded
    startDateInput.addEventListener('change', (e) => {
        state.startDate = e.target.value;
        saveData();
        if (state.isScheduled) {
            renderScheduleView(); // Re-render to update timeline and tooltips
        }
    });

    // Run schedule (header button)
    document.getElementById('btn-schedule').addEventListener('click', runScheduleAction);

    // Export Schedule to CSV
    document.getElementById('btn-export-csv').addEventListener('click', exportScheduleCSV);

    // Algorithm change — re-schedule
    document.getElementById('algorithm-select').addEventListener('change', (e) => {
        state.algorithm = e.target.value;
        if (state.isScheduled) {
            runSchedulingAlgorithm(state.algorithm);
            renderScheduleView();
            requestAnimationFrame(() => setTimeout(zoomFit, 100));
            showNotification(`🔄 Rescheduled with ${e.target.selectedOptions[0].text}`, 'info');
        }
    });

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
    document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
    document.getElementById('btn-zoom-fit').addEventListener('click', zoomFit);

    // Search
    document.getElementById('component-search').addEventListener('input', (e) => searchPart(e.target.value));

    // Ctrl+scroll zoom
    document.getElementById('gantt-viewport')?.addEventListener('wheel', (e) => {
        if (e.ctrlKey) { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); }
    }, { passive: false });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            state.selectedPart = null; unhighlightAll(); renderComponentTable();
            document.getElementById('component-search').value = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
