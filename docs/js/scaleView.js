/**
 * Scale View - Balance Scale D3 Visualization
 *
 * Renders an animated balance scale that tilts based on
 * the ratio between sediment supply and transport capacity.
 *
 * Features:
 * - Dynamic rock pile: Qs * D50 controls rock size
 * - Water bucket: Qw * S affects flow indicator
 * - Arrow indicator showing aggradation/degradation direction
 */

const ScaleView = {
    svg: null,
    width: 0,
    height: 0,
    margin: { top: 10, right: 20, bottom: 10, left: 20 },
    beamGroup: null,
    sedimentGroup: null,
    waterGroup: null,
    arrowGroup: null,
    arrowPointer: null,  // Direct reference to arrow pointer
    beamLength: 0,

    // Pan and label references for moment arm positioning
    sedimentPanGroup: null,
    waterPanGroup: null,
    sedimentLabel: null,
    waterLabel: null,

    // Current parameter values for dynamic updates
    currentParams: { Qs: 50, D50: 50, Qw: 50, S: 50 },

    /**
     * Initialize the scale visualization
     * @param {string} containerId - DOM element ID for the container
     */
    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Get container dimensions
        const rect = container.getBoundingClientRect();
        this.width = rect.width || 500;
        this.height = rect.height || 280;

        // Create SVG
        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Draw arrow indicator (behind everything)
        this.drawArrowIndicator();

        // Draw static elements
        this.drawBase();

        // Create beam group for rotation
        this.beamGroup = this.svg.append('g')
            .attr('class', 'beam-group')
            .attr('transform', `translate(${this.width / 2}, ${this.height * 0.38})`);

        // Draw the beam and pans
        this.drawBeam();

        // Initial rock and water draw
        this.updateRocks(50, 50);
        this.updateWater(50, 50);
    },

    /**
     * Draw the arrow indicator showing aggradation/degradation
     */
    drawArrowIndicator() {
        const cx = this.width / 2;
        const arrowY = this.height * 0.12;

        // Create arrow group
        this.arrowGroup = this.svg.append('g')
            .attr('class', 'arrow-indicator')
            .attr('transform', `translate(${cx}, ${arrowY})`);

        // Background arc
        const arcWidth = 160;
        this.arrowGroup.append('path')
            .attr('d', `M ${-arcWidth/2} 0 Q 0 -22 ${arcWidth/2} 0`)
            .attr('fill', 'none')
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 6)
            .attr('stroke-linecap', 'round');

        // Degradation zone (left) - red
        this.arrowGroup.append('path')
            .attr('d', `M ${-arcWidth/2} 0 Q ${-arcWidth/4} -15 0 -22`)
            .attr('fill', 'none')
            .attr('stroke', '#e74c3c')
            .attr('stroke-width', 5)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.5);

        // Aggradation zone (right) - orange
        this.arrowGroup.append('path')
            .attr('d', `M 0 -22 Q ${arcWidth/4} -15 ${arcWidth/2} 0`)
            .attr('fill', 'none')
            .attr('stroke', '#f39c12')
            .attr('stroke-width', 5)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.5);

        // Center equilibrium mark (green tick)
        this.arrowGroup.append('line')
            .attr('x1', 0)
            .attr('y1', -28)
            .attr('x2', 0)
            .attr('y2', -16)
            .attr('stroke', '#27ae60')
            .attr('stroke-width', 3);

        // Arrow pointer (needle) - store direct reference
        this.arrowPointer = this.arrowGroup.append('g')
            .attr('class', 'arrow-pointer-group');

        this.arrowPointer.append('path')
            .attr('d', 'M 0,-40 L -6,-25 L -2,-25 L -2,8 L 2,8 L 2,-25 L 6,-25 Z')
            .attr('fill', '#444')
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        // Needle center circle
        this.arrowPointer.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', '#555')
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        // Labels
        this.arrowGroup.append('text')
            .attr('x', -arcWidth/2 - 10)
            .attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', '#c0392b')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text('DEGRAD.');

        this.arrowGroup.append('text')
            .attr('x', arcWidth/2 + 10)
            .attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', '#d68910')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text('AGGR.');
    },

    /**
     * Draw the base/fulcrum of the scale
     */
    drawBase() {
        const cx = this.width / 2;
        const baseY = this.height * 0.85;

        // Fulcrum triangle
        const fulcrumHeight = 80;
        const fulcrumWidth = 50;

        this.svg.append('polygon')
            .attr('class', 'scale-fulcrum')
            .attr('points', `
                ${cx},${baseY - fulcrumHeight}
                ${cx - fulcrumWidth / 2},${baseY}
                ${cx + fulcrumWidth / 2},${baseY}
            `)
            .attr('fill', '#555');

        // Base platform
        this.svg.append('rect')
            .attr('x', cx - 60)
            .attr('y', baseY)
            .attr('width', 120)
            .attr('height', 10)
            .attr('rx', 4)
            .attr('fill', '#444');

        // Fulcrum decorative circle
        this.svg.append('circle')
            .attr('cx', cx)
            .attr('cy', baseY - fulcrumHeight)
            .attr('r', 8)
            .attr('fill', '#666')
            .attr('stroke', '#444')
            .attr('stroke-width', 2);
    },

    /**
     * Calculate pan X position based on slider value (1-100)
     * Maps slider to position range: beamLength * 0.25 to beamLength * 0.50
     * @param {number} sliderValue - Slider value (1-100)
     * @param {boolean} isLeft - True for left pan (negative X), false for right
     * @returns {number} X offset from beam center
     */
    getPanPosition(sliderValue, isLeft) {
        const minOffset = this.beamLength * 0.25;
        const maxOffset = this.beamLength * 0.50;
        const t = (sliderValue - 1) / 99; // Normalize to 0-1
        const offset = minOffset + t * (maxOffset - minOffset);
        return isLeft ? -offset : offset;
    },

    /**
     * Draw the balance beam and pans
     */
    drawBeam() {
        this.beamLength = this.width * 0.72;
        const beamHeight = 10;

        // Main beam
        this.beamGroup.append('rect')
            .attr('class', 'scale-beam')
            .attr('x', -this.beamLength / 2)
            .attr('y', -beamHeight / 2)
            .attr('width', this.beamLength)
            .attr('height', beamHeight)
            .attr('rx', 5)
            .attr('fill', '#666');

        // Center pivot point
        this.beamGroup.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 10)
            .attr('fill', '#555')
            .attr('stroke', '#444')
            .attr('stroke-width', 2);

        // Initial pan positions at slider=50 (midpoint of range)
        const leftX = this.getPanPosition(50, true);
        const rightX = this.getPanPosition(50, false);

        // Left pan (sediment)
        this.sedimentPanGroup = this.beamGroup.append('g')
            .attr('class', 'sediment-pan-group')
            .attr('transform', `translate(${leftX}, 0)`);
        this.drawSedimentPan(this.sedimentPanGroup);

        // Right pan (water bucket)
        this.waterPanGroup = this.beamGroup.append('g')
            .attr('class', 'water-pan-group')
            .attr('transform', `translate(${rightX}, 0)`);
        this.drawWaterBucket(this.waterPanGroup);

        // Labels above pans (stored for repositioning)
        this.sedimentLabel = this.beamGroup.append('text')
            .attr('class', 'pan-label sediment-label')
            .attr('x', leftX)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#8b4513')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .text('Qs * D50');

        this.waterLabel = this.beamGroup.append('text')
            .attr('class', 'pan-label water-label')
            .attr('x', rightX)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#2980b9')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .text('Qw * S');
    },

    /**
     * Draw the sediment pan with rock pile
     * @param {d3.Selection} panGroup - The parent group to draw into
     */
    drawSedimentPan(panGroup) {
        panGroup.attr('class', 'pan-group pan-sediment');

        const chainLength = 40;
        const panWidth = 70;
        const panDepth = 18;

        // Chains
        panGroup.append('line')
            .attr('class', 'scale-chain')
            .attr('x1', -15)
            .attr('y1', 0)
            .attr('x2', -panWidth / 2 + 5)
            .attr('y2', chainLength)
            .attr('stroke', '#888')
            .attr('stroke-width', 2);

        panGroup.append('line')
            .attr('class', 'scale-chain')
            .attr('x1', 15)
            .attr('y1', 0)
            .attr('x2', panWidth / 2 - 5)
            .attr('y2', chainLength)
            .attr('stroke', '#888')
            .attr('stroke-width', 2);

        // Pan (shallow bowl)
        panGroup.append('path')
            .attr('class', 'scale-pan')
            .attr('d', `
                M ${-panWidth / 2} ${chainLength}
                Q ${-panWidth / 2} ${chainLength + panDepth} 0 ${chainLength + panDepth}
                Q ${panWidth / 2} ${chainLength + panDepth} ${panWidth / 2} ${chainLength}
            `)
            .attr('fill', '#c0c0c0')
            .attr('stroke', '#888')
            .attr('stroke-width', 2);

        // Create group for rocks (will be updated dynamically)
        this.sedimentGroup = panGroup.append('g')
            .attr('class', 'sediment-content')
            .attr('transform', `translate(0, ${chainLength - 5})`);

        // Store pan dimensions
        this.sedimentPanWidth = panWidth;
    },

    /**
     * Draw the water bucket
     * @param {d3.Selection} panGroup - The parent group to draw into
     */
    drawWaterBucket(panGroup) {
        panGroup.attr('class', 'pan-group pan-water');

        const chainLength = 40;
        const bucketWidth = 55;
        const bucketHeight = 45;

        // Chains
        panGroup.append('line')
            .attr('class', 'scale-chain')
            .attr('x1', -12)
            .attr('y1', 0)
            .attr('x2', -bucketWidth / 2 + 8)
            .attr('y2', chainLength)
            .attr('stroke', '#888')
            .attr('stroke-width', 2);

        panGroup.append('line')
            .attr('class', 'scale-chain')
            .attr('x1', 12)
            .attr('y1', 0)
            .attr('x2', bucketWidth / 2 - 8)
            .attr('y2', chainLength)
            .attr('stroke', '#888')
            .attr('stroke-width', 2);

        // Bucket handle arc
        panGroup.append('path')
            .attr('d', `M ${-bucketWidth / 2 + 8} ${chainLength}
                        Q 0 ${chainLength - 12}
                        ${bucketWidth / 2 - 8} ${chainLength}`)
            .attr('fill', 'none')
            .attr('stroke', '#666')
            .attr('stroke-width', 3);

        // Bucket body (trapezoid shape)
        const bucketTop = chainLength + 3;
        const topWidth = bucketWidth;
        const bottomWidth = bucketWidth - 12;

        panGroup.append('path')
            .attr('class', 'bucket-body')
            .attr('d', `
                M ${-topWidth / 2} ${bucketTop}
                L ${-bottomWidth / 2} ${bucketTop + bucketHeight}
                L ${bottomWidth / 2} ${bucketTop + bucketHeight}
                L ${topWidth / 2} ${bucketTop}
                Z
            `)
            .attr('fill', '#7a7a7a')
            .attr('stroke', '#555')
            .attr('stroke-width', 2);

        // Bucket interior (darker)
        panGroup.append('path')
            .attr('class', 'bucket-interior')
            .attr('d', `
                M ${-topWidth / 2 + 3} ${bucketTop + 2}
                L ${-bottomWidth / 2 + 3} ${bucketTop + bucketHeight - 2}
                L ${bottomWidth / 2 - 3} ${bucketTop + bucketHeight - 2}
                L ${topWidth / 2 - 3} ${bucketTop + 2}
                Z
            `)
            .attr('fill', '#4a4a4a');

        // Create group for water (will be updated dynamically)
        this.waterGroup = panGroup.append('g')
            .attr('class', 'water-content')
            .attr('transform', `translate(0, ${bucketTop})`);

        // Store bucket dimensions for water updates
        this.bucketDimensions = {
            topWidth: topWidth - 6,
            bottomWidth: bottomWidth - 6,
            height: bucketHeight - 4,
            top: 2
        };
    },

    /**
     * Generate rocks based on Qs * D50 (size)
     * @param {number} Qs - Sediment discharge (1-100)
     * @param {number} D50 - Sediment size (1-100)
     */
    updateRocks(Qs, D50) {
        if (!this.sedimentGroup) return;

        // Clear existing rocks
        this.sedimentGroup.selectAll('*').remove();

        // Number of rocks based on Qs (2 to 12 rocks)
        const numRocks = Math.floor(2 + (Qs / 100) * 10);

        // Base rock size based on D50 (3 to 10 pixels)
        const baseSize = 3 + (D50 / 100) * 7;

        // Generate rock positions in a pile shape within pan bounds
        const rocks = [];
        const pileWidth = 50;
        const baseSeed = Qs * 1000 + D50 * 10;

        for (let i = 0; i < numRocks; i++) {
            // Stack rocks from bottom up in layers
            const layer = Math.floor(i / 3);
            const layerWidth = pileWidth - layer * 12;

            // Randomize position within constraints
            const seed = baseSeed + i * 17;
            const randX = this.pseudoRandom(seed);
            const randY = this.pseudoRandom(seed + 1);
            const randSize = this.pseudoRandom(seed + 2);
            const x = (randX - 0.5) * Math.max(layerWidth, 10);
            const y = 18 - (layer * baseSize * 0.9) - randY * 3;

            // Vary rock size slightly
            const sizeVariation = 0.7 + randSize * 0.5;
            const rockSize = Math.min(baseSize * sizeVariation, 12);

            rocks.push({ x, y: Math.max(y, 5), size: rockSize });
        }

        // Sort by y (bottom rocks first for proper layering)
        rocks.sort((a, b) => b.y - a.y);

        // Draw rocks
        rocks.forEach((rock, i) => {
            const seed = baseSeed + i * 17 + 3;
            const rotation = this.pseudoRandom(seed) * 360;
            const aspectRatio = 0.6 + this.pseudoRandom(seed + 1) * 0.35;

            this.sedimentGroup.append('ellipse')
                .attr('cx', rock.x)
                .attr('cy', rock.y)
                .attr('rx', rock.size)
                .attr('ry', rock.size * aspectRatio)
                .attr('fill', this.getRockColor(D50))
                .attr('stroke', '#4a3520')
                .attr('stroke-width', 0.5)
                .attr('transform', `rotate(${rotation}, ${rock.x}, ${rock.y})`);
        });
    },

    /**
     * Get rock color based on D50 (finer = lighter, coarser = darker)
     * @param {number} D50 - Sediment size
     * @returns {string} Color hex code
     */
    getRockColor(D50) {
        const t = D50 / 100;
        const r = Math.round(200 - t * 60);
        const g = Math.round(170 - t * 70);
        const b = Math.round(120 - t * 50);
        return `rgb(${r}, ${g}, ${b})`;
    },

    /**
     * Update water level in bucket based on Qw * S
     * @param {number} Qw - Water discharge (1-100)
     * @param {number} S - Slope (1-100)
     */
    updateWater(Qw, S) {
        if (!this.waterGroup || !this.bucketDimensions) return;

        // Clear existing water
        this.waterGroup.selectAll('*').remove();

        const dim = this.bucketDimensions;

        // Water level based on Qw (15% to 85% of bucket)
        const fillPercent = 0.15 + (Qw / 100) * 0.7;
        const waterHeight = dim.height * fillPercent;
        const waterTop = dim.top + dim.height - waterHeight;

        // Calculate width at water level (bucket tapers)
        const taperRatio = (waterTop - dim.top) / dim.height;
        const waterTopWidth = dim.topWidth - (dim.topWidth - dim.bottomWidth) * taperRatio;

        // Draw water body
        this.waterGroup.append('path')
            .attr('class', 'water-fill')
            .attr('d', `
                M ${-waterTopWidth / 2} ${waterTop}
                L ${-dim.bottomWidth / 2} ${dim.top + dim.height}
                L ${dim.bottomWidth / 2} ${dim.top + dim.height}
                L ${waterTopWidth / 2} ${waterTop}
                Z
            `)
            .attr('fill', '#5dade2')
            .attr('opacity', 0.85);

        // Add wave pattern on surface
        const waveAmplitude = 1 + (S / 100) * 2;
        const numWaves = 2 + Math.floor(S / 40);

        let wavePath = `M ${-waterTopWidth / 2} ${waterTop}`;
        const waveWidth = waterTopWidth / numWaves;

        for (let i = 0; i < numWaves; i++) {
            const x1 = -waterTopWidth / 2 + waveWidth * i + waveWidth / 2;
            const x2 = -waterTopWidth / 2 + waveWidth * (i + 1);
            const direction = i % 2 === 0 ? -1 : 1;
            wavePath += ` Q ${x1} ${waterTop + direction * waveAmplitude} ${x2} ${waterTop}`;
        }

        this.waterGroup.append('path')
            .attr('class', 'water-surface')
            .attr('d', wavePath)
            .attr('fill', 'none')
            .attr('stroke', '#2980b9')
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round');
    },

    /**
     * Update pan positions based on D50 and S values (moment arm effect)
     * @param {number} D50 - Sediment size (1-100), controls sediment pan position
     * @param {number} S - Slope (1-100), controls water pan position
     * @param {number} duration - Animation duration in ms
     */
    updatePanPositions(D50, S, duration = 500) {
        if (!this.sedimentPanGroup || !this.waterPanGroup) return;

        const leftX = this.getPanPosition(D50, true);
        const rightX = this.getPanPosition(S, false);

        // Animate sediment pan group
        this.sedimentPanGroup
            .transition()
            .duration(duration)
            .ease(d3.easeQuadOut)
            .attr('transform', `translate(${leftX}, 0)`);

        // Animate water pan group
        this.waterPanGroup
            .transition()
            .duration(duration)
            .ease(d3.easeQuadOut)
            .attr('transform', `translate(${rightX}, 0)`);

        // Animate labels to follow pans
        if (this.sedimentLabel) {
            this.sedimentLabel
                .transition()
                .duration(duration)
                .ease(d3.easeQuadOut)
                .attr('x', leftX);
        }

        if (this.waterLabel) {
            this.waterLabel
                .transition()
                .duration(duration)
                .ease(d3.easeQuadOut)
                .attr('x', rightX);
        }
    },

    /**
     * Update arrow indicator rotation based on ratio
     * @param {number} ratio - Balance ratio
     */
    updateArrow(ratio) {
        if (!this.arrowPointer) return;

        // Calculate arrow rotation (-50 to +50 degrees)
        // Ratio > 1 = aggradation = rotate right (positive)
        // Ratio < 1 = degradation = rotate left (negative)
        const clampedRatio = Math.max(0.1, Math.min(10, ratio));
        const logRatio = Math.log(clampedRatio);
        const maxAngle = 50;
        const angle = (logRatio / Math.log(10)) * maxAngle;

        // Rotate the entire arrow pointer group
        this.arrowPointer
            .transition()
            .duration(400)
            .ease(d3.easeQuadOut)
            .attr('transform', `rotate(${angle})`);
    },

    /**
     * Update the scale visualization with new parameters
     * @param {number} ratio - Balance ratio
     * @param {Object} params - { Qs, D50, Qw, S }
     * @param {number} duration - Animation duration in ms
     */
    update(ratio, params, duration = 500) {
        if (!this.beamGroup) return;

        // Calculate tilt angle
        const angle = Balance.calculateTiltAngle(ratio);

        // Animate the beam rotation
        this.beamGroup
            .transition()
            .duration(duration)
            .ease(d3.easeElastic.period(0.4))
            .attr('transform', `translate(${this.width / 2}, ${this.height * 0.38}) rotate(${angle})`);

        // Update arrow indicator
        this.updateArrow(ratio);

        // Update visual content if parameters changed
        if (params) {
            if (params.Qs !== this.currentParams.Qs || params.D50 !== this.currentParams.D50) {
                this.updateRocks(params.Qs, params.D50);
            }
            if (params.Qw !== this.currentParams.Qw || params.S !== this.currentParams.S) {
                this.updateWater(params.Qw, params.S);
            }
            // Update pan positions if D50 or S changed (moment arm effect)
            if (params.D50 !== this.currentParams.D50 || params.S !== this.currentParams.S) {
                this.updatePanPositions(params.D50, params.S, duration);
            }
            this.currentParams = { ...params };
        }

        // Update visual intensity based on state
        const state = Balance.getState(ratio);
        this.updateStateVisuals(state);
    },

    /**
     * Update visual styling based on balance state
     * @param {string} state - 'degradation' | 'equilibrium' | 'aggradation'
     */
    updateStateVisuals(state) {
        const colors = {
            degradation: '#c0392b',
            equilibrium: '#27ae60',
            aggradation: '#d68910'
        };

        // Update beam color hint
        this.beamGroup.select('.scale-beam')
            .transition()
            .duration(300)
            .attr('fill', state === 'equilibrium' ? '#666' : colors[state]);

        // Update arrow pointer color
        if (this.arrowPointer) {
            this.arrowPointer.select('path')
                .transition()
                .duration(300)
                .attr('fill', colors[state]);
        }
    },

    /**
     * Deterministic pseudo-random function (0-1) based on a seed
     * @param {number} seed
     * @returns {number}
     */
    pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
};

