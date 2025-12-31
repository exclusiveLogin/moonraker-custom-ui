/**
 * Web Component для отображения статуса принтера
 */
import store from '../services/store.js';

class StatusWidget extends HTMLElement {
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
                    <span class="widget-title">📊 Статус</span>
                </div>
                <div class="widget-content">
                    <div class="status-item">
                        <span class="status-label">Состояние:</span>
                        <span class="status-value" id="printerState">Неизвестно</span>
                    </div>
                    <div class="status-item" id="filenameItem" style="display: none;">
                        <span class="status-label">Файл:</span>
                        <span class="status-value" id="filename">-</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Время печати:</span>
                        <span class="status-value" id="printDuration">00:00:00</span>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    update(state) {
        const { printStats } = state.printer;
        const stateEl = this.querySelector('#printerState');
        const filenameEl = this.querySelector('#filename');
        const filenameItemEl = this.querySelector('#filenameItem');
        const durationEl = this.querySelector('#printDuration');

        // Обновляем состояние
        if (stateEl) {
            const stateText = this.getStateText(printStats.state);
            stateEl.textContent = stateText;
            stateEl.className = `status-value status-${printStats.state}`;
        }

        // Обновляем имя файла
        if (printStats.filename) {
            if (filenameEl) {
                const shortName = printStats.filename.split('/').pop();
                filenameEl.textContent = shortName;
            }
            if (filenameItemEl) {
                filenameItemEl.style.display = 'flex';
            }
        } else {
            if (filenameItemEl) {
                filenameItemEl.style.display = 'none';
            }
        }

        // Обновляем время печати
        if (durationEl) {
            durationEl.textContent = this.formatDuration(printStats.printDuration);
        }
    }

    getStateText(state) {
        const states = {
            'printing': '🟢 Печать',
            'paused': '⏸️ Пауза',
            'complete': '✅ Завершено',
            'cancelled': '❌ Отменено',
            'error': '🔴 Ошибка',
            'idle': '⚪ Ожидание',
            'standby': '⏳ Ожидание'
        };
        return states[state] || state;
    }

    formatDuration(seconds) {
        if (!seconds) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    addStyles() {
        if (document.getElementById('status-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'status-widget-styles';
        style.textContent = `
            .status-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-sm) 0;
                border-bottom: 1px solid var(--border-color);
            }
            .status-item:last-child {
                border-bottom: none;
            }
            .status-label {
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            .status-value {
                font-weight: 600;
                color: var(--text-primary);
            }
            .status-value.status-printing {
                color: var(--status-printing);
            }
            .status-value.status-paused {
                color: var(--accent-warning);
            }
            .status-value.status-complete {
                color: var(--accent-success);
            }
            .status-value.status-error {
                color: var(--accent-error);
            }
            .status-value.status-idle {
                color: var(--status-idle);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('status-widget', StatusWidget);


