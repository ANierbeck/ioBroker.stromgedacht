import { tests } from "@iobroker/testing";
import assert from "assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

let adapterName: string;

const zipCode = "70173";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

tests.integration(path.join(__dirname, ".."), {
	allowedExitCodes: [11, 15],
	controllerVersion: "latest",
	defineAdditionalTests({ suite }) {
		suite("Test retrieveJson()", (getHarness: any) => {
			let harness: any;

			before(async () => {
				harness = getHarness();
				// load package.json here to avoid top-level await / require
				const pkgRaw = await fs.readFile(path.join(__dirname, "..", "package.json"), "utf8");
				const pkg = JSON.parse(pkgRaw) as any;
				adapterName = pkg.name.split(".").pop();
			});

			beforeEach(async () => {
				const obj = {
					native: {
						zipcode: zipCode,
						hoursInFuture: "24",
						daysInPast: "1",
					},
				};
				// @ts-ignore
				await harness.changeAdapterConfig(adapterName, obj);
			});

			it("Should work", async () => {
				await harness.startAdapterAndWait(true);
				const state = await harness.states.getState("stromgedacht.0.forecast.states.json");
				assert.notEqual(state?.val, null, "state is null");
			});
		});
	},
});

export {};
