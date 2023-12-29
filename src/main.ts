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

const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";

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
		this.log.debug(`Deleting states`);
		await this.getStatesOfAsync("stromgedacht.0.forecast", "")
			.then((states) => {
				this.log.debug(`States: ${JSON.stringify(states)}`);
				for (const state of states) {
					this.log.debug(`Deleting state ${state._id}`);
					this.delObject(state._id);
				}
				return;
			})
			.catch((error) => {
				this.log.error(`Could not get states: ${error.message}`);
				return;
			});

		this.log.debug(`recreating states`);
		//recreate basic object structure
		for (const obj of instanceObjects) {
			this.log.debug(`Creating object ${obj._id}`);
			this.setObjectNotExistsAsync(obj._id, obj);
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
				//this.setStateAsync("info.connection", true, true);
				return response.data;
			})
			.then(async (data) => this.parseState(data))
			.catch((error) => {
				this.log.error(`Error: ${error.message}`);
				this.setState("info.connection", false, true);
			});
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
		let stateId = "";
		const supergruenStates: State[] = [];
		const gruenStates: State[] = [];
		const gelbStates: State[] = [];
		const rotStates: State[] = [];
		states.forEach((state: any) => {
			switch (state.state) {
				case -1: //supergruen
					supergruenStates.push(state);
					break;
				case 1: //gruen
					gruenStates.push(state);
					break;
				case 2: //gelb
					gelbStates.push(state);
					break;
				case 3: //rot
					rotStates.push(state);
					break;
				default:
					break;
			}
		});

		for (let i = 0; i < supergruenStates.length; i++) {
			stateId = `forecast.states.supergruen.${i}`;
			this.log.debug(`state ${stateId}`);
			this.setObjectNotExists(`${stateId}.begin`, {
				type: "state",
				common: {
					name: "Begin of supergruen",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			this.setObjectNotExists(`${stateId}.end`, {
				type: "state",
				common: {
					name: "End of supergruen",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			const state = supergruenStates[i];
			this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
			this.setState(`${stateId}.begin`, state.from, true);
			this.setState(`${stateId}.end`, state.to, true);
		}
		for (let i = 0; i < gruenStates.length; i++) {
			stateId = `forecast.states.gruen.${i}`;
			this.log.debug(`state ${stateId}`);
			this.setObjectNotExists(`${stateId}.begin`, {
				type: "state",
				common: {
					name: "Begin of gruen",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			this.setObjectNotExists(`${stateId}.end`, {
				type: "state",
				common: {
					name: "End of gruen",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			const state = gruenStates[i];
			this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
			this.setState(`${stateId}.begin`, state.from, true);
			this.setState(`${stateId}.end`, state.to, true);
		}
		for (let i = 0; i < gelbStates.length; i++) {
			stateId = `forecast.states.gelb.${i}`;
			this.log.debug(`state ${stateId}`);
			this.setObjectNotExists(`${stateId}.begin`, {
				type: "state",
				common: {
					name: "Begin of gelb",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			this.setObjectNotExists(`${stateId}.end`, {
				type: "state",
				common: {
					name: "End of gelb",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			const state = gelbStates[i];
			this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
			this.setState(`${stateId}.begin`, state.from, true);
			this.setState(`${stateId}.end`, state.to, true);
		}
		for (let i = 0; i < rotStates.length; i++) {
			stateId = `forecast.states.rot.${i}`;
			this.log.debug(`state ${stateId}`);
			this.setObjectNotExists(`${stateId}.begin`, {
				type: "state",
				common: {
					name: "Begin of rot",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			this.setObjectNotExists(`${stateId}.end`, {
				type: "state",
				common: {
					name: "End of rot",
					type: "string",
					role: "time",
					read: true,
					write: false,
				},
				native: {},
			});
			const state = rotStates[i];
			this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
			this.setStateAsync(`${stateId}.begin`, state.from, true);
			this.setStateAsync(`${stateId}.end`, state.to, true);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Stromgedacht(options);
} else {
	// otherwise start the instance directly
	(() => new Stromgedacht())();
}
