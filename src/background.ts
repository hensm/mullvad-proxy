"use strict";

import logger from "./lib/logger";
import options from "./lib/options";

import * as utils from "./lib/utils";
import * as mullvadApi from "./lib/mullvadApi";

import localStorage from "./localStorage";
import messages from "./messages";

const _ = browser.i18n.getMessage;

browser.runtime.onInstalled.addListener(async details => {
    switch (details.reason) {
        // Implicit defaults
        case "install": {
            await options.setAll();

            // Init after defaults set
            init();
            break;
        }
        case "update": {
            await options.update();
            break;
        }
    }
});

type CreateNotificationOptions =
    browser.notifications.CreateNotificationOptions;

// If proxy connected successfully
const notifConnectionSucceeded = (
    host = "host"
): CreateNotificationOptions => ({
    title: _("notificationConnectionSucceededTitle"),
    message: _("notificationConnectionSucceededMessage", host),
    type: "basic",
    iconUrl: "icons/icons8-ok-120.png"
});

// If proxy server is unreachable or misc connection error
const notifConnectionFailed = (host = "host"): CreateNotificationOptions => ({
    title: _("notificationConnectionFailedTitle"),
    message: _("notificationConnectionFailedMessage", host),
    type: "basic",
    iconUrl: "icons/icons8-warn-120.png"
});

// If user is not connected to a Mullvad VPN server
const notifConnectionFailedNonMullvad = (): CreateNotificationOptions => ({
    title: _("notificationConnectionFailedTitle"),
    message: _("notificationConnectionFailedMessageNonMullvad"),
    type: "basic",
    iconUrl: "icons/icons8-warn-120.png"
});

// If proxy is manually disconnected
const notifConnectionDisconnected = (
    host = "host"
): CreateNotificationOptions => ({
    title: _("notificationConnectionDisconnectedTitle"),
    message: _("notificationConnectionDisconnectedMessage", host),
    type: "basic",
    iconUrl: "icons/icons8-cancel-120.png"
});

let lastNotificationId: string;
async function showNotification(createOptions: CreateNotificationOptions) {
    const { enableNotifications, enableNotificationsOnlyErrors } =
        await options.getAll();

    if (!enableNotifications) {
        return;
    }

    // Limit to error notifications if opt enabled
    if (
        enableNotificationsOnlyErrors &&
        createOptions.title !== _("notificationConnectionFailedTitle")
    ) {
        return;
    }

    if (lastNotificationId) {
        browser.notifications.clear(lastNotificationId);
    }

    lastNotificationId = await browser.notifications.create(createOptions);
    return lastNotificationId;
}

let isChromium: boolean;
const { chrome } = window as any;

// Current proxy details
let proxy: browser.proxy.ProxyType | null;
let proxyConnecting = false;
let proxyAbortController = new AbortController();

let excludeList: string[] = [];

options.addEventListener("changed", async ev => {
    if (
        ev.detail.includes("enableExcludeList") ||
        ev.detail.includes("excludeList")
    ) {
        const opts = await options.getAll();

        if (opts.enableExcludeList) {
            excludeList = opts.excludeList;
            return;
        }

        excludeList = [];
    }
});

function onProxyRequest(details: browser.proxy._OnRequestDetails) {
    // Check patterns against request URLs
    for (const host of excludeList) {
        if (new URL(details.url).host === host) {
            return;
            // Also ignore requests to be loaded into an excluded host
        } else if (
            details.documentUrl &&
            new URL(details.documentUrl).host === host
        ) {
            return;
        }
    }

    return proxy;
}

function onProxyError(...args: any[]) {
    logger.error("Proxy error!", args);
    showNotification(notifConnectionFailed(proxy?.host));
    disableProxy();
}

/**
 * Checks current connection is valid and sets up proxy request
 * listener (or in Chromium, sets the browser proxy settings).
 * If client isn't connected via Mullvad, proxy connection is
 * aborted and user is notified.
 */
async function enableProxy(
    host: string,
    details: mullvadApi.ConnectionDetails
) {
    if (proxyConnecting) {
        return;
    }

    logger.info("Connecting...");

    /**
     * Mullvad SOCKS5 proxy servers do not require authentication,
     * since they're siloed within the network and accessible only
     * to authenticated users already.
     */
    proxy = {
        type: "socks",
        host: host,
        port: mullvadApi.SOCKS_PORT,
        proxyDNS: await options.get("proxyDns")
    };

    proxyConnecting = true;

    // Quit if not connected to a Mullvad server
    if (!details.mullvad_exit_ip) {
        logger.error("Not connected via Mullvad!");
        showNotification(notifConnectionFailedNonMullvad());
        await disableProxy();
        return;
    }

    /**
     * Firefox uses a request-based proxy API that allows more
     * granular control over which requests are proxied, whereas
     * Chrome is more limited, only allowing basic, declarative
     * customizations.
     */
    if (isChromium) {
        logger.info("Proxy registered", proxy);

        chrome.proxy.onProxyError.addListener(onProxyError);
        chrome.proxy.settings.set({
            scope: "regular",
            value: {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "socks5",
                        host: proxy.host,
                        port: parseInt(proxy.port)
                    }
                }
            }
        });
    } else {
        logger.info("Proxy registered", proxy);

        browser.proxy.onError.addListener(onProxyError);
        browser.proxy.onRequest.addListener(onProxyRequest, {
            urls: ["<all_urls>"]
        });
    }

    try {
        // Request to trigger proxy
        const address = await mullvadApi.fetchIpAddress(
            mullvadApi.EndpointVariant.IPv4,
            {
                signal: proxyAbortController.signal
            }
        );

        logger.info(`IP address: ${address}`);

        showNotification(notifConnectionSucceeded(proxy.host));

        browser.browserAction.setIcon({
            path: {
                16: "icons/locked-16.png",
                24: "icons/locked-24.png",
                32: "icons/locked-32.png"
            }
        });

        proxyConnecting = false;
    } catch (err) {
        // Only handle request errors for the current fetch
        if (proxy?.host === host) {
            logger.error("Proxy request failed!");
            showNotification(notifConnectionFailed(proxy.host));

            await disableProxy();
        }
    }
}

