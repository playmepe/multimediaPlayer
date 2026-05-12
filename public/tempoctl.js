
        // 🔥 CAMBIO: WebSocket nativo en lugar de Socket.IO
        let ws = null;
        let timerInterval = null;
        let blinkInterval = null;
        let remainingTime = 0;
        let endTime = 0;
        let isPaused = true;
        let hideHours = false;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;
        const WS_PORT = 8085; // 🔥 Puerto del WebSocket

        function updateConnectionStatus(status, message = '') {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message || status;
            statusEl.className = status.toLowerCase();
        }

        function connectWebSocket() {
            console.log('🔌 Conectando WebSocket...');
            updateConnectionStatus('connecting', 'Conectando...');

            try {
                //const wsUrl = `ws://localhost:${WS_PORT}`;
                const wsUrl = `ws://${window.location.hostname}:${WS_PORT}`;
                console.log(`🔗 Conectando a: ${wsUrl}`);

                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log('✅ WebSocket conectado');
                    reconnectAttempts = 0;
                    updateConnectionStatus('connected', 'Conectado');
                };

                ws.onclose = (event) => {
                    console.log('❌ WebSocket cerrado:', event.code, event.reason);
                    updateConnectionStatus('disconnected', `Desconectado: ${event.code}`);

                    // Intentar reconectar
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        setTimeout(connectWebSocket, 2000);
                    } else {
                        updateConnectionStatus('disconnected', 'Conexión fallida');
                    }
                };

                ws.onerror = (error) => {
                    console.error('❌ Error WebSocket:', error);
                    updateConnectionStatus('disconnected', 'Error de conexión');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📨 Mensaje recibido:', data);

                        if (data.type === 'timerState') {
                            handleTimerState(data.data);
                        }
                    } catch (error) {
                        console.error('❌ Error procesando mensaje:', error);
                    }
                };

            } catch (error) {
                console.error('💥 Error creando WebSocket:', error);
                updateConnectionStatus('disconnected', 'Error de inicialización');
            }
        }

        function handleTimerState(state) {
            console.log('⏰ Estado recibido:', state);
            remainingTime = state.remainingTime;
            endTime = state.endTime;
            isPaused = state.isPaused;
            hideHours = state.hideHours;
            updateTimerDisplay();

            if (!isPaused && remainingTime > 0) {
                startLocalTimer();
            } else {
                stopLocalTimer();
            }
        }

        function sendWebSocketMessage(message) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            } else {
                console.error('❌ WebSocket no conectado');
            }
        }

        // 🔥 CAMBIO: Funciones de control con WebSocket
        function controlTimer(action) {
            console.log('⏰ Enviando control:', action);
            sendWebSocketMessage({
                type: 'controlTimer',
                data: { action }
            });
        }

        function setInitialTime() {
            const hours = parseInt(document.getElementById('hoursInput').value, 10) || 0;
            const minutes = parseInt(document.getElementById('minutesInput').value, 10) || 0;
            const seconds = parseInt(document.getElementById('secondsInput').value, 10) || 0;
            const totalMilliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;

            console.log('⏰ Estableciendo tiempo inicial:', totalMilliseconds);
            sendWebSocketMessage({
                type: 'setInitialTime',
                data: totalMilliseconds
            });
        }

        function toggleHideHours() {
            hideHours = document.getElementById('hideHoursCheckbox').checked;
            console.log('⏰ Ocultar horas:', hideHours);
            sendWebSocketMessage({
                type: 'toggleHideHours',
                data: hideHours
            });
            updateTimerDisplay();
        }

        function setPresetTime(seconds) {
            const totalMilliseconds = seconds * 1000;
            console.log('⏰ Tiempo preestablecido (seg):', seconds);
            sendWebSocketMessage({
                type: 'setInitialTime',
                data: totalMilliseconds
            });
        }

        function setPresetTimeM(minutes) {
            const totalMilliseconds = minutes * 60 * 1000;
            console.log('⏰ Tiempo preestablecido (min):', minutes);
            sendWebSocketMessage({
                type: 'setInitialTime',
                data: totalMilliseconds
            });
        }

        // Funciones del temporizador (se mantienen igual)
        function startLocalTimer() {
            stopLocalTimer();
            timerInterval = setInterval(updateTimerDisplay, 500);
            console.log('⏰ Timer local iniciado');
        }

        function stopLocalTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                console.log('⏰ Timer local detenido');
            }
        }

        function updateTimerDisplay() {
            const countdownElement = document.getElementById('countdown');

            if (isPaused) {
                let formattedTime = formatTime(remainingTime);
                countdownElement.innerHTML = `<h1>${hideHours ? formattedTime.substr(3) : formattedTime}</h1>`;
            } else {
                const now = Date.now();
                remainingTime = Math.max(0, endTime - now);

                let formattedTime = formatTime(remainingTime);
                countdownElement.innerHTML = `<h1>${hideHours ? formattedTime.substr(3) : formattedTime}</h1>`;

                if (remainingTime <= 0) {
                    stopLocalTimer();
                    console.log('⏰ Tiempo agotado');
                }
            }

            adjustFontSize();
            handleBlinking();
        }

        function formatTime(ms) {
            if (isNaN(ms) || ms < 0) return '00:00:00';
            let hours = Math.floor(ms / 3600000);
            let minutes = Math.floor((ms % 3600000) / 60000);
            let seconds = Math.floor((ms % 60000) / 1000);
            return `${padTime(hours)}:${padTime(minutes)}:${padTime(seconds)}`;
        }

        function padTime(time) {
            return (time < 10 ? '0' : '') + time;
        }

        function adjustFontSize() {
            const timerDisplay = document.getElementById('timerDisplay');
            timerDisplay.style.fontSize = hideHours ? '20px' : '5px';
        }

        function handleBlinking() {
            if (remainingTime <= 10000 && remainingTime > 0 && !isPaused) {
                if (!blinkInterval) startBlinking();
            } else {
                if (blinkInterval) stopBlinking();
            }
        }

        function startBlinking() {
            blinkInterval = setInterval(() => {
                document.body.style.backgroundColor =
                    document.body.style.backgroundColor === 'red' ? '#000000' : 'red';
            }, 500);
        }

        function stopBlinking() {
            if (blinkInterval) {
                clearInterval(blinkInterval);
                blinkInterval = null;
            }
        }

        // Inicializar al cargar la página
        window.addEventListener('load', function() {
            console.log('🚀 Iniciando control de temporizador con WebSocket...');
            connectWebSocket();
            updateTimerDisplay();
        });

        // Limpiar al cerrar
        window.addEventListener('beforeunload', function() {
            stopLocalTimer();
            stopBlinking();
            if (ws) ws.close();
        });
