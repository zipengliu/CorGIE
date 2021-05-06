import React from "react";
import { Navbar, Nav } from "react-bootstrap";

export default function AppNav({ datasetId, stats }) {
    return (
        <Navbar expand="md">
            {/* <Navbar.Brand href="/">Corresponding Features between Graph and Embeddings</Navbar.Brand> */}
            <Navbar.Brand href={"."}>
                <img alt="" src="logo192.png" width="25" height="25" className="d-inline-block align-top" />{" "}
                CorGIE: <span className="text-underline">Cor</span>responding a{" "}
                <span className="text-underline">G</span>raph and <span className="text-underline">I</span>ts{" "}
                <span className="text-underline">E</span>mbedding
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="responsive-navbar-nav" />
            <Navbar.Collapse id="responsive-navbar-nav">
                <Nav className="mr-auto">
                    {/* <Nav.Link href={"."} active={!datasetId}>
                        Home
                    </Nav.Link> */}
                </Nav>
                <Navbar.Text className="justify-content-end">
                    {datasetId ? `Dataset: ${datasetId} (V=${stats.numNodes}, E=${stats.numEdges})` : ""}
                </Navbar.Text>
            </Navbar.Collapse>
        </Navbar>
    );
}
