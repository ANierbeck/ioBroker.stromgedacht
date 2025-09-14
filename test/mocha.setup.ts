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

	// Provide a compatibility shim for older/newer db-states implementations.
	// Some versions expose `delStateAsync`, others expose `delState` or `delStateSync`.
	// This helper tries to patch both the prototype and common instance shapes so the
	// test harness can call `delStateAsync()` reliably in CI.
	try {
		// optional dependency: import safely and tolerate absence in some CI setups
		let dbStatesModule: any = null;
		try {
			dbStatesModule = await import("@iobroker/db-states-jsonl");
		} catch {
			dbStatesModule = null;
		}
		let mod: any = dbStatesModule;
		if (dbStatesModule && (dbStatesModule as any).default) {
			mod = (dbStatesModule as any).default;
		}

		const makeAsync = (fn?: (...args: any[]) => any): ((id: string) => Promise<any>) | undefined => {
			if (!fn) return undefined;
			return function (this: any, id: string): Promise<any> {
				return new Promise((resolve, reject) => {
					try {
						const res = fn.call(this, id);
						if (res && typeof res.then === "function") return resolve(res);
						resolve(res);
					} catch (err) {
						reject(err);
					}
				});
			};
		};

		if (mod) {
			// Patch prototype if available
			if (mod.prototype) {
				if (!mod.prototype.delStateAsync) {
					const candidate =
						mod.prototype.delState || mod.prototype.delStateSync || mod.prototype.delStatePromise;
					if (candidate) {
						console.info("mocha.setup: patching db-states prototype to provide delStateAsync");
						mod.prototype.delStateAsync = makeAsync(candidate);
					}
				}
			}

			// Also try to patch a common instance shape that some test harnesses use
			try {
				const probe = new (mod as any)();
				const instCandidate = probe.delState || probe.delStateSync || probe.delStatePromise;
				if (instCandidate && !probe.delStateAsync) {
					console.info("mocha.setup: patching db-states instance to provide delStateAsync");
					(probe as any).delStateAsync = makeAsync(instCandidate);
					// attach back to prototype so other instances benefit
					if ((mod as any).prototype && !(mod as any).prototype.delStateAsync) {
						(mod as any).prototype.delStateAsync = (probe as any).delStateAsync;
					}
				}
			} catch {
				// Instantiation may fail in some CI configs; that's fine — prototype patch is sufficient.
			}
		}
	} catch (err) {
		// best-effort shim, ignore failures but surface a debug message
		console.debug(
			"mocha.setup: db-states compatibility shim failed:",
			err && (err as any).message ? (err as any).message : err,
		);
	}
})();

export {};
