/*
 * Created with @iobroker/create-adapter v2.5.0
 */
"use strict";

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import axios from "axios";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const adapterName = require("./../package.json").name.split(".").pop();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const instanceObjects = require("./../io-package.json").instanceObjects;

interface State {
	from: string;
	to: string;
	state: number;
}

enum StateEnum {
	SUPERGRUEN = -1,
	GRUEN = 1,
	GELB = 2,
	ROT = 3,
}

const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";

const statePaths = [
	"forecast.states.supergruen",
	"forecast.states.gruen",
	"forecast.states.gelb",
	"forecast.states.rot",
];

class Stromgedacht extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: adapterName,
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady(): Promise<void> {
		//schedule it to run every 2 hours
		this.log.info(`config zipcode: ${this.config.zipcode}`);

		if (this.config.zipcode === undefined || this.config.zipcode === "") {
			this.log.error("No zipcode configured");
			return;
		}

		//cleanup of old states
		this.log.debug(`removing stale states`);
		for (const path of statePaths) {
			this.log.debug(`Deleting states for ${path}`);
			await this.getChannelsOfAsync(path).then((channels) => {
				this.log.debug(`Channels to remove: ${JSON.stringify(channels)}`);
				for (const channel of channels) {
					this.log.debug(`ChannelID: ${channel._id}`);
					this.delObject(channel._id);
				}
			});
		}

		this.log.debug(`recreating states`);
		//recreate basic object structure
		for (const obj of instanceObjects) {
			this.log.debug(`Creating object ${obj._id}`);
			await this.setObjectNotExistsAsync(obj._id, obj);
		}

		await this.requestStates()
			.then(async (response) => {
				if (response === null) {
					this.log.error(`No response received`);
					return;
				}
				this.log.debug(`Received states for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
				this.setStateAsync("forecast.states.json", JSON.stringify(response.data), true);
				this.setStateAsync("forecast.states.hoursInFuture", this.config.hoursInFuture, true);
				//this.setState("info.connection", true, true);
				return response.data;
			})
			.then(async (data) => this.parseState(data))
			.catch((error) => {
				this.log.error(`Error: ${error.message}`);
				//this.setState("info.connection", false, true);
			});

		//this.setStateAsync("info.connection", false, true);
		this.terminate("Terminate done collecting data, waiting for next schedule", 11);
		return;
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			// setting connection state to false
			this.setState("info.connection", false, true);
			this.log.info("cleaned everything up...");
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Sends a request to the stromgedacht API to retrieve states based on the provided zipcode and hoursInFuture.
	 * @returns A promise that resolves to an AxiosResponse object containing the API response.
	 */
	async requestStates(): Promise<axios.AxiosResponse<any, any>> {
		const zipcode = this.config.zipcode;
		const hoursInFuture = this.config.hoursInFuture;

		const queryParams = {
			zip: zipcode,
			hoursInFuture: hoursInFuture,
		};

		return axios({
			method: "get",
			baseURL: stromgedachtApi,
			params: queryParams,
			timeout: 10000,
			responseType: "json",
			validateStatus: (status) => status === 200,
		})
			.then((response) => {
				return response;
			})
			.catch((error) => {
				if (error.response) {
					this.log.error(`Error: ${error.response.status}`);
				} else if (error.request) {
					this.log.error(`Error: no data received for time frame`);
				} else {
					this.log.error(`Error: ${error.message}`);
				}
				console.log(error.config);
				throw error;
			});
	}

	/**
	 * Parses the state from the provided JSON object and sets the corresponding states in the system.
	 * @param json - The JSON object containing the states.
	 */
	async parseState(json: any): Promise<void> {
		this.log.debug(`Parsing state ${JSON.stringify(json)}`);
		const states: State[] = json.states;
		this.log.debug(`States: ${JSON.stringify(states)}`);

		const supergruenStates: State[] = [];
		const supergruenTimeseries: [Date, number][] = [];
		const gruenStates: State[] = [];
		const gruenTimeseries: [Date, number][] = [];
		const gelbStates: State[] = [];
		const gelbTimeseries: [Date, number][] = [];
		const rotStates: State[] = [];
		const rotTimeseries: [Date, number][] = [];
		const timeseries: [Date, number][] = [];
		states.forEach((state: any) => {
			const timeDifference = this.getTimeOffset(new Date(state.from), new Date(state.to));
			const offSet = this.getOffset(new Date(state.from));

			switch (state.state) {
				case StateEnum.SUPERGRUEN: //supergruen
					supergruenStates.push(state);
					for (let i = 0; i < timeDifference; i++) {
						const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
						const timeslot = new Date(newTime);
						supergruenTimeseries.push([timeslot, 1]);
					}
					break;
				case StateEnum.GRUEN: //gruen
					gruenStates.push(state);
					for (let i = 0; i < timeDifference; i++) {
						const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
						const timeslot = new Date(newTime);
						gruenTimeseries.push([timeslot, 1]);
					}
					break;
				case StateEnum.GELB: //gelb
					gelbStates.push(state);
					for (let i = 0; i < timeDifference; i++) {
						const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
						const timeslot = new Date(newTime);
						gelbTimeseries.push([timeslot, 1]);
					}
					break;
				case StateEnum.ROT: //rot
					rotStates.push(state);
					for (let i = 0; i < timeDifference; i++) {
						const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1000 - offSet;
						const timeslot = new Date(newTime);
						rotTimeseries.push([timeslot, 1]);
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
			}
		});

		this.log.debug(`Timeseries: ${JSON.stringify(timeseries)}`);
		this.setStateAsync("forecast.states.timeseries", JSON.stringify(timeseries), true);
		this.setStates(supergruenStates, "forecast.states.supergruen", supergruenTimeseries);
		this.setStates(gruenStates, "forecast.states.gruen", gruenTimeseries);
		this.setStates(gelbStates, "forecast.states.gelb", gelbTimeseries);
		this.setStates(rotStates, "forecast.states.rot", rotTimeseries);
		this.setStateAsync("forecast.states.lastUpdated", new Date().toString(), true);
	}

	/**
	 * Sets the states and corresponding objects in the ioBroker adapter.
	 * @param states - The array of states to set
	 * @param stateIdPrefix - The prefix for the state IDs
	 * @param timeseries - The timeseries data to set
	 * @returns A promise that resolves when the states and objects are set
	 */
	private async setStates(states: State[], stateIdPrefix: string, timeseries: [Date, number][]): Promise<void> {
		for (let i = 0; i < states.length; i++) {
			const stateId = `${stateIdPrefix}.${i}`;
			this.log.debug(`state ${stateId}`);
			await this.setObjectNotExists(`${stateId}.begin`, {
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
			await this.setObjectNotExists(`${stateId}.end`, {
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
			this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
			this.setState(`${stateId}.begin`, state.from.toString(), true);
			this.setState(`${stateId}.end`, state.to.toString(), true);
		}

		this.setStateAsync(`${stateIdPrefix}.timeseries`, JSON.stringify(timeseries), true);
	}

	private getOffset(from: Date): number {
		const offSetMinutes = from.getMinutes();
		const offSetSeconds = from.getSeconds();
		const offSetMilliseconds = from.getMilliseconds();
		const offSet = offSetMinutes * 60 * 1000 + offSetSeconds * 1000 + offSetMilliseconds;
		return offSet;
	}

	private getTimeOffset(startDate: Date, endDate: Date): number {
		// Calculate the time difference in milliseconds
		const timeDifference = endDate.getTime() - startDate.getTime();

		// Convert the time difference to hours
		const hoursOffset = timeDifference / (1000 * 60 * 60);

		return hoursOffset;
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Stromgedacht(options);
} else {
	// otherwise start the instance directly
	(() => new Stromgedacht())();
}
