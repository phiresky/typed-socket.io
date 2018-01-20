# typed-socket.io

A library for fully typed client-server communication with socket.io and TypeScript

## Basic Usage (purely compile-time)

Simple Example:

* server.ts

```ts
import * as io from "socket.io";

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
              ┃      to parameter of type '"chatMessage"'.                ┃
              ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */
});
```

* client.ts

```ts
import * as io from "socket.io-client";

const host = "http://localhost:8000";
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
    (error, response) => {
        if (error) return console.error(error);
        // typeof response === "ok" here
    },
);

client.emit("postMessage", { message: "Hello World", channel: "es" }, () => {});
/*                                        ▲
              ┏━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
              ┃ [ts] Type '"es"' is not assignable to type '"en" | "ru"'. ┃
              ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */
```

The only thing you need to glue this together is a file that is imported on the client _and_ the server with the type definition, that looks as follows:

* common.ts

```ts
import { ServerDefinition, SimpleNamespace, ServerNamespace,
    RootServer, ClientSideSocket } from "typed-socket.io";

type ChatMessage = {
    sender: string;
    message: string;
    channel: "en" | "ru";
};
export interface MyServerDefinition extends ServerDefinition {
    namespaces: {
        "/chat": SimpleNamespace<{
            // messages the server may send to the clients
            ServerMessages: {
                chatMessage: ChatMessage;
                history: ChatMessage[];
            };
            // messages clients can send to the server, with a typed response
            ClientRPCs: {
                postMessage: {
                    request: { message: string; channel: "en" | "ru" };
                    response: "ok";
                    error: string;
                };
            };
            // messages clients can send to the server (without a response)
            ClientMessages: {
                // (not needed here)
            };
        }>;
        // ...
    };
}

export type TypedServer = RootServer<MyServerDefinition>;
export type TypedChatClient = ClientSideSocket<MyServerDefinition, "/chat">;
```

A runnable version of this example is in [test/chat-example](test/chat-example).

Note that when using this library this way, the types are only checked at compile-time, which means that you trust your clients to send the correct data at runtime.

## Runtime Component

If you want runtime type safety, you can use the following classes:

### TypedServer

Example: TODO
Needs a peer dependency to socket.io.

### TypedClient

Example: TODO
Needs a peer dependency to socket.io-client.