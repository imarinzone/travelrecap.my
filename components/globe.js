
class Globe {
    constructor(containerId, visitedCountries) {
        this.container = document.getElementById(containerId);
        this.visitedCountries = new Set(visitedCountries.map(c => c.toLowerCase())); // Normalize for comparison
        this.width = 450;
        this.height = 450;
        this.sensitivity = 75;
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.countries = null;
        this.oceanCircle = null;
        this.rotationTimer = null;
        this.scrollProgress = 0;
        
        // Theme colors
        this.themes = {
            dark: {
                ocean: '#111827',
                oceanStroke: '#334155',
                country: '#334155',
                countryStroke: '#1e293b',
                visited: '#38bdf8',
                glow: 'rgba(56,189,248,0.2)'
            },
            light: {
                ocean: '#60a5fa',          // Blue ocean
                oceanStroke: '#3b82f6',
                country: '#4ade80',         // Green land
                countryStroke: '#22c55e',   // Darker green stroke
                visited: '#f97316',         // Orange for visited (stands out on green)
                glow: 'rgba(59,130,246,0.15)'
            }
        };

        if (!this.container) {
            console.error(`Globe container #${containerId} not found`);
            return;
        }

        this.init();
        this.setupThemeListener();
    }

    getCurrentTheme() {
        return document.body.classList.contains('dark') ? 'dark' : 'light';
    }

    init() {
        const theme = this.themes[this.getCurrentTheme()];
        
        // Create SVG
        this.svg = d3.select(this.container).append("svg")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("cursor", "grab")
            .attr("width", "100%")
            .style("height", "auto")
            .attr("class", "globe-svg");

        // Projection
        this.projection = d3.geoOrthographic()
            .scale(200)
            .center([0, 0])
            .rotate([0, -30])
            .translate([this.width / 2, this.height / 2]);

        this.initialScale = this.projection.scale();
        this.path = d3.geoPath().projection(this.projection);

        // Glow filter
        const defs = this.svg.append("defs");
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Background circle/ocean
        this.oceanCircle = this.svg.append("circle")
            .attr("fill", theme.ocean)
            .attr("stroke", theme.oceanStroke)
            .attr("stroke-width", "1")
            .attr("cx", this.width / 2)
            .attr("cy", this.height / 2)
            .attr("r", this.initialScale);

        // Load world data
        d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data) => {
            const worldGroup = this.svg.append("g");
            this.worldData = data; // Store for theme updates

            this.countries = worldGroup.append("g")
                .selectAll("path")
                .data(data.features)
                .enter()
                .append("path")
                .attr("d", this.path)
                .attr("fill", (d) => {
                    const countryName = d.properties.name || "";
                    if (this.visitedCountries.has(countryName.toLowerCase())) {
                        return theme.visited;
                    }
                    return theme.country;
                })
                .attr("stroke", theme.countryStroke)
                .attr("stroke-width", 0.3);

            this.startRotation();
            this.setupDrag();
            this.setupScrollListener();
        }).catch(err => console.error("Error loading world data:", err));
    }
    
    setupThemeListener() {
        // Listen for theme changes via MutationObserver on body class
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    this.updateTheme();
                }
            });
        });
        
        observer.observe(document.body, { attributes: true });
    }
    
    updateTheme() {
        const theme = this.themes[this.getCurrentTheme()];
        
        // Update ocean
        if (this.oceanCircle) {
            this.oceanCircle
                .transition()
                .duration(300)
                .attr("fill", theme.ocean)
                .attr("stroke", theme.oceanStroke);
        }
        
        // Update countries
        if (this.countries) {
            this.countries
                .transition()
                .duration(300)
                .attr("fill", (d) => {
                    const countryName = d.properties.name || "";
                    if (this.visitedCountries.has(countryName.toLowerCase())) {
                        return theme.visited;
                    }
                    return theme.country;
                })
                .attr("stroke", theme.countryStroke);
        }
    }

    startRotation() {
        if (this.autoRotateEnabled === false) return;
        if (this.rotationTimer) this.rotationTimer.stop();

        this.rotationTimer = d3.timer((elapsed) => {
            const rotate = this.projection.rotate();
            // Constant slow rotation + extra rotation based on scroll speed
            const scrollImpact = this.scrollProgress * 720; // 2 full extra turns across scroll
            const baseRotation = elapsed * 0.05;

            this.projection.rotate([-baseRotation - scrollImpact, rotate[1]]);
            this.countries.attr("d", this.path);

            this.updateContainerTransform();
        });
    }

    stopRotation() {
        if (this.rotationTimer) {
            this.rotationTimer.stop();
            this.rotationTimer = null;
        }
    }

    getRotation() {
        if (!this.projection) return [0, 0];
        return this.projection.rotate();
    }

    setRotation(rotation) {
        if (!this.projection || !this.countries) return;
        this.projection.rotate(rotation);
        this.countries.attr("d", this.path);
        this.updateContainerTransform();
    }

    setupDrag() {
        const sensitivity = this.sensitivity;
        const globe = this;

        this.svg.call(d3.drag()
            .on("start", () => {
                if (globe.rotationTimer) globe.rotationTimer.stop();
            })
            .on("drag", (event) => {
                const rotate = globe.projection.rotate();
                const k = sensitivity / globe.projection.scale();
                globe.projection.rotate([rotate[0] + event.dx * k, rotate[1] - event.dy * k]);
                globe.countries.attr("d", globe.path);
            })
            .on("end", () => {
                if (globe.autoRotateEnabled === false) return;
                const currentRotation = globe.projection.rotate()[0];
                globe.rotationTimer = d3.timer((elapsed) => {
                    const scrollImpact = globe.scrollProgress * 720;
                    const baseRotation = elapsed * 0.05;
                    globe.projection.rotate([currentRotation - baseRotation - scrollImpact, globe.projection.rotate()[1]]);
                    globe.countries.attr("d", globe.path);
                    globe.updateContainerTransform();
                });
            })
        );
    }

    setupScrollListener() {
        window.addEventListener('scroll', () => {
            // Calculate scroll progress (0 to 1) based on page height
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            this.scrollProgress = height > 0 ? (winScroll / height) : 0;
        });
    }

    updateContainerTransform() {
        // Smooth translation and orbital motion via CSS
        // Skip movement while the globe is "docked" into the summary card
        if (this.container && this.container.dataset.docked !== 'true') {
            const p = this.scrollProgress;

            // Adjust these values to control the movement path
            // Move from left to right across the screen

            const windowWidth = window.innerWidth;
            const maxMove = windowWidth * 0.4; // Move across 40% of screen

            const xOffset = -100 + (p * maxMove) + Math.sin(p * Math.PI * 2) * 30;
            const yOffset = Math.sin(p * Math.PI * 4) * 20; // Bobbing up and down
            const scale = 1 + Math.sin(p * Math.PI) * 0.1; // Pulsing scale

            this.container.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(${scale})`;
        }
    }
}
