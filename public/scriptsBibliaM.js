document.addEventListener('DOMContentLoaded', () => {
    const bookInput = document.getElementById('bookInput');
    const chapterInput = document.getElementById('chapterInput');
    const verseInput = document.getElementById('verseInput');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');
     const leftContent = document.querySelector('.left-content');
    const centerContent = document.querySelector('.center-content');
    const chapterContent = document.getElementById('chapter-content');
    const verseContent = document.getElementById('verse-content');
    const bookGrid = document.getElementById('bookGrid');
    const chapterGrid = document.getElementById('chapterGrid');
    const verseGrid = document.getElementById('verseGrid'); // Ensure this ID matchesyour HTML
    const contentBox = document.getElementById('contentBox');
    const toggleButton = document.getElementById('toggleButton');
   const playlistButton = document.getElementById('playlistButton');
   const pantallaButton = document.getElementById('pantallaButton');
     const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const sendButton = document.getElementById('sendButton');
    //const playerGrid = document.getElementById('playerGrid');
const pantallaTButton = document.getElementById('pantallaTButton');
const mediaButton = document.getElementById('mediaButton');
//const player = document.getElementById('player');
const fondoCheckbox = document.getElementById('fondoCheckbox');

// WebSockets
const socket = new WebSocket(`ws://${window.location.hostname}:8080`);
const ws = new WebSocket(`ws://${window.location.hostname}:8081`);

// Elementos que faltaban
const hideVideoButton = document.getElementById('hideVideoButton'); // FALTABA
const themeSelector = document.getElementById('themeSelector'); // FALTABA
const positionSelector = document.getElementById('positionSelector'); // FALTABA
const showVideoButton = document.getElementById('showVideoButton'); // FALTABA
const incrementalCheckbox = document.getElementById('incrementalCheckbox');

    // Elementos para búsqueda
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const searchResults = document.getElementById('searchResults');

    let version = ''; // Versión completa (ej: "Reina Valera 1960 - RV1960")
    let versionAbbr = ''; // Versión abreviada (ej: "RV1960")
    let books = [];
    let chapters = [];
    let verses = [];
    let chapterCache = {};
    let selectedVersion = ''; // Definir la variable en el ámbito adecuado
    let selectedBook = '';
    let selectedChapter = '';
    let verseData = [];
    let selectedIncrementalVerses = [];
    let isWebSocketOpen = false;
   // let ws;
    //let currentFontSize = fontSizeSlider.value; // Tamaño de fuente inicial
    let playlistWindow = null;   //para abrir la web playlist
    let pantallaWindow = null;

     // Configuración por defecto
    const defaultConfig = {
        title: {
            fontFamily: 'Arial',
            fontSize: '65px',
            color: '#ffffff',
            backgroundColor: '#333333',
            shadow: true,
            shadowColor: '#000000',
            bold: true,
            italic: false
        },
        content: {
            fontFamily: 'Arial',
            fontSize: '60px',
            color: '#ffffff',
            lineHeight: '1.4',
            shadow: true,
            shadowColor: '#000000',
            bold: false,
            italic: false,
            padding: '10px'
        }
    };

 let currentConfig = { ...defaultConfig };

 // ========== SISTEMA DE HISTORIAL ==========

 const historyManager = {
     // Guardar en historial con validación
     save: function(entry) {
         try {
             console.log('HistoryManager: Guardando entrada', entry);

             let history = this.load();

             // Validar entrada
             if (!this.isValidEntry(entry)) {
                 console.error('Entrada inválida, no se guardará:', entry);
                 return false;
             }

             // Evitar duplicados recientes (mismo contenido en los últimos 5 segundos)
             const isDuplicate = history.some(existingEntry =>
             existingEntry.content === entry.content &&
             new Date(entry.timestamp) - new Date(existingEntry.timestamp) < 5000
             );

             if (isDuplicate) {
                 console.log('Entrada duplicada detectada, no se guardará:', entry.title);
                 return false;
             }

             entry.id = entry.id || Date.now() + Math.random().toString(36).substr(2, 9);
             history.unshift(entry);

             // Mantener solo los últimos 100 elementos
             if (history.length > 100) {
                 history = history.slice(0, 100);
             }

             localStorage.setItem('bibleHistory', JSON.stringify(history));
             console.log('Entrada guardada exitosamente. Total en historial:', history.length);
             return true;

         } catch (error) {
             console.error('Error en historyManager.save:', error);
             return false;
         }
     },

     // Validar entrada
     isValidEntry: function(entry) {
         return entry &&
         typeof entry === 'object' &&
         entry.title &&
         entry.content &&
         entry.book &&
         entry.chapter &&
         entry.timestamp;
     },

     // Cargar historial con manejo de errores
     load: function() {
         try {
             const history = localStorage.getItem('bibleHistory');
             if (!history) return [];

             const parsed = JSON.parse(history);
             return Array.isArray(parsed) ? parsed : [];

         } catch (error) {
             console.error('Error al cargar historial:', error);
             return [];
         }
     },

     // ... resto de funciones igual
     // Limpiar historial
     clear: function() {
         localStorage.removeItem('bibleHistory');
         console.log('Historial limpiado');
     },

     // Obtener por ID
     getById: function(id) {
         const history = this.load();
         return history.find(entry => entry.id === id);
     },

     // Filtrar por libro, capítulo, etc.
     filter: function(filters) {
         let history = this.load();

         if (filters.book) {
             history = history.filter(entry => entry.book === filters.book);
         }

         if (filters.chapter) {
             history = history.filter(entry => entry.chapter === filters.chapter);
         }

         if (filters.version) {
             history = history.filter(entry => entry.version === filters.version);
         }

         if (filters.date) {
             history = history.filter(entry =>
             new Date(entry.timestamp).toDateString() === new Date(filters.date).toDateString()
             );
         }

         return history;
     },

     // Exportar historial
     export: function() {
         const history = this.load();
         const dataStr = JSON.stringify(history, null, 2);
         const dataBlob = new Blob([dataStr], {type: 'application/json'});

         const link = document.createElement('a');
         link.href = URL.createObjectURL(dataBlob);
         link.download = `bible-history-${new Date().toISOString().split('T')[0]}.json`;
         link.click();
     },

     import: function(file) {
         const reader = new FileReader();
         reader.onload = function(e) {
             try {
                 const importedHistory = JSON.parse(e.target.result);
                 const currentHistory = historyManager.load();
                 const mergedHistory = [...importedHistory, ...currentHistory];

                 // Mantener solo los últimos 100 elementos únicos
                 const uniqueHistory = mergedHistory.filter((entry, index, self) =>
                 index === self.findIndex(e => e.id === entry.id)
                 ).slice(0, 100);

                 localStorage.setItem('bibleHistory', JSON.stringify(uniqueHistory));
                 alert('Historial importado correctamente');
                 refreshHistoryUI(); // Cambiar historyManager.refreshUI por refreshHistoryUI
             } catch (error) {
                 alert('Error al importar el historial: ' + error.message);
             }
         };
         reader.readAsText(file);
     },
 };


 // Sistema de cola para guardado de historial
 const historyQueue = {
     queue: [],
     isProcessing: false,

     add: function(entry) {
         this.queue.push(entry);
         console.log('Entrada añadida a la cola. Tamaño de cola:', this.queue.length);
         this.process();
     },

     process: function() {
         if (this.isProcessing || this.queue.length === 0) return;

         this.isProcessing = true;
         const entry = this.queue.shift();

         console.log('Procesando entrada de la cola:', entry);

         // Intentar guardar con retry
         this.saveWithRetry(entry, 0);
     },

     saveWithRetry: function(entry, attempt) {
         const maxAttempts = 3;

         try {
             const success = historyManager.save(entry);

             if (success) {
                 console.log('✅ Entrada guardada exitosamente desde la cola');
                 this.isProcessing = false;
                 this.process(); // Procesar siguiente en la cola
                 refreshHistoryUI();
             } else {
                 throw new Error('historyManager.save returned false');
             }

         } catch (error) {
             console.error(`❌ Error en intento ${attempt + 1} de guardar:`, error);

             if (attempt < maxAttempts) {
                 console.log(`Reintentando en ${(attempt + 1) * 1000}ms...`);
                 setTimeout(() => {
                     this.saveWithRetry(entry, attempt + 1);
                 }, (attempt + 1) * 1000);
             } else {
                 console.error('❌ Falló después de todos los intentos. Descartando entrada:', entry);
                 this.isProcessing = false;
                 this.process(); // Continuar con la siguiente
             }
         }
     }
 };

 // Reemplazar saveToHistory con la versión con cola
 function saveToHistory(entry) {
     console.log('📥 Solicitando guardado en historial:', entry.title);

     // Validación básica antes de encolar
     if (!entry || !entry.title || !entry.book || !entry.chapter) {
         console.error('❌ Entrada inválida, no se encolará:', entry);
         return;
     }

     // Asegurar datos mínimos
     entry.id = entry.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9);
     entry.timestamp = entry.timestamp || new Date().toISOString();
     entry.type = entry.type || 'single';

     historyQueue.add(entry);
 }

 // Función para obtener configuración actual
 function getCurrentConfig() {
    return currentConfig;
    /*
     return currentConfig || {
         title: {
             fontFamily: document.getElementById('titleFontFamily')?.value || 'Arial',
                          fontSize: document.getElementById('titleFontSize')?.value + 'px' || '32px',
                          color: document.getElementById('titleColor')?.value || '#ffffff'
         },
         content: {
             fontFamily: document.getElementById('contentFontFamily')?.value || 'Arial',
                          fontSize: document.getElementById('contentFontSize')?.value + 'px' || '24px',
                          color: document.getElementById('contentColor')?.value || '#ffffff'
         }
     };*/
 }

 function createHistoryUI() {
     return new Promise((resolve, reject) => {
         try {
             const videoSearch = document.getElementById('video-search');
             if (!videoSearch) {
                resolve();
                 //reject(new Error('video-search no encontrado'));
                 return;
             }

             // Verificar si el modal ya existe
             if (document.getElementById('historyModal')) {
                 console.log('✅ Modal de historial ya existe');
                 resolve();
                 return;
             }

             // Botón para abrir historial
             const historyButton = document.createElement('button');
             historyButton.id = 'historyButton';
             historyButton.textContent = '📜 Historial';
             historyButton.title = 'Ver historial de citas';
             historyButton.addEventListener('click', showHistoryModal);
             videoSearch.appendChild(historyButton);

             // Modal de historial
             const historyModal = document.createElement('div');
             historyModal.id = 'historyModal';
             historyModal.className = 'config-modal';
             historyModal.style.display = 'none';
             historyModal.innerHTML = `
             <div class="config-modal-content" style="max-width: 800px;">
             <span class="config-close" id="historyClose">&times;</span>
             <h2>Historial de Citas Bíblicas</h2>

             <div class="history-controls">
             <button id="clearHistory">🗑️ Limpiar Todo</button>
             <button id="exportHistory">📤 Exportar JSON</button>
             <input type="file" id="importHistory" accept=".json" style="display: none;">
             <button id="importHistoryBtn">📥 Importar JSON</button>
             <button id="debugHistory">🐛 Debug</button>
             <input type="text" id="historySearch" placeholder="Buscar en historial...">
             </div>

             <div id="historyStats" style="margin: 10px 0; font-size: 0.9em; color: #666;"></div>
             <div id="queueStats" style="margin: 5px 0; font-size: 0.8em; color: #888;"></div>

             <div id="historyList" class="history-list">
             <!-- Las entradas se cargarán aquí -->
             </div>
             </div>
             `;
             document.body.appendChild(historyModal);

             // Configurar event listeners
             setupHistoryModalEvents();
             console.log('✅ UI del historial creada exitosamente');
             resolve();

         } catch (error) {
             console.error('❌ Error creando UI del historial:', error);
             //reject(error);
             resolve();
         }
     });
 }

 function setupHistoryModalEvents() {
     // Cerrar modal
     document.getElementById('historyClose').addEventListener('click', closeHistoryModal);

     // Limpiar historial
     document.getElementById('clearHistory').addEventListener('click', () => {
         if (confirm('¿Estás seguro de que quieres limpiar todo el historial?')) {
             historyManager.clear();
             refreshHistoryUI();
         }
     });

     // Exportar
     document.getElementById('exportHistory').addEventListener('click', () => {
         historyManager.export();
     });

     // Importar
     document.getElementById('importHistoryBtn').addEventListener('click', () => {
         document.getElementById('importHistory').click();
     });

     document.getElementById('importHistory').addEventListener('change', (e) => {
         if (e.target.files[0]) {
             historyManager.import(e.target.files[0]);
         }
     });

     // Debug
     document.getElementById('debugHistory').addEventListener('click', () => {
         debugHistory();
     });

     // Búsqueda
     document.getElementById('historySearch').addEventListener('input', (e) => {
         filterHistory(e.target.value);
     });

     // Cerrar al hacer click fuera
     document.getElementById('historyModal').addEventListener('click', function(event) {
         if (event.target === this) {
             closeHistoryModal();
         }
     });
 }

 function showHistoryModal() {
     const historyModal = document.getElementById('historyModal');
     if (!historyModal) {
         console.error('❌ Modal de historial no encontrado');
         return;
     }

     historyModal.style.display = 'block';

     // Forzar actualización completa
     setTimeout(() => {
         refreshHistoryUI();
         console.log('🔍 Modal mostrado, historial actualizado');
     }, 100);
 }

 // Cerrar modal de historial
 function closeHistoryModal() {
     document.getElementById('historyModal').style.display = 'none';
 }


 function refreshHistoryUI() {
     const historyList = document.getElementById('historyList');

     if (!historyList) {
         console.warn('⚠️ historyList no encontrado en refreshHistoryUI');
         return;
     }

     const history = historyManager.load();

     // Actualizar estadísticas
     updateHistoryStats();
     updateQueueStats();

     if (history.length === 0) {
         historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay citas en el historial</p>';
         return;
     }

     console.log('🔄 Renderizando historial con', history.length, 'entradas');

     // Limpiar y recrear el contenido
     historyList.innerHTML = '';

     history.forEach((entry, index) => {
         const entryElement = document.createElement('div');
         entryElement.className = 'history-entry';
         entryElement.dataset.id = entry.id;

         // Asegurar que el contenido no sea demasiado largo para preview
         const contentPreview = entry.content.length > 100
         ? entry.content.substring(0, 100) + '...'
         : entry.content;

         entryElement.innerHTML = `
         <div class="history-header">
         <strong>${escapeHtml(entry.title)}</strong>
         <span class="history-time">${formatTime(entry.timestamp)}</span>
         </div>
         <div class="history-content">${escapeHtml(contentPreview)}</div>
         <div class="history-actions">
         <button class="history-btn reuse-btn" data-id="${entry.id}" title="Reenviar esta cita">🔄 Reenviar</button>
         <button class="history-btn copy-btn" data-id="${entry.id}" title="Copiar al portapapeles">📋 Copiar</button>
         <button class="history-btn delete-btn" data-id="${entry.id}" title="Eliminar del historial">🗑️ Eliminar</button>
         </div>
         `;

         historyList.appendChild(entryElement);

         // DEBUG: Verificar que se creó correctamente
         console.log(`✅ Entrada ${index + 1} creada:`, entry.title);
     });

     // Configurar event listeners inmediatamente
     setupHistoryEventListeners();
     console.log('✅ Event listeners del historial configurados');
 }


 function updateHistoryStats() {
     const history = historyManager.load();
     const statsElement = document.getElementById('historyStats');
     if (statsElement) {
         statsElement.textContent = `Total de citas: ${history.length}`;
     }
 }


 function updateQueueStats() {
     const queueElement = document.getElementById('queueStats');
     if (queueElement) {
         queueElement.textContent = `En cola: ${historyQueue.queue.length} | Procesando: ${historyQueue.isProcessing ? 'Sí' : 'No'}`;
     }
 }

 function setupHistoryEventListeners() {
     const historyList = document.getElementById('historyList');
     if (!historyList) {
         console.error('❌ historyList no encontrado en setupHistoryEventListeners');
         return;
     }

     console.log('🔧 Configurando event listeners para el historial...');

     // Usar event delegation para manejar todos los clicks
     historyList.addEventListener('click', function(event) {
         const button = event.target.closest('.history-btn');
         if (!button) return;

         event.preventDefault();
         event.stopPropagation();

         const id = button.dataset.id;
         const action = button.classList[1];

         console.log(`🎯 Click detectado: ${action} para ID: ${id} (${typeof id})`);

         if (!id) {
             console.error('❌ ID no encontrado en el botón');
             return;
         }

         // Pasar el ID exacto como está (sin conversión)
         switch (action) {
             case 'reuse-btn':
                 reuseHistoryEntry(id); // Pasar el ID como string
                 break;
             case 'copy-btn':
                 copyHistoryEntry(id);
                 break;
             case 'delete-btn':
                 deleteHistoryEntry(id);
                 break;
             default:
                 console.warn('⚠️ Acción desconocida:', action);
         }
     });

     console.log('✅ Event delegation configurado');
 }


 function reuseHistoryEntry(id) {
     console.log('🚀 INICIANDO reuseHistoryEntry para ID:', id, 'Tipo:', typeof id);

     if (!id) {
         console.error('❌ ID no proporcionado para reuseHistoryEntry');
         return;
     }

     // Buscar la entrada sin convertir el ID - manejar tanto números como strings
     const entry = historyManager.getById(id);

     if (!entry) {
         console.error('❌ No se encontró la entrada con ID:', id);
         console.log('🔍 Buscando entrada con ID exacto...');

         // Intentar búsqueda flexible
         const history = historyManager.load();
         const foundEntry = history.find(e => e.id == id); // Usar == para comparación flexible

         if (foundEntry) {
             console.log('✅ Entrada encontrada con comparación flexible');
             processEntryForReuse(foundEntry);
         } else {
             console.log('📊 Todas las entradas disponibles:', history.map(e => ({
                 id: e.id,
                 type: typeof e.id,
                 title: e.title
             })));
             alert('❌ No se pudo encontrar la cita en el historial');
         }
         return;
     }

     processEntryForReuse(entry);
 }


 function copyHistoryEntry(id) {
     const entry = historyManager.getById(id);
     if (entry) {
         navigator.clipboard.writeText(entry.fullContent).then(() => {
             //alert('Cita copiada al portapapeles');
         });
     }
 }

 function deleteHistoryEntry(id) {
     if (confirm('¿Eliminar esta cita del historial?')) {
         let history = historyManager.load();
         history = history.filter(entry => entry.id !== id);
         localStorage.setItem('bibleHistory', JSON.stringify(history));
         refreshHistoryUI();
     }
 }


 // Función auxiliar para escapar HTML
 function escapeHtml(unsafe) {
     return unsafe
     .replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;")
     .replace(/'/g, "&#039;");
 }

 function formatTime(timestamp) {
     try {
         const date = new Date(timestamp);
         return date.toLocaleDateString('es-ES') + ' ' + date.toLocaleTimeString('es-ES', {
             hour: '2-digit',
             minute: '2-digit'
         });
     } catch (error) {
         return timestamp;
     }
 }

 function filterHistory(searchTerm) {
     const history = historyManager.load();
     const filteredHistory = searchTerm ?
     history.filter(entry =>
     entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
     entry.book.toLowerCase().includes(searchTerm.toLowerCase())
     ) : history;

     const historyList = document.getElementById('historyList');
     if (historyList) {
         historyList.innerHTML = filteredHistory.map(entry => `
         <div class="history-entry" data-id="${entry.id}">
         <div class="history-header">
         <strong>${entry.title}</strong>
         <span class="history-time">${formatTime(entry.timestamp)}</span>
         </div>
         <div class="history-content">${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}</div>
         <div class="history-actions">
         <button class="history-btn reuse-btn" data-id="${entry.id}">🔄 Reenviar</button>
         <button class="history-btn copy-btn" data-id="${entry.id}">📋 Copiar</button>
         <button class="history-btn share-btn" data-id="${entry.id}">📤 Compartir</button>
         <button class="history-btn delete-btn" data-id="${entry.id}">🗑️ Eliminar</button>
         </div>
         </div>
         `).join('');

         // Re-asignar event listeners después del filtrado
         setTimeout(() => {
             setupHistoryEventDelegation();
         }, 100);
     }
 }

 // ========== SISTEMA DE CONFIGURACIÓN DE FUENTES ==========

 ////////////////////////////// configuracion fuente  ///////////////////////////////////
 // Función para inicializar la configuración
 function initConfig() {
     loadConfigFromStorage();
     setupConfigModal();
     updateColorPreviews();
 }

 // Función para cargar configuración desde localStorage
 function loadConfigFromStorage() {
     const savedConfig = localStorage.getItem('bibleDisplayConfig');
     if (savedConfig) {
         currentConfig = { ...defaultConfig, ...JSON.parse(savedConfig) };
         applyConfigToForm();
     } else {
         currentConfig = { ...defaultConfig };
     }
 }

 // Función para guardar configuración en localStorage
 function saveConfigToStorage() {
     localStorage.setItem('bibleDisplayConfig', JSON.stringify(currentConfig));
 }

 // Función para aplicar la configuración al formulario
 function applyConfigToForm() {
     // Título
     document.getElementById('titleFontFamily').value = currentConfig.title.fontFamily;
     document.getElementById('titleFontSize').value = parseInt(currentConfig.title.fontSize);
     document.getElementById('titleColor').value = currentConfig.title.color;
     document.getElementById('titleBackground').value = currentConfig.title.backgroundColor;
     document.getElementById('titleShadow').checked = currentConfig.title.shadow;
     document.getElementById('titleShadowColor').value = currentConfig.title.shadowColor;
     document.getElementById('titleBold').checked = currentConfig.title.bold;
     document.getElementById('titleItalic').checked = currentConfig.title.italic;

     // Contenido
     document.getElementById('contentFontFamily').value = currentConfig.content.fontFamily;
     document.getElementById('contentFontSize').value = parseInt(currentConfig.content.fontSize);
     document.getElementById('contentColor').value = currentConfig.content.color;
     document.getElementById('contentLineHeight').value = parseFloat(currentConfig.content.lineHeight);
     document.getElementById('contentShadow').checked = currentConfig.content.shadow;
     document.getElementById('contentShadowColor').value = currentConfig.content.shadowColor;
     document.getElementById('contentBold').checked = currentConfig.content.bold;
     document.getElementById('contentItalic').checked = currentConfig.content.italic;
     document.getElementById('contentPadding').value = parseInt(currentConfig.content.padding);

     updateColorPreviews();
 }

 // Función para actualizar las vistas previas de color
 function updateColorPreviews() {
     const previews = {
         'titleColorPreview': currentConfig.title.color,
         'titleBackgroundPreview': currentConfig.title.backgroundColor,
         'titleShadowColorPreview': currentConfig.title.shadowColor,
         'contentColorPreview': currentConfig.content.color,
         'contentShadowColorPreview': currentConfig.content.shadowColor
     };

     Object.entries(previews).forEach(([id, color]) => {
         const element = document.getElementById(id);
         if (element) {
             element.style.backgroundColor = color;
         }
     });
 }

 // Función para configurar el modal
 function setupConfigModal() {
     const modal = document.getElementById('configModal');
     const btn = document.getElementById('configButton');
     const span = document.getElementsByClassName('config-close')[0];

     btn.onclick = function() {
         modal.style.display = "block";
         applyConfigToForm();
     }

     span.onclick = function() {
         modal.style.display = "none";
     }

     window.onclick = function(event) {
         if (event.target == modal) {
             modal.style.display = "none";
         }
     }

     // Configurar event listeners para los inputs de color
     const colorInputs = [
         'titleColor', 'titleBackground', 'titleShadowColor',
         'contentColor', 'contentShadowColor'
     ];

     colorInputs.forEach(inputId => {
         document.getElementById(inputId).addEventListener('input', function() {
             const previewId = inputId + 'Preview';
             document.getElementById(previewId).style.backgroundColor = this.value;
         });
     });

     // Botones de acción
     document.getElementById('cargarfuente').addEventListener('click', cargarfuente);
     document.getElementById('saveConfig').addEventListener('click', saveConfig);
     document.getElementById('applyConfig').addEventListener('click', applyConfig);
     document.getElementById('resetConfig').addEventListener('click', resetConfig);
 }

 function cargarfuente() {
     //updateConfigFromForm();
     //saveConfigToStorage();
     sendfuenteToWS();
     //document.getElementById('configModal').style.display = "none";
     //alert('Configuración guardada y aplicada');
 }

 // Función para guardar configuración
 function saveConfig() {
     updateConfigFromForm();
     saveConfigToStorage();
     sendConfigToWS();
     document.getElementById('configModal').style.display = "none";
     //alert('Configuración guardada y aplicada');
 }

 // Función para aplicar configuración sin guardar
 function applyConfig() {
     updateConfigFromForm();
     sendConfigToWS();
     //alert('Configuración aplicada temporalmente');
 }

 // Función para restablecer configuración
 function resetConfig() {
     if (confirm('¿Restablecer configuración a valores por defecto?')) {
         currentConfig = { ...defaultConfig };
         applyConfigToForm();
         saveConfigToStorage();
         sendConfigToWS();
     }
 }

 // Función para actualizar configuración desde el formulario
 function updateConfigFromForm() {
     currentConfig.title = {
         fontFamily: document.getElementById('titleFontFamily').value,
                          fontSize: document.getElementById('titleFontSize').value + 'px',
                          color: document.getElementById('titleColor').value,
                          backgroundColor: document.getElementById('titleBackground').value,
                          shadow: document.getElementById('titleShadow').checked,
                          shadowColor: document.getElementById('titleShadowColor').value,
                          bold: document.getElementById('titleBold').checked,
                          italic: document.getElementById('titleItalic').checked
     };

     currentConfig.content = {
         fontFamily: document.getElementById('contentFontFamily').value,
                          fontSize: document.getElementById('contentFontSize').value + 'px',
                          color: document.getElementById('contentColor').value,
                          lineHeight: document.getElementById('contentLineHeight').value,
                          shadow: document.getElementById('contentShadow').checked,
                          shadowColor: document.getElementById('contentShadowColor').value,
                          bold: document.getElementById('contentBold').checked,
                          italic: document.getElementById('contentItalic').checked,
                          padding: document.getElementById('contentPadding').value + 'px'
     };

     updateColorPreviews();
 }

 // Función para enviar configuración por WebSocket
 function sendConfigToWS() {
     if (ws.readyState === WebSocket.OPEN) {
         const configMessage = `CONFIG:${JSON.stringify(currentConfig)}`;
         ws.send(configMessage);
         console.log('Configuración enviada desde historial:', currentConfig);
     } else {
         console.error('WebSocket no conectado para enviar configuración');
     }
 }

 // Función para enviar configuración por WebSocket
 function sendfuenteToWS() {
     if (ws.readyState === WebSocket.OPEN) {
         ws.send(`cambiartipoletra`);
         //ws.send(configMessage);
         console.log('Cambio de fuente enviada: tipodeletra');
     } else {
         console.error('WebSocket no conectado para enviar configuración');
     }
 }

 ////////////////////////////  fin configuracion  /////////////////////////////

  // ========== SISTEMA DE BÚSQUEDA ==========


  function setupSearch() {
      if (searchButton && searchInput) {
          searchButton.addEventListener('click', performSearch);
          searchInput.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                  performSearch();
              }
          });
      }
  }

  async function performSearch() {
      const searchTerm = searchInput.value.trim();
      if (!searchTerm) {
          alert('Por favor, escribe un término de búsqueda.');
          return;
      }

      console.log(`🔍 Buscando: ${searchTerm}`);

      try {
          const response = await fetch(`/api/search/${encodeURIComponent(searchTerm)}`);
          if (!response.ok) {
              throw new Error('Error en la búsqueda');
          }

          const data = await response.json();
          displaySearchResults(data);
      } catch (error) {
          console.error('Error en la búsqueda', error);
          if (searchResults) {
              searchResults.textContent = 'Error en la búsqueda.';
          }
      }
  }

  const versionColors = {
      'Dios Habla Hoy - DHH': '#f9e08e',
      'Reina Valera Actualizada (2015) - RVA2015': '#d5f98e',
                          'La Biblia de las Américas - LBLA': '#8ef9b7',
                          'Reina Valera Antigua - RV1909': '#8ef4f9',
                          'Reina Valera 1960': '#a1bfa2',
                          'Traducción en Lenguaje Actual - TLA': '#a1b1bf'
  };

  function displaySearchResults(verses) {
      if (!searchResults) return;

      searchResults.innerHTML = '';

      if (verses.length === 0) {
          searchResults.textContent = 'No se encontraron resultados.';
          return;
      }

      verses.forEach((verse) => {
          const verseDiv = document.createElement('div');
          verseDiv.className = 'busqueda-item';

          const versionSpan = document.createElement('span');
          versionSpan.className = 'verse-version';
          const color = versionColors[verse.version] || '#8fe41b';
          versionSpan.style.backgroundColor = color;
          versionSpan.textContent = verse.version;

          const contentBox = document.createElement('div');
          contentBox.className = 'content-box';

          const verseText = `${verse.book} ${verse.chapter}:${verse.verseNumber} - ${verse.text}`;
          const textDiv = document.createElement('div');
          const colort = versionColors[verse.text] || 'rgb(141 227 203)';
          textDiv.style.backgroundColor = colort;
          textDiv.className = 'verse-text';
          textDiv.textContent = verseText;

          const projectButton = document.createElement('button');
          projectButton.textContent = 'Proyectar';
          projectButton.className = 'project-button';
          projectButton.addEventListener('click', () => showVerse(verse));

          contentBox.appendChild(textDiv);
          contentBox.appendChild(projectButton);
          verseDiv.appendChild(versionSpan);
          verseDiv.appendChild(contentBox);
          searchResults.appendChild(verseDiv);
      });
  }

  function showVerse(verse) {
      console.log('Selected Verse:', verse);
      const identifier = "12345";
      const title = `${verse.version} - ${verse.book} ${verse.chapter}:${verse.verseNumber}`;
      const message = `${identifier}:biblia\n${title}\n${verse.verseNumber}: ${verse.text}`;

      if (ws.readyState === WebSocket.OPEN) {
          ws.send('SHOW');
          ws.send(message);
          ws.send(`TEXT_ALIGN:justify`);
          ws.send(`cambiartipoletra`);
          console.log('📤 Versículo de búsqueda enviado:', title);
      } else {
          console.error('WebSocket no está abierto.');
      }
  }

  // ========== FUNCIONES PRINCIPALES (EXISTENTES) ==========

  // [Aquí va todo el código anterior de funciones principales...]
  // loadVersions, setVersion, loadBooks, displayBooks, selectBook, loadChapters,
  // populateChapters, selectChapter, loadVerses, displayVerses, displayResultContent,
  // selectVerse, handleVerseInput, sendSingleVerseMessage, sendSelectedVerses,
  // sendMessagess, parseVerses, highlightSelectedVerses, generateTitle,
  // connectWebSocket, updateButtonColor, checkLoopStatusOnLoad, adjustHeaderHeight,
  // loadSavedSettings

  // ========== FUNCIONES PRINCIPALES ==========
    // 1. CARGAR VERSIONES
    // Función para cargar las versiones en el combo box
    async function loadVersions() {
        try {
            const response = await fetch('/api/versions');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const versions = await response.json();
            const select = document.getElementById('versionSelect');

            // Limpiar el select antes de agregar las versiones
            select.innerHTML = '<option value="">-- Elige una versión --</option>';

            versions.forEach(fullVersion => {
                const option = document.createElement('option');
                option.value = fullVersion;
                option.textContent = fullVersion;
                select.appendChild(option);
            });

            // Intentar cargar la versión guardada en localStorage
            const savedVersion = localStorage.getItem('selectedVersion');
            if (savedVersion) {
                if (Array.from(select.options).some(option => option.value === savedVersion)) {
                    select.value = savedVersion;
                    setVersion(savedVersion);
                    loadBooks(savedVersion);
                }
            }

        } catch (error) {
            console.error('Error al cargar las versiones:', error);
        }
    }

    // Definir la función setVersion
    const setVersion = (selectedVersion) => {
        version = selectedVersion;
        versionAbbr = extractVersionAbbreviation(selectedVersion);
        console.log('Versión seleccionada:', version);
        console.log('Abreviatura:', versionAbbr);
    };

    // Función para extraer la abreviatura de la versión
    function extractVersionAbbreviation(fullVersion) {
        if (!fullVersion) return '';

        // Buscar el patrón " - ABREVIATURA" al final del string
        const parts = fullVersion.split(' - ');
        if (parts.length > 1) {
            return parts[parts.length - 1].trim();
        }

        // Si no hay " - ", devolver la versión completa
        return fullVersion;
    }

    // Función para cargar libros según la versión seleccionada
    async function loadBooks(version) {
        try {
            const response = await fetch(`/api/books/${version}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            books = await response.json();

            // Ordenar los libros
            const bookOrder = [
                "GENESIS", "EXODO", "LEVITICO", "NUMEROS", "DEUTERONOMIO", "JOSUE",
                "JUECES", "RUT", "1 SAMUEL", "2 SAMUEL", "1 REYES", "2 REYES",
                "1 CRONICAS", "2 CRONICAS", "ESDRAS", "NEHEMIAS", "ESTER", "JOB",
                "SALMOS", "PROVERBIOS", "ECLESIASTES", "CANTARES", "ISAIAS",
                "JEREMIAS", "LAMENTACIONES", "EZEQUIEL", "DANIEL", "OSEAS", "JOEL",
                "AMOS", "ABDIAS", "JONAS", "MIQUEAS", "NAHUM", "HABACUC", "SOFONIAS",
                "HAGEO", "ZACARIAS", "MALAQUIAS", "MATEO", "MARCOS", "LUCAS", "JUAN",
                "HECHOS", "ROMANOS", "1 CORINTIOS", "2 CORINTIOS", "GALATAS", "EFESIOS",
                "FILIPENSES", "COLOSENSES", "1 TESALONICENSES", "2 TESALONICENSES",
                "1 TIMOTEO", "2 TIMOTEO", "TITO", "FILEMON", "HEBREOS", "SANTIAGO",
                "1 PEDRO", "2 PEDRO", "1 JUAN", "2 JUAN", "3 JUAN", "JUDAS", "APOCALIPSIS"
            ];

            books.sort((a, b) => bookOrder.indexOf(a) - bookOrder.indexOf(b));

            bookInput.addEventListener('input', filterBooks);
            displayBooks(books);
        } catch (error) {
            console.error('Error loading books', error);
        }
    }

    function filterBooks() {
        const input = bookInput.value.toLowerCase();
        const filteredBooks = books.filter(book => book.toLowerCase().includes(input));
        displayBooks(filteredBooks);
        // Si solo hay un libro filtrado, seleccionarlo y pasar al siguiente input
        if (filteredBooks.length === 1) {
            selectBook(filteredBooks[0]);
            chapterInput.focus(); // Enfocar el chapterInput

            chapterContent.classList.remove('hidden');
            verseContent.classList.add('hidden');
            leftContent.classList.add('hidden');
        }
    }

    function displayBooks(booksToDisplay) {
        bookGrid.innerHTML = ''; // Limpiar el grid
        resultContent.innerHTML = ''; // Limpiar contenido anterior
        verseGrid.innerHTML = ''; // Limpiar contenido anterior
        booksToDisplay.forEach((book) => {
            const div = document.createElement('div');
            div.textContent = book;
            div.className = 'book-item ' + (isNewTestament(book) ? 'new-testament' : 'old-testament'); // Asignar clase según el testamento
            div.tabIndex = 0; // Hacer que el div sea navegable con el teclado
            div.onclick = () => selectBook(book);
            bookGrid.appendChild(div);
            //console.log('Libros recibidos:', book); // Verifica aquí
        });
    }

    // Función para determinar si un libro es del Nuevo Testamento
    function isNewTestament(book) {
        const newTestamentBooks = [
            "MATEO", "MARCOS", "LUCAS", "JUAN", "HECHOS", "ROMANOS",
            "1 CORINTIOS", "2 CORINTIOS", "GALATAS", "EFESIOS", "FILIPENSES",
            "COLOSENSES", "1 TESALONICENSES", "2 TESALONICENSES", "1 TIMOTEO",
            "2 TIMOTEO", "TITO", "FILEMON", "HEBREOS", "SANTIAGO", "1 PEDRO",
            "2 PEDRO", "1 JUAN", "2 JUAN", "3 JUAN", "JUDAS", "APOCALIPSIS"
        ];
        return newTestamentBooks.includes(book);
    }

     // 5. SELECCIONAR LIBRO
    function selectBook(book) {
        bookInput.value = book; // Set selected book
        selectedBook = book; // Save selected book
        loadChapters(book); // Load chapters for the selected book
        chapterInput.disabled = false; // Enable chapter input
        chapterInput.value = ''; // Clear chapter input
        resultContent.innerHTML = ''; // Limpiar contenido anterior
        verseGrid.innerHTML = ''; // Limpiar contenido anterior
    }

    // 6. CARGAR CAPÍTULOS
    const loadChapters = (book) => {
        // Verificar que version esté definido
        if (!version) {
            console.error('No hay versión seleccionada. No se pueden cargar capítulos.');
            return; // Salir si version no está definido
        }
        if (chapterCache[book]) {
            populateChapters(chapterCache[book]);
            return;
        }

        fetch(`/api/chapters/${version}/${book}`) // Cambiado aquí
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(chaptersData => {
            console.log('Capítulos recibidos:', chaptersData); // Verifica aquí
            chapters = chaptersData;
            chapterCache[book] = chapters; // Guardar en caché
            populateChapters(chapters);
        })
        .catch(error => console.error('Error loading chapters:', error));
    };



    function populateChapters(chapters) {
        chapterInput.value = ''; // Limpiar el campo de entrada del capítulo
        chapterGrid.innerHTML = ''; // Limpiar el grid de capítulos

        // Convertir las cadenas a números y ordenar
        const sortedChapters = chapters
        .map(chapter => parseInt(chapter, 10)) // Convertir a número
        .sort((a, b) => a - b); // Ordenar numéricamente

        sortedChapters.forEach((chapter) => {
            const div = document.createElement('div');
            div.textContent = `${chapter}`; // Mostrar capítulo en el grid
            div.className = 'chapter-item';
            div.tabIndex = 0; // Permitir navegación con teclado
            div.onclick = () => selectChapter(chapter); // Manejar la selección del capítulo
            chapterGrid.appendChild(div); // Añadir al grid
        });
    }

        // 7. SELECCIONAR CAPÍTULO
    function selectChapter(chapter) {
        chapterInput.value = chapter; // Set selected chapter
        selectedChapter = chapter; // Save selected chapter
        loadVerses(version, selectedBook, selectedChapter, verseInput.value); // Asegúrate de que `version` no sea undefined
    }

     // 8. CARGAR VERSÍCULOS
    // Cambia esta función para almacenar los datos de los versículos en la variable global verseData
    async function loadVerses(version, book, chapter, verses) {
        try {
            const response = await fetch(`/api/verses/${encodeURIComponent(version)}/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}`);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            verseData = data; // Almacena los datos de los versículos cargados

            displayVerses(data); // Mostrar todos los números de los versículos

            const verseNumbers = verses ? parseVerses(verses) : []; // Convertir la entrada de versos a un array de números
            let filteredVerses = data; // No filtramos los versículos, mostramos todos en resultContent

            // Mostrar todos los versículos, pero los seleccionados deben resaltar
            displayResultContent(filteredVerses);

            // Resaltar los versículos correspondientes
            highlightSelectedVerses(verseNumbers);

            // Si hay versículos seleccionados, solo enviamos esos versículos
            if (verseNumbers.length > 0) {
                filteredVerses = filteredVerses.filter(item => verseNumbers.includes(parseInt(item["0"])));
            }

            // Preparar los resultados para el envío, solo los versículos seleccionados
            return filteredVerses.map(item => `${item["0"]}: ${item["1"]}`).join('\n');
        } catch (error) {
            console.error('Debe seleccionar Libro, Capítulo y Versículo', error);
            resultContent.textContent = 'Debe seleccionar Libro, Capítulo y Versículo.';
            return ''; // Devuelve una cadena vacía en caso de error
        }
    }

      // 9. MOSTRAR VERSÍCULOS EN GRID
    // En displayVerses, verificar que los clicks estén configurados
    function displayVerses(verses) {
        const verseGrid = document.getElementById('verseGrid');
        if (!verseGrid) {
            console.error('❌ verseGrid element is not found.');
            return;
        }

        verseGrid.innerHTML = '';
        console.log(`🔄 Mostrando ${verses.length} versículos en el grid`);

        verses.forEach((verse) => {
            const div = document.createElement('div');
            div.textContent = `${verse["0"]}`;
            div.className = 'verse-items';
            div.setAttribute('data-verse', verse["0"]);
            div.tabIndex = 0;

            // Asegurar que el click esté configurado
            div.onclick = () => {
                console.log('🖱️ Click en versículo del grid:', verse["0"]);
                selectVerse(verse);
            };

            // También permitir selección con teclado
            div.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    console.log('⌨️ Tecla en versículo del grid:', verse["0"]);
                    selectVerse(verse);
                    event.preventDefault();
                }
            });

            verseGrid.appendChild(div);
        });
    }

    // 10. MOSTRAR CONTENIDO DE VERSÍCULOS
 function displayResultContent(verses) {
     const resultContent = document.getElementById('resultContent');
     resultContent.innerHTML = ''; // Limpiar el contenido anterior

     verses.forEach((verse) => {
         const verseDiv = document.createElement('div');
         verseDiv.className = 'verse-item';
         verseDiv.setAttribute('data-verse', verse["0"]); // Atributo para identificación
         verseDiv.textContent = `${verse["0"]}: ${verse["1"]}`; // Formato "número: texto"
         verseDiv.tabIndex = 0;

         // Crear un checkbox para cada versículo (solo si el modo es incremental)
         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.className = 'verse-checkbox';
         checkbox.setAttribute('data-verse', verse["0"]);

         // Gestionar el cambio de estado del checkbox para selección incremental
         checkbox.addEventListener('change', (event) => {
             const verseNumber = parseInt(event.target.getAttribute('data-verse'));

             if (event.target.checked) {
                 // Si está marcado y el checkbox global está activo, se agrega al array
                 if (incrementalCheckbox.checked) {
                     selectedIncrementalVerses.push(verseNumber);

                 }
             } else {
                 // Si se desmarca, se elimina del array
                 selectedIncrementalVerses = selectedIncrementalVerses.filter(v => v !== verseNumber);
             }

             // Actualizar los versículos seleccionados para enviarlos
             sendSelectedVerses();
         });

         // Añadir el checkbox al contenedor del verso
         //verseDiv.appendChild(checkbox);

         // Añadir el div con el checkbox al resultContent
         resultContent.appendChild(verseDiv);

         // Añadir funcionalidad de clic para seleccionar/deseleccionar el versículo
         verseDiv.addEventListener('click', (event) => {
             const verseNumber = parseInt(verseDiv.getAttribute('data-verse'));

             // Si el checkbox global NO está marcado, se selecciona un único verso
             if (!incrementalCheckbox.checked) {
                 // Resaltar solo el versículo clickeado
                 const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
                 resultContentItems.forEach(item => {
                     item.classList.remove('selected-verse'); // Eliminar resalte de todos los versos
                 });
                 verseDiv.classList.add('selected-verse'); // Resaltar el versículo clickeado

                 // Desmarcar el checkbox correspondiente si se hace clic en un verso sin el checkbox activado
                 const relatedCheckbox = verseDiv.querySelector('.verse-checkbox');
                 if (relatedCheckbox) {
                     relatedCheckbox.checked = false; // Desmarcar checkbox relacionado
                 }
                 // 2. Actualizar verseGrid para resaltar el versículo seleccionado
                 const verseGridItems = document.querySelectorAll('#verseGrid .verse-item');
                 verseGridItems.forEach(item => {

                     if (item.getAttribute('data-verse') === verseDiv.getAttribute('data-verse')) {
                         item.classList.add('selected-verse'); // Resaltar en verseGrid
                     } else {
                         item.classList.remove('selected-verse'); // Eliminar resalte de los otros versos
                     }
                 });
                 // 1. Enviar el mensaje para este versículo único
                 sendSingleVerseMessage(verseNumber);

                 console.log('enviando111:', verseNumber);
             } else {

                 // Si el checkbox global está marcado, se alterna la selección incremental
                 if (verseDiv.classList.contains('selected-verse')) {
                     verseDiv.classList.remove('selected-verse'); // Eliminar resalte
                     // Eliminar del array de selección incremental
                     selectedIncrementalVerses = selectedIncrementalVerses.filter(v => v !== verseNumber);
                 } else {
                     verseDiv.classList.add('selected-verse'); // Resaltar el versículo
                     // Añadir al array de selección incremental
                     selectedIncrementalVerses.push(verseNumber);
                 }
                 console.log('enviando222:', sendSelectedVerses);
                 // Enviar los versículos seleccionados incrementalmente
                 sendSelectedVerses();
             }
         });
         resultContent.appendChild(verseDiv);
     });
 }

  // 11. SELECCIONAR VERSÍCULO
 // Función para seleccionar versículo desde el grid - CORREGIDA
 function selectVerse(verse) {
     console.log('🎯 selectVerse llamado con:', verse);

     if (!verse || !verse["0"] || !verse["1"]) {
         console.error('❌ Versículo inválido en selectVerse:', verse);
         return;
     }

     // Usar handleVerseInput que ya incluye el guardado en historial
     handleVerseInput(verse);

     // Resaltar en el grid
     const verseGridItems = document.querySelectorAll('#verseGrid .verse-item');
     verseGridItems.forEach(item => {
         if (item.getAttribute('data-verse') === verse["0"].toString()) {
             item.classList.add('selected-verse');
         } else {
             item.classList.remove('selected-verse');
         }
     });

     // Resaltar en el contenido
     const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
     resultContentItems.forEach(item => {
         if (item.getAttribute('data-verse') === verse["0"].toString()) {
             item.classList.add('selected-verse');
             item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
         } else {
             item.classList.remove('selected-verse');
         }
     });
 }

    // 12. MANEJAR INPUT DE VERSÍCULOS
    // Función para manejar entrada de versículos - CORREGIDA
    async function handleVerseInput(verse) {
        console.log('🎯 handleVerseInput llamado con:', verse);

        const identifier = "12345";
        let verseNumber, title, message;

        if (verse) {
            // Caso: Click en versículo del grid
            verseNumber = verse["0"];
            title = `${versionAbbr} - ${selectedBook} ${selectedChapter}:${verseNumber}`;
            message = `${identifier}:biblia\n${title}\n${verseNumber}: ${verse["1"]}`;

            console.log('📖 Desde grid:', title);

        } else {
            // Caso: Enter en el input
            const versesInput = verseInput.value.trim();
            if (!versesInput) {
                console.warn('⚠️ Input de versículos vacío');
                return;
            }

            verseNumber = versesInput;
            title = `${versionAbbr} - ${selectedBook} ${selectedChapter}:${verseNumber}`;

            console.log('📖 Desde input:', title);

            // Cargar los versículos para el input
            const results = await loadVerses(version, selectedBook, selectedChapter, versesInput);
            message = `${identifier}:biblia\n${title}\n${results}`;
        }

        // Validar que tenemos todos los datos necesarios
        if (!versionAbbr || !selectedBook || !selectedChapter) {
            console.error('❌ Faltan datos para guardar en historial:', {
                versionAbbr, selectedBook, selectedChapter
            });
            return;
        }

        resultTitle.textContent = title;

        // Preparar entrada de historial
        let historyEntry;

        if (verse) {
            // Entrada para versículo único del grid
            historyEntry = {
                type: 'single',
                version: versionAbbr,
                book: selectedBook,
                chapter: selectedChapter,
                verse: parseInt(verseNumber),
                          title: title,
                          content: `${verseNumber}: ${verse["1"]}`,
                          fullContent: message,
                          timestamp: new Date().toISOString(),
                          config: getCurrentConfig(),
                          source: 'grid'
            };
        } else {
            // Entrada para input (puede ser múltiple versículos)
            const verseNumbers = parseVerses(verseInput.value.trim());
            if (verseNumbers.length === 1) {
                historyEntry = {
                    type: 'single',
                    version: versionAbbr,
                    book: selectedBook,
                    chapter: selectedChapter,
                    verse: verseNumbers[0],
                    title: title,
                    content: await loadVerses(version, selectedBook, selectedChapter, verseInput.value),
                          fullContent: message,
                          timestamp: new Date().toISOString(),
                          config: getCurrentConfig(),
                          source: 'input'
                };
            } else {
                historyEntry = {
                    type: 'multiple',
                    version: versionAbbr,
                    book: selectedBook,
                    chapter: selectedChapter,
                    verses: verseNumbers,
                    title: title,
                    content: await loadVerses(version, selectedBook, selectedChapter, verseInput.value),
                          fullContent: message,
                          timestamp: new Date().toISOString(),
                          config: getCurrentConfig(),
                          source: 'input'
                };
            }
        }

        console.log('💾 Guardando desde handleVerseInput:', historyEntry);
        saveToHistory(historyEntry);

        console.log('📤 Enviando mensaje...');
        sendMessagess(message);

        // Scroll al versículo seleccionado
        if (verse) {
            const verseNumbers = [parseInt(verseNumber)];
            const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
            let firstSelectedItem = null;

            resultContentItems.forEach(item => {
                const itemVerseNumber = parseInt(item.getAttribute('data-verse'));
                if (verseNumbers.includes(itemVerseNumber)) {
                    item.classList.add('selected-verse');
                    if (!firstSelectedItem) {
                        firstSelectedItem = item;
                    }
                } else {
                    item.classList.remove('selected-verse');
                }
            });

            if (firstSelectedItem) {
                firstSelectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

      // 13. ENVIAR VERSÍCULO ÚNICO
    function sendSingleVerseMessage(verseNumber) {
        console.log('🚀 Iniciando sendSingleVerseMessage para versículo:', verseNumber);

        // Verificar que todos los datos necesarios estén disponibles
        if (!verseData || !Array.isArray(verseData)) {
            console.error('❌ verseData no está disponible o no es un array');
            return;
        }

        if (!versionAbbr || !selectedBook || !selectedChapter) {
            console.error('❌ Faltan datos necesarios:', {
                versionAbbr, selectedBook, selectedChapter
            });
            return;
        }

        const verse = verseData.find(v => {
            const verseNum = parseInt(v["0"]);
            return verseNum === verseNumber;
        });

        if (!verse) {
            console.error('❌ No se encontró el versículo', verseNumber, 'en verseData:', verseData);
            return;
        }

        const identifier = "12345";
        const title = `${versionAbbr} - ${selectedBook} ${selectedChapter}:${verseNumber}`;
        const message = `${identifier}:biblia\n${title}\n${verseNumber}: ${verse["1"]}`;

        console.log('📖 Preparando cita:', title);
        resultTitle.textContent = title;

        // Crear entrada de historial
        const historyEntry = {
            type: 'single',
            version: versionAbbr,
            book: selectedBook,
            chapter: selectedChapter,
            verse: verseNumber,
            title: title,
            content: `${verseNumber}: ${verse["1"]}`,
            fullContent: message,
            timestamp: new Date().toISOString(),
                          config: getCurrentConfig()
        };

        console.log('💾 Guardando en historial...');
        saveToHistory(historyEntry);

        console.log('📤 Enviando por WebSocket...');
        sendMessagess(message);
    }

     // 14. ENVIAR VERSÍCULOS SELECCIONADOS
    function sendSelectedVerses() {
        console.log('🚀 Iniciando sendSelectedVerses');

        if (!selectedIncrementalVerses || selectedIncrementalVerses.length === 0) {
            console.warn('⚠️ No hay versículos seleccionados');
            return;
        }

        if (!verseData || !Array.isArray(verseData)) {
            console.error('❌ verseData no disponible');
            return;
        }

        const identifier = "12345";
        const title = `${versionAbbr} - ${generateTitle(selectedIncrementalVerses.map(verseNumber => {
            return verseData.find(v => parseInt(v["0"]) === verseNumber);
        }))}`;

        console.log('📖 Preparando cita múltiple:', title);
        resultTitle.textContent = title;

        const messageContent = selectedIncrementalVerses.map(verseNumber => {
            const verse = verseData.find(v => parseInt(v["0"]) === verseNumber);
            return verse ? `${verseNumber}: ${verse["1"]}` : `❌ Versículo ${verseNumber} no encontrado`;
        }).filter(content => content).join('\n');

        const message = `${identifier}:biblia\n${title}\n${messageContent}`;

        // Crear entrada de historial
        const historyEntry = {
            type: 'multiple',
            version: versionAbbr,
            book: selectedBook,
            chapter: selectedChapter,
            verses: [...selectedIncrementalVerses],
            title: title,
            content: messageContent,
            fullContent: message,
            timestamp: new Date().toISOString(),
                          config: getCurrentConfig()
        };

        console.log('💾 Guardando en historial...');
        saveToHistory(historyEntry);

        console.log('📤 Enviando por WebSocket...');
        sendMessagess(message);
        resultTitle.textContent = title;
    }


    function generateTitle(verses) {
        const verseNumbers = verses.map(verse => parseInt(verse["0"])).sort((a, b) => a - b);
        let title = `${selectedBook} ${selectedChapter}:`;

        const groupedVerses = [];
        let rangeStart = verseNumbers[0];
        let rangeEnd = verseNumbers[0];

        for (let i = 1; i < verseNumbers.length; i++) {
            if (verseNumbers[i] === rangeEnd + 1) {
                rangeEnd = verseNumbers[i];
            } else {
                groupedVerses.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
                rangeStart = verseNumbers[i];
                rangeEnd = verseNumbers[i];
            }
        }

        groupedVerses.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        title += groupedVerses.join(', ');
        return title;
    }

    // 15. ENVIAR MENSAJES POR WEBSOCKET
    // Función para enviar mensajes por WebSocket
    function sendMessagess(message) {

        if (ws.readyState === WebSocket.OPEN) {
            // 1. Enviar configuración de estilos
            sendConfigToWS();
            //resultTitle.textContent = title;
            // Obtener el elemento del checkbox 'fondoCheckbox'
            var fondoCheckbox = document.getElementById('fondoCheckbox');

            // Verificar si el checkbox está marcado
            if (fondoCheckbox && fondoCheckbox.checked) {
                // Si está marcado, enviar 'fondo_biblia' a través de WebSocket
                ws.send('fondo_biblia');
                // Puedes descomentar esta línea si deseas enviar un mensaje adicional:
                // ws.send('LOOP_biblia');
                console.log('CheckActive'); // Imprimir estado antes de enviar
            } else {
                // Si no está marcado, enviar 'check_disable' a través de WebSocket
                ws.send('check_disable');
                console.log('check_disable'); // Imprimir estado antes de enviar
            }
            ws.send('SHOW');
            ws.send(message);
            ws.send(`TEXT_ALIGN:justify`);
            //ws.send(`cambiartipoletra`);
            ws.send('LOOP_STATUS');
            console.log('enviando mensaje:', message);
        } else {
            console.error('WebSocket is not open. Unable to send the message.');
        }
    }

     // 16. CONVERTIR TEXTO A ARRAY DE VERSÍCULOS
    // Función para convertir la entrada de versículos en un array
    function parseVerses(verses) {
        const parts = verses.split(',');
        const result = [];

        parts.forEach(part => {
            const range = part.split('-').map(Number);
            if (range.length === 1) {
                result.push(range[0]); // Un solo versículo
            } else if (range.length === 2) {
                const [start, end] = range;
                for (let i = start; i <= end; i++) {
                    result.push(i); // Rango de versículos
                }
            }
        });

        return result;
    }

    // 17. RESALTAR VERSÍCULOS SELECCIONADOS
    // Función para resaltar los versículos seleccionados
    function highlightSelectedVerses(verseNumbers) {
        // Resaltar los versículos en verseGrid
        const verseGridItems = document.querySelectorAll('#verseGrid .verse-item');
        verseGridItems.forEach(item => {
            const verseNumber = parseInt(item.getAttribute('data-verse'));
            if (verseNumbers.includes(verseNumber)) {
                item.classList.add('selected-verse');
            } else {
                item.classList.remove('selected-verse');
            }
        });

        // Resaltar los versículos en resultContent
        const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
        resultContentItems.forEach(item => {
            const verseNumber = parseInt(item.getAttribute('data-verse'));
            if (verseNumbers.includes(verseNumber)) {
                item.classList.add('selected-verse');
            } else {
                item.classList.remove('selected-verse');
            }
        });
    }



    // Función para cambiar el color del botón según el estado de loop
    function updateButtonColor(loopStatus) {
        if (hideVideoButton) {
            if (loopStatus) {
                hideVideoButton.style.backgroundColor = 'green';
                hideVideoButton.textContent = 'Loop On';
            } else {
                hideVideoButton.style.backgroundColor = 'red';
                hideVideoButton.textContent = 'Loop Off';
            }
            localStorage.setItem('loopStatus', loopStatus);
        }
    }

    // Función para verificar el estado al cargar la página
    function checkLoopStatusOnLoad() {
        const storedStatus = localStorage.getItem('loopStatus');

        if (storedStatus !== null) {
            const loopStatus = storedStatus === 'true';
            updateButtonColor(loopStatus); // Actualizar el botón basado en el estado almacenado
        }
    }

      // ========== EVENT LISTENERS ==========


       // ========== INICIALIZACIÓN FINAL ==========

       function adjustHeaderHeight() {
           const videoSear = document.getElementById('video-search');
           const header = document.getElementById('header');
           header.style.height = `${videoSear.offsetHeight}px`; // Ajusta la altura del header
       }

       // Función para cargar configuraciones guardadas
       function loadSavedSettings() {
           const savedTheme = localStorage.getItem('pluginTheme') || 'default';
           const savedPosition = localStorage.getItem('pluginPosition') || 'bottom-right';

           // Establecer los valores en los selectores
           themeSelector.value = savedTheme;
           positionSelector.value = savedPosition;

           // Enviar configuraciones al cargar (si hay conexión WebSocket)
           setTimeout(() => {
               sendTheme(savedTheme);
               sendPosition(savedPosition);
           }, 1000); // Pequeño delay para asegurar que WebSocket esté conectado
       }

       // Función para enviar tema en texto plano
       function sendTheme(theme) {
           if (ws.readyState === WebSocket.OPEN) {
               const message = `updatePlugin:theme:${theme}`;
               ws.send(message);
               console.log('Enviando tema (texto):', message);
           } else {
               console.error("WebSocket no está conectado");
           }
       }


       function sendPosition(position) {
           if (ws.readyState === WebSocket.OPEN) {
               const message = `updatePlugin:position:${position}`;
               ws.send(message);
               console.log('Enviando comando (texto):', message);
           } else {
               console.error("WebSocket no está conectado");
           }
       }

       // ========== INICIALIZACIÓN COMPLETA ==========

       console.log('🎬 INICIANDO APLICACIÓN BIBLIA COMPLETA...');

       // Inicialmente, ocultar las secciones que no son left-content
    //centerContent.classList.add('hidden');
    chapterContent.classList.add('hidden');
    verseContent.classList.add('hidden');

    // ========== EVENT LISTENERS ==========

     // Event listeners para navegación entre secciones
    // Lógica para mostrar center-content al seleccionar un libro
    bookGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('book-item')) { // Asegúrate de que los elementos del libro tengan esta clase
            centerContent.classList.remove('hidden'); // Mostrar center-content
            leftContent.classList.add('hidden');
        }
    });

    // Lógica para mostrar verse-content al seleccionar un capítulo
    chapterGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('chapter-item')) { // Asegúrate de que los elementos del capítulo tengan esta clase
            verseContent.classList.remove('hidden'); // Mostrar verse-content
             chapterContent.classList.add('hidden');
        }
    });

    // 1. CARGAR VERSIONES
    ////????????

    // ========== EVENT LISTENERS ==========

    // Event listener para versionSelect
     const versionSelect = document.getElementById('versionSelect'); // Suponiendo que tienes un select para las versiones

    versionSelect.addEventListener('change', (event) => {
        selectedVersion = event.target.value; // Actualiza selectedVersion con el valor seleccionado
    });


    bookInput.addEventListener('click', () => {
        loadVersions();
        bookInput.value = ''; // Borrar el contenido al hacer clic
        chapterContent.classList.add('hidden');
        verseContent.classList.add('hidden');
        leftContent.classList.remove('hidden');

    });

    // Verificar que el event listener esté correctamente configurado
    verseInput.addEventListener('keydown', async (event) => {
        console.log('⌨️ Tecla presionada en verseInput:', event.key);

        if (event.key === 'Enter') {
            console.log('✅ Enter detectado en verseInput');

            if (version && selectedBook && selectedChapter) {
                const verses = verseInput.value.trim();
                console.log('📝 Contenido del input:', verses);

                verseInput.style.backgroundColor = defaultColor;

                if (verses) {
                    console.log('🚀 Ejecutando handleVerseInput desde input...');
                    await handleVerseInput(); // Sin parámetro = desde input
                    verseInput.value = '';
                    chapterContent.classList.add('hidden');
                    verseContent.classList.remove('hidden');
                    leftContent.classList.add('hidden');
                } else {
                    console.warn('⚠️ Input vacío, no se hace nada');
                }
            } else {
                console.error('❌ Faltan datos para enviar:', {
                    version: !!version,
                    selectedBook: !!selectedBook,
                    selectedChapter: !!selectedChapter
                });
            }
        }
    });


    verseInput.addEventListener('click', () => {
        verseInput.value = ''; // Borrar el contenido al hacer clic

    });


    toggleButton.addEventListener('click', () => {
        if (isWebSocketOpen) {
            // Obtén el estado actual del botón desde el texto
            const isVisible = toggleButton.textContent === 'MostrarBiblia';  // Si es 'Mostrar', el estado es falso

            if (isVisible) {
                // Si el botón está en "Mostrar", lo cambiamos a "Ocultar" y enviamos el mensaje SHOW
                ws.send('SHOW');
                // toggleButton.textContent = 'Ocultar';  // Cambiar el texto a "Ocultar"
            } else {
                // Si el botón está en "Ocultar", lo cambiamos a "Mostrar" y enviamos el mensaje HIDE
                ws.send('HIDE');
                //toggleButton.textContent = 'Mostrar';  // Cambiar el texto a "Mostrar"
            }
        } else {
            console.error('WebSocket no está abierto');
        }
    });

    if (hideVideoButton) {
        hideVideoButton.addEventListener('click', () => {
            if (isWebSocketOpen) {
                ws.send('LOOP_C');
                //hideVideoButton.style.backgroundColor = colorChange ? '#007BFF' : 'red';
                //colorChange = !colorChange; // Alternar el estado
            } else {
                console.error('WebSocket no está abierto. No se puede enviar el mensaje.');
            }
        });
    }

    //const showVideoButton = document.getElementById('showVideoButton');
    if (showVideoButton) {
        showVideoButton.addEventListener('click', () => {
            if (isWebSocketOpen) {
                ws.send('fondo_biblia');
                console.log('Enviando mensaje fondo_biblia:');
            } else {
                console.error('WebSocket no está abierto. No se puede enviar el mensaje.');
            }
        });
    }

    // Checkbox incremental
    if (incrementalCheckbox) {
        incrementalCheckbox.addEventListener('change', () => {
            if (!incrementalCheckbox.checked) {
                selectedIncrementalVerses = [];
                document.querySelectorAll('#resultContent .verse-item').forEach(item => {
                    item.classList.remove('selected-verse');
                });
                sendSelectedVerses();
            }
        });
    }
    // ========== EVENT LISTENERS ==========

    // ========== EJECUCIÓN INICIAL ==========
    // 1. Ajustes iniciales
    adjustHeaderHeight();

    // 2. CARGAR VERSIONES
    loadVersions();

    // 3. Configuración
    loadSavedSettings();
    initConfig();
    connectWebSocket();
    setupSearch();

    // 4. Inicializar historial
    createHistoryUI().then(() => {
       refreshHistoryUI();
    });

      // 5. UI
    const videoSear = document.getElementById('video-search');
    if (videoSear) videoSear.style.background = '#5da7eb';
    adjustHeaderHeight();
    // 6. Estado inicial
    bookInput.focus();
    bookInput.value = '';
    chapterInput.value = '';
    verseInput.value = '';
    chapterGrid.innerHTML = '';

    // 7. Verificar estado
    checkLoopStatusOnLoad();

    console.log('✅ APLICACIÓN COMPLETA INICIALIZADA')

     // ========== WEBSOCKET & CONFIGURACIÓN ==========
    // Función para conectar al WebSocket
    function connectWebSocket() {
        //   ws = new WebSocket('ws://localhost:8081');
        //    const socket = new WebSocket(`ws://${window.location.hostname}:8080`);
        //const ws = new WebSocket(`ws://${window.location.hostname}:8081`);


        ws.onopen = () => {
            console.log('Conexión WebSocket establecida');
            isWebSocketOpen = true; // Actualiza el estado a abierto
        };

        ws.onmessage = (event) => {
            console.log('Mensaje del servidor:', event.data);
            const message = event.data;
            const data = message.split(':');
            console.log(data);
            switch (data[0]) {
                case 'LOOP_STATUS':
                    if (data.length > 1) {
                        // Obtener el valor correcto y eliminar espacios
                        const loopStatus = data[1].trim() === 'true';
                        updateButtonColor(loopStatus);
                        //console.log('El estado de loop es:', loopStatus);
                    }
                    break;
                case 'UPDATE_BUTTON_BIBLIA_ON':
                    //console.log('Actualizando el botón a "OcultarBiblia"');
                    //toggleButton.textContent = "Ocultar";
                    //updateToggleButtonState(isVisible);
                    //  checkToggleButtonStateOnLoad();
                    toggleButton.textContent = "OcultarBiblia";  // Cambiar texto cuando está visible
                    toggleButton.style.backgroundColor = 'green';  // Color cuando es visible
                    break;
                case 'UPDATE_BUTTON_BIBLIA_OFF':
                    //console.log('Actualizando el botón a "MostrarBiblia"');
                    //toggleButton.textContent = "Mostrar";
                    //updateToggleButtonState(isVisible);
                    //  checkToggleButtonStateOnLoad();
                    toggleButton.textContent = "MostrarBiblia";  // Cambiar texto cuando no está visible
                    toggleButton.style.backgroundColor = 'red';  // Color cuando no está visible
                    break;
                    // case 'SHOW':
                    //   showContentBox();
                    // break;
            }
        };

        ws.onclose = () => {
            console.log('Conexión WebSocket cerrada');
            isWebSocketOpen = false; // Actualiza el estado a cerrado
        };

        ws.onerror = (error) => {
            console.error('Error en WebSocket:', error);
            isWebSocketOpen = false; // Actualiza el estado en caso de error
        };
    }

//////////////////////////  DE AQUI HACIA ABAJO SON LO QUE FALTA REVISAR   ////////////////////////////

/*
     // Ajusta la altura al cargar la página
        window.onload = adjustHeaderHeight;

        // Ajusta la altura al redimensionar la ventana
        window.onresize = adjustHeaderHeight;
*/
// Crear el iframe para reproductor
/*    const iframe = document.createElement('iframe');
    iframe.src = '../listaOBS_Control.html'; // Cambia esto por la URL que deseas
    iframe.width = '100%'; // Ajusta el ancho según necesites
    iframe.height = '840px'; // Ajusta la altura según necesites
    iframe.style.border = 'none'; // Opcional: elimina el borde del iframe
*/





    function loadSettings() {
                // Cargar tamaño de fuente desde LocalStorage
                currentFontSize = localStorage.getItem('fontSize') || 20;
                fontSizeSlider.value = currentFontSize;
                fontSizeValue.textContent = `${currentFontSize}px`;
                document.querySelector('.verse-content').style.fontSize = `${currentFontSize}px`;

                // Cargar versículos seleccionados desde LocalStorage
                const selectedVerses = JSON.parse(localStorage.getItem('selectedVerses')) || [];
                selectedVerses.forEach(value => {
                    const checkbox = document.querySelector(`.verse-checkbox[value="${value}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
    function saveSettings() {
                // Guardar tamaño de fuente en LocalStorage
                localStorage.setItem('fontSize', currentFontSize);

                // Guardar versículos seleccionados en LocalStorage
                const selectedVerses = Array.from(document.querySelectorAll('.verse-checkbox:checked'))
                    .map(checkbox => checkbox.value);
                localStorage.setItem('selectedVerses', JSON.stringify(selectedVerses));
            }

connectWebSocket();

let colorChange = false;



// Agregar evento al combo box de versiones
    document.getElementById('versionSelect').addEventListener('change', function () {
        const selectedVersion = this.value;
        setVersion(selectedVersion); // Establecer la nueva versión
        loadBooks(selectedVersion); // Cargar libros según la versión seleccionada
        localStorage.setItem('selectedVersion', selectedVersion);
    });

const bookOrder = [
    "GENESIS",  "EXODO", "LEVITICO",  "NUMEROS",  "DEUTORONOMIO", "JOSUE",
        "JUECES",
        "RUT",
        "1 SAMUEL",
        "2 SAMUEL",
        "1 REYES",
        "2 REYES",
        "1 CRONICAS",
        "2 CRONICAS",
        "ESDRAS",
        "NEHEMIAS",
        "ESTER",
        "JOB",
        "SALMOS",
        "PROVERBIOS",
        "ECLESIASTES",
        "CANTARES",
        "ISAIAS",
        "JEREMIAS",
        "LAMENTACIONES",
        "EZEQUIEL",
        "DANIEL",
        "OSEAS",
        "JOEL",
        "AMOS",
        "ABDIAS",
        "JONAS",
        "MIQUEAS",
        "NAHUM",
        "HABACUC",
        "SOFONIAS",
        "HAGEO",
        "ZACARIAS",
        "MALAQUIAS",
        "MATEO",
        "MARCOS",
        "LUCAS",
        "JUAN",
        "HECHOS",
        "ROMANOS",
        "1 CORINTIOS",
        "2 CORINTIOS",
        "GALATAS",
        "EFESIOS",
        "FILIPENSES",
        "COLOSENSES",
        "1 TESALONICENSES",
        "2 TESALONICENSES",
        "1 TIMOTEO",
        "2 TIMOTEO",
        "TITO",
        "FILEMON",
        "HEBREOS",
        "SANTIAGO",
        "1 PEDRO",
        "2 PEDRO",
        "1 JUAN",
        "2 JUAN",
        "3 JUAN",
        "JUDAS",
        "APOCALIPSIS"
];

// Función para cargar libros según la versión seleccionada
async function loadBooks(version) {
    try {
        const response = await fetch(`/api/books/${version}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        books = await response.json();

        // Ordenar los libros usando el array de referencia
        books.sort((a, b) => bookOrder.indexOf(a) - bookOrder.indexOf(b));

        bookInput.addEventListener('input', filterBooks);
        displayBooks(books); // Mostrar todos los libros inicialmente
    } catch (error) {
        console.error('Error loading books', error);
    }
}
// ... El resto de tu código permanece igual




chapterInput.addEventListener('input', filterChapters);

       function filterChapters() {
        const input = chapterInput.value.toLowerCase();
        const currentChapters = chapterCache[selectedBook] || []; // Obtener capítulos del libro actual
        const filteredChapters = currentChapters.filter(chapter => chapter.toString().includes(input));
        displayChapters(filteredChapters);
         // Si solo hay un capítulo filtrado, seleccionarlo y pasar al siguiente input
         if (filteredChapters.length === 1) {
         selectChapter(filteredChapters[0]);
         verseInput.focus(); // Enfocar el verseInput
         chapterContent.classList.add('hidden');
    verseContent.classList.remove('hidden');
    leftContent.classList.add('hidden');
       }
    }

// Mantén el resto del código igual, solo modifica el evento keydown para mejor feedback
    chapterInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const chapterValue = chapterInput.value.trim();
            const currentChapters = chapterCache[selectedBook] || [];
            const maxChapter = Math.max(...currentChapters);
            const chapterNum = parseInt(chapterValue);

            const isValid = !isNaN(chapterNum) && chapterNum >= 1 && chapterNum <= maxChapter;

            if (isValid) {
                selectChapter(chapterNum);
                verseInput.focus();
                 verseInput.value = '';
            } else {
                event.preventDefault();
                chapterInput.classList.add('chapter-input-invalid');
                // Muestra mensaje temporal
                chapterInput.placeholder = `Máx. ${maxChapter} capítulos`;
                setTimeout(() => { chapterInput.placeholder = ""; }, 2000);
            }
        }
    });

    
