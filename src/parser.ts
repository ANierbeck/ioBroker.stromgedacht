/* Parsing helpers extracted from main.ts so unit tests can import them without
   loading @iobroker/adapter-core. The functions accept an "adapter-like"
   object which must provide setState/setStateAsync/addToInfluxDB/log, etc. */

interface State {
	from: string;
	to: string;
	state: number;
}

export function getOffset(from: Date): number {
	const offSetMinutes = from.getMinutes();
	const offSetSeconds = from.getSeconds();
	const offSetMilliseconds = from.getMilliseconds();
	const offSet = offSetMinutes * 60 * 1000 + offSetSeconds * 1000 + offSetMilliseconds;
	return offSet;
}

export function getTimeOffset(startDate: Date, endDate: Date): number {
	const timeDifference = endDate.getTime() - startDate.getTime();
	const hoursOffset = timeDifference / (1000 * 60 * 60);
	return hoursOffset;
}

export async function setForecastStates(
	adapter: any,
	states: State[],
	stateIdPrefix: string,
	timeseries: [Date, number][],
): Promise<void> {
	for (let i = 0; i < states.length; i++) {
		const stateId = `${stateIdPrefix}.${i}`;
		await adapter.setObjectNotExists(`${stateId}.begin`, {
			type: "state",
			common: {
				name: `Begin of ${stateIdPrefix}`,
				type: "string",
				role: "time",
				read: true,
				write: false,
			},
			native: {},
		});
		await adapter.setObjectNotExists(`${stateId}.end`, {
			type: "state",
			common: {
				name: `End of ${stateIdPrefix}`,
				type: "string",
				role: "time",
				read: true,
				write: false,
			},
			native: {},
		});
		const state = states[i];
		adapter.setState(`${stateId}.begin`, state.from.toString(), true);
		adapter.setState(`${stateId}.end`, state.to.toString(), true);
	}

	await adapter.setStateAsync(`${stateIdPrefix}.timeseries`, JSON.stringify(timeseries), true);
}

export async function parseState(adapter: any, json: any): Promise<void> {
	adapter.log?.debug?.(`Parsing state ${JSON.stringify(json)}`);
	const states: State[] = json.states;

	const supergruenStates: State[] = [];
	const supergruenTimeseries: [Date, number][] = [];
	const gruenStates: State[] = [];
	const gruenTimeseries: [Date, number][] = [];
	const gelbStates: State[] = [];
	const gelbTimeseries: [Date, number][] = [];
	const rotStates: State[] = [];
	const rotTimeseries: [Date, number][] = [];
	const timeseries: [Date, number][] = [];

	// Keep numeric enum values in-sync with main implementation
	const StateEnum = { SUPERGRUEN: -1, GRUEN: 1, ORANGE: 3, ROT: 4 };

	states.forEach((state: any) => {
		const timeDifference = getTimeOffset(new Date(state.from), new Date(state.to));
		const offSet = getOffset(new Date(state.from));

		switch (state.state) {
			case StateEnum.SUPERGRUEN:
				supergruenStates.push(state);
				for (let i = 0; i < timeDifference; i++) {
					const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
					const timeslot = new Date(newTime);
					supergruenTimeseries.push([timeslot, 1]);
					adapter.addToInfluxDB?.("forecast.state.supergruen", timeslot.getTime(), 1);
				}
				break;
			case StateEnum.GRUEN:
				gruenStates.push(state);
				for (let i = 0; i < timeDifference; i++) {
					const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
					const timeslot = new Date(newTime);
					gruenTimeseries.push([timeslot, 1]);
					adapter.addToInfluxDB?.("forecast.state.gruen", timeslot.getTime(), 1);
				}
				break;
			case StateEnum.ORANGE:
				gelbStates.push(state);
				for (let i = 0; i < timeDifference; i++) {
					const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
					const timeslot = new Date(newTime);
					gelbTimeseries.push([timeslot, 1]);
					adapter.addToInfluxDB?.("forecast.state.orange", timeslot.getTime(), 1);
				}
				break;
			case StateEnum.ROT:
				rotStates.push(state);
				for (let i = 0; i < timeDifference; i++) {
					const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
					const timeslot = new Date(newTime);
					rotTimeseries.push([timeslot, 1]);
					adapter.addToInfluxDB?.("forecast.state.red", timeslot.getTime(), 1);
				}
				break;
			default:
				break;
		}

		for (let i = 0; i < timeDifference; i++) {
			const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
			const timeslot = new Date(newTime);
			const timeslotState = state.state;
			timeseries.push([timeslot, timeslotState]);
			adapter.addToInfluxDB?.("forecast.states", timeslot.getTime(), timeslotState);
		}
	});

	adapter.log?.debug?.(`Timeseries: ${JSON.stringify(timeseries)}`);
	await adapter.setState("forecast.states.timeseries", JSON.stringify(timeseries), true);
	await setForecastStates(adapter, supergruenStates, "forecast.states.supergruen", supergruenTimeseries);
	await setForecastStates(adapter, gruenStates, "forecast.states.gruen", gruenTimeseries);
	await setForecastStates(adapter, gelbStates, "forecast.states.orange", gelbTimeseries);
	await setForecastStates(adapter, rotStates, "forecast.states.rot", rotTimeseries);
	await adapter.setState("forecast.states.lastUpdated", new Date().toString(), true);
}

export async function parseForecast(adapter: any, json: any): Promise<void> {
	// Write load, renewableEnergy and residualLoad states defensively.
	// If the API response omits a field, write an empty array so downstream
	// consumers and tests see a deterministic state rather than undefined.
	if (json.load != undefined) {
		await adapter.setState("forecast.load.json", JSON.stringify(json.load), true);
	} else {
		adapter.log?.error?.(`No load data received`);
		await adapter.setState("forecast.load.json", JSON.stringify([]), true);
	}
	await adapter.setState("forecast.load.lastUpdated", new Date().toString(), true);

	if (json.renewableEnergy != undefined) {
		await adapter.setState("forecast.renewableEnergy.json", JSON.stringify(json.renewableEnergy), true);
	} else {
		adapter.log?.warn?.(`No renewableEnergy data received — writing empty array`);
		await adapter.setState("forecast.renewableEnergy.json", JSON.stringify([]), true);
	}
	await adapter.setState("forecast.renewableEnergy.lastUpdated", new Date().toString(), true);

	if (json.residualLoad != undefined) {
		await adapter.setState("forecast.residualLoad.json", JSON.stringify(json.residualLoad), true);
	} else {
		adapter.log?.warn?.(`No residualLoad data received — writing empty array`);
		await adapter.setState("forecast.residualLoad.json", JSON.stringify([]), true);
	}
	await adapter.setState("forecast.residualLoad.lastUpdated", new Date().toString(), true);
	if (json.superGreenThreshold != undefined) {
		await adapter.setState("forecast.superGreenThreshold.json", JSON.stringify(json.superGreenThreshold), true);
		await adapter.setState("forecast.superGreenThreshold.lastUpdated", new Date().toString(), true);
	} else {
		adapter.log?.error?.(`No superGreenThreshold data received`);
	}
}
