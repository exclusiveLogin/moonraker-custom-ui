/**
 * Web Component для отображения температуры
 */
import store from '../services/store.js';

class TemperatureWidget extends HTMLElement {
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
                    <span class="widget-title">🌡️ Температура</span>
                </div>
                <div class="widget-content">
                    <div class="temp-item">
                        <div class="temp-label">
                            <span class="temp-icon">🔥</span>
                            <span>Экструдер</span>
                        </div>
                        <div class="temp-values">
                            <span class="temp-current" id="hotendCurrent">0°C</span>
                            <span class="temp-target" id="hotendTarget">/ 0°C</span>
                        </div>
                        <div class="temp-bar">
                            <div class="temp-bar-fill" id="hotendBar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="temp-item">
                        <div class="temp-label">
                            <span class="temp-icon">🛏️</span>
                            <span>Стол</span>
                        </div>
                        <div class="temp-values">
                            <span class="temp-current" id="bedCurrent">0°C</span>
                            <span class="temp-target" id="bedTarget">/ 0°C</span>
                        </div>
                        <div class="temp-bar">
                            <div class="temp-bar-fill" id="bedBar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем стили для виджета
        this.addStyles();
    }

    update(state) {
        const { bed, hotend } = state.printer.temperature;

        // Обновляем экструдер
        const hotendCurrentEl = this.querySelector('#hotendCurrent');
        const hotendTargetEl = this.querySelector('#hotendTarget');
        const hotendBarEl = this.querySelector('#hotendBar');
        const tolerance = 0.5; // чтобы не мигать при почти равных значениях
        
        const hotendTargetText = hotend.target > 0 ? `${Math.round(hotend.target)}°C` : '—';
        if (hotendCurrentEl) hotendCurrentEl.textContent = `${Math.round(hotend.current)}°C`;
        if (hotendTargetEl) hotendTargetEl.textContent = `/ ${hotendTargetText}`;
        
        if (hotendBarEl && hotend.target > 0) {
            const progress = Math.min((hotend.current / hotend.target) * 100, 100);
            hotendBarEl.style.width = `${progress}%`;
            const reached = hotend.current >= (hotend.target - tolerance);
            hotendBarEl.style.backgroundColor = reached ? 'var(--accent-success)' : 'var(--temp-hotend)';
        }

        // Обновляем стол
        const bedCurrentEl = this.querySelector('#bedCurrent');
        const bedTargetEl = this.querySelector('#bedTarget');
        const bedBarEl = this.querySelector('#bedBar');
        
        const bedTargetText = bed.target > 0 ? `${Math.round(bed.target)}°C` : '—';
        if (bedCurrentEl) bedCurrentEl.textContent = `${Math.round(bed.current)}°C`;
        if (bedTargetEl) bedTargetEl.textContent = `/ ${bedTargetText}`;
        
        if (bedBarEl && bed.target > 0) {
            const progress = Math.min((bed.current / bed.target) * 100, 100);
            bedBarEl.style.width = `${progress}%`;
            const reached = bed.current >= (bed.target - tolerance);
            bedBarEl.style.backgroundColor = reached ? 'var(--accent-success)' : 'var(--temp-bed)';
        }
    }

    addStyles() {
        if (document.getElementById('temperature-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'temperature-widget-styles';
        style.textContent = `
            .temp-item {
                margin-bottom: var(--spacing-md);
            }
            .temp-item:last-child {
                margin-bottom: 0;
            }
            .temp-label {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-xs);
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
            .temp-icon {
                font-size: 1.2rem;
            }
            .temp-values {
                display: flex;
                align-items: baseline;
                gap: var(--spacing-xs);
                margin-bottom: var(--spacing-xs);
            }
            .temp-current {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            .temp-target {
                font-size: 1rem;
                color: var(--text-muted);
            }
            .temp-bar {
                height: 6px;
                background-color: var(--bg-tertiary);
                border-radius: 3px;
                overflow: hidden;
            }
            .temp-bar-fill {
                height: 100%;
                background-color: var(--temp-hotend);
                transition: width 0.3s ease, background-color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('temperature-widget', TemperatureWidget);


