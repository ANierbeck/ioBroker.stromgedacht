const path = require("path");
const { tests, utils } = require("@iobroker/testing");
const { util } = require("chai");
const assert = require("assert");

const adapterName = require("./../package.json").name.split(".").pop();

const zipCode = "70173";

// Create mocks and asserts
//const { adapter, database } = utils.unit.createMocks();
//const { assertObjectExists } = utils.unit.createAsserts(database, adapter);

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

				const obj = {
					native: {
						zipcode: zipCode,
						hoursInFuture: "24",
					},
				};
				console.warn("change adapter config");
				//await harness.changeAdapterConfig(adapterName, obj);
				await harness.states.setState("stromgedacht.0.config.zipcode", { val: zipCode, ack: true });
			});

			/*
			afterEach(() => {
				// The mocks keep track of all method invocations - reset them after each single test
				adapter.resetMockHistory();
				// We want to start each test with a fresh database
				database.clear();
			});
			*/

			it("Check Zip Code ist set", () => {
				return new Promise(async (resolve) => {
					// Perform the test
					await harness.startAdapterAndWait();
					await harness.states.getState("stromgedacht.0.config.zipcode").val.should.equal(zipCode);
					database.hasState(adapterName + ".0.config.zipcode").should.equal(true);
					//await harness.databases.adapter.config.zipcode.should.equal(zipCode);
					resolve();
				});
			}).timeout(6000);

			it("Should work", () => {
				return new Promise(async (resolve) => {
					// Start the adapter and wait until it has started
					await harness.startAdapterAndWait();

					// Perform the actual test:
					await harness.states.getState("stromgedacht.0.forecast.states.json").val.should.not.equal(null);
					/*
					harness.sendTo("adapter.0", "test", "message", (resp) => {
						console.dir(resp);
						resolve();
					});
					*/
					resolve();
				});
			}).timeout(6000);
		});
	},
});
