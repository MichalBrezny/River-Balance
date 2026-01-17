/**
 * Lane's Balance Calculations
 *
 * Lane's Balance: Qs * D50 ∝ Qw * S
 *
 * Where:
 *   Qs  = Sediment discharge
 *   D50 = Median sediment size
 *   Qw  = Water discharge
 *   S   = Channel slope
 *
 * Balance Ratio = (Qs * D50) / (Qw * S)
 *   > 1 : Aggradation (sediment supply exceeds transport capacity)
 *   < 1 : Degradation (transport capacity exceeds sediment supply)
 *   = 1 : Equilibrium (balance between supply and capacity)
 */

const Balance = {
    /**
     * Calculate the balance ratio from parameters
     * @param {number} Qs - Sediment discharge (1-100)
     * @param {number} D50 - Sediment size (1-100)
     * @param {number} Qw - Water discharge (1-100)
     * @param {number} S - Channel slope (1-100)
     * @returns {number} Balance ratio
     */
    calculateRatio(Qs, D50, Qw, S) {
        const sedimentTerm = Qs * this.mapD50(D50);
        const waterTerm = Qw * this.mapSlope(S);

        // Prevent division by zero
        if (waterTerm === 0) return Infinity;

        return sedimentTerm / waterTerm;
    },

    /**
     * Map D50 slider (1-100) to log-scaled value for calculation
     * @param {number} value - D50 slider value
     * @returns {number}
     */
    mapD50(value) {
        const ratio = (value - 1) / 99;
        const logValue = -1 + 3 * ratio; // From 10^-1 to 10^2
        return Math.pow(10, logValue);
    },

    /**
     * Map slope slider (1-100) to a scaled value for calculation
     * @param {number} value - Slope slider value
     * @returns {number}
     */
    mapSlope(value) {
        // Map 1-100 to a more reasonable range, e.g., 0.1 to 10
        return 0.1 + (value / 100) * 5.906;
    },

    /**
     * Get the balance state based on ratio
     * @param {number} ratio - Balance ratio
     * @returns {string} 'degradation' | 'equilibrium' | 'aggradation'
     */
    getState(ratio) {
        // Use an imbalance threshold (log10 ratio)
        const imbalance = this.getImbalanceIndex(ratio);
        if (imbalance < -0.05) return 'degradation';
        if (imbalance > 0.05) return 'aggradation';
        return 'equilibrium';
    },

    /**
     * Calculate log10 imbalance index
     * @param {number} ratio - Balance ratio
     * @returns {number} Imbalance index
     */
    getImbalanceIndex(ratio) {
        const clampedRatio = Math.max(0.01, Math.min(100, ratio));
        return Math.log10(clampedRatio);
    },

    /**
     * Calculate tilt angle for the balance scale
     * Uses logarithmic scale for visual representation
     * @param {number} ratio - Balance ratio
     * @returns {number} Angle in degrees (-30 to +30)
     */
    calculateTiltAngle(ratio) {
        // Clamp ratio to reasonable range
        const clampedRatio = Math.max(0.1, Math.min(10, ratio));

        // Use log scale for more intuitive visual response
        // log(1) = 0, log(0.1) ≈ -2.3, log(10) ≈ 2.3
        const logRatio = Math.log(clampedRatio);

        // Scale to max ±30 degrees
        const maxAngle = 30;
        const scaleFactor = maxAngle / Math.log(10);

        // Negate: when ratio > 1 (more sediment), left side should go DOWN (negative angle)
        return -logRatio * scaleFactor;
    },

    /**
     * Calculate stream power (simplified)
     * Higher stream power = more erosive potential
     * @param {number} Qw - Water discharge
     * @param {number} S - Slope
     * @returns {number} Relative stream power (0-1)
     */
    calculateStreamPower(Qw, S) {
        // Normalize to 0-1 range
        return (Qw * S) / (100 * 100);
    },

    /**
     * Determine channel pattern based on parameters
     * Geomorphologically correct relationships:
     * - Braided: high sediment load, coarse sediment (high D50), steep slopes
     * - Meandering: moderate conditions, finer sediment, adequate discharge
     * - Straight: very low discharge only (rare in nature)
     *
     * @param {number} Qs - Sediment discharge
     * @param {number} D50 - Sediment size (1-100)
     * @param {number} Qw - Water discharge
     * @param {number} S - Slope
     * @param {number} ratio - Balance ratio
     * @returns {string} 'straight' | 'meandering' | 'braided'
     */
    getChannelPattern(Qs, D50, Qw, S, ratio) {
        const sedimentLoad = Qs / 100;
        const grainSize = D50 / 100;  // 0-1, higher = coarser
        const slope = S / 100;
        const discharge = Qw / 100;
        const streamPower = discharge * slope;

        // Braiding index: combines factors that promote braiding
        // - High sediment load (bedload-dominated) - primary factor
        // - Coarse sediment (non-cohesive, forms bars easily)
        // - Aggradation (excess sediment relative to transport capacity) - critical factor
        // Note: High stream power (Qw*S) does NOT promote braiding directly
        // It increases transport capacity, so you need MORE sediment to braid
        const aggradationFactor = ratio > 1 ? Math.min((ratio - 1) * 0.3, 0.3) : 0;
        const braidingIndex = (sedimentLoad * 0.35) + (grainSize * 0.25) + aggradationFactor;

        // Braided rivers: high braiding index
        // Threshold set so default values (50/50/50/50) show meandering
        if (braidingIndex > 0.5) {
            return 'braided';
        }

        // Straight channels: only when discharge is very low (not enough energy to meander)
        // This is rare - most rivers with any flow will meander
        if (discharge < 0.15) {
            return 'straight';
        }

        // Meandering is the default pattern for most rivers
        // Rivers meander when they have enough discharge to erode banks
        // but not enough sediment/slope/coarseness to braid
        return 'meandering';
    },

    /**
     * Get active geomorphic processes based on balance state
     * @param {number} ratio - Balance ratio
     * @param {number} Qw - Water discharge
     * @param {number} S - Slope
     * @returns {Array<{name: string, type: string}>} Active processes
     */
    getActiveProcesses(ratio, Qw, S) {
        const state = this.getState(ratio);
        const streamPower = this.calculateStreamPower(Qw, S);
        const processes = [];

        if (state === 'degradation') {
            processes.push({ name: 'Bed incision', type: 'degradation' });
            if (streamPower > 0.3) {
                processes.push({ name: 'Bank erosion', type: 'degradation' });
            }
            if (streamPower > 0.5) {
                processes.push({ name: 'Knickpoint migration', type: 'degradation' });
            }
            if (ratio < 0.5) {
                processes.push({ name: 'Bed armoring', type: 'degradation' });
            }
        } else if (state === 'aggradation') {
            processes.push({ name: 'Bar formation', type: 'aggradation' });
            if (ratio > 1.5) {
                processes.push({ name: 'Channel widening', type: 'aggradation' });
            }
            if (ratio > 2) {
                processes.push({ name: 'Avulsion risk', type: 'aggradation' });
            }
            processes.push({ name: 'Overbank deposition', type: 'aggradation' });
        } else {
            processes.push({ name: 'Sediment transport balance', type: 'equilibrium' });
            processes.push({ name: 'Dynamic equilibrium', type: 'equilibrium' });
        }

        return processes;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Balance;
}


