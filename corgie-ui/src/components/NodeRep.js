import React from "react";

export default function NodeRep({ shape, r}) {
    if (shape === "triangle") {
        return <circle cx={0} cy={0} r={r} />;
    } else {
        return <polygon points={`0,${-r} ${-1.732*r/2},${r/2} ${1.732*r/2},${r/2}`} />
    }
}
