/**
 * Process View - Active Geomorphic Processes Display
 *
 * Shows a list of currently active geomorphic processes
 * based on the balance state and parameters.
 */

const ProcessView = {
    container: null,

    /**
     * Initialize the process view
     * @param {string} containerId - DOM element ID for the process list
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Clear and add initial state
        this.container.innerHTML = '';
        this.update(1, 50, 50); // Start at equilibrium
    },

    /**
     * Update the process list based on current state
     * @param {number} ratio - Balance ratio
     * @param {number} Qw - Water discharge
     * @param {number} S - Slope
     */
    update(ratio, Qw, S) {
        if (!this.container) return;

        // Get active processes from Balance module
        const processes = Balance.getActiveProcesses(ratio, Qw, S);

        // Clear existing list
        this.container.innerHTML = '';

        // Add each process as a list item
        processes.forEach((process, index) => {
            const li = document.createElement('li');
            li.className = process.type;
            li.textContent = process.name;

            // Stagger animation
            li.style.opacity = '0';
            li.style.transform = 'translateX(-10px)';

            this.container.appendChild(li);

            // Animate in
            setTimeout(() => {
                li.style.transition = 'opacity 0.3s, transform 0.3s';
                li.style.opacity = '1';
                li.style.transform = 'translateX(0)';
            }, index * 50);
        });

        // Update section header color based on state
        this.updateHeaderColor(Balance.getState(ratio));
    },

    /**
     * Update the section header color to match state
     * @param {string} state - Current balance state
     */
    updateHeaderColor(state) {
        const header = this.container?.parentElement?.querySelector('h3');
        if (!header) return;

        const colors = {
            degradation: '#e74c3c',
            equilibrium: '#27ae60',
            aggradation: '#f39c12'
        };

        header.style.borderBottomColor = colors[state];
    }
};
