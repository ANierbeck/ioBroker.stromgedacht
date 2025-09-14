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
})();

export {};
