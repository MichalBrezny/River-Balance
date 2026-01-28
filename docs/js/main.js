/**
 * Main Application - Lane's Balance Interactive Visualization
 *
 * Manages application state, event bindings, and coordinates
 * updates across all visualization modules.
 */

// Application state
const state = {
    // Parameters (1-100 scale for sliders)
    Qs: 50,    // Sediment discharge
    D50: 50,   // Sediment size (fine->coarse)
    Qw: 50,    // Water discharge
    S: 50,     // Slope (flat->steep)

    // Derived values
    balanceRatio: 1.0,  // (Qs*D50)/(Qw*S), 1.0 = equilibrium

    // Animation timing
    animationDuration: 400,

    // To track changes
    previousState: {},
    lastChanged: null,
};

// Store references for cleanup
let resizeHandler = null;

/**
 * Initialize the application
 */
function init() {
    // Initialize all visualizations
    ScaleView.init('scale-viz');
    PlanView.init('plan-viz');
    ProcessView.init('process-list');

    // Bind slider events
    bindSliders();

    // Bind reset button
    bindResetButton();

    // Bind display toggles
    bindToggles();

    // Set initial previous state
    state.previousState = { ...state };

    // Bind screenshot button
    bindScreenshotButton();

    // Initial update
    updateAll();

    // Handle window resize (store reference for cleanup)
    resizeHandler = debounce(handleResize, 250);
    window.addEventListener('resize', resizeHandler);

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Cleanup resources before page unload
 */
function cleanup() {
    // Remove resize listener
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
    }
    // Stop flow animation
    if (typeof PlanView !== 'undefined' && PlanView.stopFlowAnimation) {
        PlanView.stopFlowAnimation();
    }
}

/**
 * Bind screenshot button event
 */
function bindScreenshotButton() {
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            const target = document.querySelector('main');
            if (!target) {
                console.error('Screenshot target not found');
                return;
            }

            // Check if html2canvas is loaded
            if (typeof html2canvas === 'undefined') {
                console.error('html2canvas library not loaded');
                alert('Screenshot feature unavailable - library failed to load');
                return;
            }

            html2canvas(target, {
                scale: 2,
                useCORS: true
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'lane-balance-screenshot.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(error => {
                console.error('Screenshot failed:', error);
                alert('Failed to capture screenshot');
            });
        });
    }
}

/**
 * Bind slider input events
 */
function bindSliders() {
    const sliders = {
        'qs-slider': 'Qs',
        'd50-slider': 'D50',
        'qw-slider': 'Qw',
        's-slider': 'S'
    };

    const sliderValues = {
        'qs-slider': 'qs-value',
        'd50-slider': 'd50-value',
        'qw-slider': 'qw-value',
        's-slider': 's-value'
    };

    Object.entries(sliders).forEach(([sliderId, stateKey]) => {
        const slider = document.getElementById(sliderId);
        const valueId = sliderValues[sliderId];
        const valueEl = document.getElementById(valueId);
        if (slider) {
            // Set initial value
            slider.value = state[stateKey];
            updateSliderValue(valueEl, state[stateKey], sliderId);

            // Bind input event (fires during drag)
            slider.addEventListener('input', (e) => {
                state.lastChanged = stateKey;
                state[stateKey] = parseInt(e.target.value, 10);
                updateSliderValue(valueEl, state[stateKey], sliderId);
                updateAll();
            });
        }
    });
}

/**
 * Bind reset button click event
 */
function bindResetButton() {
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetToEquilibrium);
    }
}

/**
 * Bind display toggles
 */
function bindToggles() {
    const tooltipToggle = document.getElementById('toggle-tooltips');
    const numericToggle = document.getElementById('toggle-numeric');

    const updateToggleState = () => {
        document.body.classList.toggle('show-tooltips', !!tooltipToggle?.checked);
        document.body.classList.toggle('numeric-off', !numericToggle?.checked);
    };

    if (tooltipToggle) {
        tooltipToggle.addEventListener('change', updateToggleState);
    }
    if (numericToggle) {
        numericToggle.addEventListener('change', updateToggleState);
    }

    updateToggleState();
}

/**
 * Reset all parameters to equilibrium (50)
 */
function resetToEquilibrium() {
    state.Qs = 50;
    state.D50 = 50;
    state.Qw = 50;
    state.S = 50;
    state.lastChanged = null;

    // Update slider positions
    document.getElementById('qs-slider').value = 50;
    document.getElementById('d50-slider').value = 50;
    document.getElementById('qw-slider').value = 50;
    document.getElementById('s-slider').value = 50;
    updateSliderValue(document.getElementById('qs-value'), 50, 'qs-slider');
    updateSliderValue(document.getElementById('d50-value'), 50, 'd50-slider');
    updateSliderValue(document.getElementById('qw-value'), 50, 'qw-slider');
    updateSliderValue(document.getElementById('s-value'), 50, 's-slider');

    // Update visualizations
    updateAll();
}

/**
 * Update all visualizations based on current state
 */
