document.addEventListener('DOMContentLoaded', () => {
    // --- INICIO: VARIABLES DE PAGINACIÓN ---
    const videosPerPage = 50;
    let currentPage = 1;
    let totalVideos = 0;
    // --- FIN: VARIABLES DE PAGINACIÓN ---

    const jsonUrl = '/media/nuevas_descargas_videos.json';
    const videoList = document.getElementById('video-list');
    const menuSection = document.getElementById('menu');
    const searchInput = document.getElementById('search-input');
    const menuToggle = document.getElementById('menuToggle');
    const playlistButton = document.getElementById('playlistButton');
    const bibliaButton = document.getElementById('bibliaButton');
    const selectAllButton = document.getElementById('selectAllButton');
    const addSelectedButton = document.getElementById('addSelectedButton');
    const paginationControls = document.getElementById('pagination-controls');

    // --- VARIABLES PARA CONTROL DE TIPO DE ARCHIVOS ---
    let showImages = false; // Por defecto no mostrar imágenes
    const imageExtensions = ['jpeg', 'jpg', 'webp', 'png'];

    // --- CREAR BOTÓN PARA CONTROLAR IMÁGENES ---
    const toggleImagesButton = document.createElement('button');
    toggleImagesButton.id = 'toggleImagesButton';
    toggleImagesButton.classList.add('toggle-images-btn');
    toggleImagesButton.textContent = showImages ? 'Ocultar Imágenes' : 'Mostrar Imágenes';

    // Insertar el botón después del campo de búsqueda
    searchInput.parentNode.insertBefore(toggleImagesButton, searchInput.nextSibling);

    // WebSockets
    const socket = new WebSocket(`ws://${window.location.hostname}:8080`);
    const ws = new WebSocket(`ws://${window.location.hostname}:8081`);

    const videoTitle = document.getElementById('video-title');

    let allVideos = [];
    let currentPlaylist = [];
    let lastStateTimestamp = 0;
    let currentIndex = 0;
    const videoExtensions = ['mp4', 'avi', 'webm', 'wmv', 'mkv'];

    // Variables para listas programadas (mantener las existentes)
    const toggleScheduledListsBtn = document.getElementById('toggleScheduledLists');
    const scheduledListsContainer = document.getElementById('scheduledListsContainer');
    const closeScheduledListsBtn = document.getElementById('closeScheduledLists');
    const scheduledListsElement = document.getElementById('scheduledLists');
    const addScheduledListBtn = document.getElementById('addScheduledList');
    const scheduledListForm = document.getElementById('scheduledListForm');
    const saveScheduledListBtn = document.getElementById('saveScheduledList');
    const cancelScheduledListBtn = document.getElementById('cancelScheduledList');
    const listNameInput = document.getElementById('listName');
    const listTimeInput = document.getElementById('listTime');
    const listDaysSelect = document.getElementById('listDays');

    // Variables para el modal de gestión de videos
    const modalOverlay = document.getElementById('modalOverlay');
    const videoManagementModal = document.getElementById('videoManagementModal');
    const closeVideoModalBtn = document.getElementById('closeVideoModal');
    const modalListTitle = document.getElementById('modalListTitle');
    const availableVideosList = document.getElementById('availableVideosList');
    const currentListVideos = document.getElementById('currentListVideos');
    const saveVideoChangesBtn = document.getElementById('saveVideoChanges');
    const cancelVideoChangesBtn = document.getElementById('cancelVideoChanges');

    let scheduledLists = JSON.parse(localStorage.getItem('scheduledLists')) || [];
    let currentEditingIndex = -1;
    let currentVideoManagementIndex = -1;
    let checkInterval;
    let isPlayingScheduledList = false;
    let originalPlaylist = [];
    let currentPlayingIndex = -1;

    // --- EVENT LISTENER PARA EL BOTÓN DE IMÁGENES ---
    toggleImagesButton.addEventListener('click', () => {
        showImages = !showImages;
        toggleImagesButton.textContent = showImages ? 'Ocultar Imágenes' : 'Mostrar Imágenes';
        currentPage = 1; // Reiniciar a la primera página
        filterVideos(); // Aplicar filtro
    });

    // Event listeners para los botones existentes
    document.getElementById('pantallaButton').addEventListener('click', function() {
        const url = '../OBS_PantallaMixRes5aNPM.html';
        const width = 1920;
        const height = 1080;
        const left = 1920;
        const top = 0;
        window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
        return false;
    });

    document.getElementById('pantallaButton2').addEventListener('click', function() {
        const url = '../proyector.html';
        const width = 1920;
        const height = 1080;
        const left = 1920;
        const top = 0;
        window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left}`);
        return false;
    });

    document.getElementById('playlistButton').addEventListener('click', function() {
        window.open('../listaOBS_Control.html', '_blank');
    });

    document.getElementById('bibliaButton').addEventListener('click', function() {
        window.open('../indexBiblia.html', '_blank');
    });

    // Actualizar media.json
    document.getElementById('generateButton').addEventListener('click', () => {
        fetch('/api/generate-media')
        .then(response => response.text())
        .then(data => {
            console.log(data);
            alert('Generación en progreso...');
            location.reload();
        })
        .catch(error => console.error('Error:', error));
    });

    document.getElementById('generateButton2').addEventListener('click', () => {
        fetch('/api/generate-media')
        .then(response => response.text())
        .then(data => {
            console.log(data);
            alert('Generación en progreso...');
            location.reload();
        })
        .catch(error => console.error('Error:', error));
    });

    // --- FUNCIÓN MODIFICADA: filterVideos ---
    // Ahora incluye el filtro de imágenes
 /*   function filterVideos() {
        const searchTerm = normalizeString(searchInput.value);

        let filteredVideos = allVideos;

        // Aplicar filtro de tipo de archivo
        filteredVideos = filteredVideos.filter(video => {
            if (!video.action) return false;

            const extension = video.action.split('.').pop().toLowerCase();
            const isVideo = videoExtensions.includes(extension);
            const isImage = imageExtensions.includes(extension);

            // Si mostrar imágenes está desactivado, solo mostrar videos
            if (!showImages) {
                return isVideo;
            }
            // Si mostrar imágenes está activado, mostrar ambos
            return isVideo || isImage;
        });

        // Aplicar filtro de búsqueda si hay término
        if (searchTerm.length >= 3) {
            filteredVideos = filteredVideos.filter(video => {
                const normalizedTitle = video.title ? normalizeString(video.title) : '';
                const normalizedAction = video.action ? normalizeString(video.action) : '';
                const normalizedPlayerLabel = video.playerLabel ? normalizeString(video.playerLabel) : '';
                return normalizedTitle.includes(searchTerm) ||
                normalizedAction.includes(searchTerm) ||
                normalizedPlayerLabel.includes(searchTerm);
            });
        }

        currentPage = 1;
        displayVideos(filteredVideos);
    }
*/
    function filterVideos() {
        const searchTerm = normalizeString(searchInput.value);

        let filteredVideos = allVideos;

        // Si no hay videos, mostrar mensaje
        if (!filteredVideos || filteredVideos.length === 0) {
            videoList.innerHTML = '<p>No se encontraron archivos.</p>';
            paginationControls.innerHTML = '';
            return;
        }

        // Aplicar filtro de tipo de archivo
        filteredVideos = filteredVideos.filter(video => {
            if (!video || !video.action) return false;

            const extension = video.action.split('.').pop().toLowerCase();
            const isVideo = videoExtensions.includes(extension);
            const isImage = imageExtensions.includes(extension);

            // Si mostrar imágenes está desactivado, solo mostrar videos
            if (!showImages) {
                return isVideo;
            }
            // Si mostrar imágenes está activado, mostrar ambos
            return isVideo || isImage;
        });

        // Aplicar filtro de búsqueda si hay término
        if (searchTerm.length >= 3) {
            filteredVideos = filteredVideos.filter(video => {
                const normalizedTitle = video.title ? normalizeString(video.title) : '';
                const normalizedAction = video.action ? normalizeString(video.action) : '';
                const normalizedPlayerLabel = video.playerLabel ? normalizeString(video.playerLabel) : '';
                return normalizedTitle.includes(searchTerm) ||
                normalizedAction.includes(searchTerm) ||
                normalizedPlayerLabel.includes(searchTerm);
            });
        }

        currentPage = 1;
        displayVideos(filteredVideos);
    }

    // --- FUNCIÓN PARA FORMATEAR DURACIÓN ---
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '--:--';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // --- FUNCIÓN PARA OBTENER DURACIÓN DEL VIDEO ---
    function getVideoDuration(videoPath) {
        if (videoPath.duration) {
            return Promise.resolve(videoPath.duration);
        }

        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoPath.action || videoPath;
            video.addEventListener('loadedmetadata', () => {
                resolve(video.duration);
            });
            video.addEventListener('error', () => {
                resolve(0);
            });
            setTimeout(() => resolve(0), 3000);
        });
    }

    // --- FUNCIÓN MODIFICADA: displayVideos ---
    // Ahora diferencia entre videos e imágenes
/*    async function displayVideos(videosToDisplay = null) {
        const videos = videosToDisplay || allVideos;
        totalVideos = videos.length;

        if (totalVideos === 0) {
            videoList.innerHTML = '<p>No se encontraron archivos.</p>';
            paginationControls.innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;
        const paginatedVideos = videos.slice(startIndex, endIndex);

        videoList.innerHTML = '';

        for (const item of paginatedVideos) {
            if (!item.action || !item.icon || !item.title) {
                console.warn('Item incompleto:', item);
                continue;
            }

            const videoItem = document.createElement('div');
            videoItem.classList.add('video-item');

            const extension = item.action.split('.').pop().toLowerCase();
            const isVideo = videoExtensions.includes(extension);
            const isImage = imageExtensions.includes(extension);

            if (isVideo) {
                videoItem.classList.add('is-video');
            } else if (isImage) {
                videoItem.classList.add('is-image');
            }

            // Obtener duración solo para videos
            let duration = '--:--';
            if (isVideo) {
                try {
                    const videoDuration = await getVideoDuration(item);
                    duration = formatDuration(videoDuration);
                } catch (error) {
                    console.warn('Error al obtener duración:', error);
                }
            }

            const videoItemHTML = `
            <div class="video-checkbox">
            ${isVideo ? `<input type="checkbox" class="video-check" data-video-src="${item.action}" data-title="${item.title}">` : ''}
            </div>
            <a href="#" data-video-src="${item.action}">
            <img src="${item.icon}" alt="${item.title}" class="video-thumbnail">
            <div class="video-details">
            <h2 class="video-title">${item.title}</h2>
            ${isVideo ? `<span class="video-duration">${duration}</span>` : ''}
            ${isImage ? `<span class="file-type-badge">IMAGEN</span>` : ''}
            </div>
            </a>
            ${isVideo ? `<button class="add-to-playlist" data-video-src="${item.action}" data-title="${item.title}">Añadir a Lista</button>` : ''}
            `;

            videoItem.innerHTML = videoItemHTML;

            if (isVideo) {
                videoItem.querySelector('.add-to-playlist').addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const title = e.target.dataset.title;
                    addToPlaylist(src, title);
                });
            }

            videoItem.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
            });

            // Botones según el tipo de archivo
            if (isVideo) {
                const reproducirButton = document.createElement('button');
                reproducirButton.classList.add('reproducir-button');
                reproducirButton.textContent = 'Reproducir';
                reproducirButton.dataset.videoSrc = item.action;

                reproducirButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `VIDEO_URL:${path}`;
                    ws.send(message);
                    console.log(`Reproducir: ${src}`);
                });

                videoItem.appendChild(reproducirButton);
            } else if (isImage) {
                const projectButton = document.createElement('button');
                projectButton.classList.add('project-button');
                projectButton.textContent = 'Proyectar';
                projectButton.dataset.videoSrc = item.action;

                projectButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `cambiarimagen:${path}`;
                    ws.send(message);
                    console.log(`Proyectar: ${message}`);
                });

                videoItem.appendChild(projectButton);
            }

            // Botón eliminar para todos los tipos
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('eliminar-button');
            deleteButton.textContent = 'Eliminar';
            deleteButton.dataset.videoSrc = item.action;

            deleteButton.addEventListener('click', (e) => {
                e.preventDefault();
                const src = e.target.dataset.videoSrc;
                if (confirm(`¿Estás seguro de que quieres eliminar ${src}?`)) {
                    const relativePath = src.replace('/api/vplay/', '');
                    console.log('Ruta relativa del archivo a eliminar:', relativePath);
                    fetch(`/api/videos/${relativePath}`, {
                        method: 'DELETE'
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Error al eliminar el archivo');
                        }
                        alert('Archivo eliminado correctamente');
                        // Recargar la lista
                        filterVideos();
                    })
                    .catch(err => {
                        console.error('Error al eliminar el archivo:', err);
                        alert('No se pudo eliminar el archivo.');
                    });
                }
            });

            videoItem.appendChild(deleteButton);
            videoList.appendChild(videoItem);
        }

        renderPagination();
    }
    */
    async function displayVideos(videosToDisplay = null) {
        const videos = videosToDisplay || allVideos;
        totalVideos = videos.length;

        if (totalVideos === 0) {
            videoList.innerHTML = '<p>No se encontraron archivos.</p>';
            paginationControls.innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;
        const paginatedVideos = videos.slice(startIndex, endIndex);

        videoList.innerHTML = '';

        for (const item of paginatedVideos) {
            if (!item.action || !item.icon || !item.title) {
                console.warn('Item incompleto:', item);
                continue;
            }

            const videoItem = document.createElement('div');
            videoItem.classList.add('video-item');

            const extension = item.action.split('.').pop().toLowerCase();
            const isVideo = videoExtensions.includes(extension);
            const isImage = imageExtensions.includes(extension);

            if (isVideo) {
                videoItem.classList.add('is-video');
            } else if (isImage) {
                videoItem.classList.add('is-image');
            }

            // Obtener duración solo para videos
            let duration = '--:--';
            if (isVideo) {
                try {
                    const videoDuration = await getVideoDuration(item);
                    duration = formatDuration(videoDuration);
                } catch (error) {
                    console.warn('Error al obtener duración:', error);
                }
            }

            const videoItemHTML = `
            <div class="video-checkbox">
            ${isVideo ? `<input type="checkbox" class="video-check" data-video-src="${item.action}" data-title="${item.title}">` : ''}
            </div>
            <a href="#" data-video-src="${item.action}">
            <img src="${item.icon}" alt="${item.title}" class="video-thumbnail">
            <div class="video-details">
            <h2 class="video-title">${item.title}</h2>
            ${isVideo ? `<span class="video-duration">${duration}</span>` : ''}
            ${isImage ? `<span class="file-type-badge">IMAGEN</span>` : ''}
            </div>
            </a>
            ${isVideo ? `<button class="add-to-playlist" data-video-src="${item.action}" data-title="${item.title}">Añadir a Lista</button>` : ''}
            `;

            videoItem.innerHTML = videoItemHTML;

            if (isVideo) {
                videoItem.querySelector('.add-to-playlist').addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const title = e.target.dataset.title;
                    addToPlaylist(src, title);
                });
            }

            videoItem.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
            });

            // Contenedor para botones de acción
            const actionButtonsContainer = document.createElement('div');
            actionButtonsContainer.classList.add('action-buttons');

            // Botones según el tipo de archivo
            if (isVideo) {
                // Botón Reproducir en Player 1
                const reproducirButton = document.createElement('button');
                reproducirButton.classList.add('reproducir-button');
                reproducirButton.textContent = 'PLAY';
                reproducirButton.dataset.videoSrc = item.action;

                reproducirButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `VIDEO_URL:${path}`;
                    ws.send(message);
                    console.log(`Reproducir en Player 1: ${src}`);
                });

                actionButtonsContainer.appendChild(reproducirButton);

                // Botón Reproducir en Player 2
                const reproducirButton2 = document.createElement('button');
                reproducirButton2.classList.add('reproducir-button2');
                reproducirButton2.textContent = 'FONDO';
                reproducirButton2.dataset.videoSrc = item.action;

                reproducirButton2.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `VIDEO_URL2:${path}`;
                    ws.send(message);
                   // ws.send('LOOP_C');
                    console.log(`Reproducir en Player 2: ${src}`);
                });

                actionButtonsContainer.appendChild(reproducirButton2);

            } else if (isImage) {
                // Botón Proyectar en Player 1
                const projectButton = document.createElement('button');
                projectButton.classList.add('project-button');
                projectButton.textContent = 'Proyectar P1';
                projectButton.dataset.videoSrc = item.action;

                projectButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `cambiarimagen:${path}`;
                    ws.send(message);
                    console.log(`Proyectar en Player 1: ${message}`);
                });

                actionButtonsContainer.appendChild(projectButton);

                // Botón Proyectar en Player 2
                const projectButton2 = document.createElement('button');
                projectButton2.classList.add('project-button2');
                projectButton2.textContent = 'Proyectar P2';
                projectButton2.dataset.videoSrc = item.action;

                projectButton2.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = e.target.dataset.videoSrc;
                    const path = src.replace(/^https?:\/\/[^/]+/, '');
                    const message = `cambiarimagen2:${path}`;
                    ws.send(message);
                    console.log(`Proyectar en Player 2: ${message}`);
                });

                actionButtonsContainer.appendChild(projectButton2);
            }

            // Botón eliminar para todos los tipos
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('eliminar-button');
            deleteButton.textContent = 'Eliminar';
            deleteButton.dataset.videoSrc = item.action;

            deleteButton.addEventListener('click', (e) => {
                e.preventDefault();
                const src = e.target.dataset.videoSrc;
                if (confirm(`¿Estás seguro de que quieres eliminar ${src}?`)) {
                    const relativePath = src.replace('/api/vplay/', '');
                    console.log('Ruta relativa del archivo a eliminar:', relativePath);
                    fetch(`/api/videos/${relativePath}`, {
                        method: 'DELETE'
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Error al eliminar el archivo');
                        }
                        alert('Archivo eliminado correctamente');
                        // Recargar la lista
                        filterVideos();
                    })
                    .catch(err => {
                        console.error('Error al eliminar el archivo:', err);
                        alert('No se pudo eliminar el archivo.');
                    });
                }
            });

            actionButtonsContainer.appendChild(deleteButton);
            videoItem.appendChild(actionButtonsContainer);
            videoList.appendChild(videoItem);
        }

        renderPagination();
    }

    // Las funciones restantes se mantienen igual...
    function renderPagination() {
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalVideos / videosPerPage);

        if (totalPages <= 1) {
            return;
        }

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Anterior';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayVideos();
            }
        });
        paginationControls.appendChild(prevButton);

        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        if (startPage > 1) {
            const firstPageButton = createPageButton(1);
            paginationControls.appendChild(firstPageButton);
            if (startPage > 2) {
                paginationControls.appendChild(document.createTextNode(' ... '));
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = createPageButton(i);
            paginationControls.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationControls.appendChild(document.createTextNode(' ... '));
            }
            const lastPageButton = createPageButton(totalPages);
            paginationControls.appendChild(lastPageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayVideos();
            }
        });
        paginationControls.appendChild(nextButton);
    }

    function createPageButton(pageNum) {
        const button = document.createElement('button');
        button.textContent = pageNum;
        if (pageNum === currentPage) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            currentPage = pageNum;
            displayVideos();
        });
        return button;
    }

    function toggleMenu() {
        const menu = document.getElementById('sidebarMenu');
        menu.classList.toggle('active');
        localStorage.setItem('menuHidden', menu.classList.contains('active'));
    }

    function loadAllVideos() {
        return fetch('/media/all_videos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            allVideos = data.items;
            displayVideos();
            console.log(`Total de archivos: ${allVideos.length}`);
        })
        .catch(error => console.error('Error al cargar el JSON de videos:', error));
    }
/*
    function loadVideoList(filename) {
        console.log(`Cargando lista de videos: ${filename}`);

        fetch(`/media/${filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.items && Array.isArray(data.items)) {
                allVideos = allVideos.concat(data.items);
                console.log(`Total de archivos acumulados: ${allVideos.length}`);
                displayVideos(allVideos);
            } else {
                console.warn('No se encontraron items en el JSON.');
            }
        })
        .catch(error => console.error('Error al cargar el JSON de videos:', error));
    }
    */
    function loadVideoList(filename) {
        console.log(`Cargando lista de videos: ${filename}`);

        fetch(`/media/${filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.items && Array.isArray(data.items)) {
                // Reemplazar completamente allVideos en lugar de concatenar
                allVideos = data.items;
                console.log(`Archivos cargados: ${allVideos.length}`);

                // Aplicar filtros actuales (búsqueda y tipo de archivo)
                filterVideos();
            } else {
                console.warn('No se encontraron items en el JSON.');
                allVideos = [];
                displayVideos();
            }
        })
        .catch(error => {
            console.error('Error al cargar el JSON de videos:', error);
            allVideos = [];
            displayVideos();
        });
    }

    function normalizeString(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function toggleSelectAllVideos() {
        const videoCheckboxes = document.querySelectorAll('.is-video .video-check');
        if (videoCheckboxes.length === 0) return;
        const allChecked = Array.from(videoCheckboxes).every(checkbox => checkbox.checked);
        videoCheckboxes.forEach(checkbox => {
            checkbox.checked = !allChecked;
        });
        selectAllButton.textContent = allChecked ? 'Seleccionar videos' : 'Deseleccionar videos';
    }

    function addSelectedVideosToPlaylist() {
        const videoCheckboxes = document.querySelectorAll('.is-video .video-check:checked');
        if (videoCheckboxes.length === 0) {
            alert('Por favor selecciona al menos un video');
            return;
        }
        let playlist = JSON.parse(localStorage.getItem('playlist')) || [];
        let addedCount = 0;
        videoCheckboxes.forEach(checkbox => {
            const src = checkbox.dataset.videoSrc;
            const title = checkbox.dataset.title;
            if (!playlist.some(video => video.src === src)) {
                playlist.push({ src, title });
                addedCount++;
            }
        });
        localStorage.setItem('playlist', JSON.stringify(playlist));
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'updatePlaylist', data: playlist }));
        }
        alert(`Se añadieron ${addedCount} videos a la playlist`);
    }

    function addToPlaylist(src, title) {
        let playlist = JSON.parse(localStorage.getItem('playlist')) || [];
        if (!playlist.some(video => video.src === src)) {
            playlist.push({ src, title });
            localStorage.setItem('playlist', JSON.stringify(playlist));
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'updatePlaylist', data: playlist }));
            } else {
                console.warn('WebSocket no está conectado.');
            }
        } else {
            console.log('El video ya está en la lista de reproducción.');
        }
    }


 /*   function fetchMenu() {
        fetch('/datosimagen/menuhide.txt')
        .then(response => response.text())
        .then(hiddenItems => {
            const hiddenItemsArray = hiddenItems.split('\n').map(item => item.trim());
            return fetch('/datosimagen/menu.json').then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            }).then(data => {
                menuSection.innerHTML = '';
                data.items.forEach(item => {
                    if (!hiddenItemsArray.includes(item.title)) {
                        const menuItem = document.createElement('div');
                        menuItem.classList.add('menu-item');
                        menuItem.textContent = item.title;

                        menuItem.addEventListener('click', () => {
                            document.querySelectorAll('.menu-item').forEach(el => {
                                el.classList.remove('active');
                            });
                            menuItem.classList.add('active');
                            allVideos = [];
                            loadVideoList(item.action);
                        });

                        menuSection.appendChild(menuItem);
                    }
                });
                menuSection.style.display = 'block';
            });
        })
        .catch(error => console.error('Error loading menu:', error));
        return;
    }
*/
    function fetchMenu() {
        fetch('/datosimagen/menuhide.txt')
        .then(response => response.text())
        .then(hiddenItems => {
            const hiddenItemsArray = hiddenItems.split('\n').map(item => item.trim());
            return fetch('/datosimagen/menu.json').then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            }).then(data => {
                menuSection.innerHTML = '';
                data.items.forEach(item => {
                    if (!hiddenItemsArray.includes(item.title)) {
                        const menuItem = document.createElement('div');
                        menuItem.classList.add('menu-item');
                        menuItem.textContent = item.title;

                        menuItem.addEventListener('click', () => {
                            document.querySelectorAll('.menu-item').forEach(el => {
                                el.classList.remove('active');
                            });
                            menuItem.classList.add('active');

                            // Reiniciar estado de paginación y búsqueda
                            currentPage = 1;
                            searchInput.value = '';

                            // Cargar la nueva lista
                            loadVideoList(item.action);
                        });

                        menuSection.appendChild(menuItem);
                    }
                });
                menuSection.style.display = 'block';
            });
        })
        .catch(error => console.error('Error loading menu:', error));
    }

    // Actualizar media.json
    document.getElementById('menuToggle').addEventListener('click', () => {
        toggleMenu();
    });

    // Cerrar menú al hacer clic fuera de él
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('sidebarMenu');
        if (menu && menu.classList.contains('active') &&
            !menu.contains(e.target) &&
            !(menuToggle && menuToggle.contains(e.target))) {
            toggleMenu();
            }
    });

    // Cerrar menú con tecla Escape
    document.addEventListener('keydown', function(e) {
        const menu = document.getElementById('sidebarMenu');
        if (e.key === 'Escape' && menu && menu.classList.contains('active')) {
            toggleMenu();
        }
    });


    // ===== FUNCIONES PARA LISTAS PROGRAMADAS =====

    toggleScheduledListsBtn.addEventListener('click', () => {
        scheduledListsContainer.style.display = scheduledListsContainer.style.display === 'block' ? 'none' : 'block';
        if (scheduledListsContainer.style.display === 'block') {
            renderScheduledLists();
        }
    });

    closeScheduledListsBtn.addEventListener('click', () => {
        scheduledListsContainer.style.display = 'none';
    });

    addScheduledListBtn.addEventListener('click', () => {
        scheduledListForm.style.display = 'block';
        currentEditingIndex = -1;
        listNameInput.value = '';
        listTimeInput.value = '09:00';
        listDaysSelect.value = 'daily';
    });

    cancelScheduledListBtn.addEventListener('click', () => {
        scheduledListForm.style.display = 'none';
    });

    saveScheduledListBtn.addEventListener('click', () => {
        const name = listNameInput.value.trim();
        const time = listTimeInput.value;
        const days = listDaysSelect.value;
        if (!name) {
            alert('Por favor, ingresa un nombre para la lista');
            return;
        }
        const newScheduledList = {
            name,
            time,
            days,
            videos: currentEditingIndex >= 0 ? scheduledLists[currentEditingIndex].videos : []
        };
        if (currentEditingIndex >= 0) {
            scheduledLists[currentEditingIndex] = newScheduledList;
        } else {
            scheduledLists.push(newScheduledList);
        }
        localStorage.setItem('scheduledLists', JSON.stringify(scheduledLists));
        scheduledListForm.style.display = 'none';
        renderScheduledLists();
        if (!checkInterval) {
            startScheduledListsCheck();
        }
    });

    function renderScheduledLists() {
        scheduledListsElement.innerHTML = '';
        if (scheduledLists.length === 0) {
            scheduledListsElement.innerHTML = '<p>No hay listas programadas</p>';
            return;
        }
        scheduledLists.forEach((list, index) => {
            const listElement = document.createElement('div');
            listElement.className = 'scheduled-list-item';
            const isCurrentlyPlaying = isPlayingScheduledList && currentPlayingIndex === index;
            listElement.innerHTML = `
            <h4>${isCurrentlyPlaying ? '<span class="playing-indicator"></span>' : ''}${list.name} <span style="font-size: 0.8em; color: #666;">(${list.videos.length} videos)</span></h4>
            <p>Hora: ${list.time}</p>
            <p>Días: ${getDaysText(list.days)}</p>
            <div class="scheduled-list-actions">
            <button class="scheduled-list-btn view" data-index="${index}">Gestionar Videos</button>
            <button class="scheduled-list-btn edit" data-index="${index}">Editar</button>
            <button class="scheduled-list-btn delete" data-index="${index}">Eliminar</button>
            </div>
            `;
            scheduledListsElement.appendChild(listElement);
        });

        document.querySelectorAll('.scheduled-list-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                editScheduledList(index);
            });
        });

        document.querySelectorAll('.scheduled-list-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deleteScheduledList(index);
            });
        });

        document.querySelectorAll('.scheduled-list-btn.view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                manageScheduledListVideos(index);
            });
        });
    }

    function getDaysText(daysValue) {
        const daysMap = {
            'daily': 'Diariamente', 'weekdays': 'Lunes a Viernes', 'weekend': 'Fin de Semana',
            'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles', 'thursday': 'Jueves',
            'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo'
        };
        return daysMap[daysValue] || daysValue;
    }

    function editScheduledList(index) {
        const list = scheduledLists[index];
        listNameInput.value = list.name;
        listTimeInput.value = list.time;
        listDaysSelect.value = list.days;
        currentEditingIndex = index;
        scheduledListForm.style.display = 'block';
    }

    function deleteScheduledList(index) {
        if (confirm('¿Estás seguro de que quieres eliminar esta lista programada?')) {
            scheduledLists.splice(index, 1);
            localStorage.setItem('scheduledLists', JSON.stringify(scheduledLists));
            renderScheduledLists();
            if (scheduledLists.length === 0 && checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }
    }

    function manageScheduledListVideos(index) {
        currentVideoManagementIndex = index;
        const list = scheduledLists[index];
        modalListTitle.textContent = `Gestionar Videos: ${list.name}`;
        loadAvailableVideos();
        renderCurrentListVideos(list.videos);
        videoManagementModal.style.display = 'block';
        modalOverlay.style.display = 'block';
    }

    function loadAvailableVideos() {
        availableVideosList.innerHTML = '';
        const allVideosFromSystem = getAllVideosFromSystem();
        if (allVideosFromSystem.length === 0) {
            availableVideosList.innerHTML = '<p>No hay videos disponibles</p>';
            return;
        }
        allVideosFromSystem.forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-list-item';
            videoItem.innerHTML = `
            <span>${video.title}</span>
            <div class="video-list-actions">
            <button class="scheduled-list-btn add-video" data-src="${video.src}" data-title="${video.title}">Añadir</button>
            </div>
            `;
            availableVideosList.appendChild(videoItem);
        });

        document.querySelectorAll('.add-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const src = e.target.dataset.src;
                const title = e.target.dataset.title;
                addVideoToScheduledList(src, title);
            });
        });
    }

    function getAllVideosFromSystem() {
        return allVideos
        .filter(video => {
            if (!video.action) return false;
            const extension = video.action.split('.').pop().toLowerCase();
            return videoExtensions.includes(extension);
        })
        .map(video => ({
            src: video.action,
            title: video.title || 'Sin título'
        }));
    }

    function renderCurrentListVideos(videos) {
        currentListVideos.innerHTML = '';
        if (videos.length === 0) {
            currentListVideos.innerHTML = '<p>No hay videos en esta lista</p>';
            return;
        }
        videos.forEach((video, index) => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-list-item';
            videoItem.innerHTML = `
            <span>${video.title}</span>
            <div class="video-list-actions">
            <button class="scheduled-list-btn move-up" data-index="${index}">↑</button>
            <button class="scheduled-list-btn move-down" data-index="${index}">↓</button>
            <button class="scheduled-list-btn delete" data-index="${index}">Quitar</button>
            </div>
            `;
            currentListVideos.appendChild(videoItem);
        });

        document.querySelectorAll('#currentListVideos .delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const videoIndex = parseInt(e.target.dataset.index);
                removeVideoFromScheduledList(videoIndex);
            });
        });

        document.querySelectorAll('#currentListVideos .move-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const videoIndex = parseInt(e.target.dataset.index);
                moveVideoUp(videoIndex);
            });
        });

        document.querySelectorAll('#currentListVideos .move-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const videoIndex = parseInt(e.target.dataset.index);
                moveVideoDown(videoIndex);
            });
        });
    }

    function addVideoToScheduledList(src, title) {
        if (currentVideoManagementIndex === -1) return;
        const list = scheduledLists[currentVideoManagementIndex];
        if (list.videos.some(video => video.src === src)) {
            alert('Este video ya está en la lista');
            return;
        }
        list.videos.push({ src, title });
        renderCurrentListVideos(list.videos);
    }

    function removeVideoFromScheduledList(videoIndex) {
        if (currentVideoManagementIndex === -1) return;
        const list = scheduledLists[currentVideoManagementIndex];
        list.videos.splice(videoIndex, 1);
        renderCurrentListVideos(list.videos);
    }

    function moveVideoUp(videoIndex) {
        if (currentVideoManagementIndex === -1 || videoIndex === 0) return;
        const list = scheduledLists[currentVideoManagementIndex];
        const temp = list.videos[videoIndex];
        list.videos[videoIndex] = list.videos[videoIndex - 1];
        list.videos[videoIndex - 1] = temp;
        renderCurrentListVideos(list.videos);
    }

    function moveVideoDown(videoIndex) {
        if (currentVideoManagementIndex === -1 || videoIndex === scheduledLists[currentVideoManagementIndex].videos.length - 1) return;
        const list = scheduledLists[currentVideoManagementIndex];
        const temp = list.videos[videoIndex];
        list.videos[videoIndex] = list.videos[videoIndex + 1];
        list.videos[videoIndex + 1] = temp;
        renderCurrentListVideos(list.videos);
    }

    saveVideoChangesBtn.addEventListener('click', () => {
        if (currentVideoManagementIndex === -1) return;
        localStorage.setItem('scheduledLists', JSON.stringify(scheduledLists));
        closeVideoManagementModal();
        renderScheduledLists();
    });

    cancelVideoChangesBtn.addEventListener('click', () => {
        closeVideoManagementModal();
    });

    function closeVideoManagementModal() {
        videoManagementModal.style.display = 'none';
        modalOverlay.style.display = 'none';
        currentVideoManagementIndex = -1;
    }

    closeVideoModalBtn.addEventListener('click', closeVideoManagementModal);
    modalOverlay.addEventListener('click', closeVideoManagementModal);

    function shouldPlayToday(daysSetting) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayMap = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        };
        switch(daysSetting) {
            case 'daily': return true;
            case 'weekdays': return dayOfWeek >= 1 && dayOfWeek <= 5;
            case 'weekend': return dayOfWeek === 0 || dayOfWeek === 6;
            default: return dayOfWeek === dayMap[daysSetting];
        }
    }

    function playScheduledList(list, index) {
        console.log(`Iniciando lista programada: ${list.name}`);

        if (!isPlayingScheduledList) {
            originalPlaylist = JSON.parse(localStorage.getItem('playlist')) || [];
        }

        isPlayingScheduledList = true;
        currentPlayingIndex = index;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'playScheduledList',
                data: list.videos,
                listName: list.name
            }));
        }

        list.lastPlayed = new Date().toDateString();
        localStorage.setItem('scheduledLists', JSON.stringify(scheduledLists));

        renderScheduledLists();

        if (list.videos.length > 0) {
            playVideoFromList(list.videos, 0);
        } else {
            console.log('La lista programada está vacía');
            restoreOriginalPlaylist();
        }
    }

    function playVideoFromList(videos, index) {
        if (index >= videos.length) {
            restoreOriginalPlaylist();
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send("LISTA_PROGRAMADA_TERMINADA");
            }
            return;
        }

        const video = videos[index];
        const path = video.src.replace(/^https?:\/\/[^/]+/, '');

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(`VIDEO_URL:${path}`);
            ws.send(`LISTA_PROGRAMADA:${currentPlayingIndex}:${index}:${videos.length}`);
            console.log(`Reproduciendo: ${video.title} (${index + 1}/${videos.length})`);

            // Simular avance al siguiente video después de un tiempo
            // En producción, esto debería basarse en eventos del reproductor
            setTimeout(() => {
                playVideoFromList(videos, index + 1);
            }, 30000); // 30 segundos de ejemplo
        }
    }

    function restoreOriginalPlaylist() {
        if (isPlayingScheduledList) {
            localStorage.setItem('playlist', JSON.stringify(originalPlaylist));

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'restorePlaylist',
                    data: originalPlaylist
                }));
            }

            isPlayingScheduledList = false;
            currentPlayingIndex = -1;

            renderScheduledLists();

            console.log('Playlist original restaurada después de lista programada');
        }
    }

    function checkScheduledLists() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        scheduledLists.forEach((list, index) => {
            if (list.time === currentTime && shouldPlayToday(list.days)) {
                const today = new Date().toDateString();
                if (!list.lastPlayed || list.lastPlayed !== today) {
                    playScheduledList(list, index);
                }
            }
        });
    }

    function startScheduledListsCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        checkInterval = setInterval(() => {
            checkScheduledLists();
        }, 60000);
        checkScheduledLists();
    }

    // WebSocket message handling para socket (puerto 8080 - gestión de playlist)
    socket.addEventListener('message', event => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.timestamp && msg.timestamp < lastStateTimestamp) {
                return;
            }
            lastStateTimestamp = msg.timestamp || Date.now();

            if (msg.src) {
                const decodedSrc = decodeURIComponent(msg.src);
                const url = new URL(decodedSrc);
                const nombreConExtCodificado = url.pathname.split('/').pop();
                const nombreConExt = decodeURIComponent(nombreConExtCodificado);
                const titulo = nombreConExt.replace(/\.[^/.]+$/, '');
                videoTitle.textContent = `Reproduciendo: ${titulo}`;
                updateNowPlaying(msg);
            }

            if (msg.type === 'playlist' && Array.isArray(msg.data)) {
                currentPlaylist = msg.data;
                localStorage.setItem('playlist', JSON.stringify(currentPlaylist));
            }
            else if (msg.type === 'videoInfo') {
                currentIndex = msg.index !== undefined ? msg.index : currentIndex;
                updateNowPlaying(msg);
            }
            else if (msg.type === 'sync') {
                updateNowPlaying({
                    currentTime: msg.currentTime,
                    duration: msg.duration,
                    index: currentIndex
                });
            }

            if (msg.type === 'state' || msg.type === 'videoInfo') {
                const targetIndex = msg.state?.currentIndex ?? msg.index;
                if (typeof targetIndex !== 'undefined') {
                    const validIndex = Math.max(0, Math.min(targetIndex, currentPlaylist.length - 1));
                    updateNowPlaying({
                        index: validIndex,
                        currentTime: msg.state?.currentTime ?? msg.currentTime,
                        duration: msg.state?.duration ?? msg.duration
                    });
                }
            }

        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
            return;
        }
    });

    // WebSocket message handling para ws (puerto 8081 - control de video)
    ws.addEventListener('message', event => {
        try {
            const message = event.data;
            console.log('Mensaje recibido del control de video:', message);

            // Aquí puedes agregar manejo específico para mensajes del control de video
            if (message.includes('VIDEO_ENDED') && isPlayingScheduledList) {
                // Lógica para manejar el fin de un video en listas programadas
                console.log('Video terminado, preparando siguiente...');
            }
        } catch (e) {
            console.error('Error processing video control message:', e);
            return;
        }
    });

    function updateNowPlaying(videoInfo) {
        if (videoInfo && videoInfo.index !== undefined) {
            currentIndex = videoInfo.index;
        }

        if (videoInfo) {
            const currentTime = formatTime(videoInfo.currentTime || 0);
            const duration = formatTime(videoInfo.duration || 0);
            const progress = videoInfo.duration ? ((videoInfo.currentTime / videoInfo.duration) * 100) : 0;

            document.getElementById('videoTime').textContent = `${currentTime} / ${duration}`;
            document.getElementById('progressBar').style.width = `${progress}%`;
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Modificar la inicialización para asegurar que los videos se carguen correctamente
 /*   window.addEventListener('load', async () => {
        try {
            // Cargar primero el JSON principal
           // await loadVideoList('nuevas_descargas_videos.json');
            // Luego cargar todos los videos
            await loadAllVideos();
            // Finalmente cargar el menú
            fetchMenu();

            // Iniciar la verificación de listas programadas si existen
            if (scheduledLists.length > 0) {
                startScheduledListsCheck();
            }
        } catch (error) {
            console.error('Error durante la inicialización:', error);
            return;
        }
    });
    */
    window.addEventListener('load', async () => {
        try {
            // Inicializar con array vacío
            allVideos = [];

            // Primero cargar el menú
            await fetchMenu();

            // Luego cargar todos los videos (esto podría cambiarse para cargar una categoría por defecto)
            await loadAllVideos();

            // Iniciar la verificación de listas programadas si existen
            if (scheduledLists.length > 0) {
                startScheduledListsCheck();
            }
        } catch (error) {
            console.error('Error durante la inicialización:', error);
        }
    });

    selectAllButton.addEventListener('click', toggleSelectAllVideos);
    addSelectedButton.addEventListener('click', addSelectedVideosToPlaylist);
    searchInput.addEventListener('input', filterVideos);

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.menu-item').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
        });
    });


});
