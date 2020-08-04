"use strict";

import Messenger from "./lib/Messenger";
import { ConnectionDetails } from "./lib/mullvadApi";


export type Messages = [
    {
        subject: "popup:/update"
      , data: {
            isConnected?: boolean;
            isConnecting?: boolean;
            host?: string;
        }
    }

    // background
  , {
        subject: "background:/connect"
      , data: {
            proxyHost: string;
            details: ConnectionDetails;
        }
    }
  , {
        subject: "background:/disconnect"
    }
];

export default new Messenger<Messages>();
