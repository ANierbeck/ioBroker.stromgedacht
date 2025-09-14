// Mocha setup in TypeScript

// Makes ts-node ignore warnings, so mocha --watch does work
process.env.TS_NODE_IGNORE_WARNINGS = "TRUE";
// Sets the correct tsconfig for testing
process.env.TS_NODE_PROJECT = "tsconfig.json";
// Make ts-node respect the "include" key in tsconfig.json
process.env.TS_NODE_FILES = "TRUE";

// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
	throw e;
});

// Increase default test timeout for integration tests (CI can be slower)
before(function () {
	// 20s should be enough for setup on CI
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore: mocha adds `this` to the hook context
	this.timeout(20000);
});

// Use dynamic imports because some packages are ESM-only when loaded by Node
(async () => {
	const chaiModule = await import("chai");
	const sinonChaiModule = await import("sinon-chai");
	const chaiAsPromisedModule = await import("chai-as-promised");

	const chai = (chaiModule && (chaiModule as any).default) || chaiModule;
	const sinonChai = (sinonChaiModule && (sinonChaiModule as any).default) || sinonChaiModule;
	const chaiAsPromised = (chaiAsPromisedModule && (chaiAsPromisedModule as any).default) || chaiAsPromisedModule;

	// enable the should interface with sinon
	(chai as any).should();
	(chai as any).use(sinonChai as any);
	(chai as any).use(chaiAsPromised as any);

	// Provide a small compatibility shim for older/newer db-states implementations
	// Some versions expose `delStateAsync`, others expose `delState`. Ensure the
	// testing helper can call `.delStateAsync()` by patching the prototype if needed.
	try {
		// @ts-expect-error: optional dependency, types may not be installed in CI
		const dbStatesModule = await import("@iobroker/db-states-jsonl").catch(() => null);
		const mod: any = dbStatesModule && (dbStatesModule.default || dbStatesModule);
		if (mod && mod.prototype && !mod.prototype.delStateAsync) {
			mod.prototype.delStateAsync = function (id: string) {
				return new Promise((resolve, reject) => {
					try {
						if (typeof this.delState === "function") {
							resolve(this.delState(id));
						} else if (typeof this.delStateSync === "function") {
							resolve(this.delStateSync(id));
						} else {
							resolve(undefined);
						}
					} catch (e) {
						reject(e);
					}
				});
			};
		}
	} catch {
		// best-effort shim, ignore failures
	}
})();

export {};
