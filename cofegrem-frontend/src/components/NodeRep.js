import React from "react";

export default function NodeRep({ shape, r}) {
    if (shape === "triangle") {
        return <polygon points={`0,${-r*2} ${-1.732*r},${r} ${1.732*r},${r}`} />
    } else {
        return <circle cx={0} cy={0} r={r} />;
    }
}
