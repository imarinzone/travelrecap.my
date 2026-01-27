import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { LocationPoint } from '../types';

interface GlobeProps {
    locations: LocationPoint[];
    scrollProgress: number;
}

const Globe: React.FC<GlobeProps> = ({ locations, scrollProgress }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef(scrollProgress);

    // Update progress ref for access in d3 timer without closure issues
    useEffect(() => {
        progressRef.current = scrollProgress;
    }, [scrollProgress]);

    useEffect(() => {
        if (!svgRef.current) return;

        const width = 450;
        const height = 450;
        const sensitivity = 75;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("cursor", "grab")
            .attr("width", "100%")
            .attr("height", "auto");

        svg.selectAll("*").remove();

        const projection = d3.geoOrthographic()
            .scale(200)
            .center([0, 0])
            .rotate([0, -30])
            .translate([width / 2, height / 2]);

        const initialScale = projection.scale();
        const path = d3.geoPath().projection(projection);

        const defs = svg.append("defs");
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        svg.append("circle")
            .attr("fill", "#111827")
            .attr("stroke", "#334155")
            .attr("stroke-width", "1")
            .attr("cx", width / 2)
            .attr("cy", height / 2)
            .attr("r", initialScale);

        d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data: any) => {
            const worldGroup = svg.append("g");

            const countries = worldGroup.append("g")
                .selectAll("path")
                .data(data.features)
                .enter()
                .append("path")
                .attr("d", path as any)
                .attr("fill", "#334155")
                .attr("stroke", "#1e293b")
                .attr("stroke-width", 0.3);

            const pointsGroup = worldGroup.append("g");

            const sampledLocations = locations.length > 500
                ? locations.filter((_, i) => i % Math.ceil(locations.length / 500) === 0)
                : locations;

            const renderPoints = () => {
                const center = projection.invert!([width / 2, height / 2])!;

                const dots = pointsGroup.selectAll("circle")
                    .data(sampledLocations);

                dots.enter()
                    .append("circle")
                    .merge(dots as any)
                    .attr("cx", (d) => projection([d.longitudeE7 / 1e7, d.latitudeE7 / 1e7])![0])
                    .attr("cy", (d) => projection([d.longitudeE7 / 1e7, d.latitudeE7 / 1e7])![1])
                    .attr("r", 2)
                    .attr("fill", "#38bdf8")
                    .attr("filter", "url(#glow)")
                    .style("display", (d) => {
                        const gdistance = d3.geoDistance(
                            [d.longitudeE7 / 1e7, d.latitudeE7 / 1e7],
                            center
                        );
                        return gdistance > Math.PI / 2 ? "none" : "inline";
                    });

                dots.exit().remove();
            };

            renderPoints();

            let rotationTimer = d3.timer((elapsed) => {
                const rotate = projection.rotate();
                // Constant slow rotation + extra rotation based on scroll speed
                const scrollImpact = progressRef.current * 720; // 2 full extra turns across scroll
                const baseRotation = elapsed * 0.05;

                projection.rotate([-baseRotation - scrollImpact, rotate[1]]);
                countries.attr("d", path as any);
                renderPoints();

                // Smooth translation and orbital motion via CSS
                if (containerRef.current) {
                    const p = progressRef.current;
                    // Drifts left as we scroll down, and sinks down.
                    // Orbital wobble for "revolving" feel
                    const xOffset = -p * 300 + Math.sin(p * Math.PI * 2) * 50;
                    const yOffset = p * 600 + Math.cos(p * Math.PI * 2) * 20;
                    const scale = 1 + Math.sin(p * Math.PI) * 0.2; // Pulsing scale

                    containerRef.current.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(${scale})`;
                    containerRef.current.style.opacity = `${Math.max(0.4, 1 - p * 0.5)}`;
                }
            });

            svg.call(d3.drag<SVGSVGElement, unknown>()
                .on("start", () => rotationTimer.stop())
                .on("drag", (event) => {
                    const rotate = projection.rotate();
                    const k = sensitivity / projection.scale();
                    projection.rotate([rotate[0] + event.dx * k, rotate[1] - event.dy * k]);
                    countries.attr("d", path as any);
                    renderPoints();
                })
                .on("end", () => {
                    const currentRotation = projection.rotate()[0];
                    rotationTimer = d3.timer((elapsed) => {
                        const scrollImpact = progressRef.current * 720;
                        const baseRotation = elapsed * 0.05;
                        projection.rotate([currentRotation - baseRotation - scrollImpact, projection.rotate()[1]]);
                        countries.attr("d", path as any);
                        renderPoints();

                        if (containerRef.current) {
                            const p = progressRef.current;
                            const xOffset = -p * 300 + Math.sin(p * Math.PI * 2) * 50;
                            const yOffset = p * 600 + Math.cos(p * Math.PI * 2) * 20;
                            const scale = 1 + Math.sin(p * Math.PI) * 0.2;
                            containerRef.current.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(${scale})`;
                        }
                    });
                })
            );
        }).catch(err => console.error(err));

    }, [locations]);

    return (
        <div
            ref={containerRef}
            className="w-full max-w-[500px] aspect-square flex justify-center items-center py-4 will-change-transform transition-opacity duration-300"
            style={{ transition: 'transform 0.1s linear' }}
        >
            <svg ref={svgRef} className="drop-shadow-[0_0_50px_rgba(56,189,248,0.2)]" />
        </div>
    );
};

export default Globe;