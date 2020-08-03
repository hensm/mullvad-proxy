"use strict";

import { Logger } from "./logger";
const logger = new Logger("mullvadApi");


const ENDPOINT_AIM = "https://am.i.mullvad.net";
const ENDPOINT_AIM_IP = `${ENDPOINT_AIM}/ip`;
const ENDPOINT_AIM_DETAILS = `${ENDPOINT_AIM}/json`;
const ENDPOINT_AIM_PORT = `${ENDPOINT_AIM}/port`;

const ENDPOINT_RELAYS = "https://api.mullvad.net/www/relays/wireguard/";


/**
 * Default proxy IP addresses for the current server location
 * differ for OpenVPN/WireGuard.
 */
export const SOCKS_ADDRESS = "10.8.0.1";
export const SOCKS_ADDRESS_WG = "10.64.0.1";

export const SOCKS_PORT = "1080";

export function getFullSocksHost (serverName: string) {
    return `${serverName}.mullvad.net`;
}


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
    }

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
export async function getIpAddress () {
    const res = await fetch(ENDPOINT_AIM_IP);
    return (await res.text()).trim();
}

/**
 * Gets connection details JSON.
 */
export async function getDetails () {
    const res = await fetch(ENDPOINT_AIM_DETAILS);
    const json: ConnectionDetails = await res.json();

    // Normalize
    json.mullvad_server_type = json.mullvad_server_type?.toLowerCase();

    return json;
}

/**
 * Gets port details JSON.
 */
export async function getPortDetails (port: number) {
    if (port < 1 || port > 65536) {
        throw new Error("Invalid port!");
    }

    let json;
    try {
        const res = await fetch(`${ENDPOINT_AIM_PORT}/${port}`);
        json = await res.json();
    } catch (err) {
        logger.error(err);
        throw new Error("Failed to get port details.");
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
export async function getServers () {
    let json;
    try {
        const res = await fetch(ENDPOINT_RELAYS);
        json = await res.json();
    } catch (err) {
        logger.error(err);
        throw new Error("Failed to get relays.");
    }

    return json as Server[];
}

export function getServerIdFromHost (hostname: string) {
    return parseInt(hostname.slice(2, hostname.indexOf("-")));
}