function displayChapters(chaptersToDisplay) {
    chapterGrid.innerHTML = ''; // Limpiar el grid de capítulos

    // Convertir las cadenas a números y ordenar
    const sortedChapters = chaptersToDisplay
        .map(chapter => parseInt(chapter, 10)) // Convertir a número
        .sort((a, b) => a - b); // Ordenar numéricamente

    sortedChapters.forEach(chapter => {
        const div = document.createElement('div');
        div.textContent = `${chapter}`; // Capítulo en los grids
        div.className = 'chapter-item';
        div.tabIndex = 0; // Permitir navegación con teclado
        div.onclick = () => {
            selectChapter(chapter); // Seleccionar capítulo
        };
        chapterGrid.appendChild(div);
    });
}

// Define los colores
const defaultColor = ''; // Color por defecto
const highlightColor = 'LightSalmon'; // Color al cambiar de entrada

// Cambiar el color de fondo al enfocar bookInput
bookInput.addEventListener('focus', () => {
    bookInput.style.backgroundColor = highlightColor;
});

// Cambiar el color de fondo al enfocar chapterInput
chapterInput.addEventListener('focus', () => {
    chapterInput.style.backgroundColor = highlightColor;
    bookInput.style.backgroundColor = defaultColor; // Reiniciar bookInput
    chapterContent.classList.remove('hidden');
    verseContent.classList.add('hidden');
    leftContent.classList.add('hidden');
});