function updateAll() {
    // Calculate balance ratio
    state.balanceRatio = Balance.calculateRatio(
        state.Qs,
        state.D50,
        state.Qw,
        state.S
    );

    // Prepare parameters object for views
    const params = {
        Qs: state.Qs,
        D50: state.D50,
        Qw: state.Qw,
        S: state.S
    };

    // Update each visualization
    ScaleView.update(state.balanceRatio, params, state.animationDuration);
    PlanView.update(state.Qs, state.D50, state.Qw, state.S, state.balanceRatio, state.animationDuration);
    ProcessView.update(state.balanceRatio, state.Qw, state.S);
    updateTendencyUI(state.balanceRatio);

    // Update previous state for next change
    state.previousState = { ...state };
}

/**
 * Handle window resize - reinitialize visualizations
 */
function handleResize() {
    // Stop animation and cancel in-flight transitions before reinitializing
    PlanView.stopFlowAnimation();
    if (ScaleView.beamGroup) ScaleView.beamGroup.interrupt();

    ScaleView.init('scale-viz');
    PlanView.init('plan-viz');

    const params = {
        Qs: state.Qs,
        D50: state.D50,
        Qw: state.Qw,
        S: state.S
    };

    // Update with current state (no animation)
    ScaleView.update(state.balanceRatio, params, 0);
    PlanView.update(state.Qs, state.D50, state.Qw, state.S, state.balanceRatio, 0);
    updateTendencyUI(state.balanceRatio);
}

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Update slider output display
 * @param {HTMLElement} valueEl - Output element
 * @param {number} value - Slider value
 * @param {string} sliderId - ID of the slider
 */
function updateSliderValue(valueEl, value, sliderId) {
    if (!valueEl) return;
    if ('value' in valueEl) {
        valueEl.value = value;
    }

    let displayedValue = '';
    if (sliderId === 'd50-slider') {
        displayedValue = `${value} / ${formatD50(value)}`;
    } else if (sliderId === 's-slider') {
        displayedValue = `${value} / ${formatSlope(value)}`;
    } else {
        displayedValue = `${value}`;
    }
    valueEl.textContent = displayedValue;
}

/**
 * Map D50 slider (1-100) to log-scaled mm (0.1-100)
 * @param {number} value
 * @returns {string}
 */
function formatD50(value) {
    const ratio = (value - 1) / 99;
    const logValue = -1 + 3 * ratio;
    const mm = Math.pow(10, logValue);
    if (mm < 1) return mm.toFixed(2);
    if (mm < 10) return mm.toFixed(1);
    return Math.round(mm).toString();
}

/**
 * Map slope slider (1-100) to log-scaled display value (0.1-100)
 * Matches Balance.mapSlope() mapping.
 * @param {number} value
 * @returns {string}
 */
function formatSlope(value) {
    const ratio = (value - 1) / 99;
    const logValue = -1 + 3 * ratio;
    const s = Math.pow(10, logValue);
    if (s < 1) return s.toFixed(2);
    if (s < 10) return s.toFixed(1);
    return Math.round(s).toString();
}

/**
 * Generate a dynamic "why" sentence based on what changed and the actual state
 * @param {string} stateName - Current balance state
 * @returns {string}
 */
function getWhySentence(stateName) {
    if (stateName === 'equilibrium') {
        return 'Sediment supply and transport capacity are balanced.';
    }

    const { lastChanged, previousState } = state;
    const stateDescription = stateName === 'aggradation'
        ? 'Sediment supply exceeds transport capacity.'
        : 'Transport capacity exceeds sediment supply.';

    if (!lastChanged) {
        return stateDescription;
    }

    const currentValue = state[lastChanged];
    const previousValue = previousState[lastChanged];
    if (currentValue === previousValue) {
        return stateDescription;
    }
    const direction = currentValue > previousValue ? 'increased' : 'decreased';

    const paramNames = {
        Qs: 'sediment supply (Qs)',
        D50: 'sediment size (D50)',
        Qw: 'water discharge (Qw)',
        S: 'channel slope (S)'
    };

    return `${stateDescription} The ${direction} ${paramNames[lastChanged]} contributed to this.`;
}


/**
 * Update tendency label and imbalance text
 * @param {number} ratio
 */
function updateTendencyUI(ratio) {
    const labelEl = document.getElementById('tendency-label');
    const whyEl = document.getElementById('tendency-why');
    const imbalanceEl = document.getElementById('imbalance-value');

    if (!labelEl || !whyEl || !imbalanceEl) return;

    const clampedRatio = Math.max(0.01, Math.min(100, ratio));
    const imbalance = Math.log10(clampedRatio);
    const stateName = Balance.getState(ratio);

    if (stateName === 'aggradation') {
        labelEl.textContent = 'Tendency: Aggradation';
    } else if (stateName === 'degradation') {
        labelEl.textContent = 'Tendency: Degradation';
    } else {
        labelEl.textContent = 'Tendency: Near equilibrium';
    }

    whyEl.textContent = getWhySentence(stateName);
    imbalanceEl.textContent = `Imbalance index I = ${imbalance.toFixed(2)}`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);