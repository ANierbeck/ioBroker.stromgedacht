"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"), 1);
var import_axios = __toESM(require("axios"), 1);
const adapterName = require("./../package.json").name.split(".").pop();
const instanceObjects = require("./../io-package.json").instanceObjects;
var StateEnum = /* @__PURE__ */ ((StateEnum2) => {
  StateEnum2[StateEnum2["SUPERGRUEN"] = -1] = "SUPERGRUEN";
  StateEnum2[StateEnum2["GRUEN"] = 1] = "GRUEN";
  StateEnum2[StateEnum2["ORANGE"] = 2] = "ORANGE";
  StateEnum2[StateEnum2["ROT"] = 3] = "ROT";
  return StateEnum2;
})(StateEnum || {});
const stromgedachtStateApi = "https://api.stromgedacht.de/v1/statesRelative";
const stromgedachtForecastApi = "https://api.stromgedacht.de/v1/forecast";
const statePaths = [
  "forecast.states.supergruen",
  "forecast.states.gruen",
  "forecast.states.orange",
  "forecast.states.rot"
];
class Stromgedacht extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: adapterName
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info(`config zipcode: ${this.config.zipcode}`);
    if (this.config.zipcode === void 0 || this.config.zipcode === "") {
      this.log.error("No zipcode configured");
      return;
    }
    if (this.config.influxinstance) {
      this.log.info("InfluxDB logging is enabled - forecasts will be available");
    }
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
    for (const obj of instanceObjects) {
      this.log.debug(`Creating object ${obj._id}`);
      await this.setObjectNotExistsAsync(obj._id, obj);
    }
    this.requestStates().then(async (response) => {
      if (response === null) {
        this.log.error(`No response received`);
        return;
      }
      this.log.debug(`Received states for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
      this.setState("forecast.states.json", JSON.stringify(response.data), true);
      this.setState("forecast.states.hoursInFuture", this.config.hoursInFuture, true);
      this.setState("info.connection", true, true);
      return response.data;
    }).then(async (data) => this.parseState(data)).catch(async (error) => {
      this.log.error(`Error: ${error.message}`);
      this.setState("info.connection", false, true);
      if (this.terminate) {
        this.terminate(15);
      } else {
        process.exit(15);
      }
    });
    this.requestForecast().then(async (response) => {
      if (response === null) {
        this.log.error(`No response received`);
        return;
      }
      this.log.debug(`Received forecast for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
      return response.data;
    }).then(async (data) => this.parseForecast(data)).catch(async (error) => {
      this.log.error(`Error: ${error.message}`);
      await this.setState("info.connection", false, true);
      if (this.terminate) {
        this.terminate(15);
      } else {
        process.exit(15);
      }
    });
    await this.setState("info.connection", false, true);
    if (this.terminate) {
      this.terminate(15);
    } else {
      process.exit(15);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      this.setState("info.connection", false, true);
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      this.log.error(`Error during unload: ${e}`);
      callback();
    }
  }
  /**
   * Sends a request to the stromgedacht API to retrieve states based on the provided zipcode and hoursInFuture.
   * @returns A promise that resolves to an AxiosResponse object containing the API response.
   */
  async requestStates() {
    const zipcode = this.config.zipcode;
    const hoursInFuture = this.config.hoursInFuture;
    const queryParams = {
      zip: zipcode,
      hoursInFuture
    };
    return (0, import_axios.default)({
      method: "get",
      baseURL: stromgedachtStateApi,
      params: queryParams,
      timeout: 1e4,
      responseType: "json",
      validateStatus: (status) => status === 200
    }).then((response) => {
      return response;
    }).catch((error) => {
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
  async requestForecast() {
    const zipcode = this.config.zipcode;
    const daysInPast = this.config.daysInPast;
    const fromDate = /* @__PURE__ */ new Date();
    fromDate.setDate(fromDate.getDate() - daysInPast);
    const queryParams = {
      zip: zipcode,
      from: fromDate.toDateString()
    };
    return (0, import_axios.default)({
      method: "get",
      baseURL: stromgedachtForecastApi,
      params: queryParams,
      timeout: 1e4,
      responseType: "json",
      validateStatus: (status) => status === 200
    }).then((response) => {
      return response;
    }).catch((error) => {
      if (error.response) {
        this.log.error(`Error: ${error.response.status}`);
      } else if (error.request) {
        this.log.error(`Error: no data received for forecast`);
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
  async parseState(json) {
    this.log.debug(`Parsing state ${JSON.stringify(json)}`);
    const states = json.states;
    this.log.debug(`States: ${JSON.stringify(states)}`);
    const supergruenStates = [];
    const supergruenTimeseries = [];
    const gruenStates = [];
    const gruenTimeseries = [];
    const gelbStates = [];
    const gelbTimeseries = [];
    const rotStates = [];
    const rotTimeseries = [];
    const timeseries = [];
    states.forEach((state) => {
      const timeDifference = this.getTimeOffset(new Date(state.from), new Date(state.to));
      const offSet = this.getOffset(new Date(state.from));
      switch (state.state) {
        case -1 /* SUPERGRUEN */:
          supergruenStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            supergruenTimeseries.push([timeslot, 1]);
            this.addToInfluxDB("forecast.state.supergruen", timeslot.getTime(), 1);
          }
          break;
        case 1 /* GRUEN */:
          gruenStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            gruenTimeseries.push([timeslot, 1]);
            this.addToInfluxDB("forecast.state.gruen", timeslot.getTime(), 1);
          }
          break;
        case 2 /* ORANGE */:
          gelbStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            gelbTimeseries.push([timeslot, 1]);
            this.addToInfluxDB("forecast.state.orange", timeslot.getTime(), 1);
          }
          break;
        case 3 /* ROT */:
          rotStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            rotTimeseries.push([timeslot, 1]);
            this.addToInfluxDB("forecast.state.red", timeslot.getTime(), 1);
          }
          break;
        default:
          break;
      }
      for (let i = 0; i < timeDifference; i++) {
        const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
        const timeslot = new Date(newTime);
        const timeslotState = state.state;
        timeseries.push([timeslot, timeslotState]);
        this.addToInfluxDB("forecast.states", timeslot.getTime(), timeslotState);
      }
    });
    this.log.debug(`Timeseries: ${JSON.stringify(timeseries)}`);
    this.setState("forecast.states.timeseries", JSON.stringify(timeseries), true);
    this.setForecastStates(supergruenStates, "forecast.states.supergruen", supergruenTimeseries);
    this.setForecastStates(gruenStates, "forecast.states.gruen", gruenTimeseries);
    this.setForecastStates(gelbStates, "forecast.states.orange", gelbTimeseries);
    this.setForecastStates(rotStates, "forecast.states.rot", rotTimeseries);
    this.setState("forecast.states.lastUpdated", (/* @__PURE__ */ new Date()).toString(), true);
  }
  /**
   * Parses the forecast from the provided JSON object and sets the corresponding states in the system.
   * @param json - The JSON object containing the forecast.
   */
  parseForecast(json) {
    if (json.load != void 0) {
      this.setState("forecast.load.json", JSON.stringify(json.load), true);
      this.setState("forecast.load.lastUpdated", (/* @__PURE__ */ new Date()).toString(), true);
    } else {
      this.log.error(`No load data received`);
    }
    if (json.renewableEnergy != void 0) {
      this.setState("forecast.renewableEnergy.json", JSON.stringify(json.renewableEnergy), true);
      this.setState("forecast.renewableEnergy.lastUpdated", (/* @__PURE__ */ new Date()).toString(), true);
    } else {
      this.log.error(`No renewableEnergy data received`);
    }
    if (json.residualLoad != void 0) {
      this.setState("forecast.residualLoad.json", JSON.stringify(json.residualLoad), true);
      this.setState("forecast.residualLoad.lastUpdated", (/* @__PURE__ */ new Date()).toString(), true);
    } else {
      this.log.error(`No residualLoad data received`);
    }
    if (json.superGreenThreshold != void 0) {
      this.setState("forecast.superGreenThreshold.json", JSON.stringify(json.superGreenThreshold), true);
      this.setState("forecast.superGreenThreshold.lastUpdated", (/* @__PURE__ */ new Date()).toString(), true);
    } else {
      this.log.error(`No superGreenThreshold data received`);
    }
  }
  /**
   * Adds data to InfluxDB.
   * @param datapoint - The name of the datapoint where to store the data
   * @param timestamp - The timestamp of the data
   * @param value - The value of the data
   */
  async addToInfluxDB(datapoint, timestamp, value) {
    if (this.config.influxinstance) {
      let influxInstance = this.config.influxinstance;
      if (!influxInstance.startsWith("influxdb.")) {
        influxInstance = `influxdb.${influxInstance}`;
      }
      const result = await this.sendToAsync(influxInstance, "storeState", {
        id: `${this.namespace}.${datapoint}`,
        state: {
          ts: timestamp,
          val: value,
          ack: true,
          from: `system.adapter.${this.namespace}`
        }
      });
      this.log.debug(`InfluxDB result: ${JSON.stringify(result)}`);
    }
  }
  /**
   * Sets the states and corresponding objects in the ioBroker adapter.
   * @param states - The array of states to set
   * @param stateIdPrefix - The prefix for the state IDs
   * @param timeseries - The timeseries data to set
   * @returns A promise that resolves when the states and objects are set
   */
  async setForecastStates(states, stateIdPrefix, timeseries) {
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
          write: false
        },
        native: {}
      });
      await this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: `End of ${stateIdPrefix}`,
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = states[i];
      this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from.toString(), true);
      this.setState(`${stateId}.end`, state.to.toString(), true);
    }
    this.setStateAsync(`${stateIdPrefix}.timeseries`, JSON.stringify(timeseries), true);
  }
  getOffset(from) {
    const offSetMinutes = from.getMinutes();
    const offSetSeconds = from.getSeconds();
    const offSetMilliseconds = from.getMilliseconds();
    const offSet = offSetMinutes * 60 * 1e3 + offSetSeconds * 1e3 + offSetMilliseconds;
    return offSet;
  }
  getTimeOffset(startDate, endDate) {
    const timeDifference = endDate.getTime() - startDate.getTime();
    const hoursOffset = timeDifference / (1e3 * 60 * 60);
    return hoursOffset;
  }
}
if (require.main !== module) {
  module.exports = (options) => new Stromgedacht(options);
} else {
  (() => new Stromgedacht())();
}
//# sourceMappingURL=main.js.map
