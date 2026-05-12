const sourcesDiv = document.getElementById('sources');
const displaysDiv = document.getElementById('displays');
const refreshBtn = document.getElementById('refresh');
const closeAllBtn = document.getElementById('closeAllBtn'); // opcional si lo añades

const nameInput = document.getElementById('srcName');
const urlInput = document.getElementById('srcURL');
const addBtn = document.getElementById('addSrc');
const updateBtn = document.getElementById('updateSrc');
const cancelBtn = document.getElementById('cancelEdit');

let editingId = null;
let sources = [];

async function loadSources() {
    sourcesDiv.innerHTML = 'Cargando...';
    sources = await window.electronAPI.getSources();
    renderSources();
}

function renderSources() {
    sourcesDiv.innerHTML = '';
    if (!sources.length) sourcesDiv.innerHTML = '<em>No hay fuentes. Añade una.</em>';
    sources.forEach(s => {
        const el = document.createElement('div');
        el.className = 'source-item';
        el.innerHTML = `
        <div><strong>${s.name}</strong></div>
        <div style="font-size:0.9em;color:#555">${s.url}</div>
        <div style="margin-top:6px;">
        <button data-id="${s.id}" class="edit">Editar</button>
        <button data-id="${s.id}" class="del">Eliminar</button>
        <button data-id="${s.id}" class="preview">Previsualizar</button>
        </div>
        `;
        sourcesDiv.appendChild(el);
    });

    Array.from(sourcesDiv.querySelectorAll('.edit')).forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-id'));
            const s = sources.find(x => x.id === id);
            if (!s) return;
            editingId = id;
            nameInput.value = s.name;
            urlInput.value = s.url;
            addBtn.disabled = true;
            updateBtn.disabled = false;
            cancelBtn.disabled = false;
        });
    });

    Array.from(sourcesDiv.querySelectorAll('.del')).forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            if (!confirm('Eliminar fuente?')) return;
            await window.electronAPI.removeSource(id);
            await loadSources();
            await renderDisplays();
        });
    });

    Array.from(sourcesDiv.querySelectorAll('.preview')).forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            const s = sources.find(x => x.id === id);
            if (!s) return;
            await window.electronAPI.previewURL(s.url);
        });
    });
}

addBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!url) return alert('URL requerida');
    await window.electronAPI.addSource({ name, url });
    nameInput.value = '';
    urlInput.value = '';
    await loadSources();
    await renderDisplays();
});

updateBtn.addEventListener('click', async () => {
    if (!editingId) return;
    const updated = { id: editingId, name: nameInput.value.trim(), url: urlInput.value.trim() };
    await window.electronAPI.updateSource(updated);
    editingId = null;
    nameInput.value = '';
    urlInput.value = '';
    addBtn.disabled = false;
    updateBtn.disabled = true;
    cancelBtn.disabled = true;
    await loadSources();
    await renderDisplays();
});

