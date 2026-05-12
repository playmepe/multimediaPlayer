// Multi-Playlist Manager - Con menú hamburguesa lateral
class PlaylistManager {
    constructor() {
        this.playlists = new Map();
        this.currentPlaylistId = null;
        this.nextId = 1;
        this.socket = null;
        this.ws = null;
        this.isLoopEnabled = false;

        this.loadFromLocalStorage();
        this.initWebSockets();
        this.renderPlaylistsMenu();
        this.renderCurrentPlaylist();
        this.setupEventListeners();
        this.startProgressSync();

        console.log('✅ PlaylistManager inicializado');
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('multiPlaylists');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                for (const [id, playlist] of Object.entries(data.playlists)) {
                    this.playlists.set(id, playlist);
                }
                this.currentPlaylistId = data.currentPlaylistId;
                this.nextId = data.nextId || 1;

                if (!this.playlists.has(this.currentPlaylistId) && this.playlists.size > 0) {
                    this.currentPlaylistId = Array.from(this.playlists.keys())[0];
                }
            } catch (e) {
                console.error('Error loading playlists:', e);
                this.createDefaultPlaylist();
            }
        } else {
            this.createDefaultPlaylist();
        }
    }

    createDefaultPlaylist() {
        const id = String(this.nextId++);
        this.playlists.set(id, {
            name: 'Principal',
            items: [],
            currentIndex: 0,
            loopEnabled: false
        });
        this.currentPlaylistId = id;
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        const data = {
            playlists: Object.fromEntries(this.playlists),
            currentPlaylistId: this.currentPlaylistId,
            nextId: this.nextId
        };
        localStorage.setItem('multiPlaylists', JSON.stringify(data));
    }

    createNewPlaylist() {
        const id = String(this.nextId++);
        const name = `Lista ${this.playlists.size + 1}`;
        this.playlists.set(id, {
            name: name,
            items: [],
            currentIndex: 0,
            loopEnabled: false
        });
        this.currentPlaylistId = id;
        this.saveToLocalStorage();
        this.renderPlaylistsMenu();
        this.renderCurrentPlaylist();
        this.syncPlaylistToServer();
        this.closeMenu();
    }

    deletePlaylist(id) {
        if (this.playlists.size === 1) {
            alert('❌ No puedes eliminar la última lista');
            return;
        }

        const playlistName = this.playlists.get(id)?.name;
        if (confirm(`¿Eliminar la lista "${playlistName}"?`)) {
            this.playlists.delete(id);
            if (this.currentPlaylistId === id) {
                this.currentPlaylistId = Array.from(this.playlists.keys())[0];
            }
            this.saveToLocalStorage();
            this.renderPlaylistsMenu();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
        }
    }

    switchToPlaylist(id) {
        if (this.playlists.has(id) && id !== this.currentPlaylistId) {
            this.currentPlaylistId = id;
            this.saveToLocalStorage();
            this.renderPlaylistsMenu();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
            this.requestCurrentState();
            this.closeMenu();
        }
    }

    renamePlaylist(id, newName) {
        const playlist = this.playlists.get(id);
        if (playlist && newName && newName.trim()) {
            playlist.name = newName.trim();
            this.saveToLocalStorage();
            this.renderPlaylistsMenu();
        }
    }

    getCurrentPlaylist() {
        return this.playlists.get(this.currentPlaylistId);
    }

    updateCurrentPlaylist(updates) {
        const playlist = this.getCurrentPlaylist();
        if (playlist) {
            Object.assign(playlist, updates);
            this.saveToLocalStorage();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
        }
    }

    addVideoToCurrentPlaylist(src, title = '') {
        if (!src || src.trim() === '') {
            alert('⚠️ Por favor ingresa una URL o ruta de video');
            return;
        }

        const playlist = this.getCurrentPlaylist();
        if (playlist) {
            playlist.items.push({
                src: src.trim(),
                                title: title.trim() || this.extractTitleFromSrc(src)
            });
            this.saveToLocalStorage();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
        }
    }

    extractTitleFromSrc(src) {
        let filename = src.split('/').pop();
        filename = filename.split('?')[0];
        filename = decodeURIComponent(filename);
        return filename.replace(/\.[^/.]+$/, '') || 'Sin título';
    }

    removeItem(index) {
        const playlist = this.getCurrentPlaylist();
        if (playlist && playlist.items[index]) {
            playlist.items.splice(index, 1);
            if (playlist.currentIndex >= index && playlist.currentIndex > 0) {
                playlist.currentIndex--;
            }
            if (playlist.currentIndex >= playlist.items.length) {
                playlist.currentIndex = Math.max(0, playlist.items.length - 1);
            }
            this.saveToLocalStorage();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
            this.updateNowPlayingDisplay();
        }
    }

    reorderItems(fromIndex, toIndex) {
        const playlist = this.getCurrentPlaylist();
        if (playlist && playlist.items[fromIndex]) {
            const [item] = playlist.items.splice(fromIndex, 1);
            playlist.items.splice(toIndex, 0, item);
            if (playlist.currentIndex === fromIndex) {
                playlist.currentIndex = toIndex;
            } else if (playlist.currentIndex > fromIndex && playlist.currentIndex <= toIndex) {
                playlist.currentIndex--;
            } else if (playlist.currentIndex < fromIndex && playlist.currentIndex >= toIndex) {
                playlist.currentIndex++;
            }
            this.saveToLocalStorage();
            this.renderCurrentPlaylist();
            this.syncPlaylistToServer();
        }
    }

    playVideo(index) {
        const playlist = this.getCurrentPlaylist();
        if (playlist && playlist.items[index]) {
            playlist.currentIndex = index;
            this.saveToLocalStorage();
            this.renderCurrentPlaylist();
            this.updateNowPlayingDisplay();

            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'control',
                    action: 'playVideo',
                    index: index
                }));
            }
        }
    }

    playNext() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'control', action: 'playNext' }));
        }
    }

    updateNowPlayingDisplay() {
        const playlist = this.getCurrentPlaylist();
        const videoTitleElem = document.getElementById('video-title');
        if (playlist && playlist.items[playlist.currentIndex]) {
            const currentVideo = playlist.items[playlist.currentIndex];
            videoTitleElem.innerHTML = `🎬 ${currentVideo.title || currentVideo.src}`;
        } else {
            videoTitleElem.innerHTML = '⏹ No se está reproduciendo nada';
        }
    }

    updateProgressBar(currentTime, duration) {
        const progressBar = document.getElementById('progressBar');
        const videoTimeElem = document.getElementById('videoTime');
        if (duration && duration > 0) {
            const percent = (currentTime / duration) * 100;
            if (progressBar) progressBar.style.width = `${percent}%`;
        }
        if (videoTimeElem) {
            videoTimeElem.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    requestCurrentState() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'requestState' }));
        }
    }

    syncPlaylistToServer() {
        const playlist = this.getCurrentPlaylist();
        if (this.socket && this.socket.readyState === WebSocket.OPEN && playlist) {
            this.socket.send(JSON.stringify({
                type: 'updatePlaylist',
                data: playlist.items
            }));
        }
    }

    initWebSockets() {
        this.socket = new WebSocket(`ws://${window.location.hostname}:8080`);
        this.socket.addEventListener('open', () => {
            console.log('✅ WebSocket conectado (8080)');
            this.syncPlaylistToServer();
            this.requestCurrentState();
        });
        this.socket.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleSocketMessage(msg);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        });
        this.socket.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.ws = new WebSocket(`ws://${window.location.hostname}:8081`);
        this.ws.addEventListener('open', () => {
            console.log('✅ WebSocket secundario conectado (8081)');
        });
        this.ws.addEventListener('message', (event) => {
            const message = event.data;
            if (message.startsWith('LOOP_STATUS:')) {
                const loopStatus = message.split(':')[1]?.trim() === 'true';
                this.updateLoopButton(loopStatus);
            }
        });
    }

    handleSocketMessage(msg) {
        if (msg.src) {
            const decodedSrc = decodeURIComponent(msg.src);
            const filename = decodedSrc.split('/').pop();
            const title = filename.replace(/\.[^/.]+$/, '');
            const videoTitleElem = document.getElementById('video-title');
            if (videoTitleElem) {
                videoTitleElem.innerHTML = `🎬 Reproduciendo: ${title}`;
            }
        }

        if (msg.type === 'playlist' && Array.isArray(msg.data)) {
            const playlist = this.getCurrentPlaylist();
            if (playlist) {
                playlist.items = msg.data;
                this.saveToLocalStorage();
                this.renderCurrentPlaylist();
            }
        }

        if (msg.type === 'state' || msg.type === 'videoInfo' || msg.type === 'sync') {
            const currentTime = msg.currentTime || msg.state?.currentTime || 0;
            const duration = msg.duration || msg.state?.duration || 0;
            const currentIndex = msg.index !== undefined ? msg.index : msg.state?.currentIndex;
            this.updateProgressBar(currentTime, duration);
            if (currentIndex !== undefined) {
                const playlist = this.getCurrentPlaylist();
                if (playlist && playlist.currentIndex !== currentIndex) {
                    playlist.currentIndex = currentIndex;
                    this.saveToLocalStorage();
                    this.renderCurrentPlaylist();
                    this.updateNowPlayingDisplay();
                }
            }
        }
    }

    updateLoopButton(enabled) {
        this.isLoopEnabled = enabled;
        const loopBtn = document.getElementById('loopBtn');
        if (loopBtn) {
            if (enabled) {
                loopBtn.classList.add('active');
                loopBtn.innerHTML = '🔁 ON';
            } else {
                loopBtn.classList.remove('active');
                loopBtn.innerHTML = '🔁 OFF';
            }
        }
    }

    startProgressSync() {
        setInterval(() => {
            this.requestCurrentState();
        }, 2000);
    }

    // Render del menú lateral con todas las listas
    renderPlaylistsMenu() {
        const container = document.getElementById('playlistsList');
        if (!container) return;

        container.innerHTML = '';

        for (const [id, playlist] of this.playlists) {
            const item = document.createElement('div');
            item.className = `playlist-menu-item ${id === this.currentPlaylistId ? 'active' : ''}`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'playlist-menu-name';
            nameSpan.textContent = playlist.name;
            nameSpan.onclick = () => this.switchToPlaylist(id);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'playlist-menu-actions';

            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️';
            renameBtn.className = 'rename-btn';
            renameBtn.title = 'Renombrar';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newName = prompt('✏️ Nuevo nombre:', playlist.name);
                if (newName && newName.trim()) {
                    this.renamePlaylist(id, newName.trim());
                }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Eliminar';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deletePlaylist(id);
            };

            actionsDiv.appendChild(renameBtn);
            actionsDiv.appendChild(deleteBtn);

            item.appendChild(nameSpan);
            item.appendChild(actionsDiv);

            container.appendChild(item);
        }
    }

    // Funciones del menú lateral
    openMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const overlay = document.getElementById('menuOverlay');
        if (sideMenu) sideMenu.classList.add('open');
        if (overlay) overlay.classList.add('show');
    }

    closeMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const overlay = document.getElementById('menuOverlay');
        if (sideMenu) sideMenu.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }

    renderCurrentPlaylist() {
        const playlistElement = document.getElementById('playlist');
        const playlist = this.getCurrentPlaylist();
        const filterText = document.getElementById('filter-input')?.value.toLowerCase() || '';

        if (!playlistElement || !playlist) return;

        if (playlist.items.length === 0) {
            playlistElement.innerHTML = '<li style="text-align: center; padding: 20px; opacity: 0.6;">📋 No hay videos en esta lista</li>';
            return;
        }

        playlistElement.innerHTML = '';

        playlist.items.forEach((item, index) => {
            const li = document.createElement('li');
            const isActive = (index === playlist.currentIndex);
            li.className = `playlist-item ${isActive ? 'active' : ''}`;
            li.dataset.index = index;
            li.draggable = true;

            li.innerHTML = `
            <span class="playlist-item-handle">☰</span>
            <div class="playlist-item-info">
            <div class="playlist-item-title">${this.escapeHtml(item.title || 'Sin título')}</div>
            <div class="playlist-item-path">${this.escapeHtml(item.src)}</div>
            </div>
            <div class="playlist-item-actions">
            <button class="playlist-item-btn play" title="Reproducir">▶</button>
            <button class="playlist-item-btn delete" title="Eliminar">✕</button>
            </div>
            `;

            // Drag and drop
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index);
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    this.reorderItems(fromIndex, toIndex);
                }
            });

            li.querySelector('.play').addEventListener('click', () => this.playVideo(index));
            li.querySelector('.delete').addEventListener('click', () => this.removeItem(index));

            const text = li.textContent.toLowerCase();
            if (filterText && !text.includes(filterText)) {
                li.style.display = 'none';
            }

            playlistElement.appendChild(li);
        });

        this.updateNowPlayingDisplay();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Menú hamburguesa
        const menuBtn = document.getElementById('menuBtn');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const menuOverlay = document.getElementById('menuOverlay');
        const newPlaylistMenuBtn = document.getElementById('newPlaylistMenuBtn');

        menuBtn?.addEventListener('click', () => this.openMenu());
        closeMenuBtn?.addEventListener('click', () => this.closeMenu());
        menuOverlay?.addEventListener('click', () => this.closeMenu());
        newPlaylistMenuBtn?.addEventListener('click', () => this.createNewPlaylist());

        // Botones de control
        document.getElementById('playBtn')?.addEventListener('click', () => {
            this.socket?.send(JSON.stringify({ type: 'control', action: 'play' }));
        });

        document.getElementById('pauseBtn')?.addEventListener('click', () => {
            this.socket?.send(JSON.stringify({ type: 'control', action: 'pause' }));
        });

        document.getElementById('stopBtn')?.addEventListener('click', () => {
            this.socket?.send(JSON.stringify({ type: 'control', action: 'stop' }));
        });

        document.getElementById('nextBtn')?.addEventListener('click', () => {
            this.playNext();
        });

        document.getElementById('loopBtn')?.addEventListener('click', () => {
            this.isLoopEnabled = !this.isLoopEnabled;
            this.updateLoopButton(this.isLoopEnabled);
            this.ws?.send('LOOP_C');
            this.socket?.send(JSON.stringify({
                type: 'control',
                action: 'toggleLoop',
                enabled: this.isLoopEnabled
            }));
        });

        document.getElementById('addVideoBtn')?.addEventListener('click', () => {
            const urlInput = document.getElementById('videoUrlInput');
            const titleInput = document.getElementById('videoTitleInput');
            this.addVideoToCurrentPlaylist(urlInput?.value || '', titleInput?.value || '');
            if (urlInput) urlInput.value = '';
            if (titleInput) titleInput.value = '';
        });

            document.getElementById('videoUrlInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('addVideoBtn')?.click();
                }
            });

            const stopCheckbox = document.getElementById('stopCheckbox');
            stopCheckbox?.addEventListener('change', () => {
                this.socket?.send(JSON.stringify({
                    type: 'control',
                    action: 'updateStopCheckbox',
                    checked: stopCheckbox.checked
                }));
            });

            document.getElementById('clearPlaylistBtn')?.addEventListener('click', () => {
                if (confirm('¿Limpiar todos los videos de esta lista?')) {
                    this.updateCurrentPlaylist({ items: [], currentIndex: 0 });
                }
            });

            document.getElementById('save-playlist')?.addEventListener('click', () => {
                const playlist = this.getCurrentPlaylist();
                const data = JSON.stringify(playlist.items, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `playlist_${playlist.name}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });

            document.getElementById('load-playlist')?.addEventListener('click', () => {
                document.getElementById('playlist-file')?.click();
            });

            document.getElementById('playlist-file')?.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const items = JSON.parse(e.target.result);
                            if (Array.isArray(items)) {
                                this.updateCurrentPlaylist({ items: items, currentIndex: 0 });
                            } else {
                                alert('Archivo inválido');
                            }
                        } catch (error) {
                            alert('Error al cargar: ' + error.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });

            const modeBtn = document.getElementById('toggle-mode');
            modeBtn?.addEventListener('click', () => {
                const current = modeBtn.dataset.mode;
                const next = current === 'multimedia' ? 'youtube' : 'multimedia';
                modeBtn.dataset.mode = next;
                modeBtn.textContent = next === 'multimedia' ? 'Multimedia' : 'YouTube';
                this.ws?.send(next + '-mode');
            });

            document.getElementById('filter-input')?.addEventListener('input', () => {
                this.renderCurrentPlaylist();
            });

            document.getElementById('progressContainer')?.addEventListener('click', (e) => {
                const rect = e.target.closest('.progress-container').getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                this.socket?.send(JSON.stringify({ type: 'control', action: 'seek', time: pos }));
            });

            document.getElementById('header')?.addEventListener('dblclick', () => {
                location.reload();
            });

            window.addEventListener('resize', () => this.adjustLayout());
            setTimeout(() => this.adjustLayout(), 100);
    }

    adjustLayout() {
        const header = document.querySelector('.main-header');
        if (header) {
            const headerHeight = header.offsetHeight;
            document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
        }
    }
}

const playlistManager = new PlaylistManager();
