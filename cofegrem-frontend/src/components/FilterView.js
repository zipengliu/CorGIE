import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { changeParam } from "../actions";

class FilterView extends Component {
    render() {
        const { param, latent, graph } = this.props;
        const { filter } = param;

        const { changeParam } = this.props;

        return (
            <div id="filter-view" className="view">
                <h5 className="text-center">Node / edge filter</h5>
                <Form onSubmit={() => {console.log('submitted.')}}>
                    <Form.Check
                        type="checkbox"
                        checked={filter.presentEdges}
                        id="present-edge"
                        label="present edges"
                        onChange={changeParam.bind(null, "filter.presentEdges", null, true)}
                    />
                    <Form.Check
                        type="checkbox"
                        checked={filter.absentEdges}
                        id="absent-edge"
                        label="absent edges"
                        onChange={changeParam.bind(null, "filter.absentEdges", null, true)}
                    />

                    <Form.Check
                        type="switch"
                        checked={filter.ascending}
                        id="ascending"
                        label="ascending order"
                        onChange={changeParam.bind(null, "filter.ascending", null, true)}
                    />

                    <Form.Group controlId="source-node-label">
                        <Form.Label>Source node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>

                    <Form.Group controlId="source-node-label">
                        <Form.Label>Target node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>

                    <Button type="submit">Search</Button>
                </Form>

                <div>TODO</div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state
});

const mapDispatchToProps = dispatch => bindActionCreators({ changeParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(FilterView);