// Cambiar el color de fondo al enfocar verseInput
verseInput.addEventListener('focus', () => {
    verseInput.style.backgroundColor = highlightColor;
    chapterInput.style.backgroundColor = defaultColor; // Reiniciar chapterInput
    verseInput.value = ''; // Borrar el contenido al hacer clic
});

// Función para obtener el verso según el número (esto depende de tu implementación)
function getVerseByNumber(verseNumber) {
    // Aquí deberías obtener el verso real desde tu base de datos o objeto de versos
    // Este es un ejemplo simple, deberías adaptarlo según tu estructura de datos
    return versesData.find(verse => verse["0"] === verseNumber);
}

// Resetear los versos seleccionados y desmarcar los checkboxes cuando se desmarque el checkbox global
incrementalCheckbox.addEventListener('change', () => {
    if (!incrementalCheckbox.checked) {
        // Si el checkbox global se desmarca, se vacía la selección incremental
        selectedIncrementalVerses = [];

        // Limpiar el resaltado de los versos
        const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
        resultContentItems.forEach(item => {
            item.classList.remove('selected-verse'); // Eliminar resaltado de todos los versos
        });

        // Desmarcar todos los checkboxes
        const checkboxes = document.querySelectorAll('.verse-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false; // Desmarcar todos los checkboxes
        });

        // Enviar mensaje vacío (sin selección)
        sendSelectedVerses();
    } else {// Limpiar el resaltado de los versos
        const resultContentItems = document.querySelectorAll('#resultContent .verse-item');
        resultContentItems.forEach(item => {
            item.classList.remove('selected-verse'); // Eliminar resaltado de todos los versos
        });

    }

});

