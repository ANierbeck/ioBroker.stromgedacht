const path = require("path");
const { tests, utils } = require("@iobroker/testing");
const { util } = require("chai");
const assert = require("assert");

const adapterName = require("./../package.json").name.split(".").pop();

const zipCode = "70173";

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
						daysInPast: "1",
					},
				};
				console.warn("change adapter config");
				// @ts-ignore
				await harness.changeAdapterConfig(adapterName, obj);
			});

			it("Should work", () => {
				return new Promise(async (resolve) => {
					// Start the adapter and wait until it has started
					console.log("Should Work Test started");
					await harness.startAdapterAndWait(true);
					console.log("adapter started");

					harness.states.getState("stromgedacht.0.forecast.states.json", (err, state) => {
						if (err) {
							console.error(err);
						}
						console.log("state: " + state.val);
						assert.notEqual(state.val, null, "state is null");
						resolve();
					});
				});
			});
		});
	},
});
