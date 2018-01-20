import * as io from "socket.io";
import { TypedServer } from "./common";

const server = io(8000) as TypedServer;
const chatServer = server.of("/chat");

chatServer.on("connection", client => {
    client.on("postMessage", info => {
        // typeof info.message === string
        // typeof info.channel === "en" | "ru"
        chatServer.emit("chatMessage", {
            ...info,
            sender: client.id,
            /* something: 1,
               ▲
          ┏━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
          ┃ [ts] Object literal may only specify known properties,        ┃
          ┃      and 'something' does not exist in type                   ┃
          ┃ '{ sender: string; message: string; channel: "en" | "ru"; }'. ┃
          ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */
        });
    });

    /* client.emit("otherMessage", 123);
                   ▲
              ┏━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
              ┃ [ts] Argument of type '"otherMessage"' is not assignable  ┃
              ┃      to parameter of type '"chatMessage" | "history"'.    ┃
              ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */
});