function generateTitle(verses) {
    const verseNumbers = verses.map(verse => parseInt(verse["0"]));
    let title = `${selectedBook} ${selectedChapter}:`;

    // Organizar los versículos seleccionados y formatearlos
    const groupedVerses = [];
    let rangeStart = verseNumbers[0];
    let rangeEnd = verseNumbers[0];

    for (let i = 1; i < verseNumbers.length; i++) {
        if (verseNumbers[i] === rangeEnd + 1) {
            // Continuación del rango
            rangeEnd = verseNumbers[i];
        } else {
            // Fin del rango, lo añadimos y comenzamos un nuevo rango
            if (rangeStart === rangeEnd) {
                groupedVerses.push(`${rangeStart}`);
            } else {
                groupedVerses.push(`${rangeStart}-${rangeEnd}`);
            }
            rangeStart = verseNumbers[i];
            rangeEnd = verseNumbers[i];
        }
    }

    // Agregar el último rango
    if (rangeStart === rangeEnd) {
        groupedVerses.push(`${rangeStart}`);
    } else {
        groupedVerses.push(`${rangeStart}-${rangeEnd}`);
    }

    title += groupedVerses.join(', '); // Unir los versículos con comas
    return title;
}






function sendMessagex() {
            const checkbox = document.getElementById('fondoCheckbox');
            //checkbox.checked = !checkbox.checked; // Cambia el estado del checkbox

            // Envía el estado actualizado
           // const isChecked = checkbox.checked; // Obtén el nuevo estado
            console.log('Checkbox estado antes de enviar:', isChecked); // Imprimir estado antes de enviar

            //socket.send(JSON.stringify({ type: 'control', action: 'updateStopCheckbox', checked: isChecked }));
        }
