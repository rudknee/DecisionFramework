document.addEventListener('DOMContentLoaded', function () {
    const chartContainer = document.getElementById('chart-container');
    const recommendationsContainer = document.getElementById('recommendations-container');

    if (chartContainer) {
        renderDecisionTree(chartContainer, recommendationsContainer);
    }
});

function renderDecisionTree(chartContainer, recommendationsContainer) {
    const width = chartContainer.clientWidth;
    const height = 600;

    const svg = d3.select(chartContainer).append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g");

    const zoom = d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

    svg.call(zoom);

    let i = 0,
        duration = 750,
        root;

    const treemap = d3.tree().nodeSize([120, 350]);

    const onRecommendationsPage = window.location.pathname.includes('recommendations.html');

    Promise.all([
        d3.json("data.json"),
        d3.json("recommendations.json")
    ]).then(function ([treeData, recommendationsData]) {
        let nodeIdCounter = 0;
        function assignIds(d) {
            d.uniqueId = nodeIdCounter++;
            if (d.children) {
                d.children.forEach(assignIds);
            }
        }
        assignIds(treeData);

        const storedPath = localStorage.getItem('decisionPath');
        const decisionPath = storedPath ? JSON.parse(storedPath) : [];
        const pathSet = new Set(decisionPath);

        root = d3.hierarchy(treeData, d => d.children);
        root.x0 = height / 2;
        root.y0 = 0;

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        if (onRecommendationsPage) {
            function expandPath(d) {
                if (pathSet.has(d.data.uniqueId)) {
                    if (d._children) {
                        d.children = d._children;
                        d._children = null;
                    }
                }
                if (d.children) {
                    d.children.forEach(expandPath);
                }
            }
            collapse(root);
            expandPath(root);
            displayRecommendations();
        } else {
            root.children.forEach(collapse);
        }

        update(root);
        
        const initialScale = onRecommendationsPage ? 0.6 : 0.8;
        const initialTransform = d3.zoomIdentity.translate(150, height / 2).scale(initialScale);
        svg.call(zoom.transform, initialTransform);

        function centerNode(source) {
            const t = d3.zoomTransform(svg.node());
            let x = -source.y;
            let y = -source.x;
            x = x * t.k + width / 2;
            y = y * t.k + height / 2;
            
            const transform = d3.zoomIdentity.translate(x, y).scale(t.k);
            svg.transition().duration(duration).call(zoom.transform, transform);
        }

        function update(source) {
            const treeLayout = treemap(root);
            const nodes = treeLayout.descendants();
            const links = treeLayout.descendants().slice(1);

            const node = g.selectAll('g.node')
                .data(nodes, d => d.id || (d.id = ++i));

            const nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr("transform", d => "translate(" + source.y0 + "," + source.x0 + ")")
                .on('click', click);

            nodeEnter.append('rect')
                .attr('class', 'node-rect')
                .attr('width', 1e-6)
                .attr('height', 1e-6)
                .attr('x', -125)
                .attr('y', -40)
                .attr('rx', 5)
                .attr('ry', 5)
                .style("fill", d => {
                    if (onRecommendationsPage && pathSet.has(d.data.uniqueId)) return '#007bff';
                    if (d.data.type === 'decision') return '#fdeceb';
                    if (d.data.type === 'outcome') return '#77e9c3ff';
                    return '#fdeceb';
                })
                .style('stroke', d => {
                    if (onRecommendationsPage && pathSet.has(d.data.uniqueId)) return '#0056b3';
                    if (d.data.type === 'decision') return '#f0453a';
                    if (d.data.type === 'outcome') return '#00ffaaff';
                    return '#f0453a';
                })
                .style('stroke-width', '2.5px');

            nodeEnter.append("foreignObject")
                .attr("width", 250)
                .attr("height", 80)
                .attr("x", -125)
                .attr("y", -40)
                .append("xhtml:div")
                .attr("class", "node-text-wrapper")
                .html(d => `<div class="node-text" style="color: ${onRecommendationsPage && pathSet.has(d.data.uniqueId) ? '#fff' : '#333'}">${d.data.name}</div>`);

            const nodeUpdate = nodeEnter.merge(node);

            nodeUpdate.transition()
                .duration(duration)
                .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

            nodeUpdate.select('rect.node-rect')
                .attr('width', 250)
                .attr('height', 80)
                .attr('cursor', 'pointer');

            const nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", d => "translate(" + source.y + "," + source.x + ")")
                .remove();

            nodeExit.select('rect')
                .attr('width', 1e-6)
                .attr('height', 1e-6);

            nodeExit.select('foreignObject')
                .style('opacity', 1e-6);

            const link = g.selectAll('path.link')
                .data(links, d => d.id);

            const linkEnter = link.enter().insert('path', "g")
                .attr("class", "link")
                .style("stroke", d => {
                    if (onRecommendationsPage) {
                        const sourceInPath = pathSet.has(d.parent.data.uniqueId);
                        const targetInPath = pathSet.has(d.data.uniqueId);
                        return (sourceInPath && targetInPath) ? '#007bff' : '#ccc';
                    }
                    return '#ccc';
                })
                .style("stroke-width", d => {
                    if (onRecommendationsPage) {
                        const sourceInPath = pathSet.has(d.parent.data.uniqueId);
                        const targetInPath = pathSet.has(d.data.uniqueId);
                        return (sourceInPath && targetInPath) ? '4px' : '2px';
                    }
                    return '2px';
                })
                .attr('d', function (d) {
                    const o = { x: source.x0, y: source.y0 };
                    return diagonal(o, o);
                });

            const linkUpdate = linkEnter.merge(link);

            linkUpdate.transition()
                .duration(duration)
                .attr('d', d => diagonal(d.parent, d));

            link.exit().transition()
                .duration(duration)
                .attr('d', function (d) {
                    const o = { x: source.x, y: source.y };
                    return diagonal(o, o);
                })
                .remove();

            nodes.forEach(function (d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });

            function diagonal(s, d) {
                if (!d || !s) return null;
                const startX = s.y + 125;
                const startY = s.x;
                const endX = d.y - 125;
                const endY = d.x;

                return `M ${startX},${startY}
                        C ${(startX + endX) / 2},${startY}
                          ${(startX + endX) / 2},${endY}
                          ${endX},${endY}`;
            }

            function click(event, d) {
                if (onRecommendationsPage) {
                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else {
                        d.children = d._children;
                        d._children = null;
                    }
                    update(d);
                    centerNode(d);
                    return;
                }
                
                const path = d.ancestors().map(node => node.data.uniqueId).reverse();

                if (d.data.url && d.data.url !== '#') {
                    localStorage.setItem('decisionPath', JSON.stringify(path));
                    window.open(d.data.url, '_self');
                    return;
                }

                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
                centerNode(d);
            }
        }

        function displayRecommendations() {
            if (!recommendationsContainer || !onRecommendationsPage) return;

            const finalNodeId = decisionPath[decisionPath.length - 1];
            let finalNodeData;

            root.each(node => {
                if (node.data.uniqueId === finalNodeId) {
                    finalNodeData = node.data;
                }
            });

            if (finalNodeData && finalNodeData.recommendations) {
                const recommendationIds = finalNodeData.recommendations;
                const filteredRecommendations = recommendationsData.filter(rec => recommendationIds.includes(rec.id));

                let html = '<p>Based on your answers in the decision guide, here are some recommended actions you can take to improve your organization\'s cyber security posture.</p>';

                filteredRecommendations.forEach(rec => {
                    html += `
                        <div class="recommendation">
                            <h2>${rec.title}</h2>
                            <p>${rec.description}</p>
                    `;
                    if (rec.actions && rec.actions.length > 0) {
                        html += '<ul>';
                        rec.actions.forEach(action => {
                            html += `<li>${action}</li>`;
                        });
                        html += '</ul>';
                    }
                    if (rec.summary) {
                        html += `<p>${rec.summary}</p>`;
                    }
                    if (rec.link){
                        html += `<p>${rec.link}</p>`;
                    }
                    html += '</div>';
                });
                recommendationsContainer.innerHTML = html;
            }
        }
    });
} 