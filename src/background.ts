"use strict";

import logger from "./lib/logger";
import * as mullvadApi from "./lib/mullvadApi";

import messages from "./messages";


const _ = browser.i18n.getMessage;


type CreateNotificationOptions =
        browser.notifications.CreateNotificationOptions;

// If proxy connected successfully
const notifConnectionSucceeded = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionSucceededTitle")
  , message: _("notificationConnectionSucceededMessage", host)
  , type: "basic"
});

// If proxy server is unreachable or misc connection error
const notifConnectionFailed = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionFailedTitle")
  , message: _("notificationConnectionFailedMessage", host)
  , type: "basic"
});

// If user is not connected to a Mullvad VPN server
const notifConnectionFailedNonMullvad: CreateNotificationOptions = {
    title: _("notificationConnectionFailedTitle")
  , message: _("notificationConnectionFailedMessageNonMullvad")
  , type: "basic"
};

// If proxy is manually disconnected
const notifConnectionDisconnected = (host = "host")
        : CreateNotificationOptions => ({
    title: _("notificationConnectionDisconnectedTitle")
  , message: _("notificationConnectionDisconnectedMessage", host)
  , type: "basic"
});


// Current proxy details
let proxy: browser.proxy.Proxy | null;
let proxyConnecting = false;

function onProxyRequest (_details: browser.proxy._OnRequestDetails) {
    return proxy;
}

function onProxyError (err: Error) {
    logger.error("Proxy error!", err);
    browser.notifications.create(
            notifConnectionFailed(proxy?.host));
    disableProxy();
}


/**
 * Checks current connection is valid and sets up proxy request
 * listener. If client isn't connected via Mullvad, proxy
 * connection is aborted and user is notified.
 */
async function enableProxy (host: string) {
    if (proxyConnecting) {
        return;
    }

    // Cleanup
    if (proxy) {
        disableProxy();
    }

    proxyConnecting = true;

    logger.info("Connecting...");

    let details: mullvadApi.ConnectionDetails;
    try {
        details = await mullvadApi.getDetails();
    } catch (err) {
        // Quit if Mullvad API is unreachable
        browser.notifications.create(
                notifConnectionFailed(proxy?.host));
        return;
    }

    // Quit if not connected to a Mullvad server
    if (!details.mullvad_exit_ip) {
        logger.log("Not connected via Mullvad!");
        browser.notifications.create(notifConnectionFailedNonMullvad);
        return;
    }

    /**
     * Mullvad SOCKS5 proxy servers do not require either username
     * or password authentication, since they're siloed within the
     * network and accessible only to authenticated users already.
     */
    proxy = {
        type: "socks"

        // If host not provided, use default for current VPN server
      , host: host ?? (details.mullvad_server_type === "wireguard"
                  ? mullvadApi.SOCKS_ADDRESS
                  : mullvadApi.SOCKS_ADDRESS_WG)

        // All servers use same port
      , port: mullvadApi.SOCKS_PORT
    };

    logger.info("PAC created", proxy);

    browser.proxy.onError.addListener(onProxyError);
    browser.proxy.onRequest.addListener(onProxyRequest, {
        urls: [ "<all_urls>" ]
    });


   try {
        // Request to trigger proxy
        const address = await mullvadApi.getIpAddress();
        logger.info(`IP address: ${address}`);

        browser.notifications.create(
                notifConnectionSucceeded(proxy.host));

        browser.browserAction.setIcon({
            path: browser.runtime.getURL("icons/locked.svg")
        });

        proxyConnecting = false;
    } catch (err) {
        logger.error("Proxy request failed!");

        browser.notifications.create(
                notifConnectionFailed(proxy.host));

        disableProxy();
    }
}


/**
 * Removes proxy request listener.
 */
function disableProxy (notify = false) {
    proxyConnecting = false;

    if (notify) {
        browser.notifications.create(
                notifConnectionDisconnected(proxy?.host));
    }

    browser.browserAction.setIcon({
        path: browser.runtime.getURL("icons/unlocked.svg")
    });

    browser.proxy.onError.removeListener(onProxyError);
    browser.proxy.onRequest.removeListener(onProxyRequest);

    proxy = null;
}



messages.onConnect.addListener(port => {
    function sendPopupUpdate () {
        port.postMessage({
            subject: "popup:/update"
          , data: {
                isConnected: !!proxy && !proxyConnecting
              , isConnecting: proxyConnecting
              , host: proxy?.host
            }
        });
    }

    if (port.name !== "background") {
        return;
    }

    port.onMessage.addListener(async message => {
        switch (message.subject) {
            case "background:/connect": {
                const host = mullvadApi.getFullSocksHost(message.data.host);

                port.postMessage({
                    subject: "popup:/update"
                  , data: {
                        isConnecting: true
                    }
                });

                await enableProxy(host);
                break;
            }
            case "background:/disconnect": {
                disableProxy(true);
                break;
            }
        }

        sendPopupUpdate();
    });

    sendPopupUpdate();
});
