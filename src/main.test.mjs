import axios from "axios";
import { expect } from "chai";

const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";
const stromgedachtForecastApi = "https://api.stromgedacht.de/v1/forecast";

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

describe("stromgedacht forecast => call", () => {
	it("should return a valid response", async () => {
		const fromDate = new Date();
		fromDate.setDate(fromDate.getDate() - 1);
		const queryParams = {
			zip: "72135",
			from: fromDate.toDateString(),
		};
		axios({
			method: "get",
			baseURL: stromgedachtForecastApi,
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
		expect(json).to.be.an("object");
		const states = json.states;
		expect(states).to.be.an("array");
	});
});

describe("parse JSON => checkStates", () => {
	it("should return a valid response", async () => {
		const json = JSON.parse(sampleStateJSON);
		json.states.forEach((state) => {
			expect(state.state).to.be.a("number");
		});
	});
});

describe("parse JSON => create Timeseries", () => {
	it("should generate a valid timeseries", async () => {
		const json = JSON.parse(sampleStateJSON);
		const timeseries = [];

		const state = json.states[0];

		expect(state.from).to.be.a("string");
		expect(state.to).to.be.a("string");
		const from = (state.from = new Date(state.from));
		const to = (state.to = new Date(state.to));
		const duration = new Date(to.getTime() - from.getTime()).getHours();
		expect(duration).to.be.equal(14);
		const fromHour = from.getHours();
		expect(fromHour).to.be.equal(9);
		const toHour = to.getHours();
		expect(toHour).to.be.equal(23);

		for (let i = 0; i < duration; i++) {
			const offSet = getOffset(from);
			const newTime = from.getTime() + i * 60 * 60 * 1000 - offSet;
			const timeslot = new Date(newTime);
			const timeslotHour = timeslot.getHours();
			expect(timeslotHour).to.be.equal(9 + i);
			const timeslotState = state.state;
			expect(timeslotState).to.be.equal(1);
		}

		json.states.forEach((state) => {
			const from = (state.from = new Date(state.from));
			const to = (state.to = new Date(state.to));
			const timeDifference = getTimeOffset(from, to);
			const offSet = getOffset(from);

			for (let i = 0; i < timeDifference; i++) {
				const newTime = from.getTime() + i * 60 * 60 * 1000 - offSet;
				const timeslot = new Date(newTime);
				const timeslotState = state.state;
				timeseries.push([timeslot, timeslotState]);
			}
		});

		expect(timeseries).to.be.an("array");
		expect(timeseries).to.have.lengthOf(25);
	});
});

function getTimeOffset(startDate, endDate) {
	// Calculate the time difference in milliseconds
	const timeDifference = endDate.getTime() - startDate.getTime();

	// Convert the time difference to hours
	const hoursOffset = timeDifference / (1000 * 60 * 60);

	return hoursOffset;
}

function getOffset(from) {
	const offSetMinutes = from.getMinutes();
	const offSetSeconds = from.getSeconds();
	const offSetMilliseconds = from.getMilliseconds();
	const offSet = offSetMinutes * 60 * 1000 + offSetSeconds * 1000 + offSetMilliseconds;
	return offSet;
}
