/**
 * Web Component для отображения системной информации
 */
import store from '../services/store.js';

class SystemWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
    }

    connectedCallback() {
        this.render();
        this.unsubscribe = store.subscribe((state) => {
            this.update(state);
        });
    }

    disconnectedCallback() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    render() {
        this.innerHTML = `
            <div class="widget">
                <div class="widget-header">
                    <span class="widget-title">💻 Система</span>
                </div>
                <div class="widget-content">
                    <div class="system-item">
                        <span class="system-label">CPU:</span>
                        <div class="system-bar-container">
                            <div class="system-bar cpu" id="cpuBar" style="width: 0%"></div>
                        </div>
                        <span class="system-value" id="cpuValue">0%</span>
                    </div>
                    <div class="system-item">
                        <span class="system-label">RAM:</span>
                        <div class="system-bar-container">
                            <div class="system-bar ram" id="ramBar" style="width: 0%"></div>
                        </div>
                        <span class="system-value" id="ramValue">0%</span>
                    </div>
                    <div class="system-item">
                        <span class="system-label">MCU:</span>
                        <span class="system-value mcu" id="mcuTemp">--°C</span>
                    </div>
                    <div class="system-item">
                        <span class="system-label">Uptime:</span>
                        <span class="system-value uptime" id="uptimeValue">--:--:--</span>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    update(state) {
        const { system } = state;
        
        // CPU
        const cpuValue = this.querySelector('#cpuValue');
        const cpuBar = this.querySelector('#cpuBar');
        const cpuPercent = Math.round(system?.cpuUsage ?? 0);
        if (cpuValue) cpuValue.textContent = `${cpuPercent}%`;
        if (cpuBar) {
            cpuBar.style.width = `${cpuPercent}%`;
            cpuBar.classList.toggle('high', cpuPercent > 80);
        }

        // RAM
        const ramValue = this.querySelector('#ramValue');
        const ramBar = this.querySelector('#ramBar');
        const ramPercent = Math.round(system?.memoryUsage ?? 0);
        if (ramValue) ramValue.textContent = `${ramPercent}%`;
        if (ramBar) {
            ramBar.style.width = `${ramPercent}%`;
            ramBar.classList.toggle('high', ramPercent > 80);
        }

        // MCU Temperature
        const mcuTemp = this.querySelector('#mcuTemp');
        if (mcuTemp) {
            const temp = system?.mcuTemp ?? null;
            mcuTemp.textContent = temp !== null ? `${temp.toFixed(1)}°C` : '--°C';
        }

        // Uptime
        const uptimeValue = this.querySelector('#uptimeValue');
        if (uptimeValue) {
            uptimeValue.textContent = this.formatUptime(system?.uptime ?? 0);
        }
    }

    formatUptime(seconds) {
        if (!seconds) return '--:--:--';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    }

    addStyles() {
        if (document.getElementById('system-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'system-widget-styles';
        style.textContent = `
            .system-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-xs) 0;
            }
            .system-label {
                min-width: 55px;
                font-size: 0.85rem;
                color: var(--text-secondary);
            }
            .system-bar-container {
                flex: 1;
                height: 8px;
                background: var(--bg-tertiary);
                border-radius: 4px;
                overflow: hidden;
            }
            .system-bar {
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease, background 0.3s ease;
            }
            .system-bar.cpu {
                background: linear-gradient(90deg, var(--accent-success), var(--accent-info));
            }
            .system-bar.ram {
                background: linear-gradient(90deg, var(--accent-info), var(--accent-primary));
            }
            .system-bar.high {
                background: linear-gradient(90deg, var(--accent-warning), var(--accent-error)) !important;
            }
            .system-value {
                min-width: 50px;
                text-align: right;
                font-weight: 600;
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.9rem;
                color: var(--text-primary);
            }
            .system-value.mcu,
            .system-value.uptime {
                flex: 1;
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('system-widget', SystemWidget);
