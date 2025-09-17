const { expect } = require("chai");
import fs from "fs/promises";
import path from "path";

// Import the class under test
import { parseForecast, parseState } from "../../src/parser";

// Helper to create a minimal Stromgedacht instance with mocked ioBroker methods
function makeAdapter(): any {
	// Create a minimal adapter-like object with the methods/fields the
	// parser helpers expect. Avoid constructing the real adapter to keep
	// tests lightweight and independent of js-controller.
	const inst: any = {};
	// Minimal fields used by the parsing methods
	inst.namespace = "stromgedacht.0";
	inst.config = {};
	inst.__states = [];
	inst.setState = (id: string, val: any, ack?: boolean) => {
		// record state writes
		inst.__states.push({ id, val, ack });
		return Promise.resolve();
	};
	inst.setStateAsync = inst.setState;
	// Provide both sync and async variants used by parser helpers
	inst.setObjectNotExists = async () => Promise.resolve();
	inst.setObjectNotExistsAsync = async () => Promise.resolve();
	inst.addToInfluxDB = async () => Promise.resolve();
	inst.log = {
		debug: () => {},
		info: () => {},
		error: () => {},
	};
	return inst;
}

describe("Parser unit tests using fixtures", () => {
	it("parseState should populate timeseries and states", async () => {
		const file = path.join(process.cwd(), "test/fixtures/statesRelative_70173.json");
		const raw = await fs.readFile(file, "utf8");
		const json = JSON.parse(raw);

		const adapter: any = makeAdapter();
		// call parseState (use parser helper directly)
		await parseState(adapter, json);

		expect(adapter.__states).to.be.an("array");
		// Expect that timeseries state was written
		const timeseriesEntry = adapter.__states.find((s: any) => s.id === "forecast.states.timeseries");
		expect(timeseriesEntry).to.not.equal(undefined);
		const ts = JSON.parse(timeseriesEntry.val);
		expect(ts.length).to.be.greaterThan(0);
		// Ensure timeseries entries are tuples [Date, number]
		let prevTime = -Infinity;
		for (const item of ts) {
			expect(item).to.be.an("array");
			expect(item.length).to.equal(2);
			const [d, v] = item;
			const t = new Date(d).getTime();
			expect(Number.isFinite(t)).to.equal(true);
			expect(typeof v === "number").to.equal(true);
			expect(t).to.be.greaterThan(prevTime);
			prevTime = t;
		}
	});

	it("parseForecast should set load/residualLoad/renewableEnergy states", async () => {
		const file = path.join(process.cwd(), "test/fixtures/forecast_70173_from_2025-09-14.json");
		const raw = await fs.readFile(file, "utf8");
		const json = JSON.parse(raw);

		const adapter: any = makeAdapter();
		await parseForecast(adapter, json);

		const load = adapter.__states.find((s: any) => s.id === "forecast.load.json");
		expect(load).to.not.equal(undefined);
		const loadJson = JSON.parse(load.val);
		expect(loadJson.length).to.be.greaterThan(0);
		// ensure date order and numeric values
		let prev = -Infinity;
		for (const e of loadJson) {
			const t = new Date(e.dateTime).getTime();
			expect(Number.isFinite(t)).to.equal(true);
			expect(typeof e.value).to.equal("number");
			expect(t).to.be.greaterThan(prev);
			prev = t;
		}

		// Some fixtures may not include renewableEnergy/residualLoad. Only assert
		// presence if they were part of the fixture we fed to the parser.
		if (json.renewableEnergy !== undefined) {
			const renewable = adapter.__states.find((s: any) => s.id === "forecast.renewableEnergy.json");
			expect(renewable).to.not.equal(undefined);
		}
		if (json.residualLoad !== undefined) {
			const residual = adapter.__states.find((s: any) => s.id === "forecast.residualLoad.json");
			expect(residual).to.not.equal(undefined);
		}
	});
});
