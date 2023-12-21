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

		this.setState("info.connection", false, true);

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady(): Promise<void> {
		try {
			const instObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
			if (
				instObj &&
				instObj.common &&
				instObj.common.schedule &&
				(instObj.common.schedule === "11 * * * *" || instObj.common.schedule === "*/15 * * * *")
			) {
				instObj.common.schedule = `${Math.floor(Math.random() * 60)} * * * *`;
				this.log.info(`Default schedule found and adjusted to spread calls better over the full hour!`);
				await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, instObj);
				this.terminate ? this.terminate() : process.exit(0);
				return;
			}
		} catch (err: any) {
			this.log.error(`Could not check or adjust the schedule: ${err.message}`);
		}

		for (const obj of instanceObjects) {
			await this.setObjectNotExistsAsync(obj._id, obj);
		}

		//schedule it to run every 15 minutes
		this.log.info(`config zipcode: ${this.config.zipcode}`);

		this.setState("info.connection", false, true);

		if (this.config.zipcode === undefined || this.config.zipcode === "") {
			this.log.error("No zipcode configured");
			return;
		}

		this.getStatesOf("states", "", async (err, states: any) => {
			if (err) {
				this.log.error(`Could not get states of states: ${err.message}`);
				return;
			}
			for (const state of states) {
				this.log.info(`Deleting state ${state._id}`);
				await this.delObjectAsync(state._id);
			}
		});

		this.requestStates()
			.then(async (response) => {
				if (response === null) {
					this.log.error(`No response received`);
					return;
				}
				this.log.info(`Received states for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
				this.setState("forecast.states.json", JSON.stringify(response.data), true);
				this.setState("forecast.states.hoursInFuture", this.config.hoursInFuture, true);
				this.setState("info.connection", true, true);
				return response.data;
			})
			.then((data) => this.parseState(data))
			.catch((error) => {
				this.log.error(`Error: ${error.message}`);
				this.setState("info.connection", true, true);
			});
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

			callback();
		} catch (e) {
			callback();
		}
	}

	requestStates(): Promise<any> {
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
					this.log.error(`Error: no data received for Current Weather data`);
				} else {
					this.log.error(`Error: ${error.message}`);
				}
				console.log(error.config);
				throw error;
			});
	}

	parseState(json: any): void {
		this.log.info(`Parsing state ${JSON.stringify(json)}`);
		let states: State[] = [];
		//Object.assign(states, json.states);
		states = json.states;
		this.log.debug(`States: ${JSON.stringify(states)}`);
		let stateId = "";
		states.forEach((state: any) => {
			switch (state.state) {
				case -1: //supergruen
					stateId = "forecast.states.supergruen";
					this.log.info(`state ${stateId}`);
					break;
				case 1: //gruen
					stateId = "forecast.states.gruen";
					this.log.info(`state ${stateId}`);
					break;
				case 2: //gelb
					stateId = "forecast.states.gelb";
					this.log.info(`state ${stateId}`);
					break;
				case 3: //rot
					stateId = "forecast.states.rot";
					this.log.info(`state ${stateId}`);
					break;
				default:
					break;
			}
			this.log.info(`Setting state ${stateId}.begin to ${state.from}`);
			this.setState(stateId + ".begin", state.from, true);
			this.log.info(`Setting state ${stateId}.end to ${state.to}`);
			this.setState(stateId + ".end", state.to, true);
		});
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Stromgedacht(options);
} else {
	// otherwise start the instance directly
	(() => new Stromgedacht())();
}
