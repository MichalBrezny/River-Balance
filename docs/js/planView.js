/**
 * Plan View - Channel Pattern D3 Visualization
 *
 * Displays a bird's eye view of the river channel,
 * showing different patterns (straight, meandering, braided)
 * based on sediment supply and stream power.
 */

const PlanView = {
    svg: null,
    width: 0,
    height: 0,
    margin: { top: 10, right: 20, bottom: 10, left: 20 },
    channelGroup: null,
    mainPathNode: null,
    currentPattern: 'meandering',
    lastQs: 50,
    lastQw: 50,
    lastD50: 50,
    lastS: 50,
    currentSeed: 0,
    flowAnimationId: null,
    flowAnimationRunning: false,
    flowLastTimestamp: 0,
    flowElements: [],

    /**
     * Initialize the plan view visualization
     * @param {string} containerId - DOM element ID for the container
     */
    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Get container dimensions
        const rect = container.getBoundingClientRect();
        this.width = (rect.width || 600) - this.margin.left - this.margin.right;
        this.height = (rect.height || 160) - this.margin.top - this.margin.bottom;

        // Create SVG
        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

        // Add background (floodplain)
        this.svg.append('rect')
            .attr('class', 'floodplain')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#e8e4d9')
            .attr('rx', 4);

        // Create channel group
        this.channelGroup = this.svg.append('g').attr('class', 'channel-group');

        // Flow ->
        this.addFlowIndicator();

        // Draw initial meandering pattern (sinuosity matches update() calculation at defaults)
        const initialSinuosity = 1.1 + (50 / 100) * 0.5 - (50 / 100) * 0.2;
        this.drawMeandering(50, initialSinuosity, 50, 50);
        this.startFlowAnimation();
    },

    /**
     * Add Flow ->
     */
    addFlowIndicator() {
        const arrowY = this.height - 15;

        this.svg.append('text')
            .attr('x', 10)
            .attr('y', arrowY)
            .attr('fill', '#7f8c8d')
            .attr('font-size', '11px')
            .text('Flow ->');
    },

    /**
     * Generate meandering channel path
     * @param {number} Qw - Water discharge for width
     * @param {number} sinuosity - How curvy (1-2)
     * @returns {string} SVG path string
     */
    generateMeanderingPath(Qw, sinuosity = 1.3) {
        const baseWidth = 15 + (Qw / 100) * 25;
        const amplitude = 25 * sinuosity;
        const wavelength = this.width / 3;

        const points = [];
        const steps = 100;

        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * this.width;
            const y = this.height / 2 + Math.sin((x / wavelength) * Math.PI * 2) * amplitude;
            points.push({ x, y });
        }

        return { points, width: baseWidth };
    },

    /**
     * Draw meandering channel pattern
     * @param {number} Qw - Water discharge
     * @param {number} sinuosity - Sinuosity factor
     * @param {number} Qs - Sediment discharge (for mid-channel bars)
     * @param {number} D50 - Sediment size (for bar characteristics)
     */
    drawMeandering(Qw, sinuosity = 1.3, Qs = 50, D50 = 50) {
        this.channelGroup.selectAll('*').remove();

        const { points, width } = this.generateMeanderingPath(Qw, sinuosity);

        // Create channel path with width
        const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom.alpha(0.5));

        // Draw banks first (behind channel)
        this.channelGroup.append('path')
            .attr('class', 'channel-bank')
            .attr('d', lineGenerator(points))
            .attr('fill', 'none')
            .attr('stroke', '#8b4513')
            .attr('stroke-width', width + 4)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 0.3);

        // Draw channel
        this.mainPathNode = this.channelGroup.append('path')
            .attr('class', 'channel-main')
            .attr('d', lineGenerator(points))
            .attr('fill', 'none')
            .attr('stroke', '#5dade2')
            .attr('stroke-width', width)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 0.8)
            .node();

        // Add point bars on inside of meanders
        this.addPointBars(points, width, sinuosity);

        // Add mid-channel bars based on Qs and D50 (transition toward braided)
        this.addMidChannelBars(points, width, Qs, D50);

        this.drawFlowElements(this.mainPathNode, width, Qw);
    },

    /**
     * Add point bars on meander bends
     */
    addPointBars(points, channelWidth, sinuosity) {
        if (sinuosity < 1.2) return;

        // Find meander peaks (local maxima/minima)
        const barPositions = [];
        for (let i = 10; i < points.length - 10; i += 25) {
            const prev = points[i - 5].y;
            const curr = points[i].y;
            const next = points[i + 5].y;

            // Local extremum
            if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
                barPositions.push({
                    x: points[i].x,
                    y: points[i].y,
                    side: curr > this.height / 2 ? -1 : 1
                });
            }
        }

        barPositions.forEach((bar, index) => {
            const barSeed = this.currentSeed + 3000 + index * 23;
            const offset = channelWidth * (0.25 + this.pseudoRandom(barSeed) * 0.15);
            this.channelGroup.append('ellipse')
                .attr('class', 'channel-bar point-bar')
                .attr('cx', bar.x)
                .attr('cy', bar.y + bar.side * offset)
                .attr('rx', channelWidth * 0.55)
                .attr('ry', channelWidth * 0.28)
                .attr('fill', '#cd853f')
                .attr('opacity', 0.7);
        });
    },

    /**
     * Add mid-channel bars that increase as conditions approach braided
     * @param {Array} points - Channel centerline points
     * @param {number} channelWidth - Width of channel
     * @param {number} Qs - Sediment discharge
     * @param {number} D50 - Sediment size
     */
    addMidChannelBars(points, channelWidth, Qs, D50) {
        // Calculate bar intensity based on Qs and D50
        // More bars appear as we approach braided conditions
        const sedimentFactor = (Qs / 100 + D50 / 100) / 2;

        // No mid-channel bars if sediment is low
        if (sedimentFactor < 0.35) return;

        // Number of bars increases with sediment (0 to ~8)
        const numBars = Math.floor((sedimentFactor - 0.35) * 12);
        if (numBars <= 0) return;

        const seedBase = this.currentSeed + 4000;

        for (let i = 0; i < numBars; i++) {
            const barSeed = seedBase + i * 37;

            // Position along the channel (avoid edges)
            const t = 0.15 + this.pseudoRandom(barSeed) * 0.7;
            const pointIndex = Math.floor(t * (points.length - 1));
            const point = points[pointIndex];

            // Offset from centerline (within channel)
            const offsetMagnitude = channelWidth * 0.2 * this.pseudoRandom(barSeed + 1);
            const offsetDir = this.pseudoRandom(barSeed + 2) > 0.5 ? 1 : -1;

            // Bar size increases with D50 (coarser = larger bars)
            const sizeMultiplier = 0.5 + (D50 / 100) * 0.8;
            const barWidth = channelWidth * (0.2 + this.pseudoRandom(barSeed + 3) * 0.25) * sizeMultiplier;
            const barHeight = barWidth * (0.4 + this.pseudoRandom(barSeed + 4) * 0.3);

            // Rotation aligned somewhat with flow
            const rotation = (this.pseudoRandom(barSeed + 5) - 0.5) * 40;

            // Bar color - coarser sediment is darker
            const colorValue = 180 - (D50 / 100) * 40;
            const barColor = `rgb(${colorValue + 25}, ${colorValue - 10}, ${colorValue - 50})`;

            this.channelGroup.append('ellipse')
                .attr('class', 'channel-bar mid-channel-bar')
                .attr('cx', point.x)
                .attr('cy', point.y + offsetDir * offsetMagnitude)
                .attr('rx', barWidth)
                .attr('ry', barHeight)
                .attr('fill', barColor)
                .attr('opacity', 0.6 + this.pseudoRandom(barSeed + 6) * 0.25)
                .attr('transform', `rotate(${rotation}, ${point.x}, ${point.y + offsetDir * offsetMagnitude})`);

            // Add gravel texture on larger bars
            if (barWidth > channelWidth * 0.25) {
                const gravelCount = 2 + Math.floor(this.pseudoRandom(barSeed + 7) * 4);
                for (let g = 0; g < gravelCount; g++) {
                    const gSeed = barSeed + 100 + g * 11;
                    const gx = point.x + (this.pseudoRandom(gSeed) - 0.5) * barWidth * 0.8;
                    const gy = point.y + offsetDir * offsetMagnitude + (this.pseudoRandom(gSeed + 1) - 0.5) * barHeight * 0.8;
                    const gr = 0.8 + this.pseudoRandom(gSeed + 2) * 1.2;
                    this.channelGroup.append('circle')
                        .attr('cx', gx)
                        .attr('cy', gy)
                        .attr('r', gr)
                        .attr('fill', '#6b6b6b')
                        .attr('opacity', 0.5);
                }
            }
        }
    },

    /**
     * Draw straight channel pattern
     * @param {number} Qw - Water discharge
     */
    drawStraight(Qw) {
        this.channelGroup.selectAll('*').remove();

        const baseWidth = 12 + (Qw / 100) * 20;
        const centerY = this.height / 2;
        const seedBase = this.currentSeed + 1000;

        // Slight natural variation
        const points = [];
        for (let i = 0; i <= 20; i++) {
            const x = (i / 20) * this.width;
            const rand = this.pseudoRandom(seedBase + i * 13);
            const y = centerY + (rand - 0.5) * 5;
            points.push({ x, y });
        }

        const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom.alpha(0.5));

        // Banks
        this.channelGroup.append('path')
            .attr('class', 'channel-bank')
            .attr('d', lineGenerator(points))
            .attr('fill', 'none')
            .attr('stroke', '#8b4513')
            .attr('stroke-width', baseWidth + 4)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.3);

        // Channel
        this.mainPathNode = this.channelGroup.append('path')
            .attr('class', 'channel-main')
            .attr('d', lineGenerator(points))
            .attr('fill', 'none')
            .attr('stroke', '#5dade2')
            .attr('stroke-width', baseWidth)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.8)
            .node();
        this.drawFlowElements(this.mainPathNode, baseWidth, Qw);
    },

    /**
     * Draw braided channel pattern - gravel braidplain with thin water channels
     * Based on real braided river appearance: mostly gravel with water threads
     * @param {number} Qw - Water discharge
     * @param {number} Qs - Sediment discharge (for bar density)
     * @param {number} D50 - Sediment size (for bar characteristics)
     */
    drawBraided(Qw, Qs, D50 = 50) {
        this.channelGroup.selectAll('*').remove();

        const totalWidth = 60 + (Qw / 100) * 50;
        const centerY = this.height / 2;
        const seedBase = this.currentSeed + 2000;

        // Draw outer banks (darker edges)
        this.channelGroup.append('rect')
            .attr('class', 'braidplain-bank')
            .attr('x', 0)
            .attr('y', centerY - totalWidth / 2 - 4)
            .attr('width', this.width)
            .attr('height', totalWidth + 8)
            .attr('fill', '#6b5d4d')
            .attr('rx', 3);

        // Draw gravel braidplain base (gray/brown - this is the dominant surface)
        this.channelGroup.append('rect')
            .attr('class', 'braidplain-gravel')
            .attr('x', 0)
            .attr('y', centerY - totalWidth / 2)
            .attr('width', this.width)
            .attr('height', totalWidth)
            .attr('fill', '#a89888')
            .attr('rx', 2);

        // Add gravel texture to the braidplain
        const numGravelPatches = 40 + Math.floor(Qs / 3);
        for (let i = 0; i < numGravelPatches; i++) {
            const gSeed = seedBase + 1000 + i * 17;
            const gx = this.pseudoRandom(gSeed) * this.width;
            const gy = centerY + (this.pseudoRandom(gSeed + 1) - 0.5) * (totalWidth - 8);
            const gr = 2 + this.pseudoRandom(gSeed + 2) * 6;
            const grayVal = 130 + this.pseudoRandom(gSeed + 3) * 50 - (D50 / 100) * 20;

            this.channelGroup.append('ellipse')
                .attr('cx', gx)
                .attr('cy', gy)
                .attr('rx', gr * (1 + this.pseudoRandom(gSeed + 4) * 0.5))
                .attr('ry', gr * (0.5 + this.pseudoRandom(gSeed + 5) * 0.3))
                .attr('fill', `rgb(${grayVal + 10}, ${grayVal}, ${grayVal - 15})`)
                .attr('opacity', 0.4 + this.pseudoRandom(gSeed + 6) * 0.3);
        }

        // Generate multiple thin water channels weaving through the gravel
        const numChannels = 3 + Math.floor(Qw / 25);
        const allChannelPaths = [];

        for (let c = 0; c < numChannels; c++) {
            const channelSeed = seedBase + c * 97;
            // Channel width - thin threads
            const channelWidth = 3 + (Qw / 100) * 5 + this.pseudoRandom(channelSeed) * 4;

            // Each channel has its own path through the braidplain
            const yStart = (this.pseudoRandom(channelSeed + 1) - 0.5) * (totalWidth * 0.7);
            const points = [];

            for (let i = 0; i <= 40; i++) {
                const t = i / 40;
                const x = t * this.width;

                // Channels weave and sometimes merge/split
                const waveFreq = 2 + this.pseudoRandom(channelSeed + 2) * 2;
                const waveAmp = 8 + this.pseudoRandom(channelSeed + 3) * 12;
                const drift = (this.pseudoRandom(channelSeed + 4 + i) - 0.5) * 8;

                let y = centerY + yStart +
                    Math.sin(t * Math.PI * waveFreq) * waveAmp +
                    Math.sin(t * Math.PI * waveFreq * 2.3) * (waveAmp * 0.4) +
                    drift;

                // Keep within braidplain bounds
                y = Math.max(centerY - totalWidth / 2 + channelWidth,
                    Math.min(centerY + totalWidth / 2 - channelWidth, y));

                points.push({ x, y });
            }

            const lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y)
                .curve(d3.curveCatmullRom.alpha(0.5));

            // Draw channel with light blue/white color (like glacial water)
            const pathNode = this.channelGroup.append('path')
                .attr('class', 'braided-channel')
                .attr('d', lineGenerator(points))
                .attr('fill', 'none')
                .attr('stroke', '#b8d4e8')
                .attr('stroke-width', channelWidth)
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('opacity', 0.85)
                .node();

            // Add lighter center line for depth effect
            this.channelGroup.append('path')
                .attr('class', 'braided-channel-highlight')
                .attr('d', lineGenerator(points))
                .attr('fill', 'none')
                .attr('stroke', '#d8eef8')
                .attr('stroke-width', channelWidth * 0.4)
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.6);

            allChannelPaths.push({ node: pathNode, points, width: channelWidth });
        }

        // Add some channel connections/anastomoses
        const numConnections = Math.floor(numChannels * 1.5);
        for (let i = 0; i < numConnections; i++) {
            const connSeed = seedBase + 3000 + i * 41;
            const x = 50 + this.pseudoRandom(connSeed) * (this.width - 100);
            const y1 = centerY + (this.pseudoRandom(connSeed + 1) - 0.5) * (totalWidth * 0.6);
            const y2 = y1 + (this.pseudoRandom(connSeed + 2) - 0.5) * 25;
            const connWidth = 2 + this.pseudoRandom(connSeed + 3) * 3;

            const connPoints = [
                { x: x - 15, y: y1 },
                { x: x, y: (y1 + y2) / 2 + (this.pseudoRandom(connSeed + 4) - 0.5) * 10 },
                { x: x + 15, y: y2 }
            ];

            const connLine = d3.line()
                .x(d => d.x)
                .y(d => d.y)
                .curve(d3.curveCatmullRom.alpha(0.5));

            this.channelGroup.append('path')
                .attr('d', connLine(connPoints))
                .attr('fill', 'none')
                .attr('stroke', '#b8d4e8')
                .attr('stroke-width', connWidth)
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.7);
        }

        // Draw flow elements FIRST (before raising channels for animation)
        this.drawBraidedFlowElementsNew(allChannelPaths, totalWidth, centerY, Qw);

        // Store for animation
        this.mainPathNode = null;
        this.braidedChannels = allChannelPaths;
    },

    /**
     * Draw flow elements for braided channels along the water paths
     */
    drawBraidedFlowElementsNew(channels, totalWidth, centerY, Qw) {
        this.flowElements = [];
        const flowElementRadius = 1.2 + (Qw / 100) * 1;

        // Add flow elements along each channel
        channels.forEach((channel, cIndex) => {
            const pathNode = channel.node;
            if (!pathNode) return;

            const pathLength = pathNode.getTotalLength();
            const numElements = Math.floor(pathLength / 40 + Qw / 20);

            for (let i = 0; i < numElements; i++) {
                const offset = (pathLength / numElements) * i + this.pseudoRandom(this.currentSeed + cIndex * 100 + i) * 20;

                this.flowElements.push({
                    id: `${cIndex}-${i}`,
                    offset: offset % pathLength,
                    pathLength: pathLength,
                    pathNode: pathNode,
                    r: flowElementRadius,
                    speed: 0.6 + (Qw / 100) * 0.8
                });
            }
        });

        // Get initial positions
        this.flowElements.forEach(d => {
            const p = d.pathNode.getPointAtLength(d.offset);
            d.x = p.x;
            d.y = p.y;
        });

        this.channelGroup.selectAll('.flow-element')
            .data(this.flowElements, d => d.id)
            .join('circle')
            .attr('class', 'flow-element')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => d.r)
            .attr('fill', 'white')
            .attr('opacity', 0.8);
    },

    /**
     * Draw flow elements for meandering and straight channels
     * @param {HTMLElement} pathNode - The SVG path element for the main channel
     * @param {number} channelWidth - Width of the channel
     * @param {number} Qw - Water discharge
     */
    drawFlowElements(pathNode, channelWidth, Qw) {
        this.flowElements = [];
        const numFlowElements = Math.floor(10 + Qw / 5); // More elements for higher Qw
        const flowElementRadius = 1.5 + (Qw / 100) * 1.5;
        const pathLength = pathNode.getTotalLength();

        for (let i = 0; i < numFlowElements; i++) {
            const offset = (pathLength / numFlowElements) * i;
            const p = pathNode.getPointAtLength(offset);
            
            this.flowElements.push({
                id: i,
                x: p.x,
                y: p.y,
                r: flowElementRadius,
                offset: offset,
                pathLength: pathLength,
                pathNode: pathNode,  // Store reference for animation
                speed: 0.5 + (Qw / 100) * 0.5 // Faster for higher Qw
            });
        }

        this.channelGroup.selectAll('.flow-element')
            .data(this.flowElements, d => d.id)
            .join('circle')
            .attr('class', 'flow-element')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => d.r)
            .attr('fill', 'white')
            .attr('opacity', 0.6);
    },

    /**
     * Start the water flow animation using requestAnimationFrame
     */
    startFlowAnimation() {
        this.flowAnimationRunning = true;
        this.flowLastTimestamp = 0;
        const step = (timestamp) => {
            if (!this.flowAnimationRunning) return;
            // Throttle to ~20fps (50ms intervals) to match original behavior
            if (timestamp - this.flowLastTimestamp >= 50) {
                this.flowLastTimestamp = timestamp;
                this.updateFlowAnimation();
            }
            this.flowAnimationId = requestAnimationFrame(step);
        };
        this.flowAnimationId = requestAnimationFrame(step);
    },

    /**
     * Stop the water flow animation
     */
    stopFlowAnimation() {
        this.flowAnimationRunning = false;
        if (this.flowAnimationId) {
            cancelAnimationFrame(this.flowAnimationId);
            this.flowAnimationId = null;
        }
    },

    /**
     * Update the positions of flow elements to simulate movement
     */
    updateFlowAnimation() {
        this.flowElements.forEach(d => {
            if (!d.pathNode) return;
            d.offset = (d.offset + d.speed) % d.pathLength;
            const p = d.pathNode.getPointAtLength(d.offset);
            d.x = p.x;
            d.y = p.y;
        });

        this.channelGroup.selectAll('.flow-element')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    },

    /**
     * Update the plan view with new parameters
     * @param {number} Qs - Sediment discharge
     * @param {number} D50 - Sediment size
     * @param {number} Qw - Water discharge
     * @param {number} S - Slope
     * @param {number} ratio - Balance ratio
     * @param {number} duration - Animation duration
     */
    update(Qs, D50, Qw, S, ratio, duration = 500) {
        if (!this.channelGroup) return;

        const pattern = Balance.getChannelPattern(Qs, D50, Qw, S, ratio);
        this.currentSeed = this.computeSeed(Qs, D50, Qw, S, ratio);

        // Check if any parameter changed (threshold of 1 unit)
        const paramChanged = Math.abs(Qs - this.lastQs) > 1 ||
                            Math.abs(Qw - this.lastQw) > 1 ||
                            Math.abs(D50 - (this.lastD50 || 50)) > 1 ||
                            Math.abs(S - (this.lastS || 50)) > 1;
        const patternChanged = pattern !== this.currentPattern;

        // Redraw if pattern changed OR significant parameter change
        if (patternChanged || paramChanged) {
            this.currentPattern = pattern;
            this.lastQs = Qs;
            this.lastQw = Qw;
            this.lastD50 = D50;
            this.lastS = S;

            this.stopFlowAnimation(); // Stop animation before redrawing

            // Cancel any in-progress transitions to prevent race conditions
            this.channelGroup.interrupt();

            // Immediately redraw and fade in (simpler, more robust approach)
            this.channelGroup.attr('opacity', 0);

            if (pattern === 'straight') {
                this.drawStraight(Qw);
            } else if (pattern === 'braided') {
                this.drawBraided(Qw, Qs, D50);
            } else {
                // Sinuosity driven by discharge (energy to erode banks) and
                // suppressed by high sediment load (pushes toward braiding).
                const dischargeFactor = Qw / 100;
                const sedimentSuppression = Qs / 100;
                const sinuosity = 1.1 + dischargeFactor * 0.5 - sedimentSuppression * 0.2;
                this.drawMeandering(Qw, Math.max(1.05, sinuosity), Qs, D50);
            }

            // Fade in after redraw
            this.channelGroup
                .transition()
                .duration(duration / 2)
                .attr('opacity', 1);

            this.startFlowAnimation();
        }

        // Add pattern label
        this.updatePatternLabel(pattern);
    },

    /**
     * Update pattern label display
     * @param {string} pattern - Current channel pattern
     */
    updatePatternLabel(pattern) {
        const labels = {
            straight: 'Straight Channel',
            meandering: 'Meandering Channel',
            braided: 'Braided Channel'
        };

        // Remove existing label
        this.svg.select('.pattern-label').remove();

        // Add new label
        this.svg.append('text')
            .attr('class', 'pattern-label')
            .attr('x', this.width - 10)
            .attr('y', 20)
            .attr('text-anchor', 'end')
            .attr('fill', '#7f8c8d')
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .text(labels[pattern]);
    },

    /**
     * Deterministic pseudo-random function (0-1) based on a seed
     * @param {number} seed
     * @returns {number}
     */
    pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },

    /**
     * Compute a stable seed from parameters
     * @param {number} Qs
     * @param {number} D50
     * @param {number} Qw
     * @param {number} S
     * @param {number} ratio
     * @returns {number}
     */
    computeSeed(Qs, D50, Qw, S, ratio) {
        // Each slider is 1-100, so 3 digits suffice per param.
        // ratio is clamped to avoid overflow; we only need coarse bucketing.
        const ratioKey = Math.max(0, Math.min(999, Math.round(Math.log10(Math.max(0.01, ratio)) * 100 + 500)));
        return ((Qs * 1000 + D50) * 1000 + Qw) * 1000 + S + ratioKey / 1000;
    }
};
