"use strict";

import React from "react";

import options, { Options } from "../../lib/options";
import * as utils from "../../lib/utils";

import localStorage from "../../localStorage";

const _ = browser.i18n.getMessage;

function getInputValue(input: HTMLInputElement) {
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
    browserType: utils.BrowserType;
}

export class OptionsView extends React.Component<
    OptionsViewProps,
    OptionsViewState
> {
    state: OptionsViewState = {
        browserType: utils.BrowserType.Unknown
    };

    constructor(props: OptionsViewProps) {
        super(props);

        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleExcludeListChange = this.handleExcludeListChange.bind(this);
        this.handleClearCache = this.handleClearCache.bind(this);
        this.handleClearRecentServers =
            this.handleClearRecentServers.bind(this);
    }

    async componentDidMount() {
        this.setState({
            options: await options.getAll(),
            browserType: await utils.getBrowserType()
        });

        // Update options data if changed whilst page is open
        options.addEventListener("changed", async () => {
            this.setState({
                options: await options.getAll()
            });
        });
    }

    render() {
        return (
            <form className="options">
                {this.state.options && (
                    <>
                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="autoConnect"
                                    type="checkbox"
                                    checked={this.state.options?.autoConnect}
                                    onChange={this.handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsAutoConnectLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsAutoConnectDescription")}
                            </div>

                            <label className="option option--inline">
                                <div className="option__control">
                                    <input
                                        name="rememberConnectedServer"
                                        type="checkbox"
                                        checked={
                                            this.state.options
                                                ?.rememberConnectedServer
                                        }
                                        onChange={this.handleInputChange}
                                    />
                                </div>
                                <div className="option__label">
                                    {_("optionsRememberConnectedServerLabel")}
                                </div>
                                <div className="option__description">
                                    {_(
                                        "optionsRememberConnectedServerDescription"
                                    )}
                                </div>
                            </label>
                        </label>

                        <hr />

                        <label className="option option--inline proxy-dns-option">
                            <div className="option__control">
                                <input
                                    name="proxyDns"
                                    type="checkbox"
                                    checked={this.state.options?.proxyDns}
                                    onChange={this.handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsProxyDnsLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsProxyDnsDescription")}
                            </div>
                        </label>

                        <hr />

                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="enableNotifications"
                                    type="checkbox"
                                    checked={
                                        this.state.options?.enableNotifications
                                    }
                                    onChange={this.handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsEnableNotificationsLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsEnableNotificationsDescription")}
                            </div>

                            <label className="option option--inline">
                                <div className="option__control">
                                    <input
                                        name="enableNotificationsOnlyErrors"
                                        type="checkbox"
                                        checked={
                                            this.state.options
                                                ?.enableNotificationsOnlyErrors
                                        }
                                        onChange={this.handleInputChange}
                                    />
                                </div>
                                <div className="option__label">
                                    {_(
                                        "optionsEnableNotificationsOnlyErrorsLabel"
                                    )}
                                </div>
                            </label>
                        </label>

                        <hr />

                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="enableIpv6Lookups"
                                    type="checkbox"
                                    checked={
                                        this.state.options?.enableIpv6Lookups
                                    }
                                    onChange={this.handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsEnableIpv6LookupsLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsEnableIpv6LookupsDescription")}
                            </div>
                        </label>

                        <hr />

                        <label className="option option--inline">
                            <div className="option__control">
                                <input
                                    name="enableDebugInfo"
                                    type="checkbox"
                                    checked={
                                        this.state.options?.enableDebugInfo
                                    }
                                    onChange={this.handleInputChange}
                                />
                            </div>
                            <div className="option__label">
                                {_("optionsEnableDebugInfoLabel")}
                            </div>
                            <div className="option__description">
                                {_("optionsEnableDebugInfoDescription")}
                            </div>
                        </label>

                        {this.state.browserType ===
                            utils.BrowserType.Firefox && (
                            <>
                                <hr />

                                <label className="option option--inline">
                                    <div className="option__control">
                                        <input
                                            name="enableExcludeList"
                                            type="checkbox"
                                            checked={
                                                this.state.options
                                                    ?.enableExcludeList
                                            }
                                            onChange={this.handleInputChange}
                                        />
                                    </div>
                                    <div className="option__label">
                                        {_("optionsEnableExcludeListLabel")}
                                    </div>

                                    <label className="option">
                                        <div className="option__label">
                                            {_("optionsExcludeListLabel")}
                                        </div>
                                        <div className="option__description">
                                            {_("optionsExcludeListDescription")}
                                        </div>
                                        <div className="option__control">
                                            <textarea
                                                name="excludeList"
                                                onChange={
                                                    this.handleExcludeListChange
                                                }
                                                value={this.state.options.excludeList.join(
                                                    "\n"
                                                )}
                                                rows={8}
                                            ></textarea>
                                        </div>
                                    </label>
                                </label>
                            </>
                        )}
                    </>
                )}

                <hr />

                <div className="buttons">
                    <button onClick={this.handleClearCache}>
                        {_("optionsClearCacheLabel")}
                    </button>
                    <button onClick={this.handleClearRecentServers}>
                        {_("optionsClearRecentServersLabel")}
                    </button>
                </div>
            </form>
        );
    }

    private handleClearCache() {
        localStorage.remove(["serverList", "serverListFrom"]);
    }

    private handleClearRecentServers() {
        localStorage.remove(["recentServers"]);
    }

    private handleInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.setState(currentState => {
            if (currentState.options) {
                (currentState.options as any)[ev.target.name] = getInputValue(
                    ev.target
                ) as boolean;

                this.saveOptions();
            }

            return currentState;
        });
    }

    private handleExcludeListChange(
        ev: React.ChangeEvent<HTMLTextAreaElement>
    ) {
        this.setState(currentState => {
            if (currentState.options) {
                if (ev.target.value === "") {
                    currentState.options.excludeList = [];
                }

                currentState.options.excludeList = ev.target.value.split("\n");
                this.saveOptions();
            }

            return currentState;
        });
    }

    private async saveOptions() {
        await options.setAll(this.state.options);
    }
}
