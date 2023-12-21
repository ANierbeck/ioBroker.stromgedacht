const path = require("path");
const { tests, utils } = require("@iobroker/testing");
const { util } = require("chai");
const assert = require("assert");

const adapterName = require("./../package.json").name.split(".").pop();

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

		// Create mocks and asserts
		/*
		const { adapter, database } = utils.unit.createMocks();
		const { assertObjectExists } = utils.unit.createAsserts(database, adapter);
		*/

		// Since the tests are heavily instrumented, each suite gives access to a so called "harness" to control the tests.
		suite("Test retrieveJson()", (getHarness) => {
			// For convenience, get the current suite's harness before all tests
			let harness;
			before(async () => {
				harness = getHarness();

				const obj = {
					native: {
						zipcode: "76135",
						hoursInFuture: "24",
					},
				};
				await harness.changeAdapterConfig(adapterName, obj);
			});

			/*
			afterEach(() => {
				// The mocks keep track of all method invocations - reset them after each single test
				adapter.resetMockHistory();
				// We want to start each test with a fresh database
				database.clear();
			});
			*/

			it("Should work", () => {
				return new Promise(async (resolve) => {
					// Start the adapter and wait until it has started

					//log.debug("check if zipcode is configured");

					harness.databases.adapter.config.zipcode.should.equal("72135");
					log.debug("Start adapter");
					await harness.startAdapterAndWait();

					// Perform the actual test:
					harness.states.getState("stromgedacht.0.forecast.states.json").val.should.not.equal(null);
					/*
					harness.sendTo("adapter.0", "test", "message", (resp) => {
						console.dir(resp);
						resolve();
					});
					*/
				});
			}).timeout(10000);
		});
	},
});
