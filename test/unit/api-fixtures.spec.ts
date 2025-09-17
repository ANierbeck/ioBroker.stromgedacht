const { expect } = require("chai");
import fs from "fs/promises";
import path from "path";

describe("API fixture sanity checks", () => {
	it("statesRelative fixture should contain states array with proper entries", async () => {
		const file = path.join(process.cwd(), "test/fixtures/statesRelative_70173.json");
		const raw = await fs.readFile(file, "utf8");
		const json = JSON.parse(raw) as any;
		expect(json).to.have.property("states");
		expect(json.states).to.be.an("array");
		expect(json.states.length).to.be.greaterThan(0);
		for (const s of json.states) {
			expect(s).to.have.property("from");
			expect(s).to.have.property("to");
			expect(s).to.have.property("state");
			expect(new Date(s.from).toString()).to.not.equal("Invalid Date");
			expect(new Date(s.to).toString()).to.not.equal("Invalid Date");
		}
	});

	it("forecast fixture should contain load/renewableEnergy/residualLoad arrays", async () => {
		const file = path.join(process.cwd(), "test/fixtures/forecast_70173_from_2025-09-14.json");
		const raw = await fs.readFile(file, "utf8");
		const json = JSON.parse(raw) as any;
		expect(json).to.have.property("load");
		expect(json.load).to.be.an("array");
		expect(json.load.length).to.be.greaterThan(0);
		const entry = json.load[0];
		expect(entry).to.have.property("dateTime");
		expect(entry).to.have.property("value");
		expect(new Date(entry.dateTime).toString()).to.not.equal("Invalid Date");
		expect(typeof entry.value).to.equal("number");
	});
});
