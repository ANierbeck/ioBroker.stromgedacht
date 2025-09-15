import { tests } from "@iobroker/testing";
import assert from "assert";
import fs from "fs/promises";
import nock from "nock";
import path from "path";

let adapterName: string;

const zipCode = "70173";

// Use process.cwd() as the repository root. Mocha runs tests from the project
// root, so `process.cwd()` points to the repo root here.
const projectRoot = process.cwd();

tests.integration(projectRoot, {
	allowedExitCodes: [11, 15],
	controllerVersion: "latest",
	defineAdditionalTests({ suite }) {
		suite("Test retrieveJson()", (getHarness: any) => {
			let harness: any;

			before(async () => {
				harness = getHarness();
				// load package.json here to avoid top-level await / require
				const pkgRaw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
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
				await harness.changeAdapterConfig(adapterName, obj);

				// Set up deterministic HTTP mocks for the external API so CI is stable
				// and tests don't depend on network timing.
				nock.disableNetConnect();
				// allow local connections (testing harness uses localhost for redis etc.)
				nock.enableNetConnect("127.0.0.1");

				// Mock statesRelative endpoint
				nock("https://api.stromgedacht.de")
					.get("/v1/statesRelative")
					.query(true)
					.reply(200, {
						states: [
							{
								from: new Date().toISOString(),
								to: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
								state: 1,
							},
						],
					});

				// Mock forecast endpoint with minimal but valid payload
				nock("https://api.stromgedacht.de")
					.get("/v1/forecast")
					.query(true)
					.reply(200, {
						load: [{ dateTime: new Date().toISOString(), value: 1000 }],
						renewableEnergy: [{ dateTime: new Date().toISOString(), value: 200 }],
						residualLoad: [{ dateTime: new Date().toISOString(), value: 800 }],
						superGreenThreshold: [{ dateTime: new Date().toISOString(), value: 300 }],
					});
			});

			afterEach(async () => {
				// Clean up nock and allow network again
				nock.cleanAll();
				nock.enableNetConnect();
			});

			it("Should work", async () => {
				await harness.startAdapterAndWait(true);
				// Wait for the adapter to populate the forecast JSON state.
				// CI can be subject to small timing/race windows, so poll for a short
				// timeout instead of relying on a single immediate read.
				const waitForState = async (id: string, timeout = 5000): Promise<any> => {
					const start = Date.now();
					while (Date.now() - start < timeout) {
						const st = await harness.states.getState(id);
						if (st && st.val != null) return st;
						await new Promise((r) => setTimeout(r, 200));
					}
					return await harness.states.getState(id);
				};

				const state = await waitForState("stromgedacht.0.forecast.states.json", 8000);
				assert.notEqual(state?.val, null, "state is null");
			});
		});
	},
});

export {};
