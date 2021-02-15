"use strict";

import React from "react";

import options, { Options } from "../../lib/options";
import * as utils from "../../lib/utils";


const _ = browser.i18n.getMessage;


function getInputValue (input: HTMLInputElement) {
    switch (input.type) {
        case "checkbox":
            return input.checked;
        case "number":
            return parseFloat(input.value);

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

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="rememberConnectedServer"
                                    type="checkbox"
                                    checked={ this.state.options?.rememberConnectedServer }
                                    onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsRememberConnectedServerLabel") }
                            </div>
                            <div className="option__description">
                                { _("optionsRememberConnectedServerDescription") }
                            </div>
                        </label>

                    </label>

                    <hr/>

                    <label className="option option--inline proxy-dns-option">
                        <div className="option__control">
                            <input name="proxyDns"
                                type="checkbox"
                                checked={ this.state.options?.proxyDns }
                                onChange={ this.handleInputChange } />
                        </div>
                        <div className="option__label">
                            { _("optionsProxyDnsLabel") }
                        </div>
                        <div className="option__description">
                            { _("optionsProxyDnsDescription") }
                        </div>
                    </label>

                    <hr/>

                    <label className="option option--inline">
                        <div className="option__control">
                            <input name="enableNotifications"
                                type="checkbox"
                                checked={ this.state.options?.enableNotifications }
                                onChange={ this.handleInputChange } />
                        </div>
                        <div className="option__label">
                            { _("optionsEnableNotificationsLabel") }
                        </div>
                        <div className="option__description">
                            { _("optionsEnableNotificationsDescription") }
                        </div>

                        <label className="option option--inline">
                            <div className="option__control">
                                <input name="enableNotificationsOnlyErrors"
                                    type="checkbox"
                                    checked={ this.state.options?.enableNotificationsOnlyErrors }
                                    onChange={ this.handleInputChange } />
                            </div>
                            <div className="option__label">
                                { _("optionsEnableNotificationsOnlyErrorsLabel") }
                            </div>
                        </label>

                    </label>

                    <hr/>

                    <label className="option option--inline">
                        <div className="option__control">
                            <input name="enableDebugInfo"
                                type="checkbox"
                                checked={ this.state.options?.enableDebugInfo }
                                onChange={ this.handleInputChange } />
                        </div>
                        <div className="option__label">
                            { _("optionsEnableDebugInfoLabel") }
                        </div>
                        <div className="option__description">
                            { _("optionsEnableDebugInfoDescription") }
                        </div>
                    </label>
                </>}
        </div>
    }

    private handleInputChange (ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState(currentState => {
            if (currentState.options) {
                currentState.options[ev.target.name] =
                        getInputValue(ev.target) as boolean;

                this.saveOptions();
            }

            return currentState;
        });
    }

    private async saveOptions () {
        await options.setAll(this.state.options);
    }
}