//////////////////////////////////////////////////////////////////////////////////////////////////////
document.querySelectorAll('.verse-item').forEach(item => {
    item.addEventListener('click', () => {
        // Remover la clase 'selected' de todos los elementos
        document.querySelectorAll('.verse-item').forEach(verse => {
            verse.classList.remove('selected');
        });

        // Agregar la clase 'selected' al elemento clicado
        item.classList.add('selected');

        // Opcional: si deseas mostrar el versículo en el contenido
        const verseNumber = item.textContent;
        const resultContent = document.getElementById('resultContent');
        // Aquí puedes actualizar el contenido basado en el número del versículo
        // Esto es un ejemplo básico
        resultContent.textContent = `Versículo ${verseNumber} seleccionado.`;

        console.log(`Versículo ${verseNumber} seleccionado`);
    });

    // Para permitir selección con teclado
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            item.click(); // Simula el clic si se presiona "Enter" o "Espacio"
        }
    });
});

// Función para cargar mensajes desde localStorage
function loadMessages() {
    const messagesList = document.getElementById('messages');
    const savedMessages = JSON.parse(localStorage.getItem('messages')) || [];

    // Asegurarse de que savedMessages sea un array
    if (Array.isArray(savedMessages)) {
        savedMessages.forEach(messageObj => {
            // Verificar que messageObj sea un objeto y tenga las propiedades necesarias
            if (messageObj && typeof messageObj === 'object' && 'title' in messageObj && 'message' in messageObj) {
                const { title, message } = messageObj; // Desestructurar solo si es seguro hacerlo
                addMessageToDOM(title, message);
            }
        });
    }
}

