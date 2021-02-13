"use strict";

import React from "react";
import ReactDOM from "react-dom";
import afterFrame from "afterframe";

import messages from "../../messages";

import logger from "../../lib/logger";
import options from "../../lib/options";

import { getMinutesInMs } from "../../lib/utils";
import * as mullvadApi from "../../lib/mullvadApi";
import { TypedStorageArea } from "../../lib/TypedStorageArea";

import { OptionsPanel } from "./options/OptionsPanel";


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

const localStorage = new TypedStorageArea<{
    serverList: mullvadApi.Server[];
    serverListFrom: number;
    recentServers: mullvadApi.Server[];
}>(browser.storage.local);


interface PopupAppState {
    isLoading: boolean;
    isUpdating: boolean;

    isOptionsPanelOpen: boolean;

    proxy?: {
        isConnected: boolean;
        isConnecting: boolean;
        host?: string;
    };

    connectionDetails?: mullvadApi.ConnectionDetails;

    selectedCountry?: string;
    selectedServer?: string;
    recentServers: mullvadApi.Server[];
}

class PopupApp extends React.Component<
        {}, PopupAppState> {

    state: PopupAppState = {
        isLoading: true
      , isUpdating: false
      , isOptionsPanelOpen: false
      , proxy: {
            isConnected: false
          , isConnecting: false
        }
      , recentServers: []
    };


    private serverMap?: Map<string, mullvadApi.Server[]>;

    private pathOffsets = new Map<string, [number, number]>();
    private svgWrapper: HTMLDivElement;
    private svgElement: SVGSVGElement;

    constructor (props: {}) {
        super(props);

        const req = new XMLHttpRequest();
        req.open("GET", "assets/world.svg", false);
        req.send();

        const svgWrapper = document.createElement("div");
        const svgElement = req.responseXML!.querySelector("svg")!;

        svgWrapper.classList.add("svg-wrapper");
        svgWrapper.append(svgElement);
        document.body.append(svgWrapper);

        afterFrame(() => {
            const wrapperRect = svgWrapper.getBoundingClientRect();
            const svgRect = svgElement.getBoundingClientRect();

            for (const path of svgElement.children) {
                const pathRect = path.getBoundingClientRect();

                // Normalize
                path.id = path.id.toLowerCase();

                this.pathOffsets.set(path.id, [
                    ((wrapperRect.x + (wrapperRect.width / 2))
                            - (pathRect.x + (pathRect.width / 2)))
                  , ((wrapperRect.y + (wrapperRect.height / 2))
                            - (pathRect.y + (pathRect.height / 2)))
                ]);
            }
        });

        this.svgWrapper = svgWrapper;
        this.svgElement = svgElement;


        // Event handlers
        this.handleCountryChange = this.handleCountryChange.bind(this);
        this.handleServerChange = this.handleServerChange.bind(this);

        this.handleConnectClick = this.handleConnectClick.bind(this);
        this.handleDisconnectClick = this.handleDisconnectClick.bind(this);

        this.onOptionsPanelClose = this.onOptionsPanelClose.bind(this);
        this.onOptionsPanelOpen = this.onOptionsPanelOpen.bind(this);
    }

    private focusCountry (countryCode: string) {
        if (!this.pathOffsets.has(countryCode)) {
            return;
        }

        const [ translateX, translateY ] =
                this.pathOffsets.get(countryCode)!;

        this.svgElement.style.transform =
                `translate(${translateX}px, ${translateY}px)`;

        // Disable animation if reduced motion requested
        const reducedMotionQuery = window.matchMedia(
                "(prefers-reduced-motion: reduce)");
        if (!reducedMotionQuery.matches) {
            return;
        }

        // Set transition only on first iteration after transform
        if (!this.svgElement.style.transition) {
            afterFrame(() => {
                this.svgElement.style.transition = "transform 400ms ease";
                this.svgElement.style.visibility = "visible";
            });
        }
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
                        if (!this.state.proxy?.isConnecting && this.serverMap) {
                            this.updateConnectionDetails();
                        }
                    });

                    break;
                }
            }
        });


        let { serverList, serverListFrom } = await localStorage.get(
                [ "serverList", "serverListFrom" ]);

        // Cache for five minutes
        if (!serverList || (Date.now() - serverListFrom) > getMinutesInMs(5)) {
            serverList = await mullvadApi.fetchServerList();
            serverListFrom = Date.now();

            await localStorage.set({
                serverList
              , serverListFrom
            });
        }


        const serverMap = new Map<string, mullvadApi.Server[]>();

        for (const server of serverList) {
            let countryServers = serverMap.get(server.country_code) ?? [];

            if (!server.active) {
                continue;
            }

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


        const { recentServers } = await localStorage.get("recentServers");
        recentServers?.forEach((server, i) => {
            const siblingServers = serverMap.get(server.country_code);
            const matchingServer = siblingServers?.find(
                    sibling => sibling.socks_name === server.socks_name);

            /**
             * If recent server cannot be found, remove it, else update
             * with newer info.
             */
            if (!matchingServer) {
                recentServers.splice(i, 1);
            } else {
                recentServers.splice(i, 1, matchingServer);
            }
        });


        this.serverMap = serverMap;


        this.setState({
            recentServers
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

        const connectingOrConnected =
                this.state.proxy?.isConnected
             || this.state.proxy?.isConnecting;

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
                                ? <>
                                      { _("popupConnectionStatusConnected") }
                                      <div className="connection__info"
                                           title={ this.isViaWireGuard()
                                               ? _("popupConnectionTypeWireGuard")
                                               : _("popupConnectionTypeOpenVPN") }></div>
                                  </>
                                : this.state.proxy?.isConnecting
                                    ? <LoadingIndicator text={
                                              _("popupConnectionStatusConnecting") } />
                                    : _("popupConnectionStatusNotConnected") }
                        </div>

                        { this.state.isUpdating
                            ? <div className="loader"
                                   title={ _("popupLoading") } />
                            : <>
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
                    </> }
            </div>

            { this.isViaWireGuard() &&
                <fieldset className="selection"
                          // Disabled if not in a usable state
                          disabled={ this.state.isLoading
                                  || this.state.proxy?.isConnecting
                                  || !this.serverMap }>

                    <select className={ `selection__country ${
                                !this.state.selectedCountry && "selection__country--default"}` }
                            title={ _("popupSelectionCountryPlaceholder") }
                            value={ this.state.selectedCountry }
                            onChange={ this.handleCountryChange }>

                        { /* Country placeholder */ }
                        <option selected={ !this.state.selectedCountry }
                                disabled>
                            { _("popupSelectionCountryPlaceholder") }
                        </option>

                        { this.state.recentServers &&
                            <optgroup label={ _("popupSelectionCountryRecentServers") }>
                                { this.state.recentServers.map(server =>
                                    <option value={ server.socks_name }>
                                        { server.country_name } ({ server.socks_name })
                                    </option>) }
                            </optgroup> }

                        { this.serverMap && Array.from(
                                this.serverMap.entries()).map(([countryCode, server], i) =>
                            <option value={ countryCode } key={i}>
                                { server[0].country_name }
                            </option> )}
                    </select>

                    <select className={ `selection__server ${
                                !this.state.selectedServer && "selection__server--default"}` }
                            title={ _("popupSelectionServerPlaceholder") }
                            disabled={ !this.state.selectedCountry }
                            value={ this.state.selectedServer }
                            onChange={ this.handleServerChange }>

                        { /* Server placeholder */ }
                        <option selected={ !this.state.selectedServer }
                                disabled>
                            { _("popupSelectionServerPlaceholder") }
                        </option>

                        { this.state.selectedCountry && this.serverMap?.get(
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
                </fieldset> }

            <fieldset className="control">
                { /**
                   * If user is connected via OpenVPN, the connect button is
                   * displayed in place of a disabled disconnect button (instead
                   * of under the server selection UI) whilst the user isn't
                   * connected/connecting to a proxy.
                   */ }
                { (this.state.connectionDetails && !this.isViaWireGuard())
                        && !connectingOrConnected
                    ? <button className="control__connect"
                              onClick={ this.handleConnectClick }
                              disabled={ this.state.isLoading }>
                        { _("popupConnect") }
                    </button>
                    : <button className="control__disconnect"
                              onClick={ this.handleDisconnectClick }
                              disabled={ !connectingOrConnected }>
                        { _("popupDisconnect") }
                    </button> }
            </fieldset>

            <OptionsPanel open={ this.state.isOptionsPanelOpen }
                          onClose={ this.onOptionsPanelClose } />
            <button className="options-button"
                    onClick={ this.onOptionsPanelOpen }
                    title={ _("optionsPanelOpen") }>
            </button>
        </>;
    }

    private isViaWireGuard () {
        return this.state.connectionDetails?.mullvad_server_type === "wireguard"
            || this.state.connectionDetails?.mullvad_server_type === "socks through wireguard"
    }

    private async updateConnectionDetails () {
        if (!this.serverMap) {
            return;
        }

        this.setState({ isUpdating: true });

        let details: mullvadApi.ConnectionDetails;
        try {
            details = await mullvadApi.fetchConnectionDetails();
        } catch (err) {
            logger.error("Failed to fetch connection details!");
            this.setState({ isUpdating: false });
            return;
        }

        let matchingServer: mullvadApi.Server | undefined;
        for (const [, countryServers ] of this.serverMap) {
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
          , isUpdating: false
        }, () => {
            if (this.state.connectionDetails) {
                this.focusCountry(mullvadApi.COUNTRY_NAME_MAP[
                        this.state.connectionDetails.country]);

                port.postMessage({
                    subject: "background:/updateConnectionDetails"
                  , data: {
                        details: this.state.connectionDetails
                    }
                });
            }
        });
    }

    private handleCountryChange (
            ev: React.ChangeEvent<HTMLSelectElement>) {

        // Handle recents
        if (ev.target.value.length > 2) {
            const matchingServer = this.state.recentServers.find(
                    server => server.socks_name === ev.target.value);

            if (!matchingServer) {
                return;
            }

            this.setState({
                selectedCountry: matchingServer.country_code
              , selectedServer: matchingServer.socks_name
            });

            return;
        }

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


    private async handleConnectClick () {
        if (!this.state.connectionDetails) {
            return;
        }

        if (!this.isViaWireGuard()) {
            port.postMessage({
                subject: "background:/connect"
              , data: {
                    proxyHost: mullvadApi.SOCKS_ADDRESS
                  , details: this.state.connectionDetails
                }
            })
        } else if (this.state.selectedServer) {
            port.postMessage({
                subject: "background:/connect"
              , data: {
                    proxyHost: this.state.selectedServer
                  , details: this.state.connectionDetails
                }
            });
        }

        // Update recent servers
        if (this.state.selectedCountry) {
            const recentServers = (await localStorage
                    .get("recentServers")).recentServers ?? [];

            const newRecentServer = this.serverMap
                ?.get(this.state.selectedCountry)
                ?.find(server => server.socks_name
                             === this.state.selectedServer);

            if (newRecentServer) {
                // Remove existing to be repositioned
                const existingIndex = recentServers.findIndex(server =>
                        server.socks_name === newRecentServer.socks_name);
                if (existingIndex !== -1) {
                    recentServers.splice(existingIndex, 1);
                }

                recentServers.unshift(newRecentServer);

                // Maintain max of three recent servers
                if (recentServers.length > 3) {
                    recentServers.pop();
                }

                await localStorage.set({ recentServers });
                this.setState({ recentServers });
            }
        }
    }

    private handleDisconnectClick () {
        port.postMessage({
            subject: "background:/disconnect"
        });
    }

    private onOptionsPanelOpen () {
        this.setState({ isOptionsPanelOpen: true });
    }
    private onOptionsPanelClose () {
        this.setState({ isOptionsPanelOpen: false });
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
