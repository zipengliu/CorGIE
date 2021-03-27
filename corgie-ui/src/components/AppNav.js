import React from "react";
import { Navbar, Nav } from "react-bootstrap";

export default function AppNav({ datasetId, stats }) {
    return (
        <Navbar bg="dark" variant="dark" expand="md">
            {/* <Navbar.Brand href="/">Corresponding Features between Graph and Embeddings</Navbar.Brand> */}
            <Navbar.Brand href={'.'}>CorGIE</Navbar.Brand>
            <Navbar.Toggle aria-controls="responsive-navbar-nav" />
            <Navbar.Collapse id="responsive-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link href={'.'} active={!datasetId}>
                        Home
                    </Nav.Link>
                </Nav>
                <Navbar.Text className="justify-content-end">
                    {datasetId ? `Dataset: ${datasetId} (V=${stats.numNodes}, E=${stats.numEdges})` : ""}
                </Navbar.Text>
            </Navbar.Collapse>
        </Navbar>
    );
}