// Función para agregar un mensaje al DOM y localStorage
function addMessageToDOM(title, message) {
    const messagesList = document.getElementById('messages');

    // Crear un nuevo elemento de lista para mostrar el mensaje
    const newMessage = document.createElement('li');
    newMessage.textContent = `${title}: ${message}`; // Usar el título y el mensaje

    // Crear botón de enviar
    const sendButton = document.createElement('button');
    sendButton.textContent = 'Enviar';
    sendButton.onclick = () => {
        sendMessage(title, message);
    };

  // Crear botón de eliminar
    const deleteButton = document.createElement('button'); // Asegúrate de crear el botón
    deleteButton.textContent = 'Eliminar';
    deleteButton.onclick = () => {
        messagesList.removeChild(newMessage);
        removeMessageFromStorage(title); // Usar el título para eliminar el mensaje
    };

    // Añadir los botones al nuevo mensaje
    newMessage.appendChild(sendButton);
    newMessage.appendChild(deleteButton);
    messagesList.appendChild(newMessage);
}

// Función para guardar el mensaje en localStorage
function saveMessageToStorage(title, message) {
    const savedMessages = JSON.parse(localStorage.getItem('messages')) || [];
    savedMessages.push({ title, message });
    localStorage.setItem('messages', JSON.stringify(savedMessages));
}

