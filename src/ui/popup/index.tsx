"use strict";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import ReactDOM from "react-dom";
import afterFrame from "afterframe";

import localStorage from "../../localStorage";
import messages, { Message, MessengerPort, ProxyState } from "../../messages";

import logger from "../../lib/logger";
import options, { Options } from "../../lib/options";

import * as mullvadApi from "../../lib/mullvadApi";
import { getMinutesInMs } from "../../lib/utils";

import { OptionsPanel } from "./OptionsPanel";
import LoadingIndicator from "../LoadingIndicator";

import "../options/injectStyle";

const _ = browser.i18n.getMessage;

browser.runtime.getPlatformInfo().then(platformInfo => {
    if (platformInfo.os === "mac") {
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = "style-mac.css";

        document.head.append(linkElement);
    }
});

// Background script messaging
let port: MessengerPort;

const PopupApp = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isOptionsPanelOpen, setIsOptionsPanelOpen] = useState(false);

    const [proxyState, setProxyState] = useState<ProxyState>();

    const [connectionDetails, setConnectionDetails] =
        useState<mullvadApi.ConnectionDetails>();
    const [address6, setAddress6] = useState<string>();

    const [selectedCountry, setSelectedCountry] = useState<string>();
    const [selectedServer, setSelectedServer] = useState<string>();
    const [recentServers, setRecentServers] = useState<mullvadApi.Server[]>();

    const serverMap = useRef<Map<string, mullvadApi.Server[]>>(new Map());

    const pathOffsets = useRef<Map<string, [number, number]>>(new Map());
    const svgWrapperElement = useRef<HTMLDivElement>();
    const svgElement = useRef<SVGSVGElement>();

    const isViaWireguard = useMemo(
        () =>
            connectionDetails?.mullvad_server_type === "wireguard" ||
            connectionDetails?.mullvad_server_type ===
                "socks through wireguard",
        [connectionDetails]
    );

    const [opts, setOpts] = useState<Options>();
    useEffect(() => {
        options.getAll().then(setOpts);
        options.addEventListener("changed", () => {
            options.getAll().then(setOpts);
        });
    }, []);

    useEffect(() => {
        const req = new XMLHttpRequest();
        req.open("GET", "assets/world.svg", false);
        req.send();

        const wrapperElement = document.createElement("div");
        svgWrapperElement.current = wrapperElement;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const element = req.responseXML!.querySelector("svg")!;
        svgElement.current = element;

        wrapperElement.classList.add("svg-wrapper");
        wrapperElement.append(element);

        document.body.append(wrapperElement);

        afterFrame(() => {
            const wrapperRect = wrapperElement.getBoundingClientRect();

            for (const path of element.getElementsByTagName("path")) {
                const pathRect = path.getBoundingClientRect();

                // Normalize
                path.id = path.id.toLowerCase();

                pathOffsets.current.set(path.id, [
                    wrapperRect.x +
                        wrapperRect.width / 2 -
                        (pathRect.x + pathRect.width / 2),
                    wrapperRect.y +
                        wrapperRect.height / 2 -
                        (pathRect.y + pathRect.height / 2)
                ]);
            }
        });
    }, []);

    const focusCountry = useCallback((countryCode?: string) => {
        // If path offsets aren't found, focus on Sweden?
        if (!countryCode || !pathOffsets.current.has(countryCode)) {
            focusCountry("se");
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [translateX, translateY] = pathOffsets.current.get(countryCode)!;
        if (svgElement.current) {
            svgElement.current.style.transform = `translate(${translateX}px, ${translateY}px)`;
        }

        // Disable animation if reduced motion requested
        const reducedMotionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );
        if (reducedMotionQuery.matches) {
            if (svgElement.current && !svgElement.current.style.visibility) {
                svgElement.current.style.visibility = "visible";
            }

            return;
        }

        // Set transition only on first iteration after transform
        if (svgElement.current && !svgElement.current.style.transition) {
            afterFrame(() => {
                if (!svgElement.current) return;
                svgElement.current.style.transition = "transform 400ms ease";
                svgElement.current.style.visibility = "visible";
            });
        }
    }, []);

    useEffect(() => {
        function handleBackgroundMessage(message: Message) {
            switch (message.subject) {
                case "popup:/update":
                    setProxyState(prevProxyState => {
                        // Copy any available props
                        const newProxyState = { ...prevProxyState };
                        for (const key in message.data) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (newProxyState as any)[key] = (message.data as any)[
                                key
                            ];
                        }

                        return newProxyState;
                    });
                    break;
            }
        }

        port = messages.connect({ name: "background" });
        port.onMessage.addListener(handleBackgroundMessage);

        (async () => {
            let { serverList, serverListFrom } = await localStorage.get([
                "serverList",
                "serverListFrom"
            ]);

            // Cache for five minutes
            if (
                !serverList ||
                Date.now() - serverListFrom > getMinutesInMs(5)
            ) {
                serverList = await mullvadApi.fetchServerList();
                serverListFrom = Date.now();

                await localStorage.set({
                    serverList,
                    serverListFrom
                });
            }

            for (const server of serverList) {
                const countryServers =
                    serverMap.current.get(server.country_code) ?? [];

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

                serverMap.current.set(server.country_code, countryServers);
            }

            const { recentServers } = await localStorage.get("recentServers");
            recentServers?.forEach((server, i) => {
                const siblingServers = serverMap.current.get(
                    server.country_code
                );
                const matchingServer = siblingServers?.find(
                    sibling => sibling.socks_name === server.socks_name
                );

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

            setRecentServers(recentServers);
            setIsLoading(false);
        })();

        return () => {
            port.onMessage.removeListener(handleBackgroundMessage);
            port.disconnect();
        };
    }, []);

    const updateConnectionDetails = useCallback(async () => {
        if (!serverMap.current) {
            return;
        }

        setIsUpdating(true);

        let details: mullvadApi.ConnectionDetails;
        try {
            // Fetch connection details
            const detailsPromise = mullvadApi.fetchConnectionDetails();

            if (opts?.enableIpv6Lookups) {
                // Fetch IPv6 address if available
                try {
                    setAddress6(
                        await mullvadApi.fetchIpAddress(
                            mullvadApi.EndpointVariant.IPv6
                        )
                    );
                } catch (err) {
                    setAddress6(undefined);
                }
            } else {
                setAddress6(undefined);
            }

            details = await detailsPromise;
        } catch (err) {
            logger.error("Failed to fetch connection details!");
            setIsUpdating(false);
            return;
        }

        let matchingServer: mullvadApi.Server | undefined;
        let matchingCountry: string | undefined;
        for (const [, countryServers] of serverMap.current) {
            const match = countryServers.find(server =>
                proxyState?.host?.startsWith(server.socks_name)
            );

            if (match) {
                matchingServer = match;
                matchingCountry = matchingServer.country_code;
                break;
            }
        }

        // Handle current region addresses
        if (
            (!matchingServer &&
                proxyState?.host === mullvadApi.SOCKS_ADDRESS) ||
            proxyState?.host === mullvadApi.SOCKS_ADDRESS_WG
        ) {
            matchingCountry = details.mullvad_exit_ip_hostname?.slice(0, 2);
        }

        setSelectedCountry(matchingCountry);
        setSelectedServer(matchingServer?.socks_name);
        setConnectionDetails(details);
        setIsUpdating(false);
    }, [opts?.enableIpv6Lookups, proxyState?.host]);

    useEffect(() => {
        if (!proxyState?.isConnecting && serverMap) {
            updateConnectionDetails();
        }
    }, [proxyState, updateConnectionDetails]);

    useEffect(() => {
        if (!connectionDetails) return;
        const { mullvad_exit_ip_hostname } = connectionDetails;

        focusCountry(mullvad_exit_ip_hostname?.slice(0, 2));

        port.postMessage({
            subject: "background:/updateConnectionDetails",
            data: { details: connectionDetails }
        });
    }, [connectionDetails, focusCountry]);

    const handleCountryChange = useCallback(
        (ev: React.ChangeEvent<HTMLSelectElement>) => {
            // Handle recents
            if (ev.target.value.length > 2) {
                const matchingServer = recentServers?.find(
                    server => server.socks_name === ev.target.value
                );
                if (!matchingServer) return;

                setSelectedCountry(matchingServer.country_code);
                setSelectedServer(matchingServer.socks_name);
                return;
            }

            setSelectedCountry(ev.target.value);
            setSelectedServer(undefined);
        },
        [recentServers]
    );

    const handleServerChange = useCallback(
        (ev: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedServer(ev.target.value);
        },
        []
    );

    const handleConnectClick = useCallback(async () => {
        if (!connectionDetails) return;

        if (!isViaWireguard) {
            port.postMessage({
                subject: "background:/connect",
                data: {
                    proxyHost: mullvadApi.SOCKS_ADDRESS,
                    details: connectionDetails
                }
            });
        } else if (selectedServer) {
            port.postMessage({
                subject: "background:/connect",
                data: {
                    proxyHost: selectedServer,
                    details: connectionDetails
                }
            });
        }

        // Update recent servers
        if (selectedCountry) {
            const recentServers =
                (await localStorage.get("recentServers")).recentServers ?? [];

            const newRecentServer = serverMap.current
                ?.get(selectedCountry)
                ?.find(server => server.socks_name === selectedServer);

            if (newRecentServer) {
                // Remove existing to be repositioned
                const existingIndex = recentServers.findIndex(
                    server => server.socks_name === newRecentServer.socks_name
                );
                if (existingIndex !== -1) {
                    recentServers.splice(existingIndex, 1);
                }

                recentServers.unshift(newRecentServer);

                // Maintain max of three recent servers
                if (recentServers.length > 3) {
                    recentServers.pop();
                }

                await localStorage.set({ recentServers });
                setRecentServers(recentServers);
            }
        }
    }, [connectionDetails, isViaWireguard, selectedCountry, selectedServer]);

    const handleDisconnectClick = useCallback(() => {
        setSelectedCountry(undefined);
        setSelectedServer(undefined);
        port.postMessage({
            subject: "background:/disconnect"
        });
    }, []);

    useEffect(() => {
        if (!selectedServer || selectedServer === proxyState?.host) return;
        options.get("enableQuickConnect").then(isQuickConnectEnabled => {
            if (isQuickConnectEnabled && selectedServer) {
                handleConnectClick();
            }
        });
    }, [handleConnectClick, proxyState?.host, selectedServer]);

    const onOptionsPanelOpen = useCallback(() => {
        setIsOptionsPanelOpen(true);
    }, []);
    const onOptionsPanelClose = useCallback(() => {
        setIsOptionsPanelOpen(false);
    }, []);

    function renderConnectionInfo() {
        let connectionClassName = "connection";
        if (isLoading) {
            connectionClassName += " connection--loading";
        }

        return (
            <div className={connectionClassName}>
                <button
                    className="options-button"
                    onClick={onOptionsPanelOpen}
                    title={_("optionsPanelOpen")}
                ></button>
                {isLoading ? (
                    <div className="loader" title={_("popupLoading")} />
                ) : (
                    <>
                        <div
                            className={`connection__status ${
                                proxyState?.isConnected
                                    ? "connection__status--connected"
                                    : proxyState?.isConnecting
                                    ? "connection__status--connecting"
                                    : "connection__status--not-connected"
                            }`}
                        >
                            {proxyState?.isConnected ? (
                                <>
                                    {_("popupConnectionStatusConnected")}
                                    <a
                                        className="connection__info"
                                        href={mullvadApi.CHECK_URL}
                                        title={
                                            isViaWireguard
                                                ? _(
                                                      "popupConnectionTypeWireGuard"
                                                  )
                                                : _(
                                                      "popupConnectionTypeOpenVPN"
                                                  )
                                        }
                                    ></a>
                                </>
                            ) : proxyState?.isConnecting ? (
                                <LoadingIndicator
                                    text={_("popupConnectionStatusConnecting")}
                                />
                            ) : (
                                _("popupConnectionStatusNotConnected")
                            )}
                        </div>

                        {isUpdating ? (
                            <div className="loader" title={_("popupLoading")} />
                        ) : (
                            <>
                                {connectionDetails?.city && (
                                    <div className="connection__city">
                                        {connectionDetails.city}
                                    </div>
                                )}
                                <div className="connection__country">
                                    {connectionDetails?.country}
                                </div>

                                <div
                                    className="connection__ip connection__ip--v4"
                                    title={_("popupConnectionIpv4Title")}
                                >
                                    {connectionDetails?.ip}
                                </div>
                                {address6 && (
                                    <div
                                        className="connection__ip connection__ip--v6"
                                        title={_("popupConnectionIpv6Title")}
                                    >
                                        {address6}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        );
    }

    function renderSelectionUI() {
        return (
            <fieldset
                className="selection"
                // Disabled if not in a usable state
                disabled={
                    isLoading || proxyState?.isConnecting || !serverMap.current
                }
            >
                <select
                    className={`selection__country ${
                        !selectedCountry && "selection__country--default"
                    }`}
                    title={_("popupSelectionCountryPlaceholder")}
                    value={selectedCountry}
                    onChange={handleCountryChange}
                >
                    {/* Country placeholder */}
                    <option selected={!selectedCountry} disabled>
                        {_("popupSelectionCountryPlaceholder")}
                    </option>

                    {recentServers && (
                        <optgroup
                            label={_("popupSelectionCountryRecentServers")}
                        >
                            {recentServers.map(server => (
                                <option
                                    value={server.socks_name}
                                    key={server.socks_name}
                                >
                                    {server.country_name} (
                                    {mullvadApi.getShortSocksName(
                                        server.socks_name
                                    )}
                                    )
                                </option>
                            ))}
                        </optgroup>
                    )}

                    {serverMap.current &&
                        Array.from(serverMap.current.entries()).map(
                            ([countryCode, server], i) => (
                                <option value={countryCode} key={i}>
                                    {server[0].country_name}
                                </option>
                            )
                        )}
                </select>

                <select
                    className={`selection__server ${
                        !selectedServer && "selection__server--default"
                    }`}
                    title={_("popupSelectionServerPlaceholder")}
                    disabled={!selectedCountry}
                    value={selectedServer}
                    onChange={handleServerChange}
                >
                    {/* Server placeholder */}
                    <option
                        selected={!selectedServer}
                        disabled={!opts?.enableQuickConnect}
                    >
                        {_("popupSelectionServerPlaceholder")}
                    </option>

                    {selectedCountry &&
                        serverMap.current
                            ?.get(selectedCountry)
                            ?.map((server, i) => (
                                <option value={server.socks_name} key={i}>
                                    {mullvadApi.getShortSocksName(
                                        server.socks_name
                                    )}{" "}
                                    ({server.city_name})
                                </option>
                            ))}
                </select>

                {!opts?.enableQuickConnect && (
                    <button
                        className="selection__connect"
                        /**
                         * Enable connect button only if a server that isn't the
                         * current server is selected.
                         */
                        disabled={
                            !(
                                selectedServer &&
                                selectedServer !== proxyState?.host
                            )
                        }
                        onClick={handleConnectClick}
                    >
                        {_("popupSelectionConnect")}
                    </button>
                )}
            </fieldset>
        );
    }

    const connectingOrConnected =
        proxyState?.isConnecting || proxyState?.isConnected;

    return (
        <>
            {renderConnectionInfo()}
            {isViaWireguard && renderSelectionUI()}

            <fieldset className="control">
                {/**
                 * If user is connected via OpenVPN, the connect button is
                 * displayed in place of a disabled disconnect button (instead
                 * of under the server selection UI) whilst the user isn't
                 * connected/connecting to a proxy.
                 */}
                {connectionDetails &&
                !isViaWireguard &&
                !connectingOrConnected ? (
                    <button
                        className="control__connect"
                        onClick={handleConnectClick}
                        disabled={isLoading}
                    >
                        {_("popupConnect")}
                    </button>
                ) : (
                    <button
                        className="control__disconnect"
                        onClick={handleDisconnectClick}
                        disabled={!connectingOrConnected}
                    >
                        {_("popupDisconnect")}
                    </button>
                )}
            </fieldset>

            <OptionsPanel
                open={isOptionsPanelOpen}
                onClose={onOptionsPanelClose}
            />
        </>
    );
};

ReactDOM.render(<PopupApp />, document.body);
