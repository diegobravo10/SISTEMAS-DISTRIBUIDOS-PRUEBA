let ws = null;
let alerts = [];
let currentFilter = 'all';
const MAX_ALERTS = 100;

// DOM elements
const connectionStatus = document.getElementById('connectionStatus');
const alertsList = document.getElementById('alertsList');
const criticalCount = document.getElementById('criticalCount');
const warningCount = document.getElementById('warningCount');
const normalCount = document.getElementById('normalCount');
const sensorsCount = document.getElementById('sensorsCount');

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:9000`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        connectionStatus.className = 'status-badge';
        connectionStatus.innerHTML = '<span class="status-dot"></span><span>Conectado</span>';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.tipo !== 'sistema') addAlert(data);
    };

    ws.onclose = () => {
        connectionStatus.className = 'status-badge disconnected';
        connectionStatus.innerHTML = '<span class="status-dot"></span><span>Desconectado</span>';
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => console.error('Error WebSocket:', error);
}

function addAlert(alert) {
    alerts.unshift(alert);
    if (alerts.length > MAX_ALERTS) alerts.pop();
    renderAlerts();
    updateStats();
}

function renderAlerts() {
    const filtered = currentFilter === 'all'
        ? alerts
        : alerts.filter(a => a.nivel === currentFilter);

    if (filtered.length === 0) {
        alertsList.innerHTML = `
            <div class="empty-state">
                <div class="icon">📡</div>
                <p>No hay alertas para mostrar</p>
            </div>`;
        return;
    }

    alertsList.innerHTML = filtered.map(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString('es-EC');
        const icon = getAlertIcon(alert.tipo);

        return `
            <div class="alert-item ${alert.nivel}">
                <div class="alert-icon">${icon}</div>
                <div class="alert-content">
                    <div class="sensor">${alert.sensor_id}</div>
                    <div class="message">${alert.mensaje}</div>
                    <div class="location">📍 ${alert.ubicacion || 'Sin ubicación'}</div>
                </div>
                <div class="alert-time">${time}</div>
            </div>`;
    }).join('');
}

function getAlertIcon(tipo) {
    const icons = {
        'temperatura': '🌡️',
        'puerta': '🚪',
        'movimiento': '👤',
        'humo': '💨',
        'vibración': '⚡',
        'alarma_manual': '🚨'
    };
    return icons[tipo] || '📡';
}

function updateStats() {
    criticalCount.textContent = alerts.filter(a => a.nivel === 'critico').length;
    warningCount.textContent = alerts.filter(a => a.nivel === 'advertencia').length;
    normalCount.textContent = alerts.filter(a => a.nivel === 'normal').length;
}

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        criticalCount.textContent = data.criticas || 0;
        warningCount.textContent = data.advertencias || 0;
        normalCount.textContent = data.normales || 0;
        sensorsCount.textContent = data.sensores_activos || 0;
    } catch (err) {
        console.error('Error cargando dashboard:', err);
    }
}

async function loadHistoricalAlerts() {
    try {
        const res = await fetch('/api/alertas?limit=50');
        alerts = await res.json();
        renderAlerts();
    } catch (err) {
        console.error('Error cargando alertas:', err);
    }
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderAlerts();
    });
});

connectWebSocket();
loadDashboardStats();
loadHistoricalAlerts();
setInterval(loadDashboardStats, 60000);