function removeMessageFromStorage(title) {
    const messages = JSON.parse(localStorage.getItem('messages')) || [];
    const filteredMessages = messages.filter(message => message.title !== title);
    localStorage.setItem('messages', JSON.stringify(filteredMessages));
}

  //////////////////////////// Manejo de selección con teclado
    document.addEventListener('keydown', (event) => {
        const activeBook = document.querySelector('#bookGrid div.active');
        const activeChapter = document.querySelector('#chapterGrid div.active');

        if (document.activeElement === bookInput) {
            if (event.key === 'ArrowDown') {
                if (activeBook) {
                    const next = activeBook.nextElementSibling;
                    if (next) {
                        activeBook.classList.remove('active');
                        next.classList.add('active');
                        bookInput.value = next.textContent;
                        loadChapters(next.textContent);
                    }
                } else {
                    const firstBook = bookGrid.firstChild;
                    if (firstBook) {
                        firstBook.classList.add('active');
                        bookInput.value = firstBook.textContent;
                        loadChapters(firstBook.textContent);
                    }
                }
            } else if (event.key === 'ArrowUp') {
                if (activeBook) {
                    const prev = activeBook.previousElementSibling;
                    if (prev) {
                        activeBook.classList.remove('active');
                        prev.classList.add('active');
                        bookInput.value = prev.textContent;
                        loadChapters(prev.textContent);
                    }
                }
            } else if (event.key === 'Enter') {
                if (activeBook) {
                    selectBook(activeBook.textContent);
                    chapterInput.focus();
                    event.preventDefault();
                }
            }
        } else if (document.activeElement === chapterInput) {
            if (event.key === 'ArrowDown') {
                if (activeChapter) {
                    const next = activeChapter.nextElementSibling;
                    if (next) {
                        activeChapter.classList.remove('active');
                        next.classList.add('active');
                        chapterInput.value = next.textContent;
                    }
                } else {
                    const firstChapter = chapterGrid.firstChild;
                    if (firstChapter) {
                        firstChapter.classList.add('active');
                        chapterInput.value = firstChapter.textContent;
                    }
                }
            } else if (event.key === 'ArrowUp') {
                if (activeChapter) {
                    const prev = activeChapter.previousElementSibling;
                    if (prev) {
                        activeChapter.classList.remove('active');
                        prev.classList.add('active');
                        chapterInput.value = prev.textContent;
                    }
                }
            } else if (event.key === 'Enter') {
                if (activeChapter) {
                    selectChapter(activeChapter.textContent);
                    verseInput.focus();
                    event.preventDefault();
                }
            }
        }
    });


    themeSelector.addEventListener('change', (e) => sendTheme(e.target.value));
    positionSelector.addEventListener('change', (e) => sendPosition(e.target.value));





    // Función para guardar y enviar tema
    function sendTheme(theme) {
        // Guardar en localStorage
        localStorage.setItem('pluginTheme', theme);

        // Enviar por WebSocket
        if (ws.readyState === WebSocket.OPEN) {
            const message = `updatePlugin:theme:${theme}`;
            ws.send(message);
            console.log('Enviando tema (texto):', message);
        } else {
            console.error("WebSocket no está conectado");
        }
    }

    // Función para guardar y enviar posición
    function sendPosition(position) {
        // Guardar en localStorage
        localStorage.setItem('pluginPosition', position);

        // Enviar por WebSocket
        if (ws.readyState === WebSocket.OPEN) {
            const message = `updatePlugin:position:${position}`;
            ws.send(message);
            console.log('Enviando comando (texto):', message);
        } else {
            console.error("WebSocket no está conectado");
        }
    }

    // Event listeners (sin cambios)
    themeSelector.addEventListener('change', (e) => sendTheme(e.target.value));
    positionSelector.addEventListener('change', (e) => sendPosition(e.target.value));

    // Observar cambios en el estado de WebSocket
    let reconnectInterval;

    function initWebSocket() {
        const ws = new WebSocket(`ws://${window.location.hostname}:8081`);
        //ws = new WebSocket('ws://tu-servidor');

        ws.onopen = function() {
            console.log('WebSocket conectado');
            clearInterval(reconnectInterval);

            // Re-enviar configuraciones al reconectar
            const savedTheme = localStorage.getItem('pluginTheme') || 'default';
            const savedPosition = localStorage.getItem('pluginPosition') || 'bottom-right';

            sendTheme(savedTheme);
            sendPosition(savedPosition);
        };

        ws.onclose = function() {
            console.log('WebSocket desconectado, intentando reconectar...');
            reconnectInterval = setInterval(initWebSocket, 5000);
        };
    }

    // Inicializar WebSocket
    initWebSocket();


// ALTERNATIVA: Usar event delegation en el contenedor principal
function setupHistoryEventDelegation() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // Remover event listeners existentes
    historyList.replaceWith(historyList.cloneNode(true));
    const newHistoryList = document.getElementById('historyList');

    // Event delegation para todos los botones
    newHistoryList.addEventListener('click', function(e) {
        const button = e.target.closest('.history-btn');
        if (!button) return;

        e.preventDefault();
        e.stopPropagation();

        const id = parseInt(button.dataset.id);
        const action = button.classList[1]; // reuse-btn, copy-btn, etc.

        console.log(`🎯 Event delegation: ${action} para ID:`, id);

        switch (action) {
            case 'reuse-btn':
                reuseHistoryEntry(id);
                break;
            case 'copy-btn':
                copyHistoryEntry(id);
                break;
            case 'share-btn':
                shareHistoryEntry(id);
                break;
            case 'delete-btn':
                deleteHistoryEntry(id);
                break;
            default:
                console.warn('⚠️ Acción desconocida:', action);
        }
    });

    console.log('✅ Event delegation configurado');
}

// Función para crear una entrada individual del historial con event listeners
function createHistoryEntry(entry) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'history-entry';
    entryDiv.dataset.id = entry.id;

    entryDiv.innerHTML = `
        <div class="history-header">
            <strong>${entry.title}</strong>
            <span class="history-time">${formatTime(entry.timestamp)}</span>
        </div>
        <div class="history-content">${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}</div>
        <div class="history-actions">
            <button class="history-btn reuse-btn" data-id="${entry.id}" title="Reenviar esta cita">🔄 Reenviar</button>
            <button class="history-btn copy-btn" data-id="${entry.id}" title="Copiar al portapapeles">📋 Copiar</button>
            <button class="history-btn share-btn" data-id="${entry.id}" title="Compartir">📤 Compartir</button>
            <button class="history-btn delete-btn" data-id="${entry.id}" title="Eliminar del historial">🗑️ Eliminar</button>
        </div>
    `;

    // Asignar event listeners inmediatamente después de crear el elemento
    assignEntryEventListeners(entryDiv);

    return entryDiv;
}

// Función para asignar event listeners a una entrada específica
function assignEntryEventListeners(entryElement) {
    const id = parseInt(entryElement.dataset.id);

    // Reenviar
    const reuseBtn = entryElement.querySelector('.reuse-btn');
    if (reuseBtn) {
        reuseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Click en reenviar:', id);
            reuseHistoryEntry(id);
        });
    }

    // Copiar
    const copyBtn = entryElement.querySelector('.copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📋 Click en copiar:', id);
            copyHistoryEntry(id);
        });
    }

    // Compartir
    const shareBtn = entryElement.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📤 Click en compartir:', id);
            shareHistoryEntry(id);
        });
    }

    // Eliminar
    const deleteBtn = entryElement.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ Click en eliminar:', id);
            deleteHistoryEntry(id);
        });
    }
}

// Función para diagnosticar los botones del historial
function debugHistoryButtons() {
    console.log('=== DIAGNÓSTICO DE BOTONES DEL HISTORIAL ===');

    const historyList = document.getElementById('historyList');
    if (!historyList) {
        console.error('❌ historyList no encontrado');
        return;
    }

    const buttons = historyList.querySelectorAll('button');
    console.log(`📊 Total de botones encontrados: ${buttons.length}`);

    buttons.forEach((button, index) => {
        console.log(`Botón ${index + 1}:`, {
            texto: button.textContent,
            clases: button.className,
            dataset: button.dataset,
            tieneListeners: button._eventListeners ? 'Sí' : 'No',
            onclick: button.onclick ? 'Sí' : 'No'
        });
    });

    // Verificar event listeners del contenedor
    console.log('Event listeners del historyList:', getEventListeners ? getEventListeners(historyList) : 'N/A');
}

function assignDirectEventListeners() {
    // Reenviar
    document.querySelectorAll('.reuse-btn').forEach(btn => {
        // Remover listeners existentes para evitar duplicados
        btn.replaceWith(btn.cloneNode(true));
        const newBtn = document.querySelector(`[data-id="${btn.dataset.id}"].reuse-btn`);

        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Click directo en reenviar:', this.dataset.id);
            reuseHistoryEntry(this.dataset.id);
        });
    });

    // Copiar
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
        const newBtn = document.querySelector(`[data-id="${btn.dataset.id}"].copy-btn`);

        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('📋 Click directo en copiar:', this.dataset.id);
            copyHistoryEntry(this.dataset.id);
        });
    });

    // Eliminar
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
        const newBtn = document.querySelector(`[data-id="${btn.dataset.id}"].delete-btn`);

        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ Click directo en eliminar:', this.dataset.id);
            deleteHistoryEntry(this.dataset.id);
        });
    });
}

