import React, { Component } from "react";
import { Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import AppNav from "./AppNav";
import datasets from "../datasets";

export default class DatasetList extends Component {
    render() {
        return (
            <div>
                <AppNav />
                <Table striped hover bordered>
                    <thead>
                        <tr>
                            <th> # </th>
                            <th> Name </th>
                            <th> Source </th>
                            <th> #Nodes </th>
                            <th> #Edges </th>
                            <th> #Node types </th>
                            <th> Node features </th>
                            <th> #Hops </th>
                            <th> Description </th>
                        </tr>
                    </thead>
                    <tbody>
                        {datasets.map((d, i) => (
                            <tr key={i}>
                                <td> {i + 1} </td>
                                <td>
                                    <Link to={`/${d.id}`}> {d.name} </Link>
                                </td>
                                <td> {d.source} </td>
                                <td className="cell-num"> {d.numNodes} </td>
                                <td className="cell-num"> {d.numEdges} </td>
                                <td className="cell-num"> {d.numTypes} </td>
                                <td> {d.nodeFeatures} </td>
                                <td className="cell-num"> {d.hops} </td>
                                <td> {d.desc} </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
        );
    }
}
