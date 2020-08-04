"use strict";

import React from "react";
import ReactDOM from "react-dom";

import messages from "../messages";

import logger from "../lib/logger";
import * as mullvadApi from "../lib/mullvadApi";
import { TypedStorageArea } from "../lib/TypedStorageArea";


const _ = browser.i18n.getMessage;


browser.runtime.getPlatformInfo()
    .then(platformInfo => {
        if (platformInfo.os === "mac") {
            const linkElement = document.createElement("link");
            linkElement.rel = "stylesheet";
            linkElement.href = "style-mac.css";

            document.head.append(linkElement);
        }
    });


// Background script messaging
let port: ReturnType<typeof messages.connect>;


interface PopupAppState {
    isLoading: boolean;

    proxy?: {
        isConnected: boolean;
        isConnecting: boolean;
        host?: string;
    };

    connectionDetails?: mullvadApi.ConnectionDetails;

    serverMap?: Map<string, mullvadApi.Server[]>;
    selectedCountry?: string;
    selectedServer?: string;
}

class PopupApp extends React.Component<
        {}, PopupAppState> {

    constructor (props: {}) {
        super(props);

        this.state = {
            isLoading: true
          , proxy: {
                isConnected: false
              , isConnecting: false
            }
        };

        // Event handlers
        this.handleCountryChange = this.handleCountryChange.bind(this);
        this.handleServerChange = this.handleServerChange.bind(this);

        this.handleConnectClick = this.handleConnectClick.bind(this);
        this.handleDisconnectClick = this.handleDisconnectClick.bind(this);
    }

    async componentDidMount () {
        port = messages.connect({
            name: "background"
        });

        port.onMessage.addListener(message => {
            switch (message.subject) {

                case "popup:/update": {
                    this.setState(prevState => {
                        if (!prevState.proxy) {
                            return prevState;
                        }

                        // Copy any available props
                         for (const key in message.data) {
                            (prevState.proxy as any)[key] =
                                    (message.data as any)[key];
                        }

                        return prevState;
                    }, () => {
                        if (this.state.proxy?.isConnected && this.state.serverMap) {
                            this.updateConnectionDetails();
                        }
                    });

                    break;
                }
            }
        });


        const localStorage = new TypedStorageArea<{
            serverList: mullvadApi.Server[]
          , serverListFrom: number;
        }>(browser.storage.local);

        let { serverList, serverListFrom } = await localStorage.get(
                [ "serverList", "serverListFrom" ]);

        // Cache for five minutes
        if (!serverList || (Date.now() - serverListFrom) > 300000) {
            serverList = await mullvadApi.fetchServerList();
            serverListFrom = Date.now();

            await localStorage.set({
                serverList
              , serverListFrom
            });
        }


        const serverMap = new Map<string, mullvadApi.Server[]>();

        for (const server of serverList) {
            let countryServers = serverMap.get(
                    server.country_code) ?? [];

            countryServers.push(server);

            /**
             * By default, servers are sorted by hostnames as strings, but
             * this doesn't work for multi-digit numbers (se-1, se-10,
             * se-11, se-2, se-3, etc...), so we need to extract the IDs to
             * use as sorting keys.
             */
            countryServers.sort((a, b) => {
                const aId = mullvadApi.getServerIdFromHost(a.hostname);
                const bId = mullvadApi.getServerIdFromHost(b.hostname);

                if (aId < bId) return -1;
                if (aId > bId) return 1;

                return 0;
            });

            serverMap.set(server.country_code, countryServers);
        }

        this.setState({
            serverMap
          , isLoading: false
        }, () => {
            this.updateConnectionDetails();
        });
    }

    render () {
        let connectionClassName = "connection";
        if (this.state.isLoading) {
            connectionClassName += " connection--loading";
        }

        return <>
            <div className={ connectionClassName }>
                { this.state.isLoading
                    ? <div className="loader"
                           title={ _("popupLoading") } />
                    : <>
                        <div className={`connection__status ${
                                this.state.proxy?.isConnected
                                    ? "connection__status--connected"
                                    : this.state.proxy?.isConnecting
                                        ? "connection__status--connecting"
                                        : "connection__status--not-connected"}`}>
                            { this.state.proxy?.isConnected
                                ? _("popupConnectionStatusConnected")
                                : this.state.proxy?.isConnecting
                                    ? <LoadingIndicator text={
                                              _("popupConnectionStatusConnecting") } />
                                    : _("popupConnectionStatusNotConnected") }
                        </div>

                        { this.state.connectionDetails?.city &&
                            <div className="connection__city">
                                { this.state.connectionDetails.city }
                            </div> }

                        <div className="connection__country">
                            { this.state.connectionDetails?.country }
                        </div>

                        <div className="connection__ip" title="IP address">
                            { this.state.connectionDetails?.ip }
                        </div>
                    </> }
            </div>

            <fieldset className="selection"
                  disabled={ this.state.isLoading
                          || this.state.proxy?.isConnecting
                          || !this.state.serverMap
                             /**
                              * Alternate proxy servers are only accessible when
                              * connected to a WireGuard VPN server.
                              */
                          || (this.state.connectionDetails?.mullvad_server_type !== "wireguard"
                           && this.state.connectionDetails?.mullvad_server_type !== "socks through wireguard") }>

                <select className="selection__country"
                        value={ this.state.selectedCountry }
                        onChange={ this.handleCountryChange }>

                    { /* placeholder */ }
                    <option selected={ !this.state.selectedCountry }
                            disabled>
                        { _("popupSelectionCountryPlaceholder") }
                    </option>

                    { this.state.serverMap && Array.from(
                            this.state.serverMap.entries()).map(([countryCode, server], i) =>
                        <option value={ countryCode } key={i}>
                            { server[0].country_name }
                        </option> )}
                </select>

                <select className="selection__server"
                        disabled={ !this.state.selectedCountry }
                        value={ this.state.selectedServer }
                        onChange={ this.handleServerChange }>

                    { /* placeholder */ }
                    <option selected={ !this.state.selectedServer }
                            disabled>
                        { _("popupSelectionServerPlaceholder") }
                    </option>

                    { this.state.selectedCountry && this.state.serverMap?.get(
                            this.state.selectedCountry)?.map((server, i) => 
                        <option value={ server.socks_name } key={i}>
                            { server.socks_name } ({ server.city_name })
                        </option> )}
                </select>

                <button className="selection__connect"
                        /**
                         * Enable connect button only if a server that isn't the
                         * current server is selected.
                         */
                        disabled={ !(this.state.selectedServer && (
                                this.state.selectedServer !== this.state.proxy?.host)) }
                        onClick={ this.handleConnectClick }>
                    { _("popupSelectionConnect") }
                </button>
            </fieldset>

            <fieldset className="control"
                      disabled={ this.state.isLoading }>
                <button className="control__disconnect"
                        onClick={ this.handleDisconnectClick }
                        disabled={ !this.state.proxy?.isConnected
                                && !this.state.proxy?.isConnecting }>
                    { _("popupDisconnect") }
                </button>
            </fieldset>
        </>;
    }


    private async updateConnectionDetails () {
        if (!this.state.serverMap) {
            return;
        }

        let details: mullvadApi.ConnectionDetails;
        try {
            details = await mullvadApi.fetchConnectionDetails();
        } catch (err) {
            logger.error("Failed to fetch connection details!");
            return;
        }

        let matchingServer: mullvadApi.Server | undefined;
        for (const [, countryServers ] of this.state.serverMap) {
            const match = countryServers.find(server =>
                    this.state.proxy?.host?.startsWith(server.socks_name));

            if (match) {
                matchingServer = match;
                break;
            }
        }

        this.setState({
            selectedCountry: matchingServer?.country_code
          , selectedServer: matchingServer?.socks_name
          , connectionDetails: details
        });
    }


    private handleCountryChange (
            ev: React.ChangeEvent<HTMLSelectElement>) {

        this.setState({
            selectedCountry: ev.target.value
          , selectedServer: undefined
        });
    }

    private handleServerChange (
            ev: React.ChangeEvent<HTMLSelectElement>) {

        this.setState({
            selectedServer: ev.target.value
        });
    }


    private handleConnectClick () {
        if (this.state.selectedServer && this.state.connectionDetails) {
            port.postMessage({
                subject: "background:/connect"
              , data: {
                    proxyHost: this.state.selectedServer
                  , details: this.state.connectionDetails
                }
            });
        }
    }

    private handleDisconnectClick () {
        port.postMessage({
            subject: "background:/disconnect"
        });

        this.updateConnectionDetails();
    }
}



interface LoadingIndicatorProps {
    text: string;
    duration?: number;
}
interface LoadingIndicatorState {
    ellipsis: string;
}

class LoadingIndicator extends React.Component<
        LoadingIndicatorProps, LoadingIndicatorState> {

    constructor (props: LoadingIndicatorProps) {
        super(props);
        this.state = {
            ellipsis: ""
        };

        setInterval(() => {
            this.setState(prevState => ({
                ellipsis: this.getNextEllipsis(prevState.ellipsis)
            }));
        }, this.props.duration ?? 500);
    }

    render () {
        return <div className="loading">
            { this.props.text }
            { this.state.ellipsis }
        </div>;
    }

    private getNextEllipsis (ellipsis: string) {
        /* tslint:disable:curly */
        if (ellipsis === "") return ".";
        if (ellipsis === ".") return "..";
        if (ellipsis === "..") return "...";
        if (ellipsis === "...") return "";
        /* tslint:enable:curly */

        return "";
    }
}



ReactDOM.render(<PopupApp />, document.body);
