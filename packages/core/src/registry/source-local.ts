import { FileSystem } from "@effect/platform";
import { Effect, Layer, Schema } from "effect";
import { RegistryEntry } from "#src/spec/schema.ts";
import { RegistryNotFoundError, RegistrySource } from "#src/registry/source.ts";

export const LocalRegistrySourceLayer = (registryDir: string) =>
	Layer.effect(
		RegistrySource,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			yield* Effect.logDebug("Local registry source").pipe(Effect.annotateLogs("registryDir", registryDir));

			const get = (type: string, name: string) =>
				Effect.gen(function* () {
					const filePath = `${registryDir}/${type}/${name}.json`;
					yield* Effect.logDebug("Reading registry file").pipe(Effect.annotateLogs("filePath", filePath));
					const content = yield* fs
						.readFileString(filePath)
						.pipe(
							Effect.tapError((error) => Effect.logDebug("File read failed").pipe(Effect.annotateLogs("error", String(error)))),
							Effect.mapError(() => new RegistryNotFoundError({ type, name })),
						);
					return yield* Schema.decode(Schema.parseJson(RegistryEntry))(content).pipe(
						Effect.tapError((error) => Effect.logDebug("Schema decode failed").pipe(Effect.annotateLogs("error", String(error)))),
						Effect.mapError(() => new RegistryNotFoundError({ type, name })),
					);
				});

			const search = (name: string) =>
				get("npm", name).pipe(
					Effect.catchTag("RegistryNotFoundError", () => get("name", name)),
				);

			return RegistrySource.of({ get, search });
		}),
	);