cancelBtn.addEventListener('click', () => {
    editingId = null;
    nameInput.value = '';
    urlInput.value = '';
    addBtn.disabled = false;
    updateBtn.disabled = true;
    cancelBtn.disabled = true;
});
/*
async function renderDisplays() {
    displaysDiv.innerHTML = 'Cargando...';
    try {
        const displays = await window.electronAPI.getDisplays();
        displaysDiv.innerHTML = '';
        sources = await window.electronAPI.getSources();

        displays.forEach(d => {
            const el = document.createElement('div');
            el.className = 'box';
            el.style.marginBottom = '8px';

            const opts = sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            el.innerHTML = `
            <div><strong>ID:</strong> ${d.id} — ${d.size.width}x${d.size.height} ${d.internal ? '(integrada)' : ''}</div>
            <div style="margin-top:6px;">
            <select data-id="${d.id}" class="srcSelect" style="width:60%;">${opts}</select>
            <button data-id="${d.id}" class="projBtn">Proyectar</button>
            <button data-id="${d.id}" class="closeBtn">Cerrar proyección</button>
            </div>
            `;
            displaysDiv.appendChild(el);
        });

        Array.from(displaysDiv.querySelectorAll('.projBtn')).forEach(btn => {
            btn.addEventListener('click', async () => {
                const displayId = Number(btn.getAttribute('data-id'));
                const sel = displaysDiv.querySelector(`select[data-id="${displayId}"]`);
                if (!sel) return;
                const srcId = Number(sel.value);
                const s = sources.find(x => x.id === srcId);
                if (!s) return alert('Fuente no encontrada');
                try {
                    await window.electronAPI.openOnDisplay(displayId, s.url);
                } catch (err) {
                    alert('Error proyectando: ' + err.message);
                }
            });
        });

        Array.from(displaysDiv.querySelectorAll('.closeBtn')).forEach(btn => {
            btn.addEventListener('click', async () => {
                const displayId = Number(btn.getAttribute('data-id'));
                const res = await window.electronAPI.closeProjectionOn(displayId);
                if (!res.closed) alert('No había proyección en esa pantalla');
            });
        });

    } catch (err) {
        displaysDiv.innerHTML = 'Error: ' + err.message;
    }
}
*/
async function renderDisplays() {
    displaysDiv.innerHTML = 'Cargando...';
    try {
        const displays = await window.electronAPI.getDisplays();
        displaysDiv.innerHTML = '';
        sources = await window.electronAPI.getSources();

        displays.forEach(d => {
            const el = document.createElement('div');
            el.className = 'box display-item';
            el.style.marginBottom = '8px';

            const opts = sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

            // Información detallada del monitor
            const displayInfo = `
            <div><strong>${d.name}</strong></div>
            <div style="font-size:0.9em;color:#555;">
            Resolución: ${d.resolution} |
            ${d.frequency}Hz |
            Posición: ${d.position}
            ${d.internal ? ' | (Integrada)' : ''}
            ${d.isPrimary ? ' | <strong>PRIMARIA</strong>' : ''}
            </div>
            <div style="font-size:0.8em;color:#777;">
            Fabricante: ${d.manufacturer} |
            Modelo: ${d.model}
            </div>
            `;

            el.innerHTML = `
            ${displayInfo}
            <div style="margin-top:6px;">
            <select data-id="${d.id}" class="srcSelect" style="width:60%;">${opts}</select>
            <button data-id="${d.id}" class="projBtn">Proyectar</button>
            <button data-id="${d.id}" class="closeBtn">Cerrar</button>
            </div>
            `;
            displaysDiv.appendChild(el);
        });

        // Resto del código sin cambios...
        Array.from(displaysDiv.querySelectorAll('.projBtn')).forEach(btn => {
            btn.addEventListener('click', async () => {
                const displayId = Number(btn.getAttribute('data-id'));
                const sel = displaysDiv.querySelector(`select[data-id="${displayId}"]`);
                if (!sel) return;
                const srcId = Number(sel.value);
                const s = sources.find(x => x.id === srcId);
                if (!s) return alert('Fuente no encontrada');
                try {
                    await window.electronAPI.openOnDisplay(displayId, s.url);
                } catch (err) {
                    alert('Error proyectando: ' + err.message);
                }
            });
        });

        Array.from(displaysDiv.querySelectorAll('.closeBtn')).forEach(btn => {
            btn.addEventListener('click', async () => {
                const displayId = Number(btn.getAttribute('data-id'));
                const res = await window.electronAPI.closeProjectionOn(displayId);
                if (!res.closed) alert('No había proyección en esa pantalla');
            });
        });

    } catch (err) {
        displaysDiv.innerHTML = 'Error: ' + err.message;
    }
}

refreshBtn.addEventListener('click', () => {
    loadSources();
    renderDisplays();
});

window.electronAPI.onDisplaysChanged(() => renderDisplays());
window.electronAPI.onProjectionClosed((data) => {
    // data.displayId indica qué pantalla cerró
    console.log('Proyección cerrada en', data.displayId);
    renderDisplays();
});
window.electronAPI.onProjectionOpened((data) => {
    console.log('Proyección abierta en', data.displayId, data.url);
    renderDisplays();
});

loadSources();
renderDisplays();
