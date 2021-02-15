import React from "react";
import { Circle, RegularPolygon } from "react-konva";

function NodeRep({ typeId, x, y, radius, style, events }) {
    return !typeId ? (
        <Circle x={x} y={y} radius={radius} {...style} {...events} />
    ) : (
        <RegularPolygon x={x} y={y} radius={radius} sides={typeId + 2} {...style} {...events} />
    );
    // if (shape === "triangle") {
    //     return <circle cx={0} cy={0} r={r} />;
    // } else {
    //     return <polygon points={`0,${-r} ${(-1.732 * r) / 2},${r / 2} ${(1.732 * r) / 2},${r / 2}`} />;
    // }
}

export default NodeRep;
