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


interface OptionsViewProps {}
interface OptionsViewState {
    options?: Options;
}

export class OptionsView extends React.Component<
        OptionsViewProps, OptionsViewState> {

    state: OptionsViewState = {};

    constructor (props: OptionsViewProps) {
        super(props);

        this.handleInputChange = this.handleInputChange.bind(this);
    }

    async componentDidMount () {
        this.setState({
            options: await options.getAll()
        });

        // Update options data if changed whilst page is open
        options.addEventListener("changed", async () => {
            this.setState({
                options: await options.getAll()
            })
        })
    }

    render () {
        return <div className="options">
            { this.state.options &&
                <>
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
                            <input name="persistConnectionState"
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

                    <hr/>

                    <label className="option option--inline">
                        <div className="option__control">
                            <input name="showDebugInfo"
                                type="checkbox"
                                checked={ this.state.options?.showDebugInfo }
                                onChange={ this.handleInputChange } />
                        </div>
                        <div className="option__label">
                            { _("optionsShowDebugInfoLabel") }
                        </div>
                        <div className="option__description">
                            { _("optionsShowDebugInfoDescription") }
                        </div>
                    </label>
                </>}
        </div>
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
