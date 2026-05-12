
        document.addEventListener('DOMContentLoaded', function() {
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            const fullscreenToggle = document.getElementById('fullscreen-toggle');

            // Mapa de URLs para cada pestaña
            const tabUrls = {
                'biblia': '../indexBiblia_OBS.html',
                'media': '../indexMedia.html',
                'yt': '../yt/index.html',
                'media1': '../indexMediaBiblia.html',
                'control': '../listaOBS_Control.html',
                'lista': '../control_lista.html',
                'bibliam': '../visorlistaimgen.html',
                'lyrics': '../indexLyrics_OBS.html',
                 'lyrics2': '../indexLyrics5.html',
                'tempop': '../busqueda.html',
                'tempo': '../obs/#ws://localhost:4455#m9otOAqpcRufSxyr',
                'mix': 'mix.html',
                'config': '../proyeccion_pantallas.html',
                'web': '../indexBibliaM.html',
                 'menu': '../menu.html'
            };

            // Cargar contenido de la pestaña activa inicial
            const initialTab = document.querySelector('.tab.active');
            if (initialTab) {

                const tabId = initialTab.getAttribute('data-tab');
                loadTabContent(tabId);
            }

            // Cambiar pestañas
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');

                    // Desactivar todas las pestañas
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));

                    // Activar la pestaña clickeada
                    tab.classList.add('active');
                    document.getElementById(`${tabId}-content`).classList.add('active');

                    // Cargar contenido si no está ya cargado
                    loadTabContent(tabId);

                    // Guardar en localStorage
                    localStorage.setItem('selectedTab', tabId);
                });
            });

            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            // Control del header en móviles
            const header = document.getElementById('header');
            const mobileToggle = document.getElementById('mobile-toggle');
            let headerVisible = false;

           // Función para mostrar/ocultar el header
            function toggleHeader() {
                headerVisible = !headerVisible;
                if (headerVisible) {
                    header.classList.remove('hidden');
                    // Agregar evento cuando el header está visible
                    window.addEventListener('blur', handleWindowBlur);
                } else {
                    header.classList.add('hidden');
                    // Remover evento cuando el header está oculto
                    window.removeEventListener('blur', handleWindowBlur);
                }
            }

            const secondaryControls =  document.querySelector('.tab.active');
            // Cerrar menú al hacer clic fuera de él
            document.addEventListener('click', function(event) {
                if (!event.target.closest('.header-controls') && secondaryControls.classList.contains('active')) {
                   //  if (!event.target.closest('.header-controls')) {
                     header.classList.remove('hidden');
                }
            });

            // Cerrar menú al hacer clic fuera de él
            document.addEventListener('click', function(event) {
                // Verificar si el clic fue fuera del header y del botón toggle
                if (headerVisible &&
                    !header.contains(event.target) &&
                    !mobileToggle.contains(event.target)) {
                    toggleHeader();
                    }
            });

            function handleWindowBlur() {
                // Cuando el iframe recibe foco, cerrar el menú
                toggleHeader();
            }


            // Evento para el botón móvil
            mobileToggle.addEventListener('click', toggleHeader);

            // Detectar cambios de tamaño de pantalla
            function handleResize() {
                const isMobile = window.innerWidth <= 768;

                if (!isMobile) {
                    // En pantallas grandes, asegurarse de que el header esté visible
                    header.classList.remove('hidden');
                    headerVisible = true;
                }
            }

            // Inicializar y escuchar cambios de tamaño
            window.addEventListener('resize', handleResize);
            handleResize(); // Ejecutar al cargar la página

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            // Función para cargar contenido de pestaña
/*            function loadTabContent(tabId) {
                const tabContent = document.getElementById(`${tabId}-content`);
                const placeholder = tabContent.querySelector('.iframe-placeholder');

                // Si ya hay un iframe, no hacer nada
                if (tabContent.querySelector('iframe')) {
                    return;
                }

                // Crear iframe
                const iframe = document.createElement('iframe');
                iframe.title = tabId.charAt(0).toUpperCase() + tabId.slice(1);

                // Configurar atributos específicos para YouTube
                if (tabId === 'yt' || tabId === 'web') {
                    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                    iframe.allowFullscreen = true;
                }

                // Agregar indicador de carga
                placeholder.classList.add('loading');

                // Cargar el contenido
                iframe.onload = function() {
                    placeholder.classList.remove('loading');
                    placeholder.style.display = 'none';
                };

                iframe.onerror = function() {
                    placeholder.classList.remove('loading');
                    placeholder.textContent = 'Error al cargar el contenido';
                };

                iframe.src = tabUrls[tabId];
                tabContent.appendChild(iframe);
            }
*/
            function loadTabContent(tabId) {
                const tabContent = document.getElementById(`${tabId}-content`);
                const placeholder = tabContent.querySelector('.iframe-placeholder');

                // Si ya hay un iframe, no hacer nada
                if (tabContent.querySelector('iframe')) {
                    return;
                }

                // Crear iframe
                const iframe = document.createElement('iframe');
                iframe.title = tabId.charAt(0).toUpperCase() + tabId.slice(1);

                // Configurar atributos específicos
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
                iframe.allowFullscreen = true;
                iframe.sandbox = "allow-same-origin allow-scripts allow-popups allow-forms allow-modals"; // Importante para WS

                // Configurar loading
                placeholder.classList.add('loading');

                iframe.onload = function() {
                    placeholder.classList.remove('loading');
                    placeholder.style.display = 'none';
                    console.log(`✅ Contenido cargado: ${tabId}`);
                };

                iframe.onerror = function() {
                    placeholder.classList.remove('loading');
                    placeholder.textContent = '❌ Error al cargar el contenido';
                    console.error(`❌ Error cargando: ${tabId}`);
                };

                iframe.src = tabUrls[tabId];
                tabContent.appendChild(iframe);
            }

            // Función para descargar contenido de pestaña
            function unloadTabContent(tabId) {
                const tabContent = document.getElementById(`${tabId}-content`);
                const iframe = tabContent.querySelector('iframe');

                if (iframe) {
                    // Limpiar el iframe para liberar recursos
                    iframe.src = 'about:blank';
                    iframe.remove();

                    // Restaurar placeholder
                    const placeholder = tabContent.querySelector('.iframe-placeholder');
                    placeholder.style.display = 'flex';
                    placeholder.classList.remove('loading');

                    // Restaurar texto original del placeholder
                    const tabName = document.querySelector(`[data-tab="${tabId}"]`).textContent;
                    placeholder.textContent = `Cargando ${tabName}...`;
                }
            }

            // Descargar pestañas inactivas después de un tiempo
            let unloadTimer;
            function scheduleUnloadInactiveTabs() {
                clearTimeout(unloadTimer);
                unloadTimer = setTimeout(() => {
                    const activeTab = document.querySelector('.tab.active');
                    const activeTabId = activeTab ? activeTab.getAttribute('data-tab') : null;

                    tabs.forEach(tab => {
                        const tabId = tab.getAttribute('data-tab');
                        if (tabId !== activeTabId) {
                            unloadTabContent(tabId);
                        }
                    });
                }, 30000); // Descargar después de 30 segundos de inactividad
            }

            // Reiniciar temporizador en interacción del usuario
            document.addEventListener('click', scheduleUnloadInactiveTabs);
            document.addEventListener('keydown', scheduleUnloadInactiveTabs);

            // Iniciar temporizador
            scheduleUnloadInactiveTabs();

            // Recargar página al hacer doble clic en el header
            document.getElementById('header').addEventListener('dblclick', function() {
                location.reload();
            });

            // Cargar pestaña guardada
            const savedTab = localStorage.getItem('selectedTab');
            if (savedTab && savedTab !== document.querySelector('.tab.active').getAttribute('data-tab')) {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                const savedTabElement = document.querySelector(`[data-tab="${savedTab}"]`);
                if (savedTabElement) {
                    savedTabElement.classList.add('active');
                    document.getElementById(`${savedTab}-content`).classList.add('active');
                    loadTabContent(savedTab);
                }
            }

            // Alternar pantalla completa
            fullscreenToggle.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.error(`Error al intentar modo pantalla completa: ${err.message}`);
                    });
                    document.body.classList.add('fullscreen');
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                    document.body.classList.remove('fullscreen');
                }
            });

            // Detectar cambios en el modo pantalla completa
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    document.body.classList.remove('fullscreen');
                }
            });
        });