/**
 * Removes proxy request listener, (or in Chromium, clears the
 * browser proxy settings).
 */
async function disableProxy(notify = false) {
    if (notify) {
        showNotification(notifConnectionDisconnected(proxy?.host));
    }

    browser.browserAction.setIcon({
        path: {
            "16": "icons/unlocked-16.png",
            "24": "icons/unlocked-24.png",
            "32": "icons/unlocked-32.png"
        }
    });

    browser.browserAction.setBadgeText({
        text: null
    });

    if (isChromium) {
        await new Promise(resolve => {
            chrome.proxy.onProxyError.removeListener(onProxyError);
            chrome.proxy.settings.clear(
                {
                    scope: "regular"
                },
                resolve
            );
        });
    } else {
        browser.proxy.onError.removeListener(onProxyError);
        browser.proxy.onRequest.removeListener(onProxyRequest);
    }

    proxy = null;
    proxyConnecting = false;
    proxyAbortController.abort();
    proxyAbortController = new AbortController();
}

function updateBadgeText(countryCode: string) {
    if (proxy && !proxyConnecting) {
        browser.browserAction.setBadgeText({
            text: countryCode.toUpperCase()
        });
    }
}

messages.onConnect.addListener(port => {
    if (port.name !== "background") {
        return;
    }

    let isPortConnected = true;
    port.onDisconnect.addListener(() => {
        isPortConnected = false;
    });

    function sendPopupUpdate() {
        if (!isPortConnected) {
            return;
        }

        port.postMessage({
            subject: "popup:/update",
            data: {
                isConnected: !!proxy && !proxyConnecting,
                isConnecting: proxyConnecting,
                host: proxy?.host
            }
        });
    }

    port.onMessage.addListener(async message => {
        switch (message.subject) {
            case "background:/connect": {
                const IP_ADDR_REGEX = /(?:\d{1,3}\.){3}\d{1,3}/;
                const host = IP_ADDR_REGEX.test(message.data.proxyHost)
                    ? message.data.proxyHost
                    : mullvadApi.getFullSocksHost(message.data.proxyHost);

                if (isPortConnected) {
                    port.postMessage({
                        subject: "popup:/update",
                        data: {
                            isConnected: false,
                            isConnecting: true
                        }
                    });
                }

                await enableProxy(host, message.data.details);
                sendPopupUpdate();
                break;
            }

            case "background:/disconnect": {
                await disableProxy(true);
                sendPopupUpdate();
                break;
            }

            case "background:/updateConnectionDetails": {
                updateBadgeText(
                    mullvadApi.COUNTRY_NAME_MAP[message.data.details.country]
                );
                break;
            }
        }
    });

    sendPopupUpdate();
});

let isInitialized = false;

async function init() {
    if (isInitialized) {
        return;
    }

    // Options not set yet
    const opts = await options.getAll();
    if (!opts) {
        return;
    }

    isInitialized = true;

    if (opts.enableExcludeList) {
        excludeList = opts.excludeList;
    }

    const browserType = await utils.getBrowserType();
    switch (browserType) {
        case utils.BrowserType.Chromium: {
            isChromium = true;
            await disableProxy();
            break;
        }

        case utils.BrowserType.Firefox: {
            browser.browserAction.setBadgeBackgroundColor({
                color: "#294d73"
            });

            break;
        }
    }

    if (opts.autoConnect) {
        const connectionDetails = await mullvadApi.fetchConnectionDetails();

        if (opts.rememberConnectedServer) {
            const { recentServers } = await localStorage.get("recentServers");
            if (recentServers?.length) {
                const recentServer = recentServers[0];
                await enableProxy(
                    mullvadApi.getFullSocksHost(recentServer.socks_name),
                    connectionDetails
                );
                updateBadgeText(recentServer.country_code);
            } else {
                logger.error("Could not find last connected server.");
            }
        } else {
            let currentRegionProxyHost = mullvadApi.SOCKS_ADDRESS;
            if (connectionDetails.mullvad_server_type === "wireguard") {
                currentRegionProxyHost = mullvadApi.SOCKS_ADDRESS_WG;
            }

            await enableProxy(currentRegionProxyHost, connectionDetails);
            updateBadgeText(
                mullvadApi.COUNTRY_NAME_MAP[connectionDetails.country]
            );
        }
    }
}

init();
