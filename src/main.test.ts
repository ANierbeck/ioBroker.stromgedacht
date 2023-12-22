/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.ts-files
 */

// import { functionToTest } from "./moduleToTest";
import axios from "axios";
import { expect } from "chai";
//import Stromgedacht from "./main";

const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";
const sampleStateJSON =
	'{"states":[{"from":"2023-12-21T09:53:32.9424377+01:00","to":"2023-12-21T23:00:00+01:00","state":1},{"from":"2023-12-21T23:00:00+01:00","to":"2023-12-22T00:00:00+01:00","state":-1},{"from":"2023-12-22T00:00:00+01:00","to":"2023-12-22T09:53:32.9424378+01:00","state":1}]}';

describe("stromgedacht api => call", () => {
	it("should return a valid response", async () => {
		const queryParams = {
			zip: "72135",
			hoursInFuture: 24,
		};
		axios({
			method: "get",
			baseURL: stromgedachtApi,
			params: queryParams,
			timeout: 10000,
			responseType: "json",
			validateStatus: (status) => status === 200,
		}).then((response) => {
			expect(response.status).to.equal(200);
		});
	});
});

describe("parse JSON => states", () => {
	it("should return a valid response", async () => {
		const json = JSON.parse(sampleStateJSON);
		expect(json.states).to.be.an("array");
	});
});

describe("parse JSON => checkStates", () => {
	it("should return a valid response", async () => {
		const json = JSON.parse(sampleStateJSON);
		json.states.forEach((state: any) => {
			expect(state.state).to.be.a("number");
		});
	});
});

/**
 * unfortunately I was not able to test the Stromgedacht class
 */
describe("main to test => requestStates to test", () => {
	it(`should return a response`, () => {
		/*
		requestStates().to.be.a("function");
		expect(requestStates()).to.be.a("function");
		expect(requestStates()).to.be.a("promise");
		expect(requestStates()).to.be.fulfilled;
		*/
	});
	// ... more tests => it
});

// ... more test suites => describe
