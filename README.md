# typed-socket.io

A library for fully typed client-server communication with socket.io and TypeScript.

Install via npm: [typed-socket.io](https://www.npmjs.com/package/typed-socket.io)

Source code on GitHub: [phiresky/typed-socket.io](https://github.com/phiresky/typed-socket.io)

**Note** that an alternative implementation of (purely compile-time) typed events are included starting from [Socket.io 4.x](https://socket.io/docs/v3/migrating-from-3-x-to-4-0/#Typed-events) itself. This library was written a few years earlier. The implementation and functionality is somewhat different. This library also has optional runtime type checking with io-ts (for a production environment you'll not get around runtime type checking), other than that I'm not sure if it's still worth using.

## Basic Usage (purely compile-time)

Simple Example:

Let's say you want to have a simple chat server, where users can connect and send messages to an english and a russian channel, and all received messages will be forwarded to all other connected users.

Using this library, you can do this with both the server and the client having 100% type safety. Here's how it looks:

* server.ts

```ts
import * as io from "socket.io";

const server = io(8000) as TypedServer;
const chatServer = server.of("/chat");

chatServer.on("connection", client => {
    client.on("postMessage", (info, callback) => {
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
        callback(null, "ok");
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
import { ServerDefinition, SimpleNamespace,
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

A runnable version of this example is in [example/basic-chat](example/basic-chat).

Note that when using this library this way, the types are only checked at compile-time, which means that you trust your clients to send the correct data at runtime.

### Promises

For all RPCs, you can also use promises via `.onAsync` instead of `.on` on the server and and `.emitAsync` instead of `.emit` on the client, by calling `promisifySocket(client)` from [typed-socket.io/util](./util.ts).

```ts
// server
chatServer.on("connection", client => {
    client.on("postMessage", async info => {
        chatServer.emit("chatMessage", {
            ...info,
            sender: client.id,
        });
        return "ok"; // must return "ok" here (or throw), because thats what the ServerDefinition says.
    });
});

// client
const response = await client.emitAsync(
    "postMessage",
    { message: "Hello World", channel: "en" }
);
// assert response === "ok"
```

## Runtime Component

If you want runtime type safety, you can use the following classes:

### TypedServer

By using this class all client requests will be type checked and rejected if they don't match the given schema.

Example: See [example/chat-with-runtime-checks/server.ts](example/chat-with-runtime-checks/server.ts)

Needs a peer dependency to socket.io.

### TypedClient

This class ensures that you listen to all messages a server can send.

Example: See [example/chat-with-runtime-checks/client.ts](example/chat-with-runtime-checks/client.ts)

Needs a peer dependency to socket.io-client.
