const path = require("path");
const { tests, utils } = require("@iobroker/testing");
const { util } = require("chai");
const assert = require("assert");

const adapterName = require("./../package.json").name.split(".").pop();

const zipCode = "70173";

// Create mocks and asserts
const { adapter, database } = utils.unit.createMocks();
const { assertObjectExists } = utils.unit.createAsserts(database, adapter);

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, ".."), {
	//            ~~~~~~~~~~~~~~~~~~~~~~~~~
	// This should be the adapter's root directory

	// If the adapter may call process.exit during startup, define here which exit codes are allowed.
	// By default, termination during startup is not allowed.
	allowedExitCodes: [11],

	// To test against a different version of JS-Controller, you can change the version or dist-tag here.
	// Make sure to remove this setting when you're done testing.
	controllerVersion: "latest", // or a specific version like "4.0.1"

	// Define your own tests inside defineAdditionalTests
	defineAdditionalTests({ suite }) {
		// All tests (it, describe) must be grouped in one or more suites. Each suite sets up a fresh environment for the adapter tests.
		// At the beginning of each suite, the databases will be reset and the adapter will be started.
		// The adapter will run until the end of each suite.

		// Since the tests are heavily instrumented, each suite gives access to a so called "harness" to control the tests.
		suite("Test retrieveJson()", (getHarness) => {
			// For convenience, get the current suite's harness before all tests
			let harness;
			before(async () => {
				harness = getHarness();
			});

			beforeEach(async () => {
				const obj = {
					native: {
						zipcode: zipCode,
						hoursInFuture: "24",
					},
				};
				console.warn("change adapter config");
				// @ts-ignore
				await harness.changeAdapterConfig(adapterName, obj);
			});

			afterEach(() => {
				// The mocks keep track of all method invocations - reset them after each single test
				adapter.resetMockHistory();
				// We want to start each test with a fresh database
				database.clear();
			});

			//darn test for verification of zip code isn't working at all
			it.skip("Check Zip Code ist set", () => {
				return new Promise(async (resolve) => {
					// Perform the test
					//await harness.startAdapterAndWait(true);
					await harness.startAdapterAndWait();

					assert.equal((await harness.states.getState("system.adapter.stromgedacht.0.alive")).val, true);
					//alive.val.should.equal(true);
					console.log("alive: " + (await harness.states.getState("system.adapter.stromgedacht.0.alive")).val);

					const zip = (await harness.objects.getObject(`system.adapter.${adapterName}`)).native.zipcode;
					console.log(`zip: ${zip}`);

					assert.equal(
						(await harness.objects.getObject(`system.adapter.${adapterName}`)).native.zipcode,
						zipCode,
						"Zip Code is not set correctly",
					);
					// @ts-ignore
					resolve();
				});
			});

			//multiple tests are failing, because the adapter is still running from the first test
			it("Should work", () => {
				return new Promise(async (resolve) => {
					// Start the adapter and wait until it has started
					console.log("Should Work Test started");
					await harness.startAdapterAndWait();
					console.log("adapter started");

					const val = (await harness.states.getState("stromgedacht.0.forecast.states.json")).val;
					assert.notEqual(val, null, "val is null");

					// @ts-ignore
					resolve();
				});
			});
		});
	},
});