// Función auxiliar para procesar la entrada
function processEntryForReuse(entry) {
    console.log('✅ Entrada encontrada:', entry.title);
    console.log('📝 Contenido completo:', entry.fullContent);

    // Aplicar configuración guardada si existe
    if (entry.config) {
        console.log('🎨 Aplicando configuración guardada');
        currentConfig = { ...currentConfig, ...entry.config };
        applyConfigToForm();
        sendConfigToWS();
    }

    // Enviar el mensaje nuevamente
    if (entry.fullContent) {
        console.log('📤 Enviando mensaje por WebSocket...');
        sendMessagess(entry.fullContent);
        resultTitle.textContent = entry.title;

        // Mostrar confirmación
        showTempMessage(`✅ Cita reenviada: ${entry.title}`);
    } else {
        console.error('❌ No hay contenido para enviar en la entrada');
        // Intentar reconstruir el contenido si falta
        const reconstructedContent = `12345:biblia\n${entry.title}\n${entry.content}`;
        sendMessagess(reconstructedContent);
        resultTitle.textContent = entry.title;
        showTempMessage(`✅ Cita reenviada (reconstruida): ${entry.title}`);
    }

    // Cerrar el modal
    closeHistoryModal();

    console.log('✅ reuseHistoryEntry completado exitosamente');
}

// Función auxiliar para mostrar mensajes temporales
function showTempMessage(message) {
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;
    tempMsg.textContent = message;
    document.body.appendChild(tempMsg);

    setTimeout(() => {
        document.body.removeChild(tempMsg);
    }, 3000);
}

async function shareHistoryEntry(id) {
    const entry = historyManager.getById(id);
    if (entry && navigator.share) {
        try {
            await navigator.share({
                title: entry.title,
                text: entry.content,
                url: window.location.href
            });
        } catch (error) {
            console.log('Error al compartir:', error);
        }
    } else {
        // Fallback: copiar al portapapeles
        copyHistoryEntry(id);
    }
}

function deleteHistoryEntry(id) {
    if (confirm('¿Eliminar esta cita del historial?')) {
        let history = historyManager.load();
        history = history.filter(entry => entry.id !== id);
        localStorage.setItem('bibleHistory', JSON.stringify(history));
        refreshHistoryUI();
    }
}

// Función para reutilizar una entrada del historial
window.reuseHistoryEntry = function(id) {
    const entry = historyManager.getById(id);
    if (entry) {
        // Aplicar configuración guardada si existe
        if (entry.config) {
            currentConfig = entry.config;
            applyConfigToForm();
            sendConfigToWS();
        }

        // Enviar el mensaje nuevamente
        sendMessagess(entry.fullContent);
        resultTitle.textContent = entry.title;
        closeHistoryModal();
    }
};

// Función para copiar una entrada del historial
window.copyHistoryEntry = function(id) {
    const entry = historyManager.getById(id);
    if (entry) {
        navigator.clipboard.writeText(entry.fullContent).then(() => {
            alert('Cita copiada al portapapeles');
        }).catch(err => {
            // Fallback para navegadores que no soportan clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = entry.fullContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Cita copiada al portapapeles');
        });
    }
};

// Función para compartir una entrada del historial
window.shareHistoryEntry = async function(id) {
    const entry = historyManager.getById(id);
    if (entry) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: entry.title,
                    text: entry.content,
                    url: window.location.href
                });
            } catch (error) {
                console.log('Error al compartir:', error);
                // Fallback a copiar si falla el sharing
                copyHistoryEntry(id);
            }
        } else {
            // Fallback: copiar al portapapeles
            copyHistoryEntry(id);
        }
    }
};

// Función para eliminar una entrada del historial
window.deleteHistoryEntry = function(id) {
    if (confirm('¿Eliminar esta cita del historial?')) {
        let history = historyManager.load();
        history = history.filter(entry => entry.id !== id);
        localStorage.setItem('bibleHistory', JSON.stringify(history));
        refreshHistoryUI();
    }
};


// Asegurar que todas las funciones estén disponibles globalmente
window.reuseHistoryEntry = function(id) {
    console.log('🔄 Reutilizando entrada:', id);
    const entry = historyManager.getById(id);
    if (entry) {
        // Aplicar configuración guardada si existe
        if (entry.config) {
            currentConfig = entry.config;
            applyConfigToForm();
            sendConfigToWS();
        }

        // Enviar el mensaje nuevamente
        sendMessagess(entry.fullContent);
        resultTitle.textContent = entry.title;
        closeHistoryModal();

        console.log('✅ Entrada reenviada:', entry.title);
    } else {
        console.error('❌ No se encontró la entrada con ID:', id);
    }
};

window.copyHistoryEntry = function(id) {
    console.log('📋 Copiando entrada:', id);
    const entry = historyManager.getById(id);
    if (entry) {
        navigator.clipboard.writeText(entry.fullContent).then(() => {
            alert('✅ Cita copiada al portapapeles');
            console.log('✅ Texto copiado:', entry.title);
        }).catch(err => {
            // Fallback para navegadores que no soportan clipboard API
            console.log('⚠️ Usando fallback para copiar');
            const textArea = document.createElement('textarea');
            textArea.value = entry.fullContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('✅ Cita copiada al portapapeles (fallback)');
        });
    } else {
        console.error('❌ No se encontró la entrada con ID:', id);
    }
};

window.shareHistoryEntry = async function(id) {
    console.log('📤 Compartiendo entrada:', id);
    const entry = historyManager.getById(id);
    if (entry) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: entry.title,
                    text: entry.content,
                    url: window.location.href
                });
                console.log('✅ Entrada compartida:', entry.title);
            } catch (error) {
                console.log('❌ Error al compartir:', error);
                // Fallback a copiar si falla el sharing
                copyHistoryEntry(id);
            }
        } else {
            console.log('⚠️ Web Share API no disponible, usando copia');
            // Fallback: copiar al portapapeles
            copyHistoryEntry(id);
        }
    } else {
        console.error('❌ No se encontró la entrada con ID:', id);
    }
};

window.deleteHistoryEntry = function(id) {
    console.log('🗑️ Eliminando entrada:', id);
    if (confirm('¿Estás seguro de que quieres eliminar esta cita del historial?')) {
        let history = historyManager.load();
        const initialLength = history.length;
        history = history.filter(entry => entry.id !== id);

        if (history.length < initialLength) {
            localStorage.setItem('bibleHistory', JSON.stringify(history));
            refreshHistoryUI();
            console.log('✅ Entrada eliminada');
        } else {
            console.error('❌ No se encontró la entrada para eliminar');
        }
    }
};

// Función para cerrar el modal de historial
window.closeHistoryModal = function() {
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.style.display = 'none';
    }
};

// También asegúrate de que estas funciones estén disponibles globalmente
window.filterHistory = function(searchTerm) {
    const history = historyManager.load();
    const filteredHistory = searchTerm ?
        history.filter(entry =>
            entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.book.toLowerCase().includes(searchTerm.toLowerCase())
        ) : history;

    const historyList = document.getElementById('historyList');
    if (historyList) {
        historyList.innerHTML = filteredHistory.map(entry => `
            <div class="history-entry" data-id="${entry.id}">
                <div class="history-header">
                    <strong>${entry.title}</strong>
                    <span class="history-time">${formatTime(entry.timestamp)}</span>
                </div>
                <div class="history-content">${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}</div>
                <div class="history-actions">
                    <button onclick="reuseHistoryEntry(${entry.id})">🔄 Reenviar</button>
                    <button onclick="copyHistoryEntry(${entry.id})">📋 Copiar</button>
                    <button onclick="shareHistoryEntry(${entry.id})">📤 Compartir</button>
                    <button onclick="deleteHistoryEntry(${entry.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }
};

// Asegurar que formatTime esté disponible globalmente
window.formatTime = function(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString('es-ES') + ' ' + date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formateando tiempo:', error);
        return timestamp;
    }
};

// Asegurar que historyManager también esté disponible globalmente si es necesario
window.historyManager = historyManager;


///////////////////77  fin historial   ///////////////////////////
// Función para verificar la conectividad de eventos
function checkEventListeners() {
    console.log('=== VERIFICACIÓN DE EVENT LISTENERS ===');

    // Verificar verseInput
    const verseInput = document.getElementById('verseInput');
    if (verseInput) {
        console.log('✅ verseInput encontrado');

        // Verificar event listeners
        const events = getEventListeners(verseInput);
        console.log('Event listeners en verseInput:', events);
    } else {
        console.error('❌ verseInput no encontrado');
    }

    // Verificar verseGrid
    const verseGrid = document.getElementById('verseGrid');
    if (verseGrid) {
        console.log('✅ verseGrid encontrado');
        console.log('Hijos del verseGrid:', verseGrid.children.length);
    } else {
        console.error('❌ verseGrid no encontrado');
    }

    // Verificar si los elementos de versículo tienen onclick
    if (verseGrid) {
        const verseItems = verseGrid.querySelectorAll('.verse-items');
        console.log(`📊 ${verseItems.length} elementos de versículo encontrados`);

        verseItems.forEach((item, index) => {
            console.log(`Versículo ${index}:`, {
                texto: item.textContent,
                tieneOnclick: !!item.onclick,
                tieneEventListeners: getEventListeners ? getEventListeners(item) : 'N/A'
            });
        });
    }
}

// Añadir estas funciones que se llaman pero no están definidas:



function debugHistory() {
    console.log('=== DEBUG DEL HISTORIAL ===');
    const history = historyManager.load();
    console.log('Entradas en historial:', history.length);
    console.log('En cola:', historyQueue.queue.length);
    console.log('Procesando:', historyQueue.isProcessing);

    history.forEach((entry, index) => {
        console.log(`Entrada ${index + 1}:`, {
            id: entry.id,
            title: entry.title,
            book: entry.book,
            chapter: entry.chapter,
            timestamp: entry.timestamp
        });
    });
}

// Función para probar el sistema completo del historial
function testHistorySystem() {
    console.log('=== PRUEBA DEL SISTEMA DE HISTORIAL ===');

    // Verificar funciones globales
    console.log('Funciones globales:');
    console.log('- reuseHistoryEntry:', typeof reuseHistoryEntry);
    console.log('- copyHistoryEntry:', typeof copyHistoryEntry);
    console.log('- shareHistoryEntry:', typeof shareHistoryEntry);
    console.log('- deleteHistoryEntry:', typeof deleteHistoryEntry);
    console.log('- formatTime:', typeof formatTime);

    // Verificar historyManager
    console.log('HistoryManager:');
    console.log('- save:', typeof historyManager.save);
    console.log('- load:', typeof historyManager.load);
    console.log('- import:', typeof historyManager.import);

    // Verificar UI
    console.log('Elementos UI:');
    console.log('- historyModal:', !!document.getElementById('historyModal'));
    console.log('- historyList:', !!document.getElementById('historyList'));

    // Probar con una entrada de prueba
    const testEntry = {
        id: Date.now(),
        type: 'test',
        version: 'TEST',
        book: 'GÉNESIS',
        chapter: '1',
        verse: 1,
        title: 'TEST - GÉNESIS 1:1',
        content: '1: En el principio creó Dios los cielos y la tierra.',
        fullContent: '12345:biblia\nTEST - GÉNESIS 1:1\n1: En el principio creó Dios los cielos y la tierra.',
        timestamp: new Date().toISOString(),
        source: 'test'
    };

    console.log('Añadiendo entrada de prueba...');
    historyManager.save(testEntry);
    refreshHistoryUI();

    console.log('=== PRUEBA COMPLETADA ===');
}

 window.onload = async () => {
    try {
        loadVersions();
        bookInput.focus();
        bookInput.value = '';
        chapterInput.value = '';
        verseInput.value = '';
        chapterGrid.innerHTML = '';
        adjustHeaderHeight();
        loadSavedSettings();

        // Inicializar configuración
        initConfig();

        // Inicializar historial - esperar a que se cree
        await createHistoryUI();
        console.log('✅ Historial inicializado correctamente');

        // Cargar historial existente
        refreshHistoryUI();

    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
    }
};

function initializeMissingElements() {
    // Inicializar elementos que podrían faltar
    if (!window.hideVideoButton) {
        window.hideVideoButton = document.getElementById('hideVideoButton');
    }
    if (!window.themeSelector) {
        window.themeSelector = document.getElementById('themeSelector');
    }
    if (!window.positionSelector) {
        window.positionSelector = document.getElementById('positionSelector');
    }
}

});
