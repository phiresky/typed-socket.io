/**
 * typed socket.io server (runtime component)
 */

import * as t from "io-ts";
import * as ts from "./typedSocket";
import { isLeft } from "fp-ts/lib/Either";
import { PathReporter } from "io-ts/lib/PathReporter";
import { ServerDefinition } from "./typedSocket";
export type RuntimeNamespaceSchema = {
	ServerMessages: { [name: string]: t.Type<any, any> };
	ClientMessages: { [name: string]: t.Type<any, any> };
	ClientRPCs: {
		[name: string]: {
			request: t.Type<any, any>;
			response: t.Type<any, any>;
		};
	};
};

export type NeededInfo<
	S extends ServerDefinition = ServerDefinition,
	MyNamespaceSchema extends ts.NamespaceSchema = ts.NamespaceSchema
> = {
	ServerDefinition: S;
	NamespaceSchema: MyNamespaceSchema;
	RuntimeSchema: FromCompiletime<MyNamespaceSchema>;
};

export type ToCompiletime<S extends RuntimeNamespaceSchema> = {
	ServerMessages: {
		[k in keyof S["ServerMessages"]]: t.TypeOf<S["ServerMessages"][k]>
	};
	ClientMessages: {
		[k in keyof S["ClientMessages"]]: t.TypeOf<S["ClientMessages"][k]>
	};
	ClientRPCs: {
		[k in keyof S["ClientRPCs"]]: {
			request: t.TypeOf<S["ClientRPCs"][k]["request"]>;
			response: t.TypeOf<S["ClientRPCs"][k]["response"]>;
			error: any;
		}
	};
};

export type FromCompiletime<S extends ts.NamespaceSchema> = {
	ServerMessages: {
		[k in keyof S["ServerMessages"]]: t.Type<any, S["ServerMessages"][k]>
	};
	ClientMessages: {
		[k in keyof S["ClientMessages"]]: t.Type<any, S["ClientMessages"][k]>
	};
	ClientRPCs: {
		[k in keyof S["ClientRPCs"]]: {
			request: t.Type<any, S["ClientRPCs"][k]["request"]>;
			response: t.Type<any, S["ClientRPCs"][k]["response"]>;
			error: t.Type<any, any>;
		}
	};
};

export namespace internal {
	export type ClientMessagesHandler<S extends ts.NamespaceSchema> = {
		[k in keyof S["ClientMessages"]]: (
			message: S["ClientMessages"][k],
		) => void
	};

	export type ClientRPCsHandler<S extends ts.NamespaceSchema> = {
		[k in keyof S["ClientRPCs"]]: (
			message: S["ClientRPCs"][k]["request"],
		) => Promise<S["ClientRPCs"][k]["response"]>
	};
}

export type IClientSocketHandler<N extends NeededInfo> = {
	io: ts.ServerNamespaceNS<N["ServerDefinition"], N["NamespaceSchema"]>;
	socket: ts.ServerSideClientSocketNS<
		N["ServerDefinition"],
		N["NamespaceSchema"]
	>;
} & internal.ClientMessagesHandler<N["NamespaceSchema"]> &
	internal.ClientRPCsHandler<N["NamespaceSchema"]>;

/**
 * Usage: MyClass extends ClientSocketHandler<X> implements IClientSocketHandler<X> {...}
 */
export class ClientSocketHandler<N extends NeededInfo> {
	constructor(
		readonly io: ts.ServerNamespaceNS<
			N["ServerDefinition"],
			N["NamespaceSchema"]
		>,
		readonly socket: ts.ServerSideClientSocketNS<
			N["ServerDefinition"],
			N["NamespaceSchema"]
		>,
	) {}
}

/**
 * extend this class to create a typed socket.io server
 */
export abstract class Server<N extends NeededInfo> {
	constructor(readonly schema: N["RuntimeSchema"]) {}
	listen(
		io: ts.ServerNamespaceNS<N["ServerDefinition"], N["NamespaceSchema"]>,
	) {
		const schema = this.schema;
		io.on("connection", socket => {
			const handler = this.onConnection(socket);
			if (!handler) {
				socket.disconnect();
				return;
			}
			for (const clientMessage in schema.ClientMessages) {
				socket.on(clientMessage, (...args: any[]) =>
					this.safeHandleClientMessage(
						handler,
						clientMessage,
						args,
						schema.ClientMessages[clientMessage],
					),
				);
			}
			for (const clientRPC in schema.ClientRPCs) {
				socket.on(clientRPC, (...args: any[]) =>
					this.safeHandleClientRPC(
						handler,
						clientRPC,
						args,
						schema.ClientRPCs[clientRPC]["request"],
					),
				);
			}
		});
	}

	/**
	 * handle an incoming connection. return null to drop the connection or a socket handler object to keep it
	 */
	abstract onConnection(
		clientSocket: ts.ServerSideClientSocketNS<
			N["ServerDefinition"],
			N["NamespaceSchema"]
		>,
	): IClientSocketHandler<N> | null;

	abstract onClientTypeError(
		socket: ts.ServerSideClientSocketNS<
			N["ServerDefinition"],
			N["NamespaceSchema"]
		>,
		e: string,
	): void;

	private safeHandleClientMessage<
		K extends keyof N["NamespaceSchema"]["ClientMessages"]
	>(
		handler: IClientSocketHandler<N>,
		message: K,
		args: any[],
		schema: t.Type<any, any>,
	) {
		if (args.length !== 1) {
			this.onClientTypeError(
				handler.socket,
				"Invalid arguments l " + args.length,
			);
			return;
		}
		const arg = args[0];
		const validation = t.validate(arg, schema);
		if (isLeft(validation)) {
			const error = PathReporter.report(validation).join("\n");
			console.error(handler.socket.id, message, error);
			this.onClientTypeError(handler.socket, message + ": Type Error");
			return;
		}
		const safeArg = validation.value;
		try {
			handler[message](safeArg);
			return;
		} catch (e) {
			console.log(handler.socket.id, message, e);
		}
	}
	private async safeHandleClientRPC(
		handler: IClientSocketHandler<N>,
		message: keyof N["NamespaceSchema"]["ClientRPCs"],
		args: any[],
		schema: t.Type<any, any>,
	) {
		if (args.length !== 2) {
			this.onClientTypeError(
				handler.socket,
				"Invalid arguments l " + args.length,
			);
			return;
		}
		const [arg, cb] = args;
		if (typeof cb !== "function") {
			this.onClientTypeError(handler.socket, message + ": No callback");
			return;
		}
		const validation = t.validate(arg, schema);
		if (isLeft(validation)) {
			const error = PathReporter.report(validation).join("\n");
			console.error(handler.socket.id, message, error);
			cb(message + ": Type Error");
			return;
		}
		const safeArg = validation.value;
		try {
			cb(null, await handler[message](safeArg));
		} catch (e) {
			console.log(handler.socket.id, message, e);
			cb(e);
		}
	}
}
