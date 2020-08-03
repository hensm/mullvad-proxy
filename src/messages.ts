"use strict";

import Messenger from "./lib/Messenger";


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
            host: string;
        }
    }
  , {
        subject: "background:/disconnect"
    }
];

export default new Messenger<Messages>();
