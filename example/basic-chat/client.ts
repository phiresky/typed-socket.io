import { TypedChatClient } from "./common";

import * as io from "socket.io-client";

const host = process.argv[2] || "http://localhost:8000";
const ns = "/chat";
const client: TypedChatClient = io(host + ns) as any;

const channelNames = { en: "English", ru: "Russian" };

client.on("chatMessage", ({ sender, message, channel }) => {
    // assert typeof channel === "en" | "ru"
    // assert typeof message === string
    console.log(`${channelNames[channel]}: ${sender}: ${message}`);
});

client.emit(
    "postMessage",
    { message: "Hello World", channel: "en" },
    (error, _response) => {
        if (error) return console.error(error);
        // assert typeof _response === "ok" here
    },
);

/* client.emit("postMessage", { message: "Hello World", channel: "es" }, () => {});
                                        ▲
              ┏━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
              ┃ [ts] Type '"es"' is not assignable to type '"en" | "ru"'. ┃
              ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */

client.on("error", e => console.error("socket.io error", e));
