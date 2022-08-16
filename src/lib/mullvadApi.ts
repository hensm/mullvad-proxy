"use strict";

import { Logger } from "./logger";
const logger = new Logger("mullvadApi");

const AIM_HOST = "am.i.mullvad.net";
const ENDPOINT_AIM = `https://${AIM_HOST}`;
const IPV4_ENDPOINT_AIM = `https://ipv4.${AIM_HOST}`;
const IPV6_ENDPOINT_AIM = `https://ipv6.${AIM_HOST}`;

export enum EndpointVariant {
    IPv4,
    IPv6
}

/**
 * Get /ip and /json endpoints for IPv4/IPv6.
 */
function getVariantEndpoints(variant: EndpointVariant) {
    let endpoint;
    switch (variant) {
        case EndpointVariant.IPv4:
            endpoint = IPV4_ENDPOINT_AIM;
            break;
        case EndpointVariant.IPv6:
            endpoint = IPV6_ENDPOINT_AIM;
            break;

        default:
            throw new Error("Invalid endpoint variant");
    }

    return {
        endpointAimIp: `${endpoint}/ip`,
        endpointAimDetails: `${endpoint}/json`
    };
}

const ENDPOINT_AIM_PORT = `${ENDPOINT_AIM}/port`;
const ENDPOINT_RELAYS = "https://api.mullvad.net/www/relays/wireguard/";

/**
 * Default proxy IP addresses for the current server location
 * differ for OpenVPN/WireGuard.
 */
export const SOCKS_ADDRESS = "10.8.0.1";
export const SOCKS_ADDRESS_WG = "10.64.0.1";

export const SOCKS_PORT = "1080";

export function getFullSocksHost(serverName: string) {
    if (serverName.endsWith("mullvad.net")) {
        return serverName;
    }

    return `${serverName}.mullvad.net`;
}

export function getShortSocksName(socksName: string) {
    if (socksName.endsWith(".relays.mullvad.net")) {
        return socksName.slice(0, -26);
    }
    return socksName;
}

// am.i.mullvad
export const CHECK_URL = "https://mullvad.net/check";

export interface ConnectionDetails {
    ip: string;
    country: string;
    city: string;
    longitude: number;
    latitude: number;
    organization: string;
    blacklisted: {
        blacklisted: boolean;
        results: Array<{
            name: string;
            link: string;
            blacklisted: boolean;
        }>;
    };

    mullvad_exit_ip: boolean;
    mullvad_exit_ip_hostname?: string;
    mullvad_server_type?: string;
}

export interface PortDetails {
    ip: string;
    port: number;
    reachable: boolean;
}

/**
 * Gets public IP address as string.
 */
export async function fetchIpAddress(
    variant = EndpointVariant.IPv4,
    init?: RequestInit
) {
    logger.info("Fetching IP address...");

    const { endpointAimIp } = getVariantEndpoints(variant);
    const res = await fetch(endpointAimIp, init);
    return (await res.text()).trim();
}

/**
 * Gets connection details JSON.
 */
export async function fetchConnectionDetails(
    variant = EndpointVariant.IPv4,
    init?: RequestInit
) {
    logger.info("Fetching connection details...");

    const { endpointAimDetails } = getVariantEndpoints(variant);
    const res = await fetch(endpointAimDetails, init);
    const json: ConnectionDetails = await res.json();

    // Normalize
    json.mullvad_server_type = json.mullvad_server_type?.toLowerCase();

    return json;
}

/**
 * Gets port details JSON.
 */
export async function fetchPortDetails(port: number, init?: RequestInit) {
    if (port < 1 || port > 65536) {
        throw new Error("Invalid port!");
    }

    logger.info("Fetching port details...");

    let json;
    try {
        const res = await fetch(`${ENDPOINT_AIM_PORT}/${port}`, init);
        json = await res.json();
    } catch (err) {
        throw logger.error("Failed to fetch port details", err);
    }

    return json as PortDetails;
}

export interface Server {
    hostname: string;
    country_code: string;
    country_name: string;
    city_code: string;
    city_name: string;
    active: boolean;
    owned: boolean;
    provider: string;
    ipv4_addr_in: string;
    ipv6_addr_in: string;
    pubkey: string;
    multihop_port: number;
    socks_name: string;
}

/**
 * Gets Mullvad WireGuard server list.
 */
export async function fetchServerList(init?: RequestInit) {
    logger.info("Fetching server list...");

    let json;
    try {
        const res = await fetch(ENDPOINT_RELAYS, init);
        json = await res.json();
    } catch (err) {
        throw logger.error("Failed to fetch server list", err);
    }

    return json as Server[];
}

export function getServerIdFromHost(hostname: string) {
    return parseInt(hostname.slice(2, hostname.indexOf("-")));
}
