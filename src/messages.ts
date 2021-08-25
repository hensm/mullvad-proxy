"use strict";

import Messenger from "./lib/Messenger";
import { ConnectionDetails } from "./lib/mullvadApi";

type MessagesBase = {
    "popup:/update": {
        isConnected?: boolean;
        isConnecting?: boolean;
        host?: string;
    };
    "background:/connect": {
        proxyHost: string;
        details: ConnectionDetails;
    };
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
 * For better call semantics, make message data key optional if
 * specified as blank or with all-optional keys.
 */
type NarrowedMessage<L extends MessageBase<keyof MessagesBase>> = L extends any
    ? {} extends L["data"]
        ? Omit<L, "data"> & Partial<L>
        : L
    : never;

export type Message = NarrowedMessage<Messages[keyof Messages]>;

export default new Messenger<Message>();
