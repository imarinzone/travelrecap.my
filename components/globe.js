
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
        this.rotationTimer = null;
        this.scrollProgress = 0;

        if (!this.container) {
            console.error(`Globe container #${containerId} not found`);
            return;
        }

        this.init();
    }

    init() {
        // Create SVG
        this.svg = d3.select(this.container).append("svg")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("cursor", "grab")
            .attr("width", "100%")
            .style("height", "auto")
            .attr("class", "drop-shadow-[0_0_50px_rgba(56,189,248,0.2)]");

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
        this.svg.append("circle")
            .attr("fill", "#111827")
            .attr("stroke", "#334155")
            .attr("stroke-width", "1")
            .attr("cx", this.width / 2)
            .attr("cy", this.height / 2)
            .attr("r", this.initialScale);

        // Load world data
        d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data) => {
            const worldGroup = this.svg.append("g");

            this.countries = worldGroup.append("g")
                .selectAll("path")
                .data(data.features)
                .enter()
                .append("path")
                .attr("d", this.path)
                .attr("fill", (d) => {
                    const countryName = d.properties.name || "";
                    if (this.visitedCountries.has(countryName.toLowerCase())) {
                        return "#38bdf8"; // Highlight color (light blue)
                    }
                    return "#334155"; // Default color (dark slate)
                })
                .attr("stroke", "#1e293b")
                .attr("stroke-width", 0.3);

            this.startRotation();
            this.setupDrag();
            this.setupScrollListener();
        }).catch(err => console.error("Error loading world data:", err));
    }

    startRotation() {
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
        if (this.container) {
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
