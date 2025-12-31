/**
 * Web Component для отображения прогресса печати
 */
import store from '../services/store.js';

class ProgressWidget extends HTMLElement {
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
                    <span class="widget-title">📈 Прогресс</span>
                </div>
                <div class="widget-content">
                    <div class="progress-circle-container">
                        <svg class="progress-circle" viewBox="0 0 120 120">
                            <circle class="progress-circle-bg" cx="60" cy="60" r="54"></circle>
                            <circle class="progress-circle-fill" id="progressCircle" cx="60" cy="60" r="54"></circle>
                        </svg>
                        <div class="progress-percent" id="progressPercent">0%</div>
                    </div>
                    <div class="progress-info">
                        <div class="progress-time">
                            <span class="progress-time-label">Осталось:</span>
                            <span class="progress-time-value" id="timeRemaining">--:--:--</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    update(state) {
        const { printStats } = state.printer;
        const progress = printStats.progress || 0;
        const percentEl = this.querySelector('#progressPercent');
        const circleEl = this.querySelector('#progressCircle');
        const timeRemainingEl = this.querySelector('#timeRemaining');

        // Обновляем процент
        if (percentEl) {
            percentEl.textContent = `${Math.round(progress * 100)}%`;
        }

        // Обновляем круг прогресса
        if (circleEl) {
            const circumference = 2 * Math.PI * 54;
            const offset = circumference - (progress * circumference);
            circleEl.style.strokeDashoffset = offset;
        }

        // Обновляем оставшееся время
        if (timeRemainingEl && printStats.printDuration > 0 && progress > 0) {
            const elapsed = printStats.printDuration;
            const total = elapsed / progress;
            const remaining = total - elapsed;
            timeRemainingEl.textContent = this.formatDuration(remaining);
        } else {
            if (timeRemainingEl) {
                timeRemainingEl.textContent = '--:--:--';
            }
        }
    }

    formatDuration(seconds) {
        if (!seconds || seconds < 0) return '--:--:--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    addStyles() {
        if (document.getElementById('progress-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'progress-widget-styles';
        style.textContent = `
            .progress-circle-container {
                position: relative;
                width: 150px;
                height: 150px;
                margin: 0 auto var(--spacing-md);
            }
            .progress-circle {
                width: 100%;
                height: 100%;
                transform: rotate(-90deg);
            }
            .progress-circle-bg {
                fill: none;
                stroke: var(--bg-tertiary);
                stroke-width: 8;
            }
            .progress-circle-fill {
                fill: none;
                stroke: var(--accent-primary);
                stroke-width: 8;
                stroke-linecap: round;
                stroke-dasharray: 339.292;
                stroke-dashoffset: 339.292;
                transition: stroke-dashoffset 0.3s ease;
            }
            .progress-percent {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 2rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            .progress-info {
                text-align: center;
            }
            .progress-time {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
            }
            .progress-time-label {
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
            .progress-time-value {
                font-size: 1.3rem;
                font-weight: 600;
                color: var(--text-primary);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('progress-widget', ProgressWidget);


