import React from "react";
import { Navbar, Nav } from "react-bootstrap";

export default function AppNav({ datasetId, homePath }) {
    const p = homePath + "/";
    return (
        <Navbar bg="dark" variant="dark" expand="md">
            {/* <Navbar.Brand href="/">Corresponding Features between Graph and Embeddings</Navbar.Brand> */}
            <Navbar.Brand href={p}>CoFeGrEm</Navbar.Brand>
            <Navbar.Toggle aria-controls="responsive-navbar-nav" />
            <Navbar.Collapse id="responsive-navbar-nav">
                <Nav className="mr-auto">
                    <Nav.Link href={p} active={!datasetId}>
                        Home
                    </Nav.Link>
                </Nav>
                <Navbar.Text className="justify-content-end">
                    {datasetId ? `Dataset: ${datasetId}` : ""}
                </Navbar.Text>
            </Navbar.Collapse>
        </Navbar>
    );
}
