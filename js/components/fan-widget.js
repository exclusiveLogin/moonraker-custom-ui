/**
 * Web Component для отображения скорости вентиляторов
 * Адаптировано под конфиг QIDI с fan_generic
 */
import store from '../services/store.js';

class FanWidget extends HTMLElement {
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
                    <span class="widget-title">🌀 Вентиляторы</span>
                </div>
                <div class="widget-content">
                    <div class="fan-item">
                        <div class="fan-info">
                            <span class="fan-icon" id="partFanIcon">🌬️</span>
                            <span class="fan-name">Cooling</span>
                        </div>
                        <div class="fan-bar-container">
                            <div class="fan-bar part" id="partFanBar" style="width: 0%"></div>
                        </div>
                        <span class="fan-value" id="partFanValue">0%</span>
                    </div>
                    <div class="fan-item">
                        <div class="fan-info">
                            <span class="fan-icon" id="heaterFanIcon">💨</span>
                            <span class="fan-name">Hotend</span>
                        </div>
                        <div class="fan-bar-container">
                            <div class="fan-bar heater" id="heaterFanBar" style="width: 0%"></div>
                        </div>
                        <span class="fan-value" id="heaterFanValue">0%</span>
                    </div>
                    <div class="fan-item">
                        <div class="fan-info">
                            <span class="fan-icon" id="chamberFanIcon">🔄</span>
                            <span class="fan-name">Chamber</span>
                        </div>
                        <div class="fan-bar-container">
                            <div class="fan-bar chamber" id="chamberFanBar" style="width: 0%"></div>
                        </div>
                        <span class="fan-value" id="chamberFanValue">0%</span>
                    </div>
                    <div class="fan-item">
                        <div class="fan-info">
                            <span class="fan-icon" id="auxFanIcon">🌪️</span>
                            <span class="fan-name">Auxiliary</span>
                        </div>
                        <div class="fan-bar-container">
                            <div class="fan-bar aux" id="auxFanBar" style="width: 0%"></div>
                        </div>
                        <span class="fan-value" id="auxFanValue">0%</span>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    update(state) {
        const { fans } = state.printer;
        
        // Part cooling fan
        this.updateFan('partFan', fans?.partFan ?? 0);
        
        // Heater fan
        this.updateFan('heaterFan', fans?.heaterFan ?? 0);
        
        // Chamber circulation fan
        this.updateFan('chamberFan', fans?.chamberFan ?? 0);
        
        // Auxiliary cooling fan
        this.updateFan('auxFan', fans?.auxFan ?? 0);
    }

    updateFan(id, speed) {
        const value = this.querySelector(`#${id}Value`);
        const bar = this.querySelector(`#${id}Bar`);
        const icon = this.querySelector(`#${id}Icon`);
        const percent = Math.round(speed * 100);
        
        if (value) value.textContent = `${percent}%`;
        if (bar) bar.style.width = `${percent}%`;
        if (icon) icon.classList.toggle('spinning', percent > 0);
    }

    addStyles() {
        if (document.getElementById('fan-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'fan-widget-styles';
        style.textContent = `
            .fan-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-xs) 0;
                border-bottom: 1px solid var(--border-color);
            }
            .fan-item:last-child {
                border-bottom: none;
            }
            .fan-info {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                min-width: 90px;
            }
            .fan-icon {
                font-size: 1rem;
                transition: transform 0.3s ease;
            }
            .fan-icon.spinning {
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .fan-name {
                font-size: 0.8rem;
                color: var(--text-secondary);
            }
            .fan-bar-container {
                flex: 1;
                height: 6px;
                background: var(--bg-tertiary);
                border-radius: 3px;
                overflow: hidden;
            }
            .fan-bar {
                height: 100%;
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            .fan-bar.part {
                background: linear-gradient(90deg, var(--accent-info), var(--accent-primary));
            }
            .fan-bar.heater {
                background: linear-gradient(90deg, var(--accent-warning), var(--accent-error));
            }
            .fan-bar.chamber {
                background: linear-gradient(90deg, var(--accent-success), var(--accent-info));
            }
            .fan-bar.aux {
                background: linear-gradient(90deg, var(--accent-primary), #a855f7);
            }
            .fan-value {
                min-width: 40px;
                text-align: right;
                font-weight: 600;
                font-size: 0.85rem;
                font-family: 'JetBrains Mono', monospace;
                color: var(--text-primary);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('fan-widget', FanWidget);
