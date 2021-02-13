"use strict";

import React from "react";

import options, { Options } from "../../lib/options";


const _ = browser.i18n.getMessage;


function getInputValue (input: HTMLInputElement) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        /*case "number":
            return parseFloat(input.value);*/

        default:
            return input.value;
    }
}


interface OptionsPanelProps {
    open: boolean;
    onClose (): void;
}
interface OptionsPanelState {
    options?: Options;
}

export class OptionsPanel extends React.Component<
        OptionsPanelProps, OptionsPanelState> {

    private form?: HTMLFormElement;

    static defaultProps = {
        open: false
    }
    state: OptionsPanelState = {};

    constructor (props: OptionsPanelProps) {
        super(props);

        this.handleInputChange = this.handleInputChange.bind(this);
    }

    async componentDidMount () {
        this.setState({
            options: await options.getAll()
        });
    }

    render () {
        let panelClassName = "panel";
        if (this.props.open) {
            panelClassName += " panel--visible";
        }

        return (
            <div className={ panelClassName }>
                <div className="panel__header">
                    <h2 className="panel__title">
                        { _("optionsPanelTitle") }
                    </h2>
                    <button className="panel__close-button"
                            onClick={ () => this.props.onClose() }>
                        { _("optionsPanelClose") }
                    </button>
                </div>
                <div className="panel__content">
                    { this.state.options &&
                        <div className="options">

                            <label className="option option--inline">
                                <div className="option__control">
                                    <input name="autoConnect"
                                           type="checkbox"
                                           checked={ this.state.options?.autoConnect }
                                           onChange={ this.handleInputChange } />
                                </div>
                                <div className="option__label">
                                    { _("optionsAutoConnectLabel") }
                                </div>
                                <div className="option__description">
                                    { _("optionsAutoConnectDescription") }
                                </div>
                            </label>

                            <label className="option">
                                <div className="option__label">
                                    { _("optionsAutoConnectServerLabel") }
                                </div>
                                <div className="option__control">
                                    <input name="autoConnectServer"
                                           type="text"
                                           value={ this.state.options?.autoConnectServer }
                                           onChange={ this.handleInputChange } />
                                </div>
                                <div className="option__description">
                                    { _("optionsAutoConnectServerDescription") }
                                </div>
                            </label>

                            <hr/>

                            <label className="option option--inline">
                                <div className="option__control">
                                    <input name="autoConnect"
                                           type="checkbox"
                                           checked={ this.state.options?.persistConnectionState }
                                           onChange={ this.handleInputChange } />
                                </div>
                                <div className="option__label">
                                    { _("optionsPersistConnectionStateLabel") }
                                </div>
                                <div className="option__description">
                                    { _("optionsPersistConnectionStateDescription") }
                                </div>
                            </label>

                        </div> }
                </div>
            </div>
        )
    }

    private handleInputChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState(currentState => {
            if (currentState.options) {
                currentState.options[ev.target.name] = getInputValue(ev.target);
                this.saveOptions();
            }

            return currentState;
        });
    }

    private async saveOptions () {
        await options.setAll(this.state.options);
    }
}
