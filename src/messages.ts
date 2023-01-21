"use strict";

import Messenger from "./lib/Messenger";
import { ConnectionDetails } from "./lib/mullvadApi";
import { TypedPort } from "./lib/TypedPort";

export interface ProxyState {
    isConnected?: boolean;
    isConnecting?: boolean;
    host?: string;
}

type MessagesBase = {
    "popup:/update": ProxyState;
    "background:/connect": {
        proxyHost: string;
        details: ConnectionDetails;
    };
    // eslint-disable-next-line @typescript-eslint/ban-types
    "background:/disconnect": {};
    "background:/updateConnectionDetails": {
        details: ConnectionDetails;
    };
};

interface MessageBase<K extends keyof MessagesBase> {
    subject: K;
    data: MessagesBase[K];
}

type Messages = {
    [K in keyof MessagesBase]: MessageBase<K>;
};

/**
 * Make message data key optional if specified as blank or with all-optional
 * keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NarrowedMessage<L extends MessageBase<keyof MessagesBase>> = L extends any
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {} extends L["data"]
        ? Omit<L, "data"> & Partial<L>
        : L
    : never;

export type Message = NarrowedMessage<Messages[keyof Messages]>;
export type MessengerPort = TypedPort<Message>;

export default new Messenger<Message>();
